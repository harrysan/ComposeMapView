import { cidrToRange, ipToInt } from '../util/cidr'
import type { Issue, Rule } from './types'
import { makeIssue } from './types'

export const net003: Rule = {
  id: 'NET003',
  severity: 'error',
  title: 'ipv4_address di luar subnet',
  check(model, locale) {
    const nets = new Map(model.networks.map((n) => [n.name, n]))
    const issues: Issue[] = []
    for (const s of model.services) {
      for (const att of s.networks) {
        const net = nets.get(att.network)
        if (!att.ipv4Address || !net || net.external) continue
        const ip = ipToInt(att.ipv4Address)
        const ranges = net.subnets.map(cidrToRange).filter((r) => r !== null)
        // IP/subnet tak ter-resolve atau IPv6: lewati, jangan beri peringatan palsu.
        if (ip === null || ranges.length === 0) continue
        if (ranges.some((r) => ip >= r.start && ip <= r.end)) continue
        issues.push(
          makeIssue(
            this,
            locale,
            'NET003',
            { ip: att.ipv4Address, service: s.name, subnets: net.subnets.join(', ') },
            { services: [s.name], networks: [net.name], source: att.source },
          ),
        )
      }
    }
    return issues
  },
}
