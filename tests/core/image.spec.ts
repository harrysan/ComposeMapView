import { describe, expect, it } from 'vitest'
import { parseImage } from '@/core/normalize/image'
import { service } from './helpers'

describe('parseImage', () => {
  it.each([
    ['mysql', { name: 'mysql' }],
    ['mysql:8.4', { name: 'mysql', tag: '8.4' }],
    ['ghcr.io/org/app:1.2', { name: 'ghcr.io/org/app', tag: '1.2' }],
    ['registry:5000/app', { name: 'registry:5000/app' }],
    ['registry:5000/app:2', { name: 'registry:5000/app', tag: '2' }],
    ['app@sha256:abc123', { name: 'app', digest: 'sha256:abc123' }],
    ['app:1.0@sha256:abc123', { name: 'app', tag: '1.0', digest: 'sha256:abc123' }],
  ])('%s', (raw, expected) => {
    expect(parseImage(raw)).toEqual({ ...expected, raw })
  })

  it('tag dan digest tidak ada = tidak ada field', () => {
    const img = parseImage('redis')
    expect('tag' in img).toBe(false)
    expect('digest' in img).toBe(false)
  })
})

describe('image dan build di service', () => {
  it('image dengan variabel default', () => {
    expect(service('image: "nginx:${NGINX_TAG:-1.27}"').image).toMatchObject({
      name: 'nginx',
      tag: '1.27',
    })
  })

  it('build string', () => {
    expect(service('build: ./app').build).toEqual({ context: './app' })
  })

  it('build map', () => {
    expect(service('build:\n  context: .\n  dockerfile: Dockerfile.dev').build).toEqual({
      context: '.',
      dockerfile: 'Dockerfile.dev',
    })
  })

  it('build map tanpa context default ke "."', () => {
    expect(service('build:\n  target: dev').build).toEqual({ context: '.' })
  })

  it('tanpa image maupun build', () => {
    const s = service('command: echo hi')
    expect(s.image).toBeUndefined()
    expect(s.build).toBeUndefined()
  })
})
