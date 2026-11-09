import type { Issue, Rule } from './types'
import { makeIssue } from './types'

export const net005: Rule = {
  id: 'NET005',
  severity: 'warning',
  title: 'Static IP tanpa subnet eksplisit',
  check(model, locale) {
    const nets = new Map(model.networks.map((n) => [n.name, n]))
    const issues: Issue[] = []
    for (const s of model.services) {
      for (const att of s.networks) {
        const net = nets.get(att.network)
        if (!att.ipv4Address || !net || net.external || net.subnets.length > 0) continue
        issues.push(
          makeIssue(
            this,
            locale,
            'NET005',
            { network: net.name, service: s.name },
            { services: [s.name], networks: [net.name], source: att.source },
          ),
        )
      }
    }
    return issues
  },
}
