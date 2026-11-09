import type { PortMapping, PortRange } from '@/core/model'

export function formatRange(r: PortRange): string {
  return r.end > r.start ? `${r.start}-${r.end}` : `${r.start}`
}

const WILDCARD = ['0.0.0.0', '::', '']

/** Label badge port di node: `8080→80`, `127.0.0.1:6379→6379`, `?→80`, `53/udp`. */
export function formatPort(p: PortMapping): string {
  const ip = WILDCARD.includes(p.hostIp)
    ? ''
    : `${p.hostIp.includes(':') ? `[${p.hostIp}]` : p.hostIp}:`
  const published = p.published ? `${formatRange(p.published)}→` : p.unresolved ? '?→' : ''
  const proto = p.protocol === 'tcp' ? '' : `/${p.protocol}`
  return `${ip}${published}${formatRange(p.target)}${proto}`
}

export const NETWORK_COLOR_VARS = ['--n1', '--n2', '--n3', '--n4', '--n5', '--n6']

export function networkColor(index: number): string {
  return `var(${NETWORK_COLOR_VARS[index % NETWORK_COLOR_VARS.length]})`
}
