import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

import type { Prisma } from '@prisma/client'

import type { PrintSnapshotOption } from './printing.types'

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortJson(value))
}

export function hashPrintPayload(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex')
}

export function hashOpaqueToken(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function createAgentCredential() {
  const prefix = randomBytes(6).toString('hex')
  const secret = randomBytes(32).toString('base64url')
  const token = `cpa_${prefix}_${secret}`

  return {
    token,
    tokenHash: hashOpaqueToken(token),
    tokenPrefix: `cpa_${prefix}`,
  }
}

export function createLeaseCredential() {
  const token = randomBytes(32).toString('base64url')
  return {
    token,
    tokenHash: hashOpaqueToken(token),
  }
}

export function secureHashMatches(expectedHex: string, actualHex: string) {
  const expected = Buffer.from(expectedHex, 'hex')
  const actual = Buffer.from(actualHex, 'hex')

  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function sanitizePrintError(value: string) {
  return value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [REDACTED]')
    .replace(/(token|secret|password|authorization)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240)
}

export function maskPrintPhone(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.length < 4) {
    return ''
  }

  return `${'*'.repeat(Math.max(4, digits.length - 4))}${digits.slice(-4)}`
}

export function toNumber(value: { toNumber(): number } | number) {
  return typeof value === 'number' ? value : value.toNumber()
}

export function readSnapshotOptions(value: Prisma.JsonValue): PrintSnapshotOption[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return []
    }

    const name = typeof entry.name === 'string' ? entry.name.trim() : ''
    const quantity = typeof entry.quantity === 'number' ? entry.quantity : 1
    return name ? [{ name: name.slice(0, 120), quantity: Math.max(1, Math.floor(quantity)) }] : []
  })
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortJson(entry)]),
    )
  }

  return value
}
