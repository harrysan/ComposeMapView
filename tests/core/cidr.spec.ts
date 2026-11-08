import { describe, it, expect } from 'vitest'
import { cidrOverlap, cidrToRange, ipInCidr, ipToInt } from '@/core/util/cidr'

describe('cidrToRange', () => {
  it('menghitung rentang /24', () => {
    expect(cidrToRange('172.20.5.0/24')).toEqual({
      start: ipToInt('172.20.5.0'),
      end: ipToInt('172.20.5.255'),
    })
  })

  it('mengabaikan host bit', () => {
    expect(cidrToRange('172.20.5.77/24')).toEqual(cidrToRange('172.20.5.0/24'))
  })

  it('menolak input tidak valid', () => {
    for (const bad of ['300.1.1.1/24', '10.0.0.0/33', 'abc', '10.0.0.0/', '10.0.0/24']) {
      expect(cidrToRange(bad)).toBeNull()
    }
  })
})

describe('cidrOverlap', () => {
  it('subnet besar mencakup subnet kecil', () => {
    expect(cidrOverlap('172.20.0.0/16', '172.20.5.0/24')).toBe(true)
  })
  it('subnet bersebelahan tidak beririsan', () => {
    expect(cidrOverlap('10.0.0.0/24', '10.0.1.0/24')).toBe(false)
  })
  it('subnet identik beririsan', () => {
    expect(cidrOverlap('10.0.0.0/24', '10.0.0.0/24')).toBe(true)
  })
  it('/0 beririsan dengan semua', () => {
    expect(cidrOverlap('0.0.0.0/0', '192.168.1.0/24')).toBe(true)
  })
})

describe('ipInCidr', () => {
  it('IP di batas atas masih di dalam', () => {
    expect(ipInCidr('172.20.5.255', '172.20.5.0/24')).toBe(true)
  })
  it('IP di luar subnet', () => {
    expect(ipInCidr('10.10.5.20', '172.20.5.0/24')).toBe(false)
  })
})
