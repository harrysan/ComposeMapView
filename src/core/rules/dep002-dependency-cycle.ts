import type { ComposeModel } from '../model'
import type { Rule } from './types'
import { makeIssue } from './types'

/** Semua siklus depends_on (masing-masing dilaporkan sekali), termasuk service yang bergantung pada dirinya sendiri. */

export function findDependencyCycles(model: ComposeModel): string[][] {
  const names = new Set(model.services.map((s) => s.name))
  const adj = new Map(
    model.services.map((s) => [
      s.name,
      s.dependsOn.map((d) => d.service).filter((n) => names.has(n)),
    ]),
  )
  const state = new Map<string, 1 | 2>() // 1 = sedang dikunjungi, 2 = selesai
  const stack: string[] = []
  const seen = new Set<string>()
  const cycles: string[][] = []

  const dfs = (u: string) => {
    state.set(u, 1)
    stack.push(u)
    for (const v of adj.get(u) ?? []) {
      if (state.get(v) === 1) {
        const cycle = stack.slice(stack.indexOf(v))
        const key = [...cycle].sort().join('\0')
        if (!seen.has(key)) {
          seen.add(key)
          cycles.push(cycle)
        }
      } else if (!state.has(v)) dfs(v)
    }
    stack.pop()
    state.set(u, 2)
  }
  for (const s of model.services) if (!state.has(s.name)) dfs(s.name)
  return cycles
}

export const dep002: Rule = {
  id: 'DEP002',
  severity: 'error',
  title: 'Dependensi melingkar',
  check(model, locale) {
    const byName = new Map(model.services.map((s) => [s.name, s]))
    return findDependencyCycles(model).map((cycle) => {
      const first = byName.get(cycle[0]!)!
      const next = cycle[1 % cycle.length]!
      return makeIssue(
        this,
        locale,
        'DEP002',
        { cycle: [...cycle, cycle[0]].join(' → ') },
        {
          services: cycle,
          source: first.dependsOn.find((d) => d.service === next)?.source ?? first.source,
        },
      )
    })
  },
}
