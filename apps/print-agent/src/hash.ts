import { createHash } from 'node:crypto'

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortJson(value))
}

export function hashJson(value: unknown) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex')
}

export function hashBytes(value: Uint8Array) {
  return createHash('sha256').update(value).digest('hex')
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortJson(entry)]),
    )
  }
  return value
}
