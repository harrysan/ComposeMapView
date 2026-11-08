import { describe, expect, it } from 'vitest'
import { hasVariables, interpolate } from '@/core/normalize/interpolate'

describe('interpolate tanpa .env', () => {
  it('${VAR} tanpa nilai: teks mentah dipertahankan dan dicatat', () => {
    expect(interpolate('${DB_PORT}:3306')).toEqual({
      value: '${DB_PORT}:3306',
      unresolved: [{ name: 'DB_PORT', raw: '${DB_PORT}' }],
    })
  })

  it('$VAR tanpa kurung kurawal', () => {
    expect(interpolate('$HOME/data')).toEqual({
      value: '$HOME/data',
      unresolved: [{ name: 'HOME', raw: '$HOME' }],
    })
  })

  it('${VAR:-default} memakai default', () => {
    expect(interpolate('${PORT:-8080}:80')).toEqual({ value: '8080:80', unresolved: [] })
  })

  it('${VAR-default} memakai default', () => {
    expect(interpolate('${TAG-1.25}')).toEqual({ value: '1.25', unresolved: [] })
  })

  it('default boleh kosong', () => {
    expect(interpolate('a${X:-}b').value).toBe('ab')
  })

  it('default bersarang', () => {
    expect(interpolate('${A:-${B:-x}}')).toEqual({ value: 'x', unresolved: [] })
    expect(interpolate('${A:-${B}}').unresolved).toEqual([{ name: 'B', raw: '${B}' }])
  })

  it('${VAR:?err} dan ${VAR?err} dianggap tidak ter-resolve', () => {
    expect(interpolate('${X:?wajib}').unresolved).toHaveLength(1)
    expect(interpolate('${X?wajib}').value).toBe('${X?wajib}')
  })

  it('${VAR:+alt} tanpa nilai menjadi kosong', () => {
    expect(interpolate('[${X:+alt}]')).toEqual({ value: '[]', unresolved: [] })
    expect(interpolate('[${X+alt}]').value).toBe('[]')
  })

  it('$$ adalah escape untuk $', () => {
    expect(interpolate('$$HOME and $$(cmd)')).toEqual({ value: '$HOME and $(cmd)', unresolved: [] })
  })

  it('$ yang bukan variabel dibiarkan', () => {
    expect(interpolate('cost $5 ${').value).toBe('cost $5 ${')
    expect(interpolate('${}').value).toBe('${}')
  })

  it('beberapa variabel sekaligus', () => {
    expect(interpolate('${A}-${B:-b}-$C').unresolved.map((u) => u.name)).toEqual(['A', 'C'])
  })
})

describe('interpolate dengan .env', () => {
  const env = { SET: 'v', EMPTY: '' }

  it('memakai nilai env', () => {
    expect(interpolate('${SET}/$SET', env)).toEqual({ value: 'v/v', unresolved: [] })
  })

  it(':- memperlakukan kosong sebagai unset, - tidak', () => {
    expect(interpolate('${EMPTY:-d}', env).value).toBe('d')
    expect(interpolate('${EMPTY-d}', env).value).toBe('')
    expect(interpolate('${SET:-d}', env).value).toBe('v')
  })

  it(':? dan ?', () => {
    expect(interpolate('${EMPTY:?e}', env).unresolved).toHaveLength(1)
    expect(interpolate('${EMPTY?e}', env)).toEqual({ value: '', unresolved: [] })
    expect(interpolate('${SET:?e}', env).value).toBe('v')
  })

  it(':+ dan +', () => {
    expect(interpolate('${SET:+alt}', env).value).toBe('alt')
    expect(interpolate('${EMPTY:+alt}', env).value).toBe('')
    expect(interpolate('${EMPTY+alt}', env).value).toBe('alt')
  })
})

describe('hasVariables', () => {
  it('mendeteksi variabel, bukan escape', () => {
    expect(hasVariables('${X}')).toBe(true)
    expect(hasVariables('$X')).toBe(true)
    expect(hasVariables('$$X')).toBe(false)
    expect(hasVariables('plain')).toBe(false)
  })
})
