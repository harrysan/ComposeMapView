import type { Rule } from './types'
import { makeIssue } from './types'

export const cfg003: Rule = {
  id: 'CFG003',
  severity: 'warning',
  title: 'network_mode: host digabung dengan ports',
  check(model, locale) {
    return model.services
      .filter((s) => s.networkMode === 'host' && s.ports.length > 0)
      .map((s) =>
        makeIssue(
          this,
          locale,
          'CFG003',
          { service: s.name },
          { services: [s.name], source: s.ports[0]!.source },
        ),
      )
  },
}
