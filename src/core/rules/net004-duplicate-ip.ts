import type { Issue, Rule } from './types'
import { makeIssue } from './types'

export const net004: Rule = {
  id: 'NET004',
  severity: 'error',
  title: 'ipv4_address dipakai dua kali',
  check(model, locale) {
    const seen = new Map<string, string>()
    const issues: Issue[] = []
    for (const s of model.services) {
      for (const att of s.networks) {
        if (!att.ipv4Address) continue
        const key = `${att.network}|${att.ipv4Address}`
        const first = seen.get(key)
        if (first === undefined) {
          seen.set(key, s.name)
          continue
        }
        issues.push(
          makeIssue(
            this,
            locale,
            'NET004',
            { ip: att.ipv4Address, first, second: s.name, network: att.network },
            { services: [first, s.name], networks: [att.network], source: att.source },
          ),
        )
      }
    }
    return issues
  },
}
