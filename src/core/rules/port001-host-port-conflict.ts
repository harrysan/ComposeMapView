import type { ComposeModel, PortMapping, PortRange, Service } from '../model'
import type { Issue, Rule } from './types'
import { makeIssue } from './types'
import { formatRange, isWildcardIp, rangesOverlap } from './util'

export interface PortConflict {
  a: { service: Service; port: PortMapping }
  b: { service: Service; port: PortMapping }
  overlap: PortRange
}

function hostIpsOverlap(a: string, b: string): boolean {
  return a === b || isWildcardIp(a) || isWildcardIp(b)
}

/**
 * Pasangan mapping yang bentrok (SPEC §7.2):
 * protokol sama, rentang port host beririsan, dan host IP beririsan.
 * Mapping tanpa `published` (port acak / variabel tak ter-resolve) dan service
 * `network_mode: host` tidak diperiksa.
 */
export function findPortConflicts(model: ComposeModel): PortConflict[] {
  const maps: { service: Service; port: PortMapping; published: PortRange }[] = []
  for (const service of model.services) {
    if (service.networkMode === 'host') continue
    for (const port of service.ports) {
      if (port.published && !port.unresolved)
        maps.push({ service, port, published: port.published })
    }
  }
  const result: PortConflict[] = []
  for (let i = 0; i < maps.length; i++) {
    for (let j = i + 1; j < maps.length; j++) {
      const a = maps[i]!
      const b = maps[j]!
      if (a.port.protocol !== b.port.protocol) continue
      if (!rangesOverlap(a.published, b.published)) continue
      if (!hostIpsOverlap(a.port.hostIp, b.port.hostIp)) continue
      result.push({
        a,
        b,
        overlap: {
          start: Math.max(a.published.start, b.published.start),
          end: Math.min(a.published.end, b.published.end),
        },
      })
    }
  }
  return result
}

export const port001: Rule = {
  id: 'PORT001',
  severity: 'error',
  title: 'Port host bentrok',
  check(model, locale) {
    return findPortConflicts(model).map(({ a, b, overlap }): Issue => {
      const port = formatRange(overlap)
      const protocol = a.port.protocol
      const target = {
        services: [...new Set([a.service.name, b.service.name])],
        source: b.port.source,
      }
      return a.service === b.service
        ? makeIssue(
            this,
            locale,
            'PORT001.same',
            { port, protocol, service: a.service.name },
            target,
          )
        : makeIssue(
            this,
            locale,
            'PORT001',
            { port, protocol, a: a.service.name, b: b.service.name },
            target,
          )
    })
  },
}
