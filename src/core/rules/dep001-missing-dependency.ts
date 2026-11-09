import type { Issue, Rule } from './types'
import { makeIssue } from './types'

export const dep001: Rule = {
  id: 'DEP001',
  severity: 'error',
  title: 'depends_on ke service yang tidak ada',
  check(model, locale) {
    const names = new Set(model.services.map((s) => s.name))
    const issues: Issue[] = []
    for (const s of model.services) {
      for (const d of s.dependsOn) {
        if (names.has(d.service)) continue
        issues.push(
          makeIssue(
            this,
            locale,
            'DEP001',
            { service: s.name, dependency: d.service },
            { services: [s.name], source: d.source },
          ),
        )
      }
    }
    return issues
  },
}
