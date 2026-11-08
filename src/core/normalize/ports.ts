import type { PortMapping, PortRange } from '../model'
import { getEntry, isMapNode, rangeOf, scalar, seqItems } from './context'
import type { NormalizeContext } from './context'

type Protocol = PortMapping['protocol']

export interface ParsedPort {
  hostIp: string
  published?: PortRange
  target: PortRange
  protocol: Protocol
}

const DEFAULT_HOST_IP = '0.0.0.0'

export function parsePortRange(s: string | undefined, min = 0): PortRange | undefined {
  if (s === undefined) return undefined
  const m = /^\s*(\d+)(?:\s*-\s*(\d+))?\s*$/.exec(s)
  if (!m) return undefined
  const start = Number(m[1])
  const end = m[2] === undefined ? start : Number(m[2])
  if (start < min || end > 65535 || end < start) return undefined
  return { start, end }
}

function parseProtocol(s: string | undefined): Protocol | undefined {
  const p = (s ?? 'tcp').trim().toLowerCase()
  return p === 'tcp' || p === 'udp' || p === 'sctp' ? p : undefined
}

/**
 * Short syntax: `"80"`, `"8080:80"`, `"127.0.0.1:8080:80"`, `"127.0.0.1::80"`,
 * `"[::1]:8080:80"`, `"8080-8081:80-81"`, `"53:53/udp"`.
 * Mengembalikan `undefined` bila teks tidak valid.
 */
export function parsePortString(input: string): ParsedPort | undefined {
  let s = input.trim()
  let proto: string | undefined
  const slash = s.lastIndexOf('/')
  if (slash !== -1) {
    proto = s.slice(slash + 1)
    s = s.slice(0, slash)
  }
  const protocol = parseProtocol(proto)
  if (!protocol) return undefined

  let hostIp = DEFAULT_HOST_IP
  let published: string | undefined
  let target: string | undefined

  if (s.startsWith('[')) {
    // IPv6 dalam kurung siku: [::1]:8080:80
    const close = s.indexOf(']')
    if (close === -1 || s[close + 1] !== ':') return undefined
    hostIp = s.slice(1, close)
    const rest = s.slice(close + 2).split(':')
    if (rest.length !== 2) return undefined
    ;[published, target] = rest
  } else {
    const parts = s.split(':')
    if (parts.length === 1) target = parts[0]
    else if (parts.length === 2) [published, target] = parts
    else {
      target = parts.pop()
      published = parts.pop()
      hostIp = parts.join(':') || DEFAULT_HOST_IP
    }
  }

  const targetRange = parsePortRange(target, 1)
  if (!targetRange) return undefined
  let publishedRange: PortRange | undefined
  if (published !== undefined && published.trim() !== '') {
    publishedRange = parsePortRange(published)
    if (!publishedRange) return undefined
  }
  return { hostIp, published: publishedRange, target: targetRange, protocol }
}

export function normalizePorts(ctx: NormalizeContext, node: unknown): PortMapping[] {
  const result: PortMapping[] = []
  for (const item of seqItems(ctx, node)) {
    const source = rangeOf(ctx, item)
    if (isMapNode(ctx, item)) {
      const m = normalizeLongPort(ctx, item, source)
      if (m) result.push(m)
      continue
    }
    const v = scalar(ctx, item)
    if (!v) continue
    const parsed = parsePortString(v.value)
    if (parsed && !v.unresolved) {
      result.push({ ...parsed, unresolved: false, raw: v.raw, source })
    } else if (v.unresolved) {
      result.push(unresolvedPort(v.raw, v.value, source))
    }
    // Teks yang benar-benar tidak valid dilewati; tidak membuat app crash.
  }
  return result
}

function unresolvedPort(raw: string, value: string, source: PortMapping['source']): PortMapping {
  // Ambil apa yang bisa diambil (mis. target dari "${HOST_PORT}:80"), tanpa published
  // sehingga aturan bentrok port tidak pernah memakai mapping ini.
  const lastPart = value
    .replace(/\/\w+$/, '')
    .split(':')
    .pop()
  const target = parsePortRange(lastPart, 1) ?? { start: 0, end: 0 }
  const protocol = parseProtocol(/\/(\w+)$/.exec(value)?.[1]) ?? 'tcp'
  return { hostIp: DEFAULT_HOST_IP, target, protocol, unresolved: true, raw, source }
}

function normalizeLongPort(
  ctx: NormalizeContext,
  node: unknown,
  source: PortMapping['source'],
): PortMapping | undefined {
  const target = scalar(ctx, getEntry(ctx, node, 'target')?.value)
  const published = scalar(ctx, getEntry(ctx, node, 'published')?.value)
  const hostIp = scalar(ctx, getEntry(ctx, node, 'host_ip')?.value)
  const proto = scalar(ctx, getEntry(ctx, node, 'protocol')?.value)

  const raw =
    [hostIp?.raw, published?.raw ?? (hostIp ? '' : undefined), target?.raw]
      .filter((p) => p !== undefined)
      .join(':') + (proto ? `/${proto.raw}` : '')

  const unresolved = [target, published, hostIp, proto].some((v) => v?.unresolved)
  if (unresolved) return unresolvedPort(raw, target?.value ?? '', source)

  const targetRange = parsePortRange(target?.value, 1)
  const protocol = parseProtocol(proto?.value)
  if (!targetRange || !protocol) return undefined
  const publishedRange =
    published && published.value !== '' ? parsePortRange(published.value) : undefined
  if (published && published.value !== '' && !publishedRange) return undefined

  return {
    hostIp: hostIp?.value || DEFAULT_HOST_IP,
    published: publishedRange,
    target: targetRange,
    protocol,
    unresolved: false,
    raw,
    source,
  }
}
