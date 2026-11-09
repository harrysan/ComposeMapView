import type { Rule } from './types'
import { makeIssue } from './types'

export const vol002: Rule = {
  id: 'VOL002',
  severity: 'info',
  title: 'Named volume tidak dipakai',
  check(model, locale) {
    const used = new Set<string>()
    for (const s of model.services) {
      for (const m of s.volumes) if (m.type === 'volume' && m.source) used.add(m.source)
    }
    return model.volumes
      .filter((v) => !used.has(v.name))
      .map((v) =>
        makeIssue(
          this,
          locale,
          'VOL002',
          { volume: v.name },
          { services: [], volumes: [v.name], source: v.source },
        ),
      )
  },
}
