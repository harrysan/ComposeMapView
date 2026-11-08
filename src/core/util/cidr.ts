export interface IpRange {
  start: number
  end: number
}

export function ipToInt(ip: string): number | null {
  const parts = ip.trim().split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p) || Number(p) > 255) return null
    n = n * 256 + Number(p)
  }
  return n
}

export function cidrToRange(cidr: string): IpRange | null {
  const [ip, bitsStr] = cidr.split('/')
  if (bitsStr === '') return null
  const n = ipToInt(ip ?? '')
  const bits = bitsStr === undefined ? 32 : Number(bitsStr)
  if (n === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return null
  const size = 2 ** (32 - bits)
  const start = Math.floor(n / size) * size
  return { start, end: start + size - 1 }
}

export function cidrOverlap(a: string, b: string): boolean {
  const ra = cidrToRange(a)
  const rb = cidrToRange(b)
  if (!ra || !rb) return false
  return ra.start <= rb.end && rb.start <= ra.end
}

export function ipInCidr(ip: string, cidr: string): boolean {
  const n = ipToInt(ip)
  const r = cidrToRange(cidr)
  return n !== null && r !== null && n >= r.start && n <= r.end
}
