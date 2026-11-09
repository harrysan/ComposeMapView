import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'

/** Nama parameter di hash: `#c=<data>` (SPEC §10). */
export const SHARE_PARAM = 'c'
/** Di atas panjang ini beberapa aplikasi chat bisa memotong link. */
export const MAX_SAFE_LINK_LENGTH = 8000

export function encodeShare(text: string): string {
  return compressToEncodedURIComponent(text)
}

export type ShareReadResult =
  { status: 'none' } | { status: 'ok'; text: string } | { status: 'broken' }

/** Baca isi YAML dari hash URL (`#c=...`). Tidak pernah melempar exception. */
export function readShareHash(hash: string): ShareReadResult {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const data = params.get(SHARE_PARAM)
  if (data === null) return { status: 'none' }
  try {
    // URLSearchParams mengubah "+" menjadi spasi; kembalikan dulu.
    const text = decompressFromEncodedURIComponent(data.replace(/ /g, '+'))
    return text ? { status: 'ok', text } : { status: 'broken' }
  } catch {
    return { status: 'broken' }
  }
}

/** Link lengkap ke halaman ini dengan YAML di hash. Hash tidak pernah dikirim ke server. */
export function buildShareUrl(
  text: string,
  base: Pick<Location, 'origin' | 'pathname' | 'search'>,
): string {
  return `${base.origin}${base.pathname}${base.search}#${SHARE_PARAM}=${encodeShare(text)}`
}
