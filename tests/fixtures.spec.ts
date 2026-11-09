import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseCompose } from '@/core/normalize'
import { runRules } from '@/core/rules'

const dir = join(__dirname, 'fixtures')
const files = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f))

describe('fixtures', () => {
  it('ada minimal 10 fixture', () => {
    expect(files.length).toBeGreaterThanOrEqual(10)
  })

  it.each(files)('%s dinormalisasi tanpa error', (file) => {
    const { model, errors } = parseCompose(readFileSync(join(dir, file), 'utf8'))
    expect(errors).toEqual([])
    expect(model).not.toBeNull()
    expect(model!.services.length).toBeGreaterThan(0)
    expect(model).toMatchSnapshot()
  })

  /**
   * Setiap `<nama>.expected.json` berisi daftar ruleId (terurut, boleh berulang)
   * yang diharapkan muncul. Menambah fixture baru cukup dengan menaruh kedua file.
   */
  it.each(files)('%s menghasilkan ruleId sesuai expected.json', (file) => {
    const expectedPath = join(dir, file.replace(/\.ya?ml$/, '.expected.json'))
    if (!existsSync(expectedPath)) throw new Error(`${expectedPath} belum ada`)
    const expected = JSON.parse(readFileSync(expectedPath, 'utf8')) as string[]
    const { model } = parseCompose(readFileSync(join(dir, file), 'utf8'))
    const actual = runRules(model!)
      .map((i) => i.ruleId)
      .sort()
    expect(actual).toEqual([...expected].sort())
  })
})
