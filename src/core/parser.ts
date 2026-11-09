import { Document, isMap, LineCounter, parseAllDocuments } from 'yaml'
import type { SourceRange } from './model'

export type ParseErrorCode = 'syntax' | 'multiDoc' | 'notMapping'

export interface ParseError {
  code: ParseErrorCode
  message: string // pesan asli (untuk syntax: dari library yaml, berbahasa Inggris)
  line: number // 1-based
  col: number // 1-based
  source: SourceRange
}

export interface ParseResult {
  /** Dokumen YAML. `null` bila teks kosong atau ada error sintaks fatal. */
  doc: Document | null
  lineCounter: LineCounter
  errors: ParseError[]
}

/**
 * Teks → dokumen YAML + error sintaks.
 * Tidak pernah melempar exception: semua masalah dikembalikan di `errors`.
 */
export function parse(text: string): ParseResult {
  const lineCounter = new LineCounter()
  const errors: ParseError[] = []

  // `merge: true` agar `<<: *anchor` (umum di compose) dikenali sebagai merge key.
  const docs = parseAllDocuments(text, { lineCounter, merge: true, prettyErrors: false })
  const list = Array.isArray(docs) ? docs : []

  const push = (code: ParseErrorCode, message: string, offset: number) => {
    const pos = lineCounter.linePos(offset)
    errors.push({
      code,
      message,
      line: pos.line,
      col: pos.col,
      source: { startLine: pos.line, endLine: pos.line },
    })
  }

  for (const d of list) {
    for (const e of d.errors) push('syntax', e.message, e.pos[0])
  }

  if (list.length > 1) {
    push(
      'multiDoc',
      'File berisi lebih dari satu dokumen YAML (---). Hanya dokumen pertama yang dipakai.',
      list[1]!.range[0],
    )
  }

  const doc = list[0] ?? null
  if (!doc || doc.errors.length > 0) return { doc: null, lineCounter, errors }

  if (doc.contents === null) return { doc: null, lineCounter, errors }

  if (!isMap(doc.contents)) {
    push(
      'notMapping',
      'Root compose file harus berupa mapping (key: value).',
      doc.contents.range?.[0] ?? 0,
    )
    return { doc: null, lineCounter, errors }
  }

  return { doc, lineCounter, errors }
}
