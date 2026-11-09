import { describe, expect, it } from 'vitest'
import {
  buildShareUrl,
  encodeShare,
  MAX_SAFE_LINK_LENGTH,
  readShareHash,
  SHARE_PARAM,
} from '@/composables/useShareLink'
import { examples } from '@/examples'

const base = { origin: 'https://example.dev', pathname: '/ComposeMapView/', search: '' }

describe('link share', () => {
  it('round-trip: YAML → URL → YAML identik', () => {
    for (const ex of examples) {
      const url = buildShareUrl(ex.yaml, base)
      expect(url.startsWith(`https://example.dev/ComposeMapView/#${SHARE_PARAM}=`)).toBe(true)
      const hash = url.slice(url.indexOf('#'))
      expect(readShareHash(hash)).toEqual({ status: 'ok', text: ex.yaml })
    }
  })

  it('karakter non-ASCII dan simbol tetap utuh', () => {
    const text = 'services:\n  app:\n    environment:\n      MSG: "Halo, dunia! ✓ ${X:-ü} & ?#="\n'
    expect(readShareHash('#c=' + encodeShare(text))).toEqual({ status: 'ok', text })
  })

  it('hash tanpa parameter c', () => {
    expect(readShareHash('')).toEqual({ status: 'none' })
    expect(readShareHash('#foo=1')).toEqual({ status: 'none' })
  })

  it('data rusak atau terpotong dikenali sebagai broken', () => {
    expect(readShareHash('#c=')).toEqual({ status: 'broken' })
    expect(readShareHash('#c=@@@not-lz@@@')).toEqual({ status: 'broken' })
  })

  it('contoh bawaan muat dalam batas aman panjang link', () => {
    for (const ex of examples) {
      expect(buildShareUrl(ex.yaml, base).length).toBeLessThan(MAX_SAFE_LINK_LENGTH)
    }
  })
})
