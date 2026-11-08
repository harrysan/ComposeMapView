import type { Document, LineCounter } from 'yaml'
import type { ComposeModel } from '../model'
import { parse } from '../parser'
import type { ParseError } from '../parser'
import { createContext, getEntry, mapEntries, scalarString } from './context'
import { normalizeDeclaredNetworks, resolveNetworks } from './networks'
import { normalizeService } from './service'
import { normalizeNamedVolumes } from './volumes'

export interface NormalizeOptions {
  /** Nilai variabel dari file `.env` (F11). */
  env?: Record<string, string>
}

/**
 * Dokumen YAML → ComposeModel. Fungsi murni; tidak pernah melempar exception
 * untuk input compose yang aneh — field yang tidak dikenali dilewati.
 */
export function normalize(
  doc: Document,
  lineCounter: LineCounter,
  options: NormalizeOptions = {},
): ComposeModel {
  const ctx = createContext(doc, lineCounter, options.env)
  const root = doc.contents

  const services = mapEntries(ctx, getEntry(ctx, root, 'services')?.value).map((e) =>
    normalizeService(ctx, e),
  )
  const declaredNetworks = normalizeDeclaredNetworks(ctx, getEntry(ctx, root, 'networks')?.value)

  const model: ComposeModel = {
    services,
    networks: resolveNetworks(declaredNetworks, services),
    volumes: normalizeNamedVolumes(ctx, getEntry(ctx, root, 'volumes')?.value),
    hasVersionField: getEntry(ctx, root, 'version') !== undefined,
    unresolvedVars: ctx.unresolvedVars,
  }
  const name = scalarString(ctx, getEntry(ctx, root, 'name')?.value)
  if (name) model.projectName = name
  return model
}

export interface ComposeResult {
  /** `null` bila YAML tidak valid; UI sebaiknya mempertahankan model terakhir yang valid. */
  model: ComposeModel | null
  errors: ParseError[]
}

/** Teks YAML → ComposeModel dalam satu langkah. */
export function parseCompose(text: string, options: NormalizeOptions = {}): ComposeResult {
  const { doc, lineCounter, errors } = parse(text)
  if (!doc) return { model: null, errors }
  return { model: normalize(doc, lineCounter, options), errors }
}
