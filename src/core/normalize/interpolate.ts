export interface UnresolvedVar {
  name: string
  raw: string // mis. "${DB_PORT}" atau "$DB_PORT"
}

export interface InterpolateResult {
  value: string
  unresolved: UnresolvedVar[]
}

const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*/

/**
 * Interpolasi variabel ala Docker Compose:
 * `$VAR`, `${VAR}`, `${VAR:-def}`, `${VAR-def}`, `${VAR:?err}`, `${VAR?err}`,
 * `${VAR:+alt}`, `${VAR+alt}`, dan `$$` sebagai escape untuk `$`.
 *
 * Tanpa `env` semua variabel dianggap belum diset: nilai default dipakai bila ada,
 * selain itu teks mentahnya dipertahankan dan variabelnya dicatat di `unresolved`.
 */
export function interpolate(input: string, env?: Record<string, string>): InterpolateResult {
  const unresolved: UnresolvedVar[] = []
  const value = expand(input, env ?? {}, unresolved)
  return { value, unresolved }
}

export function hasVariables(input: string): boolean {
  return /\$(\{|[A-Za-z_])/.test(input.replace(/\$\$/g, ''))
}

function expand(input: string, env: Record<string, string>, unresolved: UnresolvedVar[]): string {
  let out = ''
  let i = 0
  while (i < input.length) {
    const ch = input[i]
    if (ch !== '$') {
      out += ch
      i++
      continue
    }
    const next = input[i + 1]
    if (next === '$') {
      out += '$'
      i += 2
      continue
    }
    if (next === '{') {
      const close = findClosingBrace(input, i + 2)
      if (close === -1) {
        // `${` tanpa penutup: biarkan apa adanya.
        out += input.slice(i)
        break
      }
      const raw = input.slice(i, close + 1)
      out += expandBraced(input.slice(i + 2, close), raw, env, unresolved)
      i = close + 1
      continue
    }
    const m = NAME_RE.exec(input.slice(i + 1))
    if (m) {
      const name = m[0]
      const raw = '$' + name
      if (name in env) out += env[name]
      else {
        unresolved.push({ name, raw })
        out += raw
      }
      i += 1 + name.length
      continue
    }
    out += '$'
    i++
  }
  return out
}

function findClosingBrace(s: string, from: number): number {
  let depth = 1
  for (let i = from; i < s.length; i++) {
    if (s[i] === '{') depth++
    else if (s[i] === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function expandBraced(
  body: string,
  raw: string,
  env: Record<string, string>,
  unresolved: UnresolvedVar[],
): string {
  const m = NAME_RE.exec(body)
  if (!m) {
    // Sintaks tidak dikenal, mis. `${}`: biarkan mentah.
    return raw
  }
  const name = m[0]
  const rest = body.slice(name.length)
  const isSet = name in env
  const val = env[name] ?? ''
  const isNonEmpty = isSet && val !== ''

  const op = /^(:-|-|:\?|\?|:\+|\+)/.exec(rest)?.[0]
  const arg = op ? rest.slice(op.length) : ''

  if (!op) {
    if (rest !== '') return raw // mis. `${VAR/x}`: tidak didukung
    if (isSet) return val
    unresolved.push({ name, raw })
    return raw
  }

  switch (op) {
    case ':-':
      return isNonEmpty ? val : expand(arg, env, unresolved)
    case '-':
      return isSet ? val : expand(arg, env, unresolved)
    case ':?':
      if (isNonEmpty) return val
      unresolved.push({ name, raw })
      return raw
    case '?':
      if (isSet) return val
      unresolved.push({ name, raw })
      return raw
    case ':+':
      return isNonEmpty ? expand(arg, env, unresolved) : ''
    case '+':
      return isSet ? expand(arg, env, unresolved) : ''
  }
  return raw
}
