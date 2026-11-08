import { describe, expect, it } from 'vitest'
import { parsePortString } from '@/core/normalize/ports'
import { service } from './helpers'

const r = (start: number, end = start) => ({ start, end })

describe('parsePortString (short syntax)', () => {
  it('"80": hanya target, port host acak', () => {
    expect(parsePortString('80')).toEqual({
      hostIp: '0.0.0.0',
      published: undefined,
      target: r(80),
      protocol: 'tcp',
    })
  })

  it('"8080:80"', () => {
    expect(parsePortString('8080:80')).toMatchObject({ published: r(8080), target: r(80) })
  })

  it('"127.0.0.1:8080:80"', () => {
    expect(parsePortString('127.0.0.1:8080:80')).toMatchObject({
      hostIp: '127.0.0.1',
      published: r(8080),
      target: r(80),
    })
  })

  it('"127.0.0.1::80": host IP tanpa published', () => {
    expect(parsePortString('127.0.0.1::80')).toMatchObject({
      hostIp: '127.0.0.1',
      published: undefined,
    })
  })

  it('"[::1]:8080:80": IPv6', () => {
    expect(parsePortString('[::1]:8080:80')).toMatchObject({ hostIp: '::1', published: r(8080) })
  })

  it('"8080-8081:80-81": rentang', () => {
    expect(parsePortString('8080-8081:80-81')).toMatchObject({
      published: r(8080, 8081),
      target: r(80, 81),
    })
  })

  it('"53:53/udp": protokol', () => {
    expect(parsePortString('53:53/udp')).toMatchObject({ protocol: 'udp', published: r(53) })
  })

  it('menolak input tidak valid', () => {
    for (const bad of ['abc', '8080:', '70000:80', '80/xyz', '81-80:80', '[::1]8080:80', '']) {
      expect.soft(parsePortString(bad)).toBeUndefined()
    }
  })
})

describe('normalizePorts', () => {
  it('angka 80 (bukan string)', () => {
    const [p] = service('image: x\nports:\n  - 80').ports
    expect(p).toMatchObject({ target: r(80), published: undefined, raw: '80', unresolved: false })
  })

  it('short syntax menyimpan raw dan nomor baris', () => {
    const [p] = service('image: x\nports:\n  - "8080:80"').ports
    expect(p).toMatchObject({ raw: '8080:80', source: { startLine: 5, endLine: 5 } })
  })

  it('long syntax {target, published, host_ip, protocol}', () => {
    const [p] = service(
      'image: x\nports:\n  - target: 53\n    published: "5353"\n    host_ip: 127.0.0.1\n    protocol: udp\n    mode: host',
    ).ports
    expect(p).toMatchObject({
      hostIp: '127.0.0.1',
      published: r(5353),
      target: r(53),
      protocol: 'udp',
      raw: '127.0.0.1:5353:53/udp',
      unresolved: false,
    })
  })

  it('long syntax tanpa published dan dengan rentang', () => {
    const [a, b] = service(
      'image: x\nports:\n  - target: 80\n  - target: 80\n    published: 8000-8010',
    ).ports
    expect(a).toMatchObject({ hostIp: '0.0.0.0', published: undefined, raw: '80' })
    expect(b).toMatchObject({ published: r(8000, 8010) })
  })

  it('variabel dengan default di-resolve', () => {
    const [p] = service('image: x\nports:\n  - "${WEB_PORT:-8080}:80"').ports
    expect(p).toMatchObject({ published: r(8080), unresolved: false, raw: '${WEB_PORT:-8080}:80' })
  })

  it('variabel tanpa nilai: published dikosongkan dan ditandai unresolved', () => {
    const [p] = service('image: x\nports:\n  - "${WEB_PORT}:80"').ports
    expect(p).toMatchObject({ target: r(80), unresolved: true })
    expect(p?.published).toBeUndefined()
  })

  it('variabel dari .env dipakai', () => {
    const [p] = service('image: x\nports:\n  - "${WEB_PORT}:80"', {
      env: { WEB_PORT: '9000' },
    }).ports
    expect(p).toMatchObject({ published: r(9000), unresolved: false })
  })

  it('entri tidak valid dilewati tanpa crash', () => {
    expect(service('image: x\nports:\n  - "abc"\n  - {}\n  - 80').ports).toHaveLength(1)
  })
})
