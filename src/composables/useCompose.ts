import { computed, effectScope, ref, shallowRef, watch } from 'vue'
import { buildGraph, issueKeys, neighbors, serviceKey } from '@/core/graph/build'
import type { ComposeModel } from '@/core/model'
import { parseCompose } from '@/core/normalize'
import type { ParseError } from '@/core/parser'
import { parseErrorToIssue, relocalize, runRules } from '@/core/rules'
import { locale } from '@/i18n'
import type { Issue, Severity } from '@/core/rules'

export const DEBOUNCE_MS = 300

export type IssueFilter = 'all' | Severity

/**
 * State utama aplikasi: yaml → model → issues → graph.
 * Dibuat sekali (singleton) supaya semua komponen berbagi state yang sama.
 */
function createComposeStore() {
  const text = ref('')
  /** Model valid terakhir. Tetap dipertahankan saat YAML sedang tidak valid (SPEC §14). */
  const model = shallowRef<ComposeModel | null>(null)
  const issues = shallowRef<Issue[]>([])
  /** Hasil linter untuk model valid terakhir; dipakai diagram supaya badge tidak hilang saat YAML rusak. */
  const modelIssues = shallowRef<Issue[]>([])
  const valid = ref(true)
  /** Editor kosong (atau hanya komentar): bukan error, tampilkan empty state. */
  const empty = ref(true)
  const parseErrors = shallowRef<ParseError[]>([])

  const selected = ref<string | null>(null)
  const focus = shallowRef<Set<string> | null>(null)
  const hoverFocus = shallowRef<Set<string> | null>(null)
  const activeIssue = ref<number | null>(null)
  const filter = ref<IssueFilter>('all')
  const showPorts = ref(true)
  const showVolumes = ref(true)
  /** Permintaan lompat ke baris editor; `nonce` memaksa lompat ulang ke baris yang sama. */
  const jump = ref<{ line: number; nonce: number } | null>(null)

  const graph = computed(() =>
    model.value
      ? buildGraph(model.value, modelIssues.value, {
          showPorts: showPorts.value,
          showVolumes: showVolumes.value,
        })
      : null,
  )

  const counts = computed(() => {
    const c: Record<Severity, number> = { error: 0, warning: 0, info: 0 }
    for (const i of issues.value) c[i.severity]++
    return c
  })

  /** Diagram menampilkan versi lama karena YAML saat ini tidak valid. */
  const stale = computed(() => !valid.value && model.value !== null)

  function keyExists(key: string): boolean {
    const m = model.value
    if (!m) return false
    const name = key.slice(2)
    if (key.startsWith('s:')) return m.services.some((s) => s.name === name)
    if (key.startsWith('n:')) return m.networks.some((n) => n.name === name)
    return graph.value?.nodes.some((n) => n.id === key) ?? false
  }

  let analyzedText: string | null = null

  function analyze() {
    analyzedText = text.value
    const result = parseCompose(text.value)
    parseErrors.value = result.errors
    activeIssue.value = null
    const toIssue = (e: ParseError) => parseErrorToIssue(e, locale.value)
    if (!result.model) {
      empty.value = result.errors.length === 0
      if (empty.value) {
        // Teks kosong: kosongkan diagram, bukan "YAML tidak valid".
        valid.value = true
        model.value = null
        modelIssues.value = []
        issues.value = []
        selected.value = null
        focus.value = null
        return
      }
      valid.value = false
      issues.value = result.errors.map(toIssue)
      return
    }
    empty.value = false
    valid.value = true
    model.value = result.model
    modelIssues.value = runRules(result.model, { locale: locale.value })
    // Error non-fatal dari parser (mis. beberapa dokumen) tetap ditampilkan.
    issues.value = [...result.errors.map(toIssue), ...modelIssues.value]
    if (selected.value && !keyExists(selected.value)) selected.value = null
    focus.value = null
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  watch(text, (value) => {
    // Sudah dianalisis (mis. lewat loadText): tidak perlu dijadwalkan ulang.
    if (value === analyzedText) return
    clearTimeout(timer)
    timer = setTimeout(analyze, DEBOUNCE_MS)
  })

  // Ganti bahasa: cukup rakit ulang teks pesan, tanpa menjalankan ulang aturan.
  watch(locale, (l) => {
    issues.value = issues.value.map((i) => relocalize(i, l))
    modelIssues.value = modelIssues.value.map((i) => relocalize(i, l))
  })

  /** Ganti seluruh isi editor dan analisis langsung (tanpa debounce). */
  function loadText(value: string, selectWorst = false) {
    clearTimeout(timer)
    text.value = value.replace(/\r\n/g, '\n')
    selected.value = null
    focus.value = null
    jump.value = null
    analyze()
    if (selectWorst && model.value) {
      // Pilih service dengan masalah terbanyak supaya panel detail langsung berisi.
      let best: string | null = null
      let bestCount = 0
      for (const s of model.value.services) {
        const key = serviceKey(s.name)
        const n = issues.value.filter((i) => issueKeys(i).includes(key)).length
        if (n > bestCount) {
          best = key
          bestCount = n
        }
      }
      selected.value = best
    }
  }

  function selectKey(key: string, withFocus = true) {
    selected.value = key
    focus.value = withFocus && model.value ? neighbors(model.value, key) : null
    activeIssue.value = null
  }

  function clearSelection() {
    selected.value = null
    focus.value = null
    activeIssue.value = null
  }

  function gotoLine(line: number) {
    jump.value = { line, nonce: (jump.value?.nonce ?? 0) + 1 }
  }

  function activateIssue(index: number) {
    const issue = issues.value[index]
    if (!issue) return
    const keys = issueKeys(issue)
    activeIssue.value = index
    focus.value = keys.length ? new Set(keys) : null
    selected.value = keys.find((k) => k.startsWith('s:')) ?? keys[0] ?? null
    if (issue.source) gotoLine(issue.source.startLine)
  }

  function hoverKey(key: string | null) {
    hoverFocus.value = key && model.value ? neighbors(model.value, key) : null
  }

  return {
    text,
    model,
    issues,
    valid,
    empty,
    stale,
    parseErrors,
    graph,
    counts,
    selected,
    focus,
    hoverFocus,
    activeIssue,
    filter,
    showPorts,
    showVolumes,
    jump,
    analyze,
    loadText,
    selectKey,
    clearSelection,
    gotoLine,
    activateIssue,
    hoverKey,
  }
}

export type ComposeStore = ReturnType<typeof createComposeStore>

let store: ComposeStore | null = null

export function useCompose(): ComposeStore {
  // Scope terlepas: watcher store tidak ikut berhenti saat komponen pertama yang memanggilnya di-unmount.
  store ??= effectScope(true).run(createComposeStore)!
  return store
}

/** Untuk test: buat store baru yang terpisah. */
export function createStoreForTest(): ComposeStore {
  return createComposeStore()
}
