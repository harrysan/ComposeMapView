import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createStoreForTest, DEBOUNCE_MS } from '@/composables/useCompose'
import { examples } from '@/examples'

const VALID = `services:
  web:
    image: nginx:1.27
    ports: ["80:80"]
    depends_on: [db]
  db:
    image: postgres:16
`

describe('useCompose', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('loadText menganalisis langsung dan memilih service dengan masalah terbanyak', () => {
    const store = createStoreForTest()
    store.loadText(examples.find((e) => e.id === 'micro')!.yaml, true)
    expect(store.valid.value).toBe(true)
    expect(store.model.value?.services.length).toBe(7)
    expect(store.counts.value.error).toBeGreaterThan(0)
    expect(store.selected.value).toBe('s:orders')
  })

  it('perubahan teks dianalisis setelah debounce', async () => {
    const store = createStoreForTest()
    store.loadText(VALID)
    store.text.value = VALID.replace('postgres:16', 'postgres')
    await nextTick()
    expect(store.issues.value.map((i) => i.ruleId)).not.toContain('IMG001')
    vi.advanceTimersByTime(DEBOUNCE_MS)
    expect(store.issues.value.map((i) => i.ruleId)).toContain('IMG001')
  })

  it('YAML tidak valid: model lama dipertahankan, issue YAML ditampilkan', async () => {
    const store = createStoreForTest()
    store.loadText(VALID)
    store.text.value = VALID + 'foo: a: b\n'
    await nextTick()
    vi.advanceTimersByTime(DEBOUNCE_MS)
    expect(store.valid.value).toBe(false)
    expect(store.stale.value).toBe(true)
    expect(store.model.value?.services.length).toBe(2)
    expect(store.issues.value).toEqual([
      expect.objectContaining({ ruleId: 'YAML', severity: 'error' }),
    ])
    expect(store.graph.value?.nodes.length).toBeGreaterThan(0)
  })

  it('activateIssue menyorot node terkait dan meminta lompat ke baris', () => {
    const store = createStoreForTest()
    store.loadText(examples.find((e) => e.id === 'micro')!.yaml)
    const idx = store.issues.value.findIndex((i) => i.ruleId === 'DEP002')
    store.activateIssue(idx)
    expect(store.activeIssue.value).toBe(idx)
    expect([...store.focus.value!].sort()).toEqual(['s:billing', 's:orders'])
    expect(store.jump.value?.line).toBe(store.issues.value[idx]!.source!.startLine)
  })

  it('selectKey memfokuskan tetangga; clearSelection menghapusnya', () => {
    const store = createStoreForTest()
    store.loadText(VALID)
    store.selectKey('s:web')
    expect([...store.focus.value!].sort()).toEqual(['n:default', 's:db', 's:web'])
    store.clearSelection()
    expect(store.selected.value).toBeNull()
    expect(store.focus.value).toBeNull()
  })

  it('pilihan yang tidak ada lagi dihapus setelah analisis ulang', () => {
    const store = createStoreForTest()
    store.loadText(VALID)
    store.selectKey('s:db')
    store.text.value = 'services:\n  web:\n    image: nginx:1\n'
    store.analyze()
    expect(store.selected.value).toBeNull()
  })

  it('ketiga contoh adalah YAML valid', () => {
    for (const ex of examples) {
      const store = createStoreForTest()
      store.loadText(ex.yaml)
      expect({ id: ex.id, valid: store.valid.value }).toEqual({ id: ex.id, valid: true })
    }
    const clean = createStoreForTest()
    clean.loadText(examples.find((e) => e.id === 'wordpress')!.yaml)
    expect(clean.counts.value.error).toBe(0)
  })
})
