import type { Issue, Rule } from './types'
import { makeIssue } from './types'

export const img001: Rule = {
  id: 'IMG001',
  severity: 'warning',
  title: 'Image tanpa tag atau :latest',
  check(model, locale) {
    const issues: Issue[] = []
    for (const s of model.services) {
      const img = s.image
      // Dengan `build`, `image` hanyalah nama hasil build lokal. Digest sudah memaku versi.
      if (!img || s.build || img.digest) continue
      // Nama/tag yang masih berisi variabel tak ter-resolve: nilainya belum diketahui.
      if (img.raw.includes('$')) continue
      if (img.tag && img.tag !== 'latest') continue
      issues.push(
        makeIssue(
          this,
          locale,
          img.tag ? 'IMG001.latest' : 'IMG001.untagged',
          { image: img.raw, service: s.name, name: img.name },
          { services: [s.name], source: s.source },
        ),
      )
    }
    return issues
  },
}
