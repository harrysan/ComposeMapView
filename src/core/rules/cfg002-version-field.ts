import type { Rule } from './types'
import { makeIssue } from './types'

export const cfg002: Rule = {
  id: 'CFG002',
  severity: 'info',
  title: 'Field version sudah usang',
  check(model, locale) {
    if (!model.hasVersionField) return []
    return [makeIssue(this, locale, 'CFG002', {}, { services: [], source: model.versionSource })]
  },
}
