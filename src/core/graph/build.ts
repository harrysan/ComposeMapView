import type { ComposeModel, NamedVolume, Network, Service } from '../model'
import {
  exposedDatabasePorts,
  findDependencyCycles,
  findPortConflicts,
  SEVERITY_ORDER,
} from '../rules'
import type { Issue, Severity } from '../rules'

export const serviceKey = (name: string) => `s:${name}`
export const networkKey = (name: string) => `n:${name}`
export const volumeKey = (name: string) => `v:${name}`

/** Semua key node (s:/n:/v:) yang disebut sebuah issue. */
export function issueKeys(issue: Issue): string[] {
  return [
    ...issue.services.map(serviceKey),
    ...(issue.networks ?? []).map(networkKey),
    ...(issue.volumes ?? []).map(volumeKey),
  ]
}

export type PortState = 'ok' | 'conflict' | 'risky'

export interface ServiceNodeData {
  kind: 'service'
  service: Service
  severity?: Severity // severity terberat dari issue terkait
  issueCount: number
  portStates: PortState[] // sejajar dengan service.ports
  tags: string[] // "host", "build", nama profile, ...
}

export interface NetworkNodeData {
  kind: 'network'
  network: Network
  colorIndex: number // 0..NETWORK_COLORS-1, konsisten per network
  severity?: Severity
}

export interface VolumeNodeData {
  kind: 'volume'
  name: string
  declared: boolean
  volume?: NamedVolume
  severity?: Severity
}

export type NodeData = ServiceNodeData | NetworkNodeData | VolumeNodeData

export interface GraphNode {
  id: string
  width: number
  height: number
  data: NodeData
}

export interface GraphEdge {
  id: string
  kind: 'network' | 'volume' | 'depends'
  source: string
  target: string
  label?: string
  colorIndex?: number // untuk edge network
  cycle?: boolean // edge depends_on yang bagian dari siklus
  title: string
}

export interface Graph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface GraphOptions {
  showPorts?: boolean
  showVolumes?: boolean
}

export const NETWORK_COLORS = 6
export const SERVICE_WIDTH = 210
export const SERVICE_HEIGHT = 56
export const PORT_ROW_HEIGHT = 28
export const NETWORK_HEIGHT = 32
export const VOLUME_HEIGHT = 44

// Perkiraan lebar teks (px per karakter) supaya ukuran node bisa dihitung tanpa DOM.
const SANS_12 = 7.2
const MONO_10 = 6.4
const MONO_11 = 6.7

function worst(a: Severity | undefined, b: Severity): Severity {
  return a === undefined || SEVERITY_ORDER[b] < SEVERITY_ORDER[a] ? b : a
}

/** Label subnet / status yang ditampilkan di samping nama network. */
export function networkSubLabel(n: Network): string {
  return n.subnets[0] ?? (n.external ? 'external' : '')
}

/** ComposeModel + issues → node dan edge abstrak (tanpa posisi). Fungsi murni. */
export function buildGraph(
  model: ComposeModel,
  issues: Issue[],
  options: GraphOptions = {},
): Graph {
  const showPorts = options.showPorts ?? true
  const showVolumes = options.showVolumes ?? true

  const severity = new Map<string, Severity>()
  const count = new Map<string, number>()
  for (const issue of issues) {
    for (const key of new Set(issueKeys(issue))) {
      severity.set(key, worst(severity.get(key), issue.severity))
      count.set(key, (count.get(key) ?? 0) + 1)
    }
  }

  const conflictPorts = new Set(findPortConflicts(model).flatMap((c) => [c.a.port, c.b.port]))

  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const serviceNames = new Set(model.services.map((s) => s.name))

  for (const s of model.services) {
    const key = serviceKey(s.name)
    const tags: string[] = []
    if (s.networkMode) tags.push(s.networkMode.split(':')[0]!)
    if (!s.image && s.build) tags.push('build')
    for (const p of s.profiles) tags.push(p)
    nodes.push({
      id: key,
      width: SERVICE_WIDTH,
      height: SERVICE_HEIGHT + (showPorts && s.ports.length > 0 ? PORT_ROW_HEIGHT : 0),
      data: {
        kind: 'service',
        service: s,
        severity: severity.get(key),
        issueCount: count.get(key) ?? 0,
        portStates: s.ports.map((p) =>
          conflictPorts.has(p)
            ? 'conflict'
            : s.networkMode !== 'host' && exposedDatabasePorts(p).length > 0
              ? 'risky'
              : 'ok',
        ),
        tags,
      },
    })
  }

  model.networks.forEach((n, i) => {
    const sub = networkSubLabel(n)
    nodes.push({
      id: networkKey(n.name),
      width: Math.round(n.name.length * SANS_12 + (sub ? sub.length * MONO_10 + 12 : 0) + 40),
      height: NETWORK_HEIGHT,
      data: {
        kind: 'network',
        network: n,
        colorIndex: i % NETWORK_COLORS,
        severity: severity.get(networkKey(n.name)),
      },
    })
  })
  const colorOf = new Map(model.networks.map((n, i) => [n.name, i % NETWORK_COLORS]))

  for (const s of model.services) {
    for (const att of s.networks) {
      edges.push({
        id: `net:${s.name}:${att.network}`,
        kind: 'network',
        source: networkKey(att.network),
        target: serviceKey(s.name),
        colorIndex: colorOf.get(att.network) ?? 0,
        title: `${s.name} ↔ ${att.network}`,
      })
    }
  }

  if (showVolumes) {
    const declared = new Map(model.volumes.map((v) => [v.name, v]))
    const volumeNames = [...declared.keys()]
    for (const s of model.services) {
      for (const m of s.volumes) {
        if (m.type === 'volume' && m.source && !volumeNames.includes(m.source))
          volumeNames.push(m.source)
      }
    }
    for (const name of volumeNames) {
      const vol = declared.get(name)
      nodes.push({
        id: volumeKey(name),
        width: Math.round(Math.max(96, name.length * MONO_11 + 32)),
        height: VOLUME_HEIGHT,
        data: {
          kind: 'volume',
          name,
          declared: !!vol,
          volume: vol,
          severity: severity.get(volumeKey(name)),
        },
      })
    }
    for (const s of model.services) {
      const seen = new Set<string>()
      for (const m of s.volumes) {
        if (m.type !== 'volume' || !m.source || seen.has(m.source)) continue
        seen.add(m.source)
        edges.push({
          id: `vol:${s.name}:${m.source}`,
          kind: 'volume',
          source: serviceKey(s.name),
          target: volumeKey(m.source),
          title: `${s.name} → ${m.target}`,
        })
      }
    }
  }

  const cycleEdges = new Set<string>()
  for (const c of findDependencyCycles(model)) {
    c.forEach((n, i) => cycleEdges.add(`${n}>${c[(i + 1) % c.length]}`))
  }
  for (const s of model.services) {
    for (const d of s.dependsOn) {
      if (!serviceNames.has(d.service)) continue
      edges.push({
        id: `dep:${s.name}:${d.service}`,
        kind: 'depends',
        source: serviceKey(s.name),
        target: serviceKey(d.service),
        label:
          d.condition === 'service_healthy'
            ? 'healthy'
            : d.condition === 'service_completed_successfully'
              ? 'selesai'
              : undefined,
        cycle: cycleEdges.has(`${s.name}>${d.service}`),
        title: `${s.name} bergantung pada ${d.service}`,
      })
    }
  }

  return { nodes, edges }
}

/** Key node yang terhubung langsung dengan `key` (termasuk dirinya), untuk efek sorot. */
export function neighbors(model: ComposeModel, key: string): Set<string> {
  const set = new Set([key])
  const kind = key.slice(0, 1)
  const name = key.slice(2)
  if (kind === 's') {
    const s = model.services.find((x) => x.name === name)
    if (!s) return set
    s.dependsOn.forEach((d) => set.add(serviceKey(d.service)))
    model.services.forEach((o) => {
      if (o.dependsOn.some((d) => d.service === name)) set.add(serviceKey(o.name))
    })
    s.networks.forEach((a) => set.add(networkKey(a.network)))
    s.volumes.forEach((v) => {
      if (v.type === 'volume' && v.source) set.add(volumeKey(v.source))
    })
  } else if (kind === 'n') {
    model.services.forEach((s) => {
      if (s.networks.some((a) => a.network === name)) set.add(serviceKey(s.name))
    })
  } else if (kind === 'v') {
    model.services.forEach((s) => {
      if (s.volumes.some((v) => v.type === 'volume' && v.source === name))
        set.add(serviceKey(s.name))
    })
  }
  return set
}

/** Signature struktur graf: layout hanya dihitung ulang bila ini berubah (SPEC §8.2). */
export function structureSignature(graph: Graph): string {
  return [
    graph.nodes.map((n) => `${n.id}:${n.width}x${n.height}`).join(','),
    graph.edges.map((e) => e.id).join(','),
  ].join('|')
}
