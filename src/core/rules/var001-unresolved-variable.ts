import type { Issue, Rule } from './types'
import { makeIssue } from './types'

export const var001: Rule = {
  id: 'VAR001',
  severity: 'info',
  title: 'Variabel tidak bisa di-resolve',
  check(model, locale) {
    const seen = new Set<string>()
    const issues: Issue[] = []
    const ordered = [...model.unresolvedVars].sort(
      (a, b) => a.source.startLine - b.source.startLine,
    )
    for (const v of ordered) {
      if (seen.has(v.name)) continue
      seen.add(v.name)
      issues.push(
        makeIssue(
          this,
          locale,
          'VAR001',
          { name: v.name },
          { services: v.service ? [v.service] : [], source: v.source },
        ),
      )
    }
    return issues
  },
}
