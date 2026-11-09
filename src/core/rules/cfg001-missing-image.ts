import type { Rule } from './types'
import { makeIssue } from './types'

export const cfg001: Rule = {
  id: 'CFG001',
  severity: 'error',
  title: 'Service tanpa image maupun build',
  check(model, locale) {
    return model.services
      .filter((s) => !s.image && !s.build && !s.extends)
      .map((s) =>
        makeIssue(
          this,
          locale,
          'CFG001',
          { service: s.name },
          { services: [s.name], source: s.source },
        ),
      )
  },
}
