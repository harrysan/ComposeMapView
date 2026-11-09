<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DetailPanel from '@/components/DetailPanel.vue'
import DiagramView from '@/components/DiagramView.vue'
import IssueList from '@/components/IssueList.vue'
import ShareDialog from '@/components/ShareDialog.vue'
import YamlEditor from '@/components/YamlEditor.vue'
import { useCompose } from '@/composables/useCompose'
import { readShareHash } from '@/composables/useShareLink'
import { cycleTheme, theme, usePersistentFlag } from '@/composables/useTheme'
import { useToast } from '@/composables/useToast'
import { examples } from '@/examples'
import { LOCALES, locale, t } from '@/i18n'
import type { MessageKey } from '@/i18n'

const MAX_FILE_BYTES = 2 * 1024 * 1024

const store = useCompose()
const { toasts, show: toast, dismiss } = useToast()

const exampleId = ref(examples[0]!.id)
const fileName = ref<string | null>(null)
const editorCollapsed = usePersistentFlag('editorCollapsed')
const detailCollapsed = usePersistentFlag('detailCollapsed')
const issuesCollapsed = usePersistentFlag('issuesCollapsed')
const shareOpen = ref(false)

type Tab = 'editor' | 'diagram' | 'issues'
const TABS: { id: Tab; key: MessageKey }[] = [
  { id: 'editor', key: 'tabs.editor' },
  { id: 'diagram', key: 'tabs.diagram' },
  { id: 'issues', key: 'tabs.issues' },
]
/** Tab aktif; hanya berpengaruh di layar sempit (< 900px, SPEC §9). */
const tab = ref<Tab>('diagram')

// Di layar sempit, klik issue langsung memperlihatkan node yang disorot di tab Diagram.
watch(
  () => store.activeIssue.value,
  (i) => {
    if (i !== null && window.matchMedia?.('(max-width: 899px)').matches) tab.value = 'diagram'
  },
)

function loadExample(id: string) {
  const ex = examples.find((e) => e.id === id)
  if (!ex) return
  exampleId.value = id
  fileName.value = null
  store.loadText(ex.yaml, true)
  // Contoh bawaan tidak perlu disimpan di URL.
  if (location.hash) history.replaceState(null, '', location.pathname + location.search)
}

function onExampleChange(e: Event) {
  const id = (e.target as HTMLSelectElement).value
  if (id !== 'custom') loadExample(id)
}

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.ceil(bytes / 1024)} KB`
}

async function openFile(file: File) {
  if (file.size > MAX_FILE_BYTES) {
    toast(
      t('load.fileTooLarge', {
        name: file.name,
        size: formatSize(file.size),
        max: formatSize(MAX_FILE_BYTES),
      }),
      'error',
    )
    return
  }
  const text = await file.text()
  if (text.includes('\u0000')) {
    toast(t('load.fileNotText', { name: file.name }), 'error')
    return
  }
  fileName.value = file.name
  exampleId.value = 'custom'
  store.loadText(text)
  tab.value = 'diagram'
}

function onFileInput(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) void openFile(file)
  input.value = ''
}

/** Buka YAML dari `#c=...`. Mengembalikan true bila hash berisi link share. */
function loadFromHash(): boolean {
  const res = readShareHash(location.hash)
  if (res.status === 'none') return false
  if (res.status === 'broken') {
    toast(t('load.sharedBroken'), 'error', 10000)
    return false
  }
  fileName.value = null
  exampleId.value = 'custom'
  store.loadText(res.text, true)
  return true
}

function onHashChange() {
  loadFromHash()
}

const stats = computed(() => {
  const m = store.model.value
  return m
    ? { services: m.services.length, networks: m.networks.length, volumes: m.volumes.length }
    : null
})

const themeLabel = computed(() => t(`theme.${theme.value}`))
const themeIcon = computed(() => ({ system: '◐', light: '☀', dark: '☾' })[theme.value])

onMounted(() => {
  if (!loadFromHash()) loadExample(exampleId.value)
  window.addEventListener('hashchange', onHashChange)
})
onBeforeUnmount(() => window.removeEventListener('hashchange', onHashChange))
</script>

<template>
  <div class="app">
    <header class="top">
      <div class="brand">
        <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
          <rect x="1" y="1" width="24" height="24" rx="6" fill="var(--accent)" />
          <circle cx="8" cy="9" r="2.6" fill="var(--surface)" />
          <circle cx="18" cy="9" r="2.6" fill="var(--surface)" />
          <circle cx="13" cy="18" r="2.6" fill="var(--surface)" />
          <path d="M8 9 L13 18 L18 9" stroke="var(--surface)" stroke-width="1.6" fill="none" />
        </svg>
        <h1>ComposeMapView</h1>
        <span class="tag">{{ t('app.tagline') }}</span>
      </div>
      <div class="actions">
        <label class="lbl" for="example">{{ t('header.examples') }}</label>
        <select id="example" class="select" :value="exampleId" @change="onExampleChange">
          <option v-for="ex in examples" :key="ex.id" :value="ex.id">{{ t(ex.labelKey) }}</option>
          <option v-if="exampleId === 'custom'" value="custom">
            {{ fileName ?? 'docker-compose.yml' }}
          </option>
        </select>
        <label class="btn" for="file">
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M8 11V2M4.5 5.5 8 2l3.5 3.5M2 11v3h12v-3"
              stroke="currentColor"
              stroke-width="1.5"
              fill="none"
            />
          </svg>
          {{ t('header.openFile') }}
        </label>
        <input
          id="file"
          type="file"
          accept=".yml,.yaml,text/yaml,text/plain"
          hidden
          @change="onFileInput"
        />
        <button class="btn" @click="shareOpen = true">
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="4" cy="8" r="2" fill="none" stroke="currentColor" stroke-width="1.5" />
            <circle cx="12" cy="3.5" r="2" fill="none" stroke="currentColor" stroke-width="1.5" />
            <circle cx="12" cy="12.5" r="2" fill="none" stroke="currentColor" stroke-width="1.5" />
            <path d="M5.8 7 10.2 4.5M5.8 9l4.4 2.5" stroke="currentColor" stroke-width="1.5" />
          </svg>
          {{ t('header.share') }}
        </button>
        <div class="seg" role="group" :aria-label="t('header.language')">
          <button
            v-for="l in LOCALES"
            :key="l"
            :aria-pressed="locale === l"
            :lang="l"
            @click="locale = l"
          >
            {{ l.toUpperCase() }}
          </button>
        </div>
        <button
          class="btn icon"
          :title="`${t('header.theme')}: ${themeLabel}`"
          :aria-label="`${t('header.theme')}: ${themeLabel}`"
          @click="cycleTheme"
        >
          <span aria-hidden="true">{{ themeIcon }}</span>
        </button>
        <span class="local" :title="t('header.localTitle')">
          <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
            <rect
              x="3"
              y="7"
              width="10"
              height="7"
              rx="1.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            />
          </svg>
          {{ t('header.local') }}
        </span>
      </div>
    </header>

    <nav class="tabs" role="tablist" :aria-label="t('tabs.label')">
      <button
        v-for="tb in TABS"
        :key="tb.id"
        role="tab"
        :aria-selected="tab === tb.id"
        @click="tab = tb.id"
      >
        {{ t(tb.key) }}
        <b v-if="tb.id === 'issues' && store.issues.value.length" class="badge">{{
          store.issues.value.length
        }}</b>
      </button>
    </nav>

    <main
      class="layout"
      :class="{ collapsed: editorCollapsed, 'issues-collapsed': issuesCollapsed }"
      :data-tab="tab"
    >
      <section
        v-show="!editorCollapsed || tab === 'editor'"
        class="pane editor-pane"
        :aria-label="t('editor.label')"
      >
        <div class="pane-head">
          <span class="title mono">{{ fileName ?? 'docker-compose.yml' }}</span>
          <span class="spacer" />
          <span class="chip">
            <span :class="store.valid.value ? 'sev-info' : 'sev-error'" aria-hidden="true">●</span>
            {{ store.valid.value ? t('editor.valid') : t('editor.invalid') }}
          </span>
          <button
            class="icon-btn desktop-only"
            :title="t('editor.collapse')"
            :aria-label="t('editor.collapse')"
            @click="editorCollapsed = true"
          >
            «
          </button>
        </div>
        <YamlEditor />
      </section>

      <section class="pane diagram-pane" :aria-label="t('diagram.title')">
        <div class="pane-head">
          <button
            v-if="editorCollapsed"
            class="icon-btn desktop-only"
            :title="t('editor.expand')"
            :aria-label="t('editor.expand')"
            @click="editorCollapsed = false"
          >
            »
          </button>
          <span class="title">{{ t('diagram.title') }}</span>
          <template v-if="stats">
            <span class="chip"
              ><b>{{ stats.services }}</b> {{ t('diagram.services') }}</span
            >
            <span class="chip"
              ><b>{{ stats.networks }}</b> {{ t('diagram.networks') }}</span
            >
            <span class="chip"
              ><b>{{ stats.volumes }}</b> {{ t('diagram.volumes') }}</span
            >
          </template>
          <span class="spacer" />
          <label class="chip toggle"
            ><input v-model="store.showPorts.value" type="checkbox" />
            {{ t('diagram.ports') }}</label
          >
          <label class="chip toggle"
            ><input v-model="store.showVolumes.value" type="checkbox" />
            {{ t('diagram.volumeToggle') }}</label
          >
          <button
            class="icon-btn"
            :title="detailCollapsed ? t('diagram.detailExpand') : t('diagram.detailCollapse')"
            :aria-label="detailCollapsed ? t('diagram.detailExpand') : t('diagram.detailCollapse')"
            :aria-expanded="!detailCollapsed"
            aria-controls="detail-panel"
            @click="detailCollapsed = !detailCollapsed"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <rect
                x="1.5"
                y="2.5"
                width="13"
                height="11"
                rx="2"
                fill="none"
                stroke="currentColor"
                stroke-width="1.4"
              />
              <path d="M10 3v10" stroke="currentColor" stroke-width="1.4" />
              <path
                :d="detailCollapsed ? 'M6.5 6 4.5 8l2 2' : 'M4.5 6l2 2-2 2'"
                fill="none"
                stroke="currentColor"
                stroke-width="1.4"
              />
            </svg>
          </button>
        </div>
        <div class="diagram-body">
          <DiagramView @file="openFile" @example="loadExample(examples[0]!.id)" />
          <DetailPanel v-show="!detailCollapsed" id="detail-panel" />
        </div>
      </section>

      <IssueList
        class="issues-pane"
        :collapsed="issuesCollapsed"
        @toggle="issuesCollapsed = !issuesCollapsed"
      />
    </main>

    <ShareDialog :open="shareOpen" @close="shareOpen = false" />

    <div class="toasts" aria-live="polite">
      <div v-for="ts in toasts" :key="ts.id" class="toast" :class="ts.kind" role="status">
        <span>{{ ts.text }}</span>
        <button :aria-label="t('toast.dismiss')" @click="dismiss(ts.id)">×</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.top {
  display: flex;
  align-items: center;
  gap: 12px 20px;
  flex-wrap: wrap;
  padding: 10px 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--line);
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-right: auto;
}
.brand h1 {
  font-size: 17px;
  font-weight: 600;
  margin: 0;
  letter-spacing: -0.01em;
}
.brand .tag {
  color: var(--muted);
  font-size: 13px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.lbl {
  color: var(--muted);
  font-size: 13px;
}
.btn.icon {
  width: 32px;
  padding: 0;
  justify-content: center;
}
.seg {
  display: inline-flex;
  border: 1px solid var(--line);
  border-radius: 7px;
  overflow: hidden;
  height: 32px;
}
.seg button {
  border: 0;
  background: var(--surface-2);
  padding: 0 9px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  color: var(--muted);
}
.seg button + button {
  border-left: 1px solid var(--line);
}
.seg button[aria-pressed='true'] {
  background: var(--accent-soft);
  color: var(--accent);
}
.local {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--muted);
  padding: 4px 10px;
  border: 1px dashed var(--line);
  border-radius: 999px;
}
.tabs {
  display: none;
}
.layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(300px, 30%) 1fr;
  grid-template-rows: 1fr 230px;
  gap: 1px;
  background: var(--line);
}
.layout.issues-collapsed {
  grid-template-rows: 1fr auto;
}
.layout.collapsed {
  grid-template-columns: 1fr;
}
.pane {
  background: var(--surface);
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.editor-pane {
  grid-row: 1 / 3;
}
.diagram-body {
  flex: 1;
  min-height: 0;
  display: flex;
}
.icon-btn {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid var(--line);
  background: var(--surface-2);
  cursor: pointer;
  line-height: 1;
  display: inline-grid;
  place-items: center;
  padding: 0;
}
.icon-btn:hover {
  border-color: var(--accent);
}
.toggle {
  cursor: pointer;
}
.toasts {
  position: fixed;
  right: 16px;
  bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 50;
  max-width: min(420px, calc(100vw - 32px));
}
.toast {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15);
  font-size: 13px;
}
.toast.error {
  border-color: var(--err);
}
.toast button {
  margin-left: auto;
  border: 0;
  background: none;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  color: var(--muted);
}

/* Layar sempit: editor, diagram, dan daftar masalah menjadi tab (SPEC §9). */
@media (max-width: 899px) {
  .brand .tag,
  .local,
  .lbl {
    display: none;
  }
  .tabs {
    display: flex;
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }
  .tabs button {
    flex: 1;
    height: 40px;
    border: 0;
    border-bottom: 2px solid transparent;
    background: none;
    font-size: 13px;
    font-weight: 600;
    color: var(--muted);
    cursor: pointer;
  }
  .tabs button[aria-selected='true'] {
    color: var(--ink);
    border-bottom-color: var(--accent);
  }
  .badge {
    margin-left: 4px;
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 9px;
    background: var(--surface-2);
    border: 1px solid var(--line);
  }
  .layout,
  .layout.collapsed,
  .layout.issues-collapsed {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
  }
  .editor-pane {
    grid-row: auto;
  }
  .layout > * {
    display: none !important;
  }
  .layout[data-tab='editor'] > .editor-pane,
  .layout[data-tab='diagram'] > .diagram-pane,
  .layout[data-tab='issues'] > .issues-pane {
    display: flex !important;
  }
  .desktop-only {
    display: none;
  }
  .diagram-body {
    flex-direction: column;
  }
  .diagram-body > :first-child {
    min-height: 360px;
  }
  .diagram-body :deep(.detail) {
    width: auto;
    max-height: 40%;
    border-left: 0;
    border-top: 1px solid var(--line);
  }
}
</style>
