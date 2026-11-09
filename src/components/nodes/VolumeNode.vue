<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import type { VolumeNodeData } from '@/core/graph/build'

defineProps<{ data: VolumeNodeData; width: number }>()
</script>

<template>
  <div
    class="vol"
    :class="{ undeclared: !data.declared }"
    :style="{ width: `${width}px` }"
    :title="`Volume ${data.name}${data.declared ? '' : ' (tidak dideklarasikan)'}`"
  >
    <Handle id="in" type="target" :position="Position.Top" :connectable="false" />
    <svg :width="width" height="44" :viewBox="`0 0 ${width} 44`" aria-hidden="true">
      <path
        class="body"
        :d="`M1,7 a${width / 2 - 1},6 0 0,0 ${width - 2},0 v30 a${width / 2 - 1},6 0 0,1 ${-(width - 2)},0 z`"
      />
      <ellipse class="top" :cx="width / 2" cy="7" :rx="width / 2 - 1" ry="6" />
    </svg>
    <span class="name mono">{{ data.name }}</span>
  </div>
</template>

<style scoped>
.vol {
  position: relative;
  height: 44px;
  cursor: pointer;
}
svg {
  position: absolute;
  inset: 0;
  overflow: visible;
}
.body,
.top {
  fill: var(--surface);
  stroke: var(--muted);
  stroke-width: 1.2;
}
:global(.vue-flow__node.sel) .body,
:global(.vue-flow__node.sel) .top {
  stroke-width: 2.4;
  stroke: var(--accent);
}
.undeclared .body,
.undeclared .top {
  stroke: var(--err);
  stroke-dasharray: 4 3;
}
.name {
  position: absolute;
  left: 8px;
  right: 8px;
  top: 17px;
  text-align: center;
  font-size: 11px;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
