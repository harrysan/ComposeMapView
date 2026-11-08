import type { Network, Service, ServiceNetworkAttachment } from '../model'
import {
  getEntry,
  isMapNode,
  mapEntries,
  rangeOf,
  scalarString,
  seqItems,
  stringList,
} from './context'
import type { NormalizeContext } from './context'
import { isExternal } from './volumes'

export const DEFAULT_NETWORK = 'default'

/**
 * `networks` di level service: list `[a, b]` atau map `{a: {aliases, ipv4_address}}`,
 * termasuk `a: null`.
 */
export function normalizeServiceNetworks(
  ctx: NormalizeContext,
  node: unknown,
): ServiceNetworkAttachment[] {
  if (isMapNode(ctx, node)) {
    return mapEntries(ctx, node).map((e) => {
      const att: ServiceNetworkAttachment = {
        network: e.key,
        aliases: stringList(ctx, getEntry(ctx, e.value, 'aliases')?.value),
        source: e.range,
      }
      const ip = scalarString(ctx, getEntry(ctx, e.value, 'ipv4_address')?.value)
      if (ip) att.ipv4Address = ip
      return att
    })
  }
  const result: ServiceNetworkAttachment[] = []
  for (const item of seqItems(ctx, node)) {
    const name = scalarString(ctx, item)
    if (name) result.push({ network: name, aliases: [], source: rangeOf(ctx, item) })
  }
  return result
}

/** Top-level `networks:`. */
export function normalizeDeclaredNetworks(ctx: NormalizeContext, node: unknown): Network[] {
  return mapEntries(ctx, node).map((e) => {
    const net: Network = {
      name: e.key,
      isDefault: e.key === DEFAULT_NETWORK,
      external: isExternal(ctx, e.value),
      subnets: [],
      declared: true,
      source: e.range,
    }
    const driver = scalarString(ctx, getEntry(ctx, e.value, 'driver')?.value)
    if (driver) net.driver = driver
    const ipam = getEntry(ctx, e.value, 'ipam')?.value
    for (const cfg of seqItems(ctx, getEntry(ctx, ipam, 'config')?.value)) {
      const subnet = scalarString(ctx, getEntry(ctx, cfg, 'subnet')?.value)
      if (subnet) net.subnets.push(subnet)
    }
    return net
  })
}

/**
 * Gabungkan network yang dideklarasikan dengan yang dipakai service:
 * - network `default` implisit ditambahkan bila ada service yang memakainya;
 * - network yang dipakai tapi tidak dideklarasikan dicatat dengan `declared: false` (untuk NET002).
 */
export function resolveNetworks(declared: Network[], services: Service[]): Network[] {
  const result = [...declared]
  const known = new Set(declared.map((n) => n.name))
  for (const svc of services) {
    for (const att of svc.networks) {
      if (known.has(att.network)) continue
      known.add(att.network)
      result.push({
        name: att.network,
        isDefault: att.network === DEFAULT_NETWORK,
        external: false,
        subnets: [],
        // `default` implisit juga `declared: false`; NET002 memakai `isDefault` untuk mengecualikannya.
        declared: false,
      })
    }
  }
  return result
}
