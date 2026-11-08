import { parseCompose } from '@/core/normalize'
import type { NormalizeOptions } from '@/core/normalize'
import type { ComposeModel, Service } from '@/core/model'

/** Parse + normalize, dan gagal keras bila YAML tidak valid. */
export function model(yaml: string, options?: NormalizeOptions): ComposeModel {
  const r = parseCompose(yaml, options)
  if (!r.model) throw new Error('YAML tidak valid: ' + r.errors.map((e) => e.message).join('; '))
  return r.model
}

/** Normalisasi satu service bernama `s` dari potongan YAML (tanpa indentasi awal). */
export function service(body: string, options?: NormalizeOptions): Service {
  const indented = body
    .split('\n')
    .map((l) => '    ' + l)
    .join('\n')
  const m = model(`services:\n  s:\n${indented}\n`, options)
  return m.services[0]!
}
