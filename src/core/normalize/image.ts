import type { ImageRef } from '../model'

/**
 * Pecah referensi image menjadi name/tag/digest.
 * Titik dua pada `registry:5000/app` adalah port registry, bukan tag:
 * tag hanya dihitung bila titik dua muncul setelah `/` terakhir.
 */
export function parseImage(raw: string): ImageRef {
  let rest = raw.trim()
  let digest: string | undefined
  const at = rest.indexOf('@')
  if (at !== -1) {
    digest = rest.slice(at + 1) || undefined
    rest = rest.slice(0, at)
  }

  let tag: string | undefined
  const colon = rest.lastIndexOf(':')
  if (colon > rest.lastIndexOf('/')) {
    tag = rest.slice(colon + 1) || undefined
    rest = rest.slice(0, colon)
  }

  const image: ImageRef = { name: rest, raw }
  if (tag !== undefined) image.tag = tag
  if (digest !== undefined) image.digest = digest
  return image
}
