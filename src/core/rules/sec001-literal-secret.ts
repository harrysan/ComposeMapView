import type { Issue, Rule } from './types'
import { makeIssue } from './types'
import { isSecretKey } from './util'

export const sec001: Rule = {
  id: 'SEC001',
  severity: 'warning',
  title: 'Rahasia ditulis langsung di file',
  check(model, locale) {
    const issues: Issue[] = []
    for (const s of model.services) {
      for (const e of s.environment) {
        if (!isSecretKey(e.key) || e.isInterpolated || !e.value) continue
        issues.push(
          makeIssue(
            this,
            locale,
            'SEC001',
            { key: e.key, service: s.name },
            { services: [s.name], source: e.source },
          ),
        )
      }
    }
    return issues
  },
}
