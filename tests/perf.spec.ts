import { describe, expect, it } from 'vitest'
import { buildGraph } from '@/core/graph/build'
import { layoutGraph } from '@/core/graph/layout'
import { parseCompose } from '@/core/normalize'
import { runRules } from '@/core/rules'

/** Compose realistis dengan `n` service: port, env, network, volume, healthcheck, depends_on. */
export function bigCompose(n: number): string {
  const lines = ['name: perf', 'services:']
  for (let i = 0; i < n; i++) {
    lines.push(
      `  svc${i}:`,
      `    image: registry.local/team/svc${i}:1.${i}.0`,
      '    ports:',
      `      - "${10000 + i}:8080"`,
      `      - "127.0.0.1:${20000 + i}:9090"`,
      '    environment:',
      `      SERVICE_NAME: svc${i}`,
      '      DB_PASSWORD: ${DB_PASSWORD:-dev}',
      '      LOG_LEVEL: info',
      '    networks:',
      `      - net${i % 6}`,
      `      - net${(i + 1) % 6}`,
      '    volumes:',
      `      - data${i % 10}:/var/lib/svc`,
      `      - ./config/svc${i}:/etc/svc:ro`,
      '    healthcheck:',
      '      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]',
    )
    const deps = [i - 1, i - 3].filter((d) => d >= 0)
    if (deps.length) {
      lines.push('    depends_on:')
      for (const d of deps) lines.push(`      svc${d}:`, '        condition: service_healthy')
    }
  }
  lines.push('networks:')
  for (let k = 0; k < 6; k++) {
    lines.push(`  net${k}:`, '    ipam:', '      config:', `        - subnet: 172.${20 + k}.0.0/16`)
  }
  lines.push('volumes:')
  for (let k = 0; k < 10; k++) lines.push(`  data${k}:`)
  return lines.join('\n') + '\n'
}

async function pipeline(yaml: string) {
  const { model } = parseCompose(yaml)
  const issues = runRules(model!)
  const graph = buildGraph(model!, issues)
  await layoutGraph(graph)
  return { model: model!, issues, graph }
}

describe('performa (SPEC §14)', () => {
  it('50 service: parse + lint + layout < 1 detik', { timeout: 30_000 }, async () => {
    const yaml = bigCompose(50)
    await pipeline(yaml) // pemanasan: inisialisasi elkjs & JIT, bukan bagian dari pengukuran

    const t0 = performance.now()
    const { model, issues, graph } = await pipeline(yaml)
    const ms = performance.now() - t0

    expect(model.services).toHaveLength(50)
    expect(issues.filter((i) => i.severity === 'error')).toEqual([])
    expect(graph.nodes).toHaveLength(50 + 6 + 10)
    console.info(`[perf] 50 service: ${ms.toFixed(0)} ms`)
    expect(ms).toBeLessThan(1000)
  })
})
