import type { NamedVolume, VolumeMount } from '../model'
import {
  getEntry,
  isMapNode,
  mapEntries,
  rangeOf,
  scalar,
  scalarBool,
  scalarString,
  seqItems,
} from './context'
import type { NormalizeContext } from './context'

/**
 * Source diawali `.`, `/`, atau `~` berarti bind mount.
 * Nama volume Docker tidak boleh berisi `/` atau `\`, jadi path seperti
 * `${DATA_DIR}/x` atau `C:\data` juga dianggap bind.
 * Source yang seluruhnya variabel tak ter-resolve juga dianggap bind, supaya
 * VOL001 tidak memunculkan peringatan palsu.
 */
export function isBindSource(source: string): boolean {
  return (
    /^[./~]/.test(source) ||
    source.includes('/') ||
    source.includes('\\') ||
    /^[A-Za-z]:/.test(source) ||
    source.startsWith('$')
  )
}

/**
 * Short syntax: `"data:/var/lib/mysql"`, `"./src:/app:ro"`, `"/abs:/x"`,
 * `"/only/container/path"` (volume anonim).
 */
export function parseVolumeString(
  raw: string,
): Omit<VolumeMount, 'raw' | 'sourceRange'> | undefined {
  let s = raw.trim()
  if (!s) return undefined

  // Path Windows "C:\x:/y" — jangan pecah titik dua setelah huruf drive.
  let drive = ''
  if (/^[A-Za-z]:[\\/]/.test(s)) {
    drive = s.slice(0, 2)
    s = s.slice(2)
  }
  const parts = s.split(':')
  if (drive) parts[0] = drive + parts[0]

  if (parts.length === 1) {
    return { type: 'volume', target: parts[0]!, readOnly: false }
  }

  const [source, target, mode = ''] = parts
  if (!target) return undefined
  const readOnly = mode.split(',').includes('ro')
  return {
    type: isBindSource(source!) ? 'bind' : 'volume',
    source: source || undefined,
    target,
    readOnly,
  }
}

export function normalizeVolumeMounts(ctx: NormalizeContext, node: unknown): VolumeMount[] {
  const result: VolumeMount[] = []
  for (const item of seqItems(ctx, node)) {
    const sourceRange = rangeOf(ctx, item)
    if (isMapNode(ctx, item)) {
      const m = normalizeLongVolume(ctx, item)
      if (m) result.push({ ...m, sourceRange })
      continue
    }
    const v = scalar(ctx, item)
    if (!v) continue
    const parsed = parseVolumeString(v.value)
    if (parsed) result.push({ ...parsed, raw: v.raw, sourceRange })
  }
  return result
}

function normalizeLongVolume(
  ctx: NormalizeContext,
  node: unknown,
): Omit<VolumeMount, 'sourceRange'> | undefined {
  const typeStr = scalarString(ctx, getEntry(ctx, node, 'type')?.value) ?? 'volume'
  const source = scalarString(ctx, getEntry(ctx, node, 'source')?.value)
  const target = scalarString(ctx, getEntry(ctx, node, 'target')?.value)
  if (!target) return undefined
  const readOnly = scalarBool(ctx, getEntry(ctx, node, 'read_only')?.value) ?? false

  // `npipe` dan `cluster` jarang dipakai; perlakukan sebagai bind supaya tidak jadi node volume.
  const type: VolumeMount['type'] =
    typeStr === 'volume' ? 'volume' : typeStr === 'tmpfs' ? 'tmpfs' : 'bind'

  const raw = `${type}: ${source ? `${source} → ` : ''}${target}${readOnly ? ' (ro)' : ''}`
  return { type, source: source || undefined, target, readOnly, raw }
}

/** Top-level `volumes:`. */
export function normalizeNamedVolumes(ctx: NormalizeContext, node: unknown): NamedVolume[] {
  return mapEntries(ctx, node).map((e) => {
    const vol: NamedVolume = {
      name: e.key,
      external: isExternal(ctx, e.value),
      source: e.range,
    }
    const driver = scalarString(ctx, getEntry(ctx, e.value, 'driver')?.value)
    if (driver) vol.driver = driver
    return vol
  })
}

/** `external: true` atau bentuk lama `external: { name: x }`. */
export function isExternal(ctx: NormalizeContext, node: unknown): boolean {
  const ext = getEntry(ctx, node, 'external')?.value
  if (ext === undefined || ext === null) return false
  if (isMapNode(ctx, ext)) return true
  return scalarBool(ctx, ext) ?? false
}
