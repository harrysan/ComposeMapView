import { describe, expect, it } from 'vitest'
import { parse } from '@/core/parser'
import { parseCompose } from '@/core/normalize'

describe('parse', () => {
  it('YAML valid', () => {
    const r = parse('services:\n  web:\n    image: nginx\n')
    expect(r.errors).toEqual([])
    expect(r.doc).not.toBeNull()
  })

  it('error sintaks memberi baris dan kolom (1-based)', () => {
    const r = parse('services:\n  web:\n    image: nginx\n   bad: [unclosed\n')
    expect(r.doc).toBeNull()
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.errors[0]!.line).toBeGreaterThanOrEqual(3)
    expect(r.errors[0]!.col).toBeGreaterThanOrEqual(1)
    expect(r.errors[0]!.source.startLine).toBe(r.errors[0]!.line)
  })

  it('teks kosong tidak error', () => {
    expect(parse('')).toMatchObject({ doc: null, errors: [] })
    expect(parse('# hanya komentar\n')).toMatchObject({ doc: null, errors: [] })
  })

  it('root bukan mapping', () => {
    const r = parse('- a\n- b\n')
    expect(r.doc).toBeNull()
    expect(r.errors[0]?.message).toMatch(/mapping/)
  })

  it('beberapa dokumen: pakai yang pertama dan beri peringatan', () => {
    const r = parse('services: {}\n---\nfoo: 1\n')
    expect(r.doc).not.toBeNull()
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0]?.line).toBe(2)
  })

  it('tidak pernah melempar exception', () => {
    for (const s of ['{', ':', '\t\tx', '[[[', '*undefined_alias', 'a: *nope']) {
      expect(() => parseCompose(s)).not.toThrow()
    }
  })
})

describe('parseCompose', () => {
  it('YAML tidak valid → model null', () => {
    expect(parseCompose('services: [').model).toBeNull()
  })
})
