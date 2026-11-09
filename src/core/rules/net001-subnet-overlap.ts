import { cidrToRange } from '../util/cidr'
import type { Issue, Rule } from './types'
import { makeIssue } from './types'

/**
 * Hanya IPv4 di v1: subnet IPv6 atau yang masih berisi variabel tidak bisa
 * dikonversi oleh `cidrToRange` sehingga otomatis dilewati.
 * Network external dilewati karena subnet-nya tidak diketahui dari file.
 */
export const net001: Rule = {
  id: 'NET001',
  severity: 'error',
  title: 'Subnet tumpang tindih',
  check(model, locale) {
    const nets = model.networks.filter((n) => !n.external && n.subnets.length > 0)
    const issues: Issue[] = []
    for (let i = 0; i < nets.length; i++) {
      for (let j = i + 1; j < nets.length; j++) {
        const a = nets[i]!
        const b = nets[j]!
        for (const ca of a.subnets) {
          for (const cb of b.subnets) {
            const ra = cidrToRange(ca)
            const rb = cidrToRange(cb)
            if (!ra || !rb || ra.start > rb.end || rb.start > ra.end) continue
            issues.push(
              makeIssue(
                this,
                locale,
                'NET001',
                { subnetA: ca, netA: a.name, subnetB: cb, netB: b.name },
                { services: [], networks: [a.name, b.name], source: b.source },
              ),
            )
          }
        }
      }
    }
    return issues
  },
}
