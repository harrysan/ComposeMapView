import { DEFAULT_LOCALE, localize } from '../i18n/messages'
import type { Locale, Params } from '../i18n/messages'
import type { ComposeModel, SourceRange } from '../model'

export type Severity = 'error' | 'warning' | 'info'

export interface Issue {
  ruleId: string // contoh: "PORT001"
  severity: Severity
  messageId: string // kunci pesan, mis. "PORT001.same"; teks ada di core/i18n
  params: Params // nilai yang disisipkan ke pesan
  message: string // bahasa manusia, sebut nama service/port
  hint?: string // saran perbaikan
  services: string[] // untuk menyorot node di diagram
  networks?: string[] // node network terkait (ekstensi dari SPEC §7)
  volumes?: string[] // node volume terkait (ekstensi dari SPEC §7)
  source?: SourceRange // untuk menyorot baris di editor
}

export interface Rule {
  id: string
  severity: Severity
  title: string
  check(model: ComposeModel, locale?: Locale): Issue[]
}

export const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 }

type IssueTarget = Pick<Issue, 'services' | 'networks' | 'volumes' | 'source'>

/** Bangun Issue dengan teks dalam bahasa yang diminta. */
export function makeIssue(
  rule: Pick<Rule, 'id' | 'severity'>,
  locale: Locale = DEFAULT_LOCALE,
  messageId: string,
  params: Params,
  target: IssueTarget,
): Issue {
  const issue: Issue = {
    ruleId: rule.id,
    severity: rule.severity,
    messageId,
    params,
    ...localize(locale, messageId, params),
    services: target.services,
  }
  if (target.networks) issue.networks = target.networks
  if (target.volumes) issue.volumes = target.volumes
  if (target.source) issue.source = target.source
  return issue
}

/** Ganti bahasa issue yang sudah ada tanpa menjalankan ulang aturannya. */
export function relocalize(issue: Issue, locale: Locale): Issue {
  const { message, hint } = localize(locale, issue.messageId, issue.params)
  const out: Issue = { ...issue, message }
  if (hint === undefined) delete out.hint
  else out.hint = hint
  return out
}
