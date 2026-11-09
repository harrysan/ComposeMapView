import ELK from 'elkjs/lib/elk.bundled.js'
import type { ElkNode } from 'elkjs/lib/elk.bundled.js'
import type { Graph, GraphNode } from './build'
import { NETWORK_HEIGHT } from './build'

export interface Point {
  x: number
  y: number
}

export type Positions = Record<string, Point>

const NETWORK_GAP = 90 // jarak baris network ke service
const VOLUME_GAP = 80 // jarak service ke baris volume
const SPREAD_GAP = 18

let elk: InstanceType<typeof ELK> | null = null

/**
 * Layout:
 * 1. Service + edge depends_on → elkjs `layered`, kiri ke kanan (SPEC §8.2).
 *    Service di kiri menunggu service di kanannya.
 * 2. Network diletakkan di baris atas, volume di baris bawah, masing-masing
 *    dirapatkan ke rata-rata posisi anggotanya lalu disebar agar tidak bertumpuk.
 */
export async function layoutGraph(graph: Graph): Promise<Positions> {
  elk ??= new ELK()
  const services = graph.nodes.filter((n) => n.data.kind === 'service')
  const serviceIds = new Set(services.map((n) => n.id))
  const depEdges = graph.edges.filter(
    (e) => e.kind === 'depends' && serviceIds.has(e.source) && serviceIds.has(e.target),
  )

  const result = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '26',
      'elk.layered.spacing.nodeNodeBetweenLayers': '84',
      'elk.spacing.componentComponent': '40',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.aspectRatio': '2.2',
    },
    children: services.map((n) => ({ id: n.id, width: n.width, height: n.height })),
    edges: depEdges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  })

  const top = NETWORK_HEIGHT + NETWORK_GAP
  const pos: Positions = {}
  for (const child of (result.children ?? []) as ElkNode[]) {
    pos[child.id] = { x: child.x ?? 0, y: (child.y ?? 0) + top }
  }

  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const centerX = (id: string) => (pos[id]?.x ?? 0) + (byId.get(id)?.width ?? 0) / 2
  const svcBottom = Math.max(top, ...services.map((n) => (pos[n.id]?.y ?? 0) + n.height))
  const svcRight = Math.max(0, ...services.map((n) => (pos[n.id]?.x ?? 0) + n.width))

  const placeRow = (kind: 'network' | 'volume', y: number) => {
    const row = graph.nodes.filter((n) => n.data.kind === kind)
    const items = row.map((n) => {
      const members = graph.edges
        .filter((e) => (kind === 'network' ? e.source === n.id : e.target === n.id))
        .map((e) => (kind === 'network' ? e.target : e.source))
        .filter((id) => pos[id])
      const cx = members.length
        ? members.reduce((a, id) => a + centerX(id), 0) / members.length
        : svcRight + 60 + n.width / 2
      return { node: n, cx, x: 0 }
    })
    spread(items, SPREAD_GAP)
    for (const it of items) pos[it.node.id] = { x: it.x, y }
  }

  placeRow('network', 0)
  placeRow('volume', svcBottom + VOLUME_GAP)
  return pos
}

/** Sebar node horizontal agar tidak bertumpuk, sambil menjaga rata-rata posisinya di titik ideal. */
export function spread(items: { node: GraphNode; cx: number; x: number }[], gap: number): void {
  const sorted = [...items].sort((a, b) => a.cx - b.cx)
  let right = -Infinity
  for (const it of sorted) {
    it.x = Math.max(it.cx - it.node.width / 2, right + gap)
    right = it.x + it.node.width
  }
  if (sorted.length) {
    const shift =
      (sorted.reduce((a, it) => a + it.cx, 0) -
        sorted.reduce((a, it) => a + it.x + it.node.width / 2, 0)) /
      sorted.length
    for (const it of sorted) it.x += shift
  }
}
