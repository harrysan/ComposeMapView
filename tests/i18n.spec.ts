import { describe, expect, it } from 'vitest'
import { localize, messageIds } from '@/core/i18n/messages'
import { parse } from '@/core/parser'
import { parseErrorToIssue, relocalize, rules, runRules } from '@/core/rules'
import { catalogKeys, translate } from '@/i18n'
import { model } from './core/helpers'

describe('pesan issue (core)', () => {
  it('ID dan EN punya messageId yang sama', () => {
    expect(messageIds('en').sort()).toEqual(messageIds('id').sort())
  })

  it('setiap aturan menghasilkan pesan dalam dua bahasa', () => {
    const m = model(`version: "3"
services:
  a:
    image: redis
    ports: ["3306:3306", "3306:3307"]
    environment: { DB_PASSWORD: secret, X: "\${NOPE}" }
    depends_on:
      ghost: {}
      b: { condition: service_healthy }
    networks:
      undeclared:
      back: { ipv4_address: 10.0.0.5 }
    volumes: ["data:/d"]
  b:
    image: "x:latest"
    depends_on: [a]
    networks:
      back: { ipv4_address: 10.0.0.5 }
  c:
    command: run
networks:
  back:
  n1: { ipam: { config: [{ subnet: 10.1.0.0/16 }] } }
  n2: { ipam: { config: [{ subnet: 10.1.5.0/24 }] } }
volumes:
  unused:
`)
    const id = runRules(m, { locale: 'id' })
    const en = runRules(m, { locale: 'en' })
    expect(en.map((i) => i.messageId)).toEqual(id.map((i) => i.messageId))
    // Hampir semua aturan terpicu oleh contoh ini.
    expect(new Set(id.map((i) => i.ruleId)).size).toBeGreaterThanOrEqual(14)
    for (let k = 0; k < id.length; k++) {
      expect(en[k]!.message).not.toBe(id[k]!.message)
      expect(en[k]!.message).not.toMatch(/undefined/)
      expect(id[k]!.message).not.toMatch(/undefined/)
    }
  })

  it('contoh pesan EN', () => {
    const m = model(
      'services:\n  app:\n    image: x:1\n    depends_on: [worker]\n  worker:\n    image: x:1\n    depends_on: [app]\n',
    )
    const [i] = runRules(m, { locale: 'en' })
    expect(i!.message).toBe('Circular dependency: app → worker → app.')
    expect(i!.hint).toContain('start order')
  })

  it('relocalize mengganti bahasa tanpa menjalankan ulang aturan', () => {
    const m = model('services:\n  r:\n    image: redis\n')
    const [id] = runRules(m)
    const en = relocalize(id!, 'en')
    expect(en.message).toBe('Image "redis" has no tag; the version can change at any time.')
    expect(en.source).toEqual(id!.source)
    expect(relocalize(en, 'id').message).toBe(id!.message)
  })

  it('messageId tak dikenal tidak membuat crash', () => {
    expect(localize('en', 'NOPE')).toEqual({ message: 'NOPE' })
  })

  it('setiap aturan bisa dijalankan tanpa locale (default ID)', () => {
    const m = model('services:\n  a:\n    command: x\n')
    for (const r of rules) expect(() => r.check(m)).not.toThrow()
    expect(rules.find((r) => r.id === 'CFG001')!.check(m)[0]!.message).toContain(
      'tidak punya image',
    )
  })

  it('error parser diterjemahkan', () => {
    const { errors } = parse('a: b: c\n')
    const id = parseErrorToIssue(errors[0]!, 'id')
    const en = parseErrorToIssue(errors[0]!, 'en')
    expect(id.message).toMatch(/^YAML tidak valid: /)
    expect(en.message).toMatch(/^Invalid YAML: /)
    expect(id.ruleId).toBe('YAML')

    const multi = parse('a: 1\n---\nb: 2\n').errors[0]!
    expect(parseErrorToIssue(multi, 'en')).toMatchObject({
      severity: 'warning',
      messageId: 'YAML.multiDoc',
    })
    const root = parse('- a\n').errors[0]!
    expect(parseErrorToIssue(root, 'en').message).toContain('must be a mapping')
  })
})

describe('teks UI', () => {
  it('ID dan EN punya kunci yang sama', () => {
    expect(catalogKeys('en').sort()).toEqual(catalogKeys('id').sort())
  })

  it('parameter disisipkan', () => {
    expect(translate('id', 'issues.line', { line: 12 })).toBe('baris 12')
    expect(translate('en', 'issues.line', { line: 12 })).toBe('line 12')
    expect(translate('en', 'detail.goto', { line: 3 })).toBe('Show in editor, line 3 →')
  })
})
