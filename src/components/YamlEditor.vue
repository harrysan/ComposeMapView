<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { basicSetup } from 'codemirror'
import { yaml } from '@codemirror/lang-yaml'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { lintGutter, setDiagnostics } from '@codemirror/lint'
import type { Diagnostic } from '@codemirror/lint'
import { EditorState, StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView, MatchDecorator, ViewPlugin } from '@codemirror/view'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import { useCompose } from '@/composables/useCompose'
import { locale, t as tr } from '@/i18n'

const store = useCompose()
const host = ref<HTMLDivElement | null>(null)
let view: EditorView | null = null

const highlight = HighlightStyle.define([
  { tag: [t.propertyName, t.definition(t.propertyName)], color: 'var(--syn-key)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--syn-str)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--syn-num)' },
  { tag: t.comment, color: 'var(--muted)', fontStyle: 'italic' },
  { tag: [t.punctuation, t.separator, t.meta], color: 'var(--muted)' },
  { tag: [t.keyword, t.labelName], color: 'var(--syn-key)' },
])

// Sorot variabel ${VAR} / $VAR di mana pun.
const varMark = Decoration.mark({ class: 'cm-var' })
const varMatcher = new MatchDecorator({
  regexp: /\$\{[^}\n]*\}|\$[A-Za-z_][A-Za-z0-9_]*/g,
  decoration: () => varMark,
})
const varHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(v: EditorView) {
      this.decorations = varMatcher.createDeco(v)
    }
    update(u: ViewUpdate) {
      this.decorations = varMatcher.updateDeco(u, this.decorations)
    }
  },
  { decorations: (v) => v.decorations },
)

// Sorotan baris saat lompat dari issue / panel detail.
const setFlash = StateEffect.define<{ from: number; to: number } | null>()
const flashLine = Decoration.line({ class: 'cm-flash' })
const flashField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    if (tr.docChanged) return Decoration.none
    for (const e of tr.effects) {
      if (!e.is(setFlash)) continue
      if (!e.value) return Decoration.none
      const ranges = []
      for (let pos = e.value.from; pos <= e.value.to;) {
        const line = tr.state.doc.lineAt(pos)
        ranges.push(flashLine.range(line.from))
        pos = line.to + 1
      }
      return Decoration.set(ranges)
    }
    return deco
  },
  provide: (f) => EditorView.decorations.from(f),
})

const theme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'var(--surface-2)',
    color: 'var(--ink)',
    fontSize: '13px',
  },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '20px' },
  '.cm-content': { caretColor: 'var(--ink)', padding: '12px 0' },
  '.cm-gutters': {
    backgroundColor: 'var(--surface-2)',
    color: 'var(--muted)',
    borderRight: '1px solid var(--line)',
  },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'transparent' },
  '&.cm-focused .cm-activeLine': { backgroundColor: 'var(--accent-soft)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--accent-soft) !important',
  },
  '.cm-cursor': { borderLeftColor: 'var(--ink)' },
  '.cm-flash': { backgroundColor: 'var(--accent-soft)', boxShadow: 'inset 3px 0 0 var(--accent)' },
  '.cm-var': { color: 'var(--syn-var)', fontWeight: '500' },
  '.cm-tooltip': {
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--line)',
    color: 'var(--ink)',
  },
  '.cm-diagnostic-error': { borderLeftColor: 'var(--err)' },
  '.cm-diagnostic-warning': { borderLeftColor: 'var(--warn)' },
  '.cm-diagnostic-info': { borderLeftColor: 'var(--info)' },
  '.cm-lint-marker': { width: '0.8em', height: '0.8em' },
  '.cm-foldGutter span': { color: 'var(--muted)' },
})

function toDiagnostics(state: EditorState): Diagnostic[] {
  const doc = state.doc
  const out: Diagnostic[] = []
  for (const issue of store.issues.value) {
    if (!issue.source) continue
    const start = Math.min(Math.max(issue.source.startLine, 1), doc.lines)
    const end = Math.min(Math.max(issue.source.endLine, start), doc.lines)
    out.push({
      from: doc.line(start).from,
      to: doc.line(end).to,
      severity: issue.severity,
      source: issue.ruleId,
      message: issue.message + (issue.hint ? `\n${issue.hint}` : ''),
    })
  }
  return out
}

function syncDiagnostics() {
  if (view) view.dispatch(setDiagnostics(view.state, toDiagnostics(view.state)))
}

onMounted(() => {
  view = new EditorView({
    parent: host.value!,
    state: EditorState.create({
      doc: store.text.value,
      extensions: [
        basicSetup,
        yaml(),
        syntaxHighlighting(highlight),
        varHighlighter,
        flashField,
        lintGutter(),
        theme,
        EditorState.tabSize.of(2),
        EditorView.contentAttributes.of({ 'aria-label': tr('editor.aria') }),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) store.text.value = u.state.doc.toString()
        }),
      ],
    }),
  })
  syncDiagnostics()
})

onBeforeUnmount(() => view?.destroy())

// Isi diganti dari luar (contoh, upload file).
watch(store.text, (value) => {
  if (!view || view.state.doc.toString() === value) return
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
  view.scrollDOM.scrollTop = 0
})

watch(store.issues, syncDiagnostics)

watch(locale, () => view?.contentDOM.setAttribute('aria-label', tr('editor.aria')))

watch(store.jump, (j) => {
  if (!view || !j) return
  const doc = view.state.doc
  const line = doc.line(Math.min(Math.max(j.line, 1), doc.lines))
  view.dispatch({
    selection: { anchor: line.from },
    effects: [
      setFlash.of({ from: line.from, to: line.to }),
      EditorView.scrollIntoView(line.from, { y: 'center' }),
    ],
  })
})

defineExpose({ focus: () => view?.focus() })
</script>

<template>
  <div ref="host" class="editor" />
</template>

<style scoped>
.editor {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.editor :deep(.cm-editor) {
  height: 100%;
}
.editor :deep(.cm-editor.cm-focused) {
  outline: none;
}
</style>
