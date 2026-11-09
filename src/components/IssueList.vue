<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Severity } from '@/core/rules'
import { useCompose } from '@/composables/useCompose'
import type { IssueFilter } from '@/composables/useCompose'
import { t } from '@/i18n'
import SeverityIcon from './SeverityIcon.vue'

defineProps<{ collapsed?: boolean }>()
const emit = defineEmits<{ toggle: [] }>()

const store = useCompose()
const list = ref<HTMLUListElement | null>(null)

const filters = computed<{ id: IssueFilter; label: string; count: number }[]>(() => [
  { id: 'all', label: t('issues.all'), count: store.issues.value.length },
  { id: 'error', label: t('severity.error'), count: store.counts.value.error },
  { id: 'warning', label: t('severity.warning'), count: store.counts.value.warning },
  { id: 'info', label: t('severity.info'), count: store.counts.value.info },
])

const visible = computed(() =>
  store.issues.value
    .map((issue, index) => ({ issue, index }))
    .filter(({ issue }) => store.filter.value === 'all' || issue.severity === store.filter.value),
)

/** Panah atas/bawah berpindah antar issue (SPEC §14). */
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
  const buttons = [...(list.value?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
  const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
  const next =
    buttons[e.key === 'ArrowDown' ? Math.min(i + 1, buttons.length - 1) : Math.max(i - 1, 0)]
  if (next) {
    e.preventDefault()
    next.focus()
  }
}
</script>

<template>
  <section class="pane" :aria-label="t('issues.title')">
    <div class="pane-head">
      <span class="title">{{ t('issues.title') }}</span>
      <div class="filters" role="group" :aria-label="t('issues.filter')">
        <button
          v-for="f in filters"
          :key="f.id"
          :aria-pressed="store.filter.value === f.id"
          @click="store.filter.value = f.id"
        >
          <SeverityIcon v-if="f.id !== 'all'" :severity="f.id as Severity" />
          {{ f.label }} <b>{{ f.count }}</b>
        </button>
      </div>
      <span class="spacer" />
      <button
        class="collapse-btn"
        :title="collapsed ? t('issues.expand') : t('issues.collapse')"
        :aria-label="collapsed ? t('issues.expand') : t('issues.collapse')"
        :aria-expanded="!collapsed"
        aria-controls="issue-list"
        @click="emit('toggle')"
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
          <path d="M2 10h12" stroke="currentColor" stroke-width="1.4" />
          <path
            :d="collapsed ? 'M6 7.5 8 5.5l2 2' : 'M6 5.5l2 2 2-2'"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
          />
        </svg>
      </button>
    </div>
    <ul v-show="!collapsed" id="issue-list" ref="list" class="issues" @keydown="onKeydown">
      <li v-if="store.empty.value" class="all-clear muted">{{ t('issues.empty') }}</li>
      <li v-else-if="!store.issues.value.length" class="all-clear">{{ t('issues.allClear') }}</li>
      <li v-else-if="!visible.length" class="all-clear muted">
        {{ t('issues.noneForFilter') }}
      </li>
      <li v-for="{ issue, index } in visible" :key="index">
        <button
          :class="{ active: store.activeIssue.value === index }"
          @click="store.activateIssue(index)"
        >
          <SeverityIcon :severity="issue.severity" />
          <span class="rule mono">{{ issue.ruleId }}</span>
          <span class="msg"
            >{{ issue.message }}<span v-if="issue.hint" class="hint">{{ issue.hint }}</span></span
          >
          <span class="ln mono">{{
            issue.source ? t('issues.line', { line: issue.source.startLine }) : ''
          }}</span>
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.pane {
  background: var(--surface);
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.collapse-btn {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid var(--line);
  background: var(--surface-2);
  cursor: pointer;
  display: inline-grid;
  place-items: center;
  padding: 0;
}
.collapse-btn:hover {
  border-color: var(--accent);
}
/* Di layar sempit daftar masalah sudah menjadi tab sendiri. */
@media (max-width: 899px) {
  .collapse-btn {
    display: none;
  }
  .issues {
    display: block !important;
  }
}
.filters {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.filters button {
  height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--surface-2);
  cursor: pointer;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-variant-numeric: tabular-nums;
}
.filters button[aria-pressed='true'] {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.issues {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  overflow: auto;
  flex: 1;
}
.issues li button {
  width: 100%;
  display: grid;
  grid-template-columns: 18px 64px 1fr auto;
  gap: 10px;
  align-items: baseline;
  padding: 7px 14px;
  border: 0;
  background: none;
  text-align: left;
  cursor: pointer;
  border-left: 3px solid transparent;
}
.issues li button:hover {
  background: var(--surface-2);
}
.issues li button.active {
  background: var(--accent-soft);
  border-left-color: var(--accent);
}
.rule {
  font-size: 11.5px;
  font-weight: 500;
  color: var(--muted);
}
.msg {
  font-size: 13px;
}
.hint {
  display: block;
  font-size: 12px;
  color: var(--muted);
  margin-top: 1px;
}
.ln {
  font-size: 11.5px;
  color: var(--muted);
  white-space: nowrap;
}
.all-clear {
  padding: 18px 14px;
  color: var(--info);
  font-size: 13px;
}
.all-clear.muted {
  color: var(--muted);
}
@media (max-width: 520px) {
  .issues li button {
    grid-template-columns: 16px 1fr auto;
  }
  .rule {
    display: none;
  }
}
</style>
