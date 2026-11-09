<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { networkSubLabel } from '@/core/graph/build'
import type { NetworkNodeData } from '@/core/graph/build'
import { networkColor } from './format'

const props = defineProps<{ data: NetworkNodeData }>()
const color = computed(() => networkColor(props.data.colorIndex))
const sub = computed(() => networkSubLabel(props.data.network))
const title = computed(() => {
  const n = props.data.network
  return `Network ${n.name}${n.subnets.length ? ' · ' + n.subnets.join(', ') : ''}${
    n.declared || n.isDefault ? '' : ' (tidak dideklarasikan)'
  }`
})
</script>

<template>
  <div
    class="net"
    :class="{ undeclared: !data.network.declared && !data.network.isDefault }"
    :style="{ '--c': color }"
    :title="title"
  >
    <Handle id="out" type="source" :position="Position.Bottom" :connectable="false" />
    <span class="dot" />
    <span class="name">{{ data.network.name }}</span>
    <span v-if="sub" class="sub mono">{{ sub }}</span>
  </div>
</template>

<style scoped>
.net {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  box-sizing: border-box;
  padding: 0 14px 0 11px;
  border-radius: 16px;
  border: 1.4px solid var(--c);
  background: color-mix(in srgb, var(--c) 13%, var(--surface));
  cursor: pointer;
  white-space: nowrap;
  color: var(--ink);
  font-family: var(--font-ui);
}
:global(.vue-flow__node.sel) .net {
  border-width: 2.4px;
}
.undeclared {
  border: 1.4px dashed var(--err);
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c);
  flex: none;
}
.name {
  font-size: 12px;
  font-weight: 600;
}
.sub {
  font-size: 10.5px;
  color: var(--muted);
}
</style>
