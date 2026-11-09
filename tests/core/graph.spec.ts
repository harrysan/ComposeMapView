import { describe, expect, it } from 'vitest'
import { buildGraph, issueKeys, neighbors, structureSignature } from '@/core/graph/build'
import type { ServiceNodeData } from '@/core/graph/build'
import { layoutGraph } from '@/core/graph/layout'
import { runRules } from '@/core/rules'
import { model } from './helpers'

const YAML = `services:
  web:
    image: nginx:1.27
    ports: ["8080:80", "3306:3306"]
    depends_on:
      api:
        condition: service_healthy
    networks: [front]
  api:
    image: api:1
    ports: ["8080:8080"]
    depends_on: [db]
    networks: [front, back]
    volumes: ["logs:/logs", "./src:/app"]
  db:
    image: postgres:16
    networks: [back]
    volumes: ["pg:/var/lib/postgresql/data"]
networks:
  front:
  back:
volumes:
  pg:
`

function graphOf(yaml = YAML, opts = {}) {
  const m = model(yaml)
  return { m, g: buildGraph(m, runRules(m), opts) }
}

describe('buildGraph', () => {
  it('membuat node service, network, dan volume (termasuk volume tak dideklarasikan)', () => {
    const { g } = graphOf()
    expect(g.nodes.map((n) => n.id)).toEqual([
      's:web',
      's:api',
      's:db',
      'n:front',
      'n:back',
      'v:pg',
      'v:logs',
    ])
    const logs = g.nodes.find((n) => n.id === 'v:logs')!.data
    expect(logs).toMatchObject({ kind: 'volume', declared: false, severity: 'error' })
  })

  it('bind mount tidak menjadi node', () => {
    const { g } = graphOf()
    expect(g.nodes.some((n) => n.id.includes('src'))).toBe(false)
  })

  it('edge network, volume, dan depends_on dengan label healthy', () => {
    const { g } = graphOf()
    const kinds = g.edges.map(
      (e) => `${e.kind} ${e.source}->${e.target}${e.label ? ' ' + e.label : ''}`,
    )
    expect(kinds).toEqual([
      'network n:front->s:web',
      'network n:front->s:api',
      'network n:back->s:api',
      'network n:back->s:db',
      'volume s:api->v:logs',
      'volume s:db->v:pg',
      'depends s:web->s:api healthy',
      'depends s:api->s:db',
    ])
  })

  it('warna network konsisten untuk semua edge-nya', () => {
    const { g } = graphOf()
    const front = g.nodes.find((n) => n.id === 'n:front')!.data
    const edges = g.edges.filter((e) => e.source === 'n:front')
    expect(edges.every((e) => e.colorIndex === (front as { colorIndex: number }).colorIndex)).toBe(
      true,
    )
  })

  it('status port: bentrok dan database terbuka', () => {
    const { g } = graphOf()
    const web = g.nodes.find((n) => n.id === 's:web')!.data as ServiceNodeData
    const api = g.nodes.find((n) => n.id === 's:api')!.data as ServiceNodeData
    expect(web.portStates).toEqual(['conflict', 'risky'])
    expect(api.portStates).toEqual(['conflict'])
    expect(web.severity).toBe('error')
  })

  it('severity dan jumlah issue per service', () => {
    const { g } = graphOf()
    const db = g.nodes.find((n) => n.id === 's:db')!.data as ServiceNodeData
    expect(db.issueCount).toBe(0)
    expect(db.severity).toBeUndefined()
  })

  it('tinggi node service bergantung pada baris port', () => {
    const { g } = graphOf()
    expect(g.nodes.find((n) => n.id === 's:web')!.height).toBe(84)
    expect(g.nodes.find((n) => n.id === 's:db')!.height).toBe(56)
    const { g: noPorts } = graphOf(YAML, { showPorts: false })
    expect(noPorts.nodes.find((n) => n.id === 's:web')!.height).toBe(56)
  })

  it('showVolumes: false menyembunyikan node dan edge volume', () => {
    const { g } = graphOf(YAML, { showVolumes: false })
    expect(g.nodes.some((n) => n.data.kind === 'volume')).toBe(false)
    expect(g.edges.some((e) => e.kind === 'volume')).toBe(false)
  })

  it('tag host/build/profile dan edge siklus', () => {
    const { g } = graphOf(`services:
  a: { build: ., network_mode: host, profiles: [dev], depends_on: [b] }
  b: { image: x:1, depends_on: [a] }
`)
    const a = g.nodes.find((n) => n.id === 's:a')!.data as ServiceNodeData
    expect(a.tags).toEqual(['host', 'build', 'dev'])
    expect(g.edges.filter((e) => e.kind === 'depends').every((e) => e.cycle)).toBe(true)
  })

  it('depends_on ke service yang tidak ada tidak membuat edge', () => {
    const { g } = graphOf('services:\n  a:\n    image: x:1\n    depends_on: [ghost]\n')
    expect(g.edges.filter((e) => e.kind === 'depends')).toEqual([])
  })
})

describe('helper', () => {
  it('issueKeys', () => {
    expect(
      issueKeys({
        ruleId: 'X',
        messageId: 'X',
        params: {},
        severity: 'error',
        message: '',
        services: ['a'],
        networks: ['n'],
        volumes: ['v'],
      }),
    ).toEqual(['s:a', 'n:n', 'v:v'])
  })

  it('neighbors', () => {
    const { m } = graphOf()
    expect([...neighbors(m, 's:api')].sort()).toEqual(
      ['n:back', 'n:front', 's:api', 's:db', 's:web', 'v:logs'].sort(),
    )
    expect([...neighbors(m, 'n:back')].sort()).toEqual(['n:back', 's:api', 's:db'])
    expect([...neighbors(m, 'v:pg')].sort()).toEqual(['s:db', 'v:pg'])
    expect([...neighbors(m, 's:nope')]).toEqual(['s:nope'])
  })

  it('structureSignature tidak berubah saat hanya nilai env berubah', () => {
    const a = graphOf(YAML).g
    const b = graphOf(YAML.replace('image: api:1', 'image: api:2')).g
    expect(structureSignature(a)).toBe(structureSignature(b))
    const c = graphOf(YAML.replace('depends_on: [db]', 'depends_on: []')).g
    expect(structureSignature(c)).not.toBe(structureSignature(a))
  })
})

describe('layoutGraph', () => {
  it('depends_on mengalir kiri ke kanan; network di atas, volume di bawah', async () => {
    const { g } = graphOf()
    const pos = await layoutGraph(g)
    expect(Object.keys(pos).sort()).toEqual(g.nodes.map((n) => n.id).sort())
    expect(pos['s:web']!.x).toBeLessThan(pos['s:api']!.x)
    expect(pos['s:api']!.x).toBeLessThan(pos['s:db']!.x)
    const svcTop = Math.min(pos['s:web']!.y, pos['s:api']!.y, pos['s:db']!.y)
    expect(pos['n:front']!.y).toBeLessThan(svcTop)
    expect(pos['v:pg']!.y).toBeGreaterThan(svcTop)
  })

  it('node dalam satu baris tidak bertumpuk', async () => {
    const { g } = graphOf(`services:
  a: { image: x:1, networks: [n1, n2, n3, n4] }
networks: { n1: , n2: , n3: , n4: }
`)
    const pos = await layoutGraph(g)
    const nets = g.nodes
      .filter((n) => n.data.kind === 'network')
      .map((n) => ({ x: pos[n.id]!.x, w: n.width }))
      .sort((a, b) => a.x - b.x)
    for (let i = 1; i < nets.length; i++)
      expect(nets[i]!.x).toBeGreaterThanOrEqual(nets[i - 1]!.x + nets[i - 1]!.w)
  })

  it('graf kosong', async () => {
    expect(await layoutGraph({ nodes: [], edges: [] })).toEqual({})
  })

  it('50 service selesai dengan cepat (SPEC §14)', async () => {
    const services = Array.from(
      { length: 50 },
      (_, i) =>
        `  s${i}:\n    image: x:1\n    depends_on: [${i > 0 ? `s${i - 1}` : ''}]\n    networks: [n${i % 5}]\n`,
    ).join('')
    const yaml = `services:\n${services}networks: { n0: , n1: , n2: , n3: , n4: }\n`
    const t0 = performance.now()
    const m = model(yaml)
    const g = buildGraph(m, runRules(m))
    await layoutGraph(g)
    expect(performance.now() - t0).toBeLessThan(3000) // batas longgar untuk CI; target nyata < 1 detik
  })
})
