<script setup lang="ts">
import type { Severity } from '@/core/rules'
import { t } from '@/i18n'

defineProps<{ severity: Severity }>()

// Severity tidak hanya dibedakan dengan warna (SPEC §14): ● error, ▲ warning, ℹ info.
const ICON: Record<Severity, string> = { error: '●', warning: '▲', info: 'ℹ' }
</script>

<template>
  <span class="sev" :class="`sev-${severity}`" role="img" :aria-label="t(`severity.${severity}`)">{{
    ICON[severity]
  }}</span>
</template>

<style scoped>
.sev {
  display: inline-block;
  width: 14px;
  flex: none;
  text-align: center;
  font-size: 12px;
}
</style>
