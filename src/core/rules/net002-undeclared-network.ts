import type { Issue, Rule } from './types'
import { makeIssue } from './types'

export const net002: Rule = {
  id: 'NET002',
  severity: 'error',
  title: 'Network tidak dideklarasikan',
  check(model, locale) {
    const undeclared = new Set(
      model.networks.filter((n) => !n.declared && !n.isDefault).map((n) => n.name),
    )
    const issues: Issue[] = []
    for (const s of model.services) {
      for (const att of s.networks) {
        if (!undeclared.has(att.network)) continue
        issues.push(
          makeIssue(
            this,
            locale,
            'NET002',
            { network: att.network, service: s.name },
            { services: [s.name], networks: [att.network], source: att.source },
          ),
        )
      }
    }
    return issues
  },
}
