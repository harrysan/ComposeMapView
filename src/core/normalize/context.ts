import { isAlias, isMap, isPair, isScalar, isSeq } from 'yaml'
import type { Document, LineCounter, Node, Pair, YAMLMap, YAMLSeq } from 'yaml'
import type { SourceRange, VarRef } from '../model'
import { interpolate } from './interpolate'

/**
 * Konteks normalisasi: membungkus dokumen YAML (AST) supaya tiap modul normalizer
 * bisa membaca nilai sekaligus posisi barisnya tanpa menyentuh detail library `yaml`.
 */
export interface NormalizeContext {
  doc: Document
  lineCounter: LineCounter
  /** Nilai variabel dari `.env` (F11). Kosong = semua variabel dianggap belum diset. */
  env: Record<string, string> | undefined
  unresolvedVars: VarRef[]
  /** Service yang sedang dinormalisasi, untuk dicatat di VarRef. */
  currentService?: string
}

export interface MapEntry {
  key: string
  value: Node | null
  range: SourceRange // dari awal key sampai akhir value
}

export function createContext(
  doc: Document,
  lineCounter: LineCounter,
  env?: Record<string, string>,
): NormalizeContext {
  return { doc, lineCounter, env, unresolvedVars: [] }
}

/** Ikuti alias `*anchor` ke node aslinya. */
export function deref(ctx: NormalizeContext, node: unknown): Node | null {
  let n = node
  for (let i = 0; i < 20 && isAlias(n); i++) n = n.resolve(ctx.doc)
  if (n === undefined || n === null) return null
  if (isScalar(n) && n.value === null) return null
  return n as Node
}

export function rangeOf(ctx: NormalizeContext, ...nodes: unknown[]): SourceRange {
  let start = Infinity
  let end = -Infinity
  for (const n of nodes) {
    const r = (n as { range?: [number, number, number] } | null)?.range
    if (!r) continue
    start = Math.min(start, r[0])
    end = Math.max(end, r[1])
  }
  if (start === Infinity) return { startLine: 1, endLine: 1 }
  const startLine = ctx.lineCounter.linePos(start).line
  const endLine = ctx.lineCounter.linePos(Math.max(start, end - 1)).line
  return { startLine, endLine: Math.max(startLine, endLine) }
}

function isMergeKey(key: unknown): boolean {
  return (
    isScalar(key) && (typeof key.value === 'symbol' || key.source === '<<' || key.value === '<<')
  )
}

/**
 * Isi mapping sebagai daftar entri, dengan merge key `<<: *anchor` sudah diterapkan
 * (key eksplisit menang atas key hasil merge).
 */
export function mapEntries(ctx: NormalizeContext, node: unknown): MapEntry[] {
  const map = deref(ctx, node)
  if (!isMap(map)) return []
  const own: MapEntry[] = []
  const merged: MapEntry[] = []

  for (const item of (map as YAMLMap).items) {
    if (!isPair(item)) continue
    const pair = item as Pair
    if (isMergeKey(pair.key)) {
      const src = deref(ctx, pair.value)
      const sources = isSeq(src) ? (src as YAMLSeq).items : [src]
      for (const s of sources) merged.push(...mapEntries(ctx, s))
      continue
    }
    const keyNode = deref(ctx, pair.key)
    const key = isScalar(keyNode) ? String(keyNode.value) : ''
    if (!key) continue
    own.push({ key, value: deref(ctx, pair.value), range: rangeOf(ctx, pair.key, pair.value) })
  }

  const seen = new Set(own.map((e) => e.key))
  const result = [...own]
  for (const e of merged) {
    if (seen.has(e.key)) continue
    seen.add(e.key)
    result.push(e)
  }
  return result
}

export function getEntry(ctx: NormalizeContext, node: unknown, key: string): MapEntry | undefined {
  return mapEntries(ctx, node).find((e) => e.key === key)
}

export function seqItems(ctx: NormalizeContext, node: unknown): Node[] {
  const seq = deref(ctx, node)
  if (!isSeq(seq)) return []
  return (seq as YAMLSeq).items.map((i) => deref(ctx, i)).filter((i): i is Node => i !== null)
}

export function isMapNode(ctx: NormalizeContext, node: unknown): boolean {
  return isMap(deref(ctx, node))
}

export function isSeqNode(ctx: NormalizeContext, node: unknown): boolean {
  return isSeq(deref(ctx, node))
}

/** Nilai skalar mentah (sebelum interpolasi), atau undefined bila bukan skalar. */
export function rawScalar(
  ctx: NormalizeContext,
  node: unknown,
): string | number | boolean | undefined {
  const n = deref(ctx, node)
  if (!isScalar(n)) return undefined
  const v = n.value
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v
  return undefined
}

export interface ScalarValue {
  value: string
  raw: string
  unresolved: boolean
}

/**
 * Nilai skalar sebagai string, dengan variabel `${VAR}` di-resolve.
 * Variabel yang tak punya nilai dicatat di `ctx.unresolvedVars`.
 */
export function scalar(ctx: NormalizeContext, node: unknown): ScalarValue | undefined {
  const v = rawScalar(ctx, node)
  if (v === undefined) return undefined
  const raw = String(v)
  if (typeof v !== 'string') return { value: raw, raw, unresolved: false }
  const res = interpolate(raw, ctx.env)
  if (res.unresolved.length > 0) {
    const source = rangeOf(ctx, deref(ctx, node))
    for (const u of res.unresolved) {
      ctx.unresolvedVars.push({ name: u.name, raw: u.raw, service: ctx.currentService, source })
    }
  }
  return { value: res.value, raw, unresolved: res.unresolved.length > 0 }
}

export function scalarString(ctx: NormalizeContext, node: unknown): string | undefined {
  return scalar(ctx, node)?.value
}

export function scalarBool(ctx: NormalizeContext, node: unknown): boolean | undefined {
  const s = scalarString(ctx, node)
  if (s === undefined) return undefined
  if (/^(true|yes|on)$/i.test(s)) return true
  if (/^(false|no|off)$/i.test(s)) return false
  return undefined
}

/** String atau list of string (mis. `env_file`, `profiles`). */
export function stringList(ctx: NormalizeContext, node: unknown): string[] {
  const n = deref(ctx, node)
  if (n === null) return []
  if (isSeq(n)) {
    return seqItems(ctx, n)
      .map((i) => scalarString(ctx, i) ?? scalarString(ctx, getEntry(ctx, i, 'path')?.value))
      .filter((s): s is string => s !== undefined)
  }
  const s = scalarString(ctx, n)
  return s === undefined ? [] : [s]
}
