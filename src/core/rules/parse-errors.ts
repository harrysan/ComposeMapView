import type { Locale, Params } from '../i18n/messages'
import type { ParseError } from '../parser'
import type { Issue, Severity } from './types'
import { makeIssue } from './types'

/** Error dari parser → Issue (ruleId "YAML") dalam bahasa yang diminta. */
export function parseErrorToIssue(e: ParseError, locale?: Locale): Issue {
  const severity: Severity = e.code === 'multiDoc' ? 'warning' : 'error'
  const params: Params = e.code === 'syntax' ? { detail: e.message.split('\n')[0]!.trim() } : {}
  return makeIssue({ id: 'YAML', severity }, locale, `YAML.${e.code}`, params, {
    services: [],
    source: e.source,
  })
}
