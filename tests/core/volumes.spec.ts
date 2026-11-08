import { describe, expect, it } from 'vitest'
import { isBindSource, parseVolumeString } from '@/core/normalize/volumes'
import { model, service } from './helpers'

describe('parseVolumeString (short syntax)', () => {
  it('"data:/var/lib/mysql": named volume', () => {
    expect(parseVolumeString('data:/var/lib/mysql')).toEqual({
      type: 'volume',
      source: 'data',
      target: '/var/lib/mysql',
      readOnly: false,
    })
  })

  it('"./src:/app:ro": bind read-only', () => {
    expect(parseVolumeString('./src:/app:ro')).toEqual({
      type: 'bind',
      source: './src',
      target: '/app',
      readOnly: true,
    })
  })

  it('"/abs/path:/x": bind', () => {
    expect(parseVolumeString('/abs/path:/x')).toMatchObject({ type: 'bind', source: '/abs/path' })
  })

  it('"~/data:/x": bind', () => {
    expect(parseVolumeString('~/data:/x')).toMatchObject({ type: 'bind' })
  })

  it('"/only/container/path": volume anonim', () => {
    expect(parseVolumeString('/only/container/path')).toEqual({
      type: 'volume',
      target: '/only/container/path',
      readOnly: false,
    })
  })

  it('mode gabungan "rw,z" dan "ro,z"', () => {
    expect(parseVolumeString('./a:/b:rw,z')?.readOnly).toBe(false)
    expect(parseVolumeString('./a:/b:ro,z')?.readOnly).toBe(true)
  })

  it('path Windows', () => {
    expect(parseVolumeString('C:\\data:/data')).toMatchObject({
      type: 'bind',
      source: 'C:\\data',
      target: '/data',
    })
  })

  it('input tidak valid', () => {
    expect(parseVolumeString('')).toBeUndefined()
    expect(parseVolumeString('data:')).toBeUndefined()
  })
})

describe('isBindSource', () => {
  it.each([
    ['./x', true],
    ['../x', true],
    ['/x', true],
    ['~/x', true],
    ['${DATA_DIR}', true],
    ['${PWD}/x', true],
    ['data', false],
    ['my-vol_1', false],
  ])('%s → %s', (src, bind) => {
    expect(isBindSource(src)).toBe(bind)
  })
})

describe('normalizeVolumeMounts', () => {
  it('long syntax {type, source, target, read_only}', () => {
    const [v] = service(
      'image: x\nvolumes:\n  - type: bind\n    source: ./conf\n    target: /etc/app\n    read_only: true',
    ).volumes
    expect(v).toMatchObject({ type: 'bind', source: './conf', target: '/etc/app', readOnly: true })
  })

  it('long syntax volume dan tmpfs', () => {
    const [a, b] = service(
      'image: x\nvolumes:\n  - type: volume\n    source: data\n    target: /data\n  - type: tmpfs\n    target: /tmp',
    ).volumes
    expect(a).toMatchObject({ type: 'volume', source: 'data', readOnly: false })
    expect(b).toMatchObject({ type: 'tmpfs', source: undefined, target: '/tmp' })
  })

  it('long syntax default type volume', () => {
    expect(service('image: x\nvolumes:\n  - source: data\n    target: /d').volumes[0]?.type).toBe(
      'volume',
    )
  })

  it('variabel path tak ter-resolve dianggap bind', () => {
    const s = service('image: x\nvolumes:\n  - ${MEDIA}:/media')
    expect(s.volumes[0]).toMatchObject({ type: 'bind', source: '${MEDIA}' })
  })
})

describe('top-level volumes', () => {
  it('null, {}, driver, external, external lama', () => {
    const m = model(`
volumes:
  a:
  b: {}
  c:
    driver: local
  d:
    external: true
  e:
    external:
      name: legacy
`)
    expect(m.volumes.map((v) => [v.name, v.external, v.driver])).toEqual([
      ['a', false, undefined],
      ['b', false, undefined],
      ['c', false, 'local'],
      ['d', true, undefined],
      ['e', true, undefined],
    ])
    expect(m.volumes[2]?.source).toEqual({ startLine: 5, endLine: 6 })
  })
})
