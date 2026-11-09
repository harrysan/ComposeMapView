import { DEFAULT_LOCALE } from '../i18n/messages'
import type { Locale } from '../i18n/messages'
import type { ComposeModel } from '../model'
import { cfg001 } from './cfg001-missing-image'
import { cfg002 } from './cfg002-version-field'
import { cfg003 } from './cfg003-host-network-ports'
import { dep001 } from './dep001-missing-dependency'
import { dep002 } from './dep002-dependency-cycle'
import { dep003 } from './dep003-healthy-without-healthcheck'
import { img001 } from './img001-unpinned-image'
import { net001 } from './net001-subnet-overlap'
import { net002 } from './net002-undeclared-network'
import { net003 } from './net003-ip-outside-subnet'
import { net004 } from './net004-duplicate-ip'
import { net005 } from './net005-static-ip-without-subnet'
import { port001 } from './port001-host-port-conflict'
import { sec001 } from './sec001-literal-secret'
import { sec002 } from './sec002-exposed-database-port'
import type { Issue, Rule } from './types'
import { SEVERITY_ORDER } from './types'
import { var001 } from './var001-unresolved-variable'
import { vol001 } from './vol001-undeclared-volume'
import { vol002 } from './vol002-unused-volume'

export type { Issue, Rule, Severity } from './types'
export { SEVERITY_ORDER, relocalize } from './types'
export { findPortConflicts } from './port001-host-port-conflict'
export { findDependencyCycles } from './dep002-dependency-cycle'
export { exposedDatabasePorts, isSecretKey } from './util'
export { parseErrorToIssue } from './parse-errors'

/** Registry semua aturan v1 (SPEC §7.1). Menambah aturan cukup dengan membuat file baru dan mendaftarkannya di sini. */
export const rules: Rule[] = [
  cfg001,
  cfg002,
  cfg003,
  port001,
  net001,
  net002,
  net003,
  net004,
  net005,
  dep001,
  dep002,
  dep003,
  vol001,
  vol002,
  img001,
  sec001,
  sec002,
  var001,
]

export interface RunOptions {
  locale?: Locale
  rules?: Rule[]
}

/** Jalankan semua aturan; hasil diurutkan menurut severity lalu nomor baris. */
export function runRules(model: ComposeModel, options: RunOptions = {}): Issue[] {
  const locale = options.locale ?? DEFAULT_LOCALE
  const issues = (options.rules ?? rules).flatMap((r) => r.check(model, locale))
  return issues.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      (a.source?.startLine ?? Infinity) - (b.source?.startLine ?? Infinity),
  )
}
