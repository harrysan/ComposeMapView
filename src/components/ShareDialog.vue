<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useCompose } from '@/composables/useCompose'
import { buildShareUrl, MAX_SAFE_LINK_LENGTH } from '@/composables/useShareLink'
import { t } from '@/i18n'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const store = useCompose()
const dialog = ref<HTMLDialogElement | null>(null)
const input = ref<HTMLInputElement | null>(null)
const confirmedSecrets = ref(false)
const copyState = ref<'idle' | 'copied' | 'failed'>('idle')

const secretCount = computed(() => store.issues.value.filter((i) => i.ruleId === 'SEC001').length)
const needsConfirm = computed(() => secretCount.value > 0 && !confirmedSecrets.value)
const isEmpty = computed(() => store.text.value.trim() === '')

const url = computed(() =>
  isEmpty.value || typeof window === 'undefined'
    ? ''
    : buildShareUrl(store.text.value, window.location),
)
const tooLong = computed(() => url.value.length > MAX_SAFE_LINK_LENGTH)

watch(
  () => props.open,
  async (open) => {
    if (!dialog.value) return
    if (open) {
      confirmedSecrets.value = false
      copyState.value = 'idle'
      if (!dialog.value.open) dialog.value.showModal?.()
      await nextTick()
      input.value?.select()
    } else if (dialog.value.open) {
      dialog.value.close()
    }
  },
)

async function copy() {
  try {
    await navigator.clipboard.writeText(url.value)
    copyState.value = 'copied'
    // Perbarui URL halaman juga, supaya tombol "kembali"/reload tetap di diagram yang sama.
    history.replaceState(null, '', url.value)
  } catch {
    copyState.value = 'failed'
    input.value?.select()
  }
}

async function confirmSecrets() {
  confirmedSecrets.value = true
  await nextTick()
  input.value?.select()
}
</script>

<template>
  <dialog
    ref="dialog"
    class="dialog"
    aria-labelledby="share-title"
    @close="emit('close')"
    @cancel="emit('close')"
  >
    <h2 id="share-title">{{ t('share.title') }}</h2>
    <p class="desc">{{ t('share.desc') }}</p>

    <p v-if="isEmpty" class="note">{{ t('share.empty') }}</p>

    <template v-else-if="needsConfirm">
      <p class="warn" role="alert">
        <span aria-hidden="true">▲</span> {{ t('share.secrets', { n: secretCount }) }}
      </p>
      <div class="actions">
        <button class="btn" @click="emit('close')">{{ t('share.close') }}</button>
        <button class="btn primary" @click="confirmSecrets">{{ t('share.secretsConfirm') }}</button>
      </div>
    </template>

    <template v-else>
      <p v-if="secretCount" class="warn">
        <span aria-hidden="true">▲</span> {{ t('share.secrets', { n: secretCount }) }}
      </p>
      <div class="link-row">
        <input
          ref="input"
          class="link mono"
          :value="url"
          readonly
          aria-label="URL"
          @focus="input?.select()"
        />
        <button class="btn primary" @click="copy">
          {{ copyState === 'copied' ? t('share.copied') : t('share.copy') }}
        </button>
      </div>
      <p class="meta">
        {{ t('share.length', { n: url.length.toLocaleString() }) }}
      </p>
      <p v-if="tooLong" class="warn">
        <span aria-hidden="true">▲</span>
        {{ t('share.tooLong', { max: MAX_SAFE_LINK_LENGTH.toLocaleString() }) }}
      </p>
      <p v-if="copyState === 'failed'" class="warn" role="alert">{{ t('share.copyFailed') }}</p>
      <div class="actions">
        <button class="btn" @click="emit('close')">{{ t('share.close') }}</button>
      </div>
    </template>
  </dialog>
</template>

<style scoped>
.dialog {
  margin: auto;
  width: min(560px, calc(100vw - 32px));
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 20px;
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
}
.dialog::backdrop {
  background: rgba(10, 16, 26, 0.45);
}
h2 {
  margin: 0 0 6px;
  font-size: 17px;
  font-weight: 600;
}
.desc,
.meta,
.note {
  color: var(--muted);
  font-size: 13px;
  margin: 0 0 12px;
}
.warn {
  font-size: 13px;
  margin: 0 0 12px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--warn);
  background: color-mix(in srgb, var(--warn) 10%, var(--surface));
}
.warn span {
  color: var(--warn);
}
.link-row {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
}
.link {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 10px;
  border-radius: 7px;
  border: 1px solid var(--line);
  background: var(--surface-2);
  font-size: 12px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--surface);
}
.primary:hover {
  filter: brightness(1.08);
}
</style>
