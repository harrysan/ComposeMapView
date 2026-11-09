<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { ServiceNodeData } from '@/core/graph/build'
import type { PortMapping } from '@/core/model'
import { formatPort } from './format'

const props = defineProps<{ data: ServiceNodeData; showPorts: boolean }>()

const MAX_PORTS = 3

const imageLabel = computed(() => {
  const s = props.data.service
  if (s.image) return s.image.raw
  if (s.build) return `build: ${s.build.context}`
  return 'tanpa image'
})

const ports = computed(() =>
  props.data.service.ports.slice(0, MAX_PORTS).map((p: PortMapping, i: number) => ({
    label: formatPort(p),
    state: props.data.portStates[i] ?? 'ok',
  })),
)
const morePorts = computed(() => Math.max(0, props.data.service.ports.length - MAX_PORTS))
</script>

<template>
  <div
    class="svc"
    :class="data.severity ? `has-${data.severity}` : ''"
    :title="`${data.service.name} · ${imageLabel}`"
  >
    <Handle id="net" type="target" :position="Position.Top" :connectable="false" />
    <Handle id="dep-in" type="target" :position="Position.Left" :connectable="false" />
    <Handle id="dep-out" type="source" :position="Position.Right" :connectable="false" />
    <Handle id="vol" type="source" :position="Position.Bottom" :connectable="false" />

    <span v-if="data.severity" class="stripe" :class="`bg-${data.severity}`" aria-hidden="true" />
    <div class="head">
      <span class="name">{{ data.service.name }}</span>
      <span v-for="tag in data.tags" :key="tag" class="tag">{{ tag }}</span>
      <span
        v-if="data.issueCount"
        class="count"
        :class="`bg-${data.severity}`"
        :aria-label="`${data.issueCount} masalah`"
        >{{ data.issueCount }}</span
      >
    </div>
    <div class="img mono">{{ imageLabel }}</div>
    <div v-if="showPorts && data.service.ports.length" class="ports">
      <span v-for="(p, i) in ports" :key="i" class="port mono" :class="p.state">{{ p.label }}</span>
      <span v-if="morePorts" class="port mono">+{{ morePorts }}</span>
    </div>
  </div>
</template>

<style scoped>
.svc {
  position: relative;
  width: 210px;
  height: 100%;
  box-sizing: border-box;
  padding: 10px 12px 8px 16px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  cursor: pointer;
  font-family: var(--font-ui);
  color: var(--ink);
  transition: opacity 0.15s;
}
.svc:hover {
  border-color: var(--muted);
}
:global(.vue-flow__node.sel) .svc {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}
.stripe {
  position: absolute;
  left: 0;
  top: 10px;
  bottom: 10px;
  width: 3.5px;
  border-radius: 2px;
}
.bg-error {
  background: var(--err);
}
.bg-warning {
  background: var(--warn);
}
.bg-info {
  background: var(--info);
}
.head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.name {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: auto;
  min-width: 0;
}
.tag {
  flex: none;
  height: 18px;
  padding: 0 6px;
  border-radius: 4px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  font: 500 10px/16px var(--font-mono);
  color: var(--muted);
}
.count {
  flex: none;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  text-align: center;
  font-size: 10.5px;
  font-weight: 600;
  line-height: 18px;
  color: var(--surface);
}
.img {
  margin-top: 2px;
  font-size: 11px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ports {
  display: flex;
  gap: 5px;
  margin-top: 8px;
  overflow: hidden;
}
.port {
  flex: none;
  height: 20px;
  padding: 0 6px;
  border-radius: 4px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  font-size: 10.5px;
  line-height: 18px;
  white-space: nowrap;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.port.conflict {
  border-color: var(--err);
  color: var(--err);
  background: transparent;
}
.port.risky {
  border-color: var(--warn);
}
</style>
