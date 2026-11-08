import { describe, expect, it } from 'vitest'
import { model, service } from './helpers'

describe('depends_on', () => {
  it('list [db]: condition default service_started', () => {
    expect(service('image: x\ndepends_on: [db, cache]').dependsOn).toEqual([
      { service: 'db', condition: 'service_started', source: { startLine: 4, endLine: 4 } },
      { service: 'cache', condition: 'service_started', source: { startLine: 4, endLine: 4 } },
    ])
  })

  it('map dengan condition', () => {
    const s = service(
      'image: x\ndepends_on:\n  db:\n    condition: service_healthy\n  migrate:\n    condition: service_completed_successfully\n  cache: {}',
    )
    expect(s.dependsOn.map((d) => [d.service, d.condition])).toEqual([
      ['db', 'service_healthy'],
      ['migrate', 'service_completed_successfully'],
      ['cache', 'service_started'],
    ])
    expect(s.dependsOn[0]?.source).toEqual({ startLine: 5, endLine: 6 })
  })

  it('condition tidak dikenal jatuh ke service_started', () => {
    expect(
      service('image: x\ndepends_on:\n  db:\n    condition: aneh').dependsOn[0]?.condition,
    ).toBe('service_started')
  })
})

describe('environment', () => {
  it('list ["A=1", "B"]', () => {
    const env = service('image: x\nenvironment:\n  - A=1\n  - B\n  - C=\n  - D=x=y').environment
    expect(env.map((e) => [e.key, e.value])).toEqual([
      ['A', '1'],
      ['B', undefined],
      ['C', ''],
      ['D', 'x=y'],
    ])
    expect(env[1]?.source).toEqual({ startLine: 6, endLine: 6 })
  })

  it('map {A: 1, B: null}', () => {
    const env = service(
      'image: x\nenvironment:\n  A: 1\n  B: null\n  C:\n  D: true\n  E: "str"',
    ).environment
    expect(env.map((e) => [e.key, e.value])).toEqual([
      ['A', '1'],
      ['B', undefined],
      ['C', undefined],
      ['D', 'true'],
      ['E', 'str'],
    ])
  })

  it('isInterpolated untuk nilai ${VAR}', () => {
    const env = service(
      'image: x\nenvironment:\n  - PASSWORD=${DB_PASS}\n  - PLAIN=secret\n  - KEY=${K:-def}\nenvironment_dummy: 1',
    ).environment
    expect(env.map((e) => [e.key, e.value, e.isInterpolated])).toEqual([
      ['PASSWORD', '${DB_PASS}', true],
      ['PLAIN', 'secret', false],
      ['KEY', 'def', true],
    ])
  })

  it('isInterpolated pada bentuk map', () => {
    const [e] = service('image: x\nenvironment:\n  TOKEN: $TOKEN').environment
    expect(e).toMatchObject({ value: '$TOKEN', isInterpolated: true })
  })
})

describe('healthcheck', () => {
  it('test berupa string', () => {
    expect(service('image: x\nhealthcheck:\n  test: curl -f http://localhost').healthcheck).toEqual(
      {
        test: 'curl -f http://localhost',
        disabled: false,
      },
    )
  })

  it('test berupa list CMD / CMD-SHELL', () => {
    expect(
      service('image: x\nhealthcheck:\n  test: ["CMD", "pg_isready", "-U", "app"]').healthcheck
        ?.test,
    ).toBe('pg_isready -U app')
    expect(
      service('image: x\nhealthcheck:\n  test: ["CMD-SHELL", "redis-cli ping"]').healthcheck?.test,
    ).toBe('redis-cli ping')
  })

  it('disable: true', () => {
    expect(service('image: x\nhealthcheck:\n  disable: true').healthcheck).toEqual({
      test: '',
      disabled: true,
    })
  })

  it('test: ["NONE"]', () => {
    expect(service('image: x\nhealthcheck:\n  test: ["NONE"]').healthcheck?.disabled).toBe(true)
  })

  it('tanpa healthcheck', () => {
    expect(service('image: x').healthcheck).toBeUndefined()
  })
})

describe('field lain di service', () => {
  it('env_file string, list, dan list objek', () => {
    expect(service('image: x\nenv_file: .env').envFiles).toEqual(['.env'])
    expect(
      service('image: x\nenv_file:\n  - a.env\n  - path: b.env\n    required: false').envFiles,
    ).toEqual(['a.env', 'b.env'])
  })

  it('profiles', () => {
    expect(service('image: x\nprofiles: [debug, tools]').profiles).toEqual(['debug', 'tools'])
  })

  it('source range service mencakup seluruh blok', () => {
    const m = model('services:\n  a:\n    image: x\n    ports:\n      - 80\n  b:\n    image: y\n')
    expect(m.services.map((s) => s.source)).toEqual([
      { startLine: 2, endLine: 5 },
      { startLine: 6, endLine: 7 },
    ])
  })
})

describe('top-level', () => {
  it('name dan version', () => {
    const m = model('version: "3.8"\nname: shop\nservices: {}\n')
    expect(m.projectName).toBe('shop')
    expect(m.hasVersionField).toBe(true)
  })

  it('tanpa version', () => {
    expect(model('services: {}\n').hasVersionField).toBe(false)
  })

  it('anchor dan merge key <<: *x', () => {
    const m = model(`
x-common: &common
  image: app:1.0
  environment:
    - MODE=prod
  networks: [back]
services:
  api:
    <<: *common
    ports: ["8000:8000"]
  worker:
    <<: *common
    image: app:worker
networks:
  back:
`)
    const [api, worker] = m.services
    expect(api?.image?.tag).toBe('1.0')
    expect(api?.environment.map((e) => e.key)).toEqual(['MODE'])
    expect(api?.networks.map((n) => n.network)).toEqual(['back'])
    expect(worker?.image?.tag).toBe('worker') // key eksplisit menang
  })

  it('unresolvedVars mencatat service dan baris', () => {
    const m = model('services:\n  db:\n    image: "postgres:${PG_TAG}"\n')
    expect(m.unresolvedVars).toEqual([
      { name: 'PG_TAG', raw: '${PG_TAG}', service: 'db', source: { startLine: 3, endLine: 3 } },
    ])
  })

  it('tidak crash pada bentuk yang salah', () => {
    const m = model(`
services:
  a: null
  b: "string"
  c:
    ports: "bukan list"
    networks: 123
    volumes: {x: 1}
    depends_on: 5
    environment: true
    healthcheck: "x"
`)
    expect(m.services.map((s) => s.name)).toEqual(['a', 'b', 'c'])
    expect(m.services[2]?.ports).toEqual([])
  })
})
