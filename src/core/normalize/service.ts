import type { Dependency, EnvVar, Service } from '../model'
import {
  getEntry,
  isMapNode,
  isSeqNode,
  mapEntries,
  rangeOf,
  scalar,
  scalarBool,
  scalarString,
  seqItems,
  stringList,
} from './context'
import type { MapEntry, NormalizeContext } from './context'
import { parseImage } from './image'
import { hasVariables } from './interpolate'
import { DEFAULT_NETWORK, normalizeServiceNetworks } from './networks'
import { normalizePorts } from './ports'
import { normalizeVolumeMounts } from './volumes'

const CONDITIONS: Dependency['condition'][] = [
  'service_started',
  'service_healthy',
  'service_completed_successfully',
]

/** `depends_on`: list `[db]` atau map `{db: {condition: service_healthy}}`. */
export function normalizeDependsOn(ctx: NormalizeContext, node: unknown): Dependency[] {
  if (isMapNode(ctx, node)) {
    return mapEntries(ctx, node).map((e) => {
      const cond = scalarString(ctx, getEntry(ctx, e.value, 'condition')?.value)
      const condition = CONDITIONS.find((c) => c === cond) ?? 'service_started'
      return { service: e.key, condition, source: e.range }
    })
  }
  const result: Dependency[] = []
  for (const item of seqItems(ctx, node)) {
    const name = scalarString(ctx, item)
    if (name)
      result.push({ service: name, condition: 'service_started', source: rangeOf(ctx, item) })
  }
  return result
}

/** `environment`: list `["A=1", "B"]` atau map `{A: 1, B: null}`. */
export function normalizeEnvironment(ctx: NormalizeContext, node: unknown): EnvVar[] {
  if (isMapNode(ctx, node)) {
    return mapEntries(ctx, node).map((e) => {
      const v = scalar(ctx, e.value)
      const env: EnvVar = {
        key: e.key,
        isInterpolated: v ? hasVariables(v.raw) : false,
        source: e.range,
      }
      if (v) env.value = v.value
      return env
    })
  }
  const result: EnvVar[] = []
  for (const item of seqItems(ctx, node)) {
    const v = scalar(ctx, item)
    if (!v) continue
    const source = rangeOf(ctx, item)
    const eq = v.value.indexOf('=')
    const rawEq = v.raw.indexOf('=')
    if (eq === -1) {
      result.push({ key: v.value.trim(), isInterpolated: false, source })
      continue
    }
    result.push({
      key: v.value.slice(0, eq).trim(),
      value: v.value.slice(eq + 1),
      isInterpolated: hasVariables(rawEq === -1 ? v.raw : v.raw.slice(rawEq + 1)),
      source,
    })
  }
  return result
}

/** `healthcheck.test` berupa string atau list; `disable: true` atau `test: ["NONE"]`. */
export function normalizeHealthcheck(ctx: NormalizeContext, node: unknown): Service['healthcheck'] {
  if (!isMapNode(ctx, node)) return undefined
  const testNode = getEntry(ctx, node, 'test')?.value
  let test = ''
  let disabled = scalarBool(ctx, getEntry(ctx, node, 'disable')?.value) ?? false

  if (isSeqNode(ctx, testNode)) {
    const parts = seqItems(ctx, testNode)
      .map((i) => scalarString(ctx, i))
      .filter((s): s is string => s !== undefined)
    const [kind, ...args] = parts
    if (kind === 'NONE') disabled = true
    else if (kind === 'CMD' || kind === 'CMD-SHELL') test = args.join(' ')
    else test = parts.join(' ')
  } else {
    test = scalarString(ctx, testNode) ?? ''
  }
  return { test, disabled }
}

export function normalizeBuild(ctx: NormalizeContext, node: unknown): Service['build'] {
  if (node === undefined || node === null) return undefined
  if (isMapNode(ctx, node)) {
    const build: NonNullable<Service['build']> = {
      context: scalarString(ctx, getEntry(ctx, node, 'context')?.value) ?? '.',
    }
    const dockerfile = scalarString(ctx, getEntry(ctx, node, 'dockerfile')?.value)
    if (dockerfile) build.dockerfile = dockerfile
    return build
  }
  const context = scalarString(ctx, node)
  return context === undefined ? undefined : { context }
}

export function normalizeService(ctx: NormalizeContext, entry: MapEntry): Service {
  ctx.currentService = entry.key
  const node = entry.value
  const get = (key: string) => getEntry(ctx, node, key)?.value

  const service: Service = {
    name: entry.key,
    ports: normalizePorts(ctx, get('ports')),
    networks: normalizeServiceNetworks(ctx, get('networks')),
    volumes: normalizeVolumeMounts(ctx, get('volumes')),
    dependsOn: normalizeDependsOn(ctx, get('depends_on')),
    environment: normalizeEnvironment(ctx, get('environment')),
    envFiles: stringList(ctx, get('env_file')),
    profiles: stringList(ctx, get('profiles')),
    source: entry.range,
  }

  const image = scalarString(ctx, get('image'))
  if (image) service.image = parseImage(image)

  const build = normalizeBuild(ctx, get('build'))
  if (build) service.build = build

  const ext = get('extends')
  const extService = isMapNode(ctx, ext)
    ? scalarString(ctx, getEntry(ctx, ext, 'service')?.value)
    : scalarString(ctx, ext)
  if (extService) {
    service.extends = { service: extService }
    const file = scalarString(ctx, getEntry(ctx, ext, 'file')?.value)
    if (file) service.extends.file = file
  }

  const networkMode = scalarString(ctx, get('network_mode'))
  if (networkMode) service.networkMode = networkMode

  const healthcheck = normalizeHealthcheck(ctx, get('healthcheck'))
  if (healthcheck) service.healthcheck = healthcheck

  // Service tanpa `networks` dan tanpa `network_mode` otomatis masuk network `default`.
  if (
    service.networks.length === 0 &&
    !networkMode &&
    getEntry(ctx, node, 'networks') === undefined
  ) {
    service.networks.push({ network: DEFAULT_NETWORK, aliases: [], source: entry.range })
  }

  ctx.currentService = undefined
  return service
}
