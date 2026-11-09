import type { Issue, Rule } from './types'
import { makeIssue } from './types'

export const vol001: Rule = {
  id: 'VOL001',
  severity: 'error',
  title: 'Named volume tidak dideklarasikan',
  check(model, locale) {
    const declared = new Set(model.volumes.map((v) => v.name))
    const issues: Issue[] = []
    for (const s of model.services) {
      for (const m of s.volumes) {
        if (m.type !== 'volume' || !m.source || declared.has(m.source)) continue
        issues.push(
          makeIssue(
            this,
            locale,
            'VOL001',
            { volume: m.source, service: s.name },
            { services: [s.name], volumes: [m.source], source: m.sourceRange },
          ),
        )
      }
    }
    return issues
  },
}
