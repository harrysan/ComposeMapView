import type { Issue, Rule } from './types'
import { makeIssue } from './types'
import { DATABASE_PORTS, exposedDatabasePorts, formatRange } from './util'

export const sec002: Rule = {
  id: 'SEC002',
  severity: 'warning',
  title: 'Port database terbuka ke semua interface',
  check(model, locale) {
    const issues: Issue[] = []
    for (const s of model.services) {
      if (s.networkMode === 'host') continue
      for (const p of s.ports) {
        for (const port of exposedDatabasePorts(p)) {
          issues.push(
            makeIssue(
              this,
              locale,
              'SEC002',
              {
                port,
                db: DATABASE_PORTS[port] ?? '',
                service: s.name,
                published: formatRange(p.published!),
              },
              { services: [s.name], source: p.source },
            ),
          )
        }
      }
    }
    return issues
  },
}
