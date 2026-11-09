<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { MarkerType, VueFlow, useVueFlow } from '@vue-flow/core'
import type { Edge, Node, NodeDragEvent, NodeMouseEvent } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { structureSignature } from '@/core/graph/build'
import type {
  GraphEdge,
  NetworkNodeData,
  NodeData,
  ServiceNodeData,
  VolumeNodeData,
} from '@/core/graph/build'
import type { Positions } from '@/core/graph/layout'
import { useCompose } from '@/composables/useCompose'
import { t } from '@/i18n'
import ServiceNode from './nodes/ServiceNode.vue'
import NetworkNode from './nodes/NetworkNode.vue'
import VolumeNode from './nodes/VolumeNode.vue'
import { networkColor } from './nodes/format'

const emit = defineEmits<{ file: [file: File]; example: [] }>()

const FLOW_ID = 'compose-diagram'
const store = useCompose()
const { fitView, onNodesInitialized } = useVueFlow(FLOW_ID)

const positions = shallowRef<Positions>({})
const signature = ref('')
let layoutToken = 0

function fit() {
  void fitView({ padding: 0.12, maxZoom: 1.15, duration: 0 })
}

// Layout dihitung ulang hanya bila struktur berubah, bukan setiap ketikan (SPEC §8.2).
watch(
  () => store.graph.value,
  async (graph) => {
    if (!graph) return
    const sig = structureSignature(graph)
    if (sig === signature.value) return
    signature.value = sig
    const token = ++layoutToken
    // elkjs cukup besar (~1,5 MB); dimuat terpisah supaya halaman tampil lebih dulu.
    const { layoutGraph } = await import('@/core/graph/layout')
    const pos = await layoutGraph(graph)
    if (token !== layoutToken) return
    positions.value = pos
    await nextTick()
    requestAnimationFrame(fit)
  },
  { immediate: true },
)

onNodesInitialized(fit)

// Panel editor/detail/masalah diciutkan atau dibuka → ukuran kanvas berubah → pas-kan ulang.
const canvas = ref<HTMLDivElement | null>(null)
let resizeObserver: ResizeObserver | null = null
let resizeFrame = 0
let lastSize = ''
onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || !canvas.value) return
  resizeObserver = new ResizeObserver(([entry]) => {
    const size = entry
      ? `${Math.round(entry.contentRect.width)}x${Math.round(entry.contentRect.height)}`
      : ''
    if (size === lastSize) return
    const first = lastSize === ''
    lastSize = size
    if (first) return // ukuran awal: sudah ditangani onNodesInitialized
    cancelAnimationFrame(resizeFrame)
    resizeFrame = requestAnimationFrame(fit)
  })
  resizeObserver.observe(canvas.value)
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  cancelAnimationFrame(resizeFrame)
})

function widthOf(id: string): number {
  return store.graph.value?.nodes.find((n) => n.id === id)?.width ?? 96
}

const activeFocus = computed(() => store.hoverFocus.value ?? store.focus.value)

const nodes = computed<Node<NodeData>[]>(() => {
  const graph = store.graph.value
  if (!graph) return []
  const focus = activeFocus.value
  const sel = store.selected.value
  return graph.nodes
    .filter((n) => positions.value[n.id])
    .map((n) => ({
      id: n.id,
      type: n.data.kind,
      position: positions.value[n.id]!,
      data: n.data,
      width: n.width,
      height: n.height,
      connectable: false,
      class: [focus && !focus.has(n.id) ? 'dim' : '', sel === n.id ? 'sel' : ''].join(' '),
      ariaLabel: `${n.data.kind === 'service' ? 'Service' : n.data.kind === 'network' ? 'Network' : 'Volume'} ${n.id.slice(2)}`,
    }))
})

function edgeStyle(e: GraphEdge, hot: boolean) {
  if (e.kind === 'network') {
    return {
      stroke: networkColor(e.colorIndex ?? 0),
      strokeWidth: hot ? 2.4 : 1.6,
      opacity: hot ? 1 : 0.55,
    }
  }
  if (e.kind === 'volume') {
    return { stroke: 'var(--muted)', strokeWidth: hot ? 2.4 : 1.2, opacity: hot ? 1 : 0.55 }
  }
  const color = e.cycle ? 'var(--err)' : hot ? 'var(--accent)' : 'var(--muted)'
  return { stroke: color, strokeWidth: hot ? 2.4 : 1.6, strokeDasharray: '6 4' }
}

const edges = computed<Edge[]>(() => {
  const graph = store.graph.value
  if (!graph) return []
  const focus = activeFocus.value
  const sel = store.selected.value
  const placed = positions.value
  // Edge hanya dikirim bila kedua node sudah punya posisi; kalau tidak, Vue Flow membuangnya.
  return graph.edges
    .filter((e) => placed[e.source] && placed[e.target])
    .map((e) => {
      const hot = !!sel && (e.source === sel || e.target === sel)
      const dim = !!focus && !(focus.has(e.source) && focus.has(e.target))
      const handles =
        e.kind === 'network'
          ? { sourceHandle: 'out', targetHandle: 'net' }
          : e.kind === 'volume'
            ? { sourceHandle: 'vol', targetHandle: 'in' }
            : { sourceHandle: 'dep-out', targetHandle: 'dep-in' }
      const markerColor = e.cycle ? 'var(--err)' : hot ? 'var(--accent)' : 'var(--muted)'
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        ...handles,
        type: 'default',
        class: [`e-${e.kind}`, dim ? 'dim' : '', hot ? 'hot' : ''].join(' '),
        style: edgeStyle(e, hot),
        markerEnd:
          e.kind === 'depends'
            ? { type: MarkerType.ArrowClosed, color: markerColor, width: 16, height: 16 }
            : undefined,
        label: e.label,
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 9,
        labelBgStyle: { fill: 'var(--surface)', stroke: 'var(--line)' },
        labelStyle: { fill: 'var(--muted)', font: '500 10px var(--font-mono)' },
        focusable: false,
        selectable: false,
      }
    })
})

function onNodeClick({ node }: NodeMouseEvent) {
  store.selectKey(node.id)
}
function onNodeEnter({ node }: NodeMouseEvent) {
  if (node.type === 'network') store.hoverKey(node.id)
}
function onNodeLeave({ node }: NodeMouseEvent) {
  if (node.type === 'network') store.hoverKey(null)
}
function onDragStop({ node }: NodeDragEvent) {
  // Simpan posisi manual supaya tidak kembali saat sorotan berubah. Tidak disimpan permanen (SPEC §8.2).
  positions.value = { ...positions.value, [node.id]: { ...node.position } }
}

const dragging = ref(false)
function onDrop(e: DragEvent) {
  dragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file) emit('file', file)
}

/** Pesan empty state yang ramah, atau null bila diagram punya isi. */
const emptyMessage = computed(() => {
  if (store.empty.value) return t('empty.noText')
  if (!store.model.value) return t('empty.invalidFirst')
  if (store.model.value.services.length === 0) return t('empty.noServices')
  return null
})

defineExpose({ fit })
</script>

<template>
  <div
    ref="canvas"
    class="canvas"
    :class="{ dragging }"
    @dragover.prevent="dragging = true"
    @dragleave="dragging = false"
    @drop.prevent="onDrop"
  >
    <VueFlow
      :id="FLOW_ID"
      :nodes="nodes"
      :edges="edges"
      :nodes-connectable="false"
      :elements-selectable="false"
      :min-zoom="0.25"
      :max-zoom="2.5"
      :zoom-on-double-click="false"
      :aria-label="t('diagram.aria')"
      @node-click="onNodeClick"
      @node-mouse-enter="onNodeEnter"
      @node-mouse-leave="onNodeLeave"
      @node-drag-stop="onDragStop"
      @pane-click="store.clearSelection()"
    >
      <template #node-service="p">
        <ServiceNode :data="p.data as ServiceNodeData" :show-ports="store.showPorts.value" />
      </template>
      <template #node-network="p">
        <NetworkNode :data="p.data as NetworkNodeData" />
      </template>
      <template #node-volume="p">
        <VolumeNode :data="p.data as VolumeNodeData" :width="widthOf(p.id)" />
      </template>
      <Background pattern-color="var(--dot)" :gap="20" :size="1.2" />
      <Controls :show-interactive="false" position="top-right" />
    </VueFlow>

    <div v-if="store.stale.value" class="banner" role="status">
      {{
        t('diagram.stale', {
          line: store.parseErrors.value[0]
            ? t('diagram.staleLine', { line: store.parseErrors.value[0].line })
            : '',
        })
      }}
    </div>
    <div v-if="emptyMessage" class="empty">
      <div class="empty-card">
        <svg width="40" height="40" viewBox="0 0 26 26" aria-hidden="true">
          <rect x="1" y="1" width="24" height="24" rx="6" fill="none" stroke="var(--line)" />
          <circle cx="8" cy="9" r="2.6" fill="var(--muted)" />
          <circle cx="18" cy="9" r="2.6" fill="var(--muted)" />
          <circle cx="13" cy="18" r="2.6" fill="var(--muted)" />
          <path d="M8 9 L13 18 L18 9" stroke="var(--muted)" stroke-width="1.4" fill="none" />
        </svg>
        <h2>{{ t('empty.title') }}</h2>
        <p>{{ emptyMessage }}</p>
        <button v-if="store.empty.value || !store.model.value" class="btn" @click="emit('example')">
          {{ t('empty.tryExample') }}
        </button>
      </div>
    </div>
    <div v-if="dragging" class="drop-hint" aria-hidden="true">{{ t('diagram.dropHere') }}</div>
    <div class="legend" aria-hidden="true">
      <span
        ><svg width="22" height="8"><path d="M1 4h20" stroke="var(--n1)" stroke-width="2" /></svg
        >{{ t('diagram.legendNetwork') }}</span
      >
      <span
        ><svg width="24" height="8">
          <path d="M1 4h16" stroke="var(--muted)" stroke-width="1.6" stroke-dasharray="5 3" />
          <path d="M16 0 L23 4 L16 8z" fill="var(--muted)" /></svg
        >depends_on</span
      >
      <span
        ><svg width="14" height="14">
          <path
            d="M1 3 a6 2.4 0 0 0 12 0 v8 a6 2.4 0 0 1 -12 0z"
            fill="none"
            stroke="var(--muted)"
          />
          <ellipse cx="7" cy="3" rx="6" ry="2.4" fill="none" stroke="var(--muted)" /></svg
        >{{ t('diagram.legendVolume') }}</span
      >
      <span class="hint">{{ t('diagram.legendHint') }}</span>
    </div>
  </div>
</template>

<style scoped>
.canvas {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  background: var(--canvas);
}
.canvas.dragging {
  box-shadow: inset 0 0 0 2px var(--accent);
}
.canvas :deep(.vue-flow__node) {
  transition: opacity 0.15s;
  border: 0;
  padding: 0;
  background: transparent;
}
.canvas :deep(.vue-flow__node.dim),
.canvas :deep(.vue-flow__edge.dim) {
  opacity: 0.14;
}
.canvas :deep(.vue-flow__edge) {
  transition: opacity 0.15s;
}
.canvas :deep(.vue-flow__handle) {
  opacity: 0;
  width: 1px;
  height: 1px;
  min-width: 0;
  min-height: 0;
  border: 0;
  pointer-events: none;
}
.canvas :deep(.vue-flow__controls) {
  box-shadow: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.canvas :deep(.vue-flow__controls-button) {
  width: 32px;
  height: 32px;
  border-radius: 7px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
}
.canvas :deep(.vue-flow__controls-button svg) {
  fill: currentColor;
  max-width: 12px;
  max-height: 12px;
}
.canvas :deep(.vue-flow__controls-button:hover) {
  border-color: var(--accent);
}
.banner {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 60px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--surface);
  border: 1px solid var(--err);
  font-size: 13px;
  z-index: 5;
}
.empty {
  z-index: 4;
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  text-align: center;
  color: var(--muted);
  padding: 24px;
  pointer-events: none;
}
.empty-card {
  max-width: 360px;
  pointer-events: auto;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 20px 22px;
}
.empty-card h2 {
  margin: 8px 0 4px;
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
}
.empty-card p {
  margin: 0 0 12px;
  font-size: 13px;
}
.drop-hint {
  position: absolute;
  inset: 12px;
  display: grid;
  place-items: center;
  border: 2px dashed var(--accent);
  border-radius: 12px;
  background: var(--accent-soft);
  color: var(--ink);
  font-weight: 600;
  pointer-events: none;
  z-index: 6;
}
.legend {
  position: absolute;
  left: 12px;
  bottom: 12px;
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  align-items: center;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 11.5px;
  color: var(--muted);
  max-width: calc(100% - 24px);
  z-index: 5;
  pointer-events: none;
}
.legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
@media (max-width: 520px) {
  .legend .hint {
    display: none;
  }
}
</style>
