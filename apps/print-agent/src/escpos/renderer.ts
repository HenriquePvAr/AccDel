import type {
  EscPosBlock,
  EscPosDocument,
  PrintEncoding,
  RenderedEscPosDocument,
} from '../types.js'
import { hashBytes } from '../hash.js'

const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a

export function renderEscPos(document: EscPosDocument): RenderedEscPosDocument {
  const chunks: Uint8Array[] = [Uint8Array.from([ESC, 0x40])]
  const textLines: string[] = []
  const baseColumns = document.paperWidth === 58 ? 32 : 48

  for (const block of document.blocks) {
    const width = block.width ?? 1
    const columns = Math.max(8, Math.floor(baseColumns / width))
    const lines = block.wrap === false
      ? [normalizePrintableText(block.text, document.encoding).slice(0, columns)]
      : wrapText(block.text, columns, document.encoding)
    chunks.push(styleBytes(block))

    for (const line of lines) {
      chunks.push(encodeText(line, document.encoding))
      chunks.push(Uint8Array.of(LF))
      textLines.push(line)
    }
  }

  chunks.push(Uint8Array.from([ESC, 0x45, 0, GS, 0x21, 0, ESC, 0x61, 0]))
  if (document.cut) chunks.push(Uint8Array.from([LF, LF, GS, 0x56, 0]))
  const bytes = concatenate(chunks)
  return {
    jobId: document.jobId,
    bytes,
    text: `${textLines.join('\n')}\n`,
    contentHash: hashBytes(bytes),
  }
}

export function formatColumns(left: string, right: string, columns: number) {
  const safeLeft = normalizePrintableText(left, 'CP860')
  const safeRight = normalizePrintableText(right, 'CP860')
  const availableLeft = Math.max(1, columns - safeRight.length - 1)
  const clippedLeft = safeLeft.slice(0, availableLeft)
  const spaces = Math.max(1, columns - clippedLeft.length - safeRight.length)
  return `${clippedLeft}${' '.repeat(spaces)}${safeRight.slice(0, columns - clippedLeft.length - spaces)}`
}

export function wrapText(value: string, columns: number, encoding: PrintEncoding) {
  const normalized = normalizePrintableText(value, encoding).replace(/\r\n?/g, '\n')
  const output: string[] = []
  for (const paragraph of normalized.split('\n')) {
    if (!paragraph) {
      output.push('')
      continue
    }
    let remaining = paragraph
    while (remaining.length > columns) {
      const candidate = remaining.slice(0, columns + 1)
      const breakAt = candidate.lastIndexOf(' ')
      const length = breakAt > 0 ? breakAt : columns
      output.push(remaining.slice(0, length).trimEnd())
      remaining = remaining.slice(length).trimStart()
    }
    output.push(remaining)
  }
  return output
}

export function normalizePrintableText(value: string, encoding: PrintEncoding) {
  const punctuation = value
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\u00a0/g, ' ')
  const output: string[] = []
  for (const character of punctuation) {
    if (character === '\n' || character === '\r' || character === '\t') {
      output.push(character === '\t' ? ' ' : character)
    } else if (character.charCodeAt(0) >= 32 && character.charCodeAt(0) <= 126) {
      output.push(character)
    } else if (encoding !== 'ASCII' && CP850_BYTES[character] != null) {
      output.push(character)
    } else {
      const ascii = character.normalize('NFD').replace(/\p{Diacritic}/gu, '')
      output.push(/^[\x20-\x7e]$/.test(ascii) ? ascii : '?')
    }
  }
  return output.join('')
}

function styleBytes(block: EscPosBlock) {
  const align = block.align === 'center' ? 1 : block.align === 'right' ? 2 : 0
  const size = (((block.width ?? 1) - 1) << 4) | ((block.height ?? 1) - 1)
  return Uint8Array.from([
    ESC,
    0x61,
    align,
    ESC,
    0x45,
    block.bold ? 1 : 0,
    GS,
    0x21,
    size,
  ])
}

function encodeText(value: string, encoding: PrintEncoding) {
  const normalized = normalizePrintableText(value, encoding)
  if (encoding === 'ASCII') return Uint8Array.from(Buffer.from(normalized, 'ascii'))
  return Uint8Array.from(
    Array.from(normalized).map((character) => CP850_BYTES[character] ?? character.charCodeAt(0)),
  )
}

function concatenate(chunks: Uint8Array[]) {
  const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const output = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.length
  }
  return output
}

const CP850_BYTES: Record<string, number> = {
  'á': 0xa0,
  'à': 0x85,
  'â': 0x83,
  'ã': 0xc6,
  'Á': 0xb5,
  'À': 0xb7,
  'Â': 0xb6,
  'Ã': 0xc7,
  'é': 0x82,
  'ê': 0x88,
  'É': 0x90,
  'Ê': 0xd2,
  'í': 0xa1,
  'Í': 0xd6,
  'ó': 0xa2,
  'ô': 0x93,
  'õ': 0xe4,
  'Ó': 0xe0,
  'Ô': 0xe2,
  'Õ': 0xe5,
  'ú': 0xa3,
  'ü': 0x81,
  'Ú': 0xe9,
  'Ü': 0x9a,
  'ç': 0x87,
  'Ç': 0x80,
}
