import type { PortMapping, PortRange } from '../model'

export function formatRange(r: PortRange): string {
  return r.end > r.start ? `${r.start}-${r.end}` : `${r.start}`
}

export function rangesOverlap(a: PortRange, b: PortRange): boolean {
  return a.start <= b.end && b.start <= a.end
}

/** Host IP yang mengikat semua interface. */
export function isWildcardIp(ip: string): boolean {
  return ip === '' || ip === '0.0.0.0' || ip === '::' || ip === '[::]'
}

/** Port database umum (SPEC SEC002). */
export const DATABASE_PORTS: Record<number, string> = {
  3306: 'MySQL',
  5432: 'PostgreSQL',
  6379: 'Redis',
  27017: 'MongoDB',
  9200: 'Elasticsearch',
}

/** Port database yang dipublish ke semua interface, atau `[]`. */
export function exposedDatabasePorts(port: PortMapping): number[] {
  if (!port.published || port.unresolved || !isWildcardIp(port.hostIp)) return []
  return Object.keys(DATABASE_PORTS)
    .map(Number)
    .filter((p) => p >= port.target.start && p <= port.target.end)
}

/** Key env yang mirip rahasia (SEC001). Key berakhiran `_FILE` berisi path, bukan rahasia. */
export function isSecretKey(key: string): boolean {
  if (/_FILE$/i.test(key)) return false
  return /(PASSWORD|PASSWD|SECRET|TOKEN|API_KEY|APIKEY|PRIVATE_KEY)/i.test(key)
}
