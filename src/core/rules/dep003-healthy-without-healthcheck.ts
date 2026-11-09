import type { Issue, Rule } from './types'
import { makeIssue } from './types'

export const dep003: Rule = {
  id: 'DEP003',
  severity: 'warning',
  title: 'service_healthy tanpa healthcheck',
  check(model, locale) {
    const byName = new Map(model.services.map((s) => [s.name, s]))
    const issues: Issue[] = []
    for (const s of model.services) {
      for (const d of s.dependsOn) {
        const t = byName.get(d.service)
        if (!t || d.condition !== 'service_healthy') continue
        if (t.healthcheck && !t.healthcheck.disabled) continue
        issues.push(
          makeIssue(
            this,
            locale,
            'DEP003',
            { service: s.name, dependency: t.name },
            { services: [s.name, t.name], source: d.source },
          ),
        )
      }
    }
    return issues
  },
}
