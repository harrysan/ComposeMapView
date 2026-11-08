import { describe, expect, it } from 'vitest'
import { model, service } from './helpers'

describe('networks di service', () => {
  it('list [a, b]', () => {
    const s = service('image: x\nnetworks: [front, back]')
    expect(s.networks.map((n) => n.network)).toEqual(['front', 'back'])
    expect(s.networks[0]?.aliases).toEqual([])
  })

  it('map dengan aliases dan ipv4_address', () => {
    const s = service(
      'image: x\nnetworks:\n  back:\n    aliases: [db, mysql]\n    ipv4_address: 172.20.0.10',
    )
    expect(s.networks).toEqual([
      {
        network: 'back',
        aliases: ['db', 'mysql'],
        ipv4Address: '172.20.0.10',
        source: { startLine: 5, endLine: 7 },
      },
    ])
  })

  it('map dengan nilai null (`a:`)', () => {
    const s = service('image: x\nnetworks:\n  a:\n  b: null')
    expect(s.networks.map((n) => [n.network, n.aliases])).toEqual([
      ['a', []],
      ['b', []],
    ])
  })
})

describe('network default implisit', () => {
  it('service tanpa networks dan network_mode masuk ke default', () => {
    const m = model('services:\n  web:\n    image: nginx\n')
    expect(m.services[0]?.networks.map((n) => n.network)).toEqual(['default'])
    expect(m.networks).toEqual([
      { name: 'default', isDefault: true, external: false, subnets: [], declared: false },
    ])
  })

  it('network_mode: host tidak masuk default', () => {
    const m = model('services:\n  web:\n    image: nginx\n    network_mode: host\n')
    expect(m.services[0]?.networkMode).toBe('host')
    expect(m.services[0]?.networks).toEqual([])
    expect(m.networks).toEqual([])
  })

  it('network_mode: "service:x" juga tidak masuk default', () => {
    const m = model(
      'services:\n  a:\n    image: x\n    network_mode: "service:b"\n  b:\n    image: x\n',
    )
    expect(m.services[0]?.networks).toEqual([])
  })

  it('service yang menulis networks tidak ikut default', () => {
    const m = model('services:\n  a:\n    image: x\n    networks: [n]\nnetworks:\n  n:\n')
    expect(m.networks.map((n) => n.name)).toEqual(['n'])
  })

  it('default yang dikonfigurasi di top-level ditandai isDefault dan declared', () => {
    const m = model(`
services:
  a:
    image: x
networks:
  default:
    ipam:
      config:
        - subnet: 10.5.0.0/16
`)
    expect(m.networks).toHaveLength(1)
    expect(m.networks[0]).toMatchObject({
      name: 'default',
      isDefault: true,
      declared: true,
      subnets: ['10.5.0.0/16'],
    })
  })
})

describe('top-level networks', () => {
  it('driver, external, ipam subnets', () => {
    const m = model(`
networks:
  back:
    driver: bridge
    ipam:
      driver: default
      config:
        - subnet: 172.20.0.0/24
          gateway: 172.20.0.1
        - subnet: 172.21.0.0/24
  ext:
    external: true
  plain:
`)
    expect(m.networks).toEqual([
      {
        name: 'back',
        isDefault: false,
        external: false,
        driver: 'bridge',
        subnets: ['172.20.0.0/24', '172.21.0.0/24'],
        declared: true,
        source: { startLine: 3, endLine: 10 },
      },
      {
        name: 'ext',
        isDefault: false,
        external: true,
        subnets: [],
        declared: true,
        source: { startLine: 11, endLine: 12 },
      },
      {
        name: 'plain',
        isDefault: false,
        external: false,
        subnets: [],
        declared: true,
        source: { startLine: 13, endLine: 13 },
      },
    ])
  })

  it('network yang dipakai tapi tidak dideklarasikan dicatat declared: false', () => {
    const m = model('services:\n  app:\n    image: x\n    networks: [cache]\n')
    expect(m.networks).toEqual([
      { name: 'cache', isDefault: false, external: false, subnets: [], declared: false },
    ])
  })

  it('subnet berisi variabel tak ter-resolve tetap disimpan mentah', () => {
    const m = model('networks:\n  n:\n    ipam:\n      config:\n        - subnet: ${SUBNET}\n')
    expect(m.networks[0]?.subnets).toEqual(['${SUBNET}'])
    expect(m.unresolvedVars.map((v) => v.name)).toEqual(['SUBNET'])
  })
})
