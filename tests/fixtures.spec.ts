import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseCompose } from '@/core/normalize'

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
})
