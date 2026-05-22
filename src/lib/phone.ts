export function normalizeWhatsAppNumber(value: string) {
  return value.replace(/\D/g, '')
}

export function getLocalWhatsAppDigits(value: string) {
  const digits = normalizeWhatsAppNumber(value)
  return digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits
}

export function formatWhatsAppNumber(value: string) {
  const local = getLocalWhatsAppDigits(value)

  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
  }

  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
  }

  return value.trim()
}

export function whatsappNumbersMatch(left: string, right: string) {
  const normalizedLeft = normalizeWhatsAppNumber(left)
  const normalizedRight = normalizeWhatsAppNumber(right)
  const localRight = getLocalWhatsAppDigits(right)

  return normalizedLeft === normalizedRight || normalizedLeft.endsWith(localRight)
}
