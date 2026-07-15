type Environment = Record<string, unknown>

const placeholderPattern = /change|example|placeholder|your[_-]/i

export function validateEnvironment(input: Environment): Environment {
  const environment = { ...input }
  const whatsappProvider = readOptional(input, 'WHATSAPP_PROVIDER')
  const aiProvider = readOptional(input, 'AI_PROVIDER')

  if (whatsappProvider && !['cloud', 'whatsapp_cloud', 'evolution_api'].includes(whatsappProvider)) {
    throw new Error(
      'WHATSAPP_PROVIDER deve ser cloud, whatsapp_cloud ou evolution_api.',
    )
  }

  if (whatsappProvider === 'cloud' || whatsappProvider === 'whatsapp_cloud') {
    requireSafeValue(input, 'WHATSAPP_PHONE_NUMBER_ID', 4)
    requireSafeValue(input, 'WHATSAPP_BUSINESS_ACCOUNT_ID', 4)
    requireSafeValue(input, 'WHATSAPP_ACCESS_TOKEN', 20)
    requireSafeValue(input, 'WHATSAPP_VERIFY_TOKEN', 24)
    requireSafeValue(input, 'WHATSAPP_APP_SECRET', 24)
    requireSafeValue(input, 'WHATSAPP_STORE_ID', 4)

    const graphVersion = requireValue(input, 'WHATSAPP_GRAPH_API_VERSION')
    if (!/^v\d+(?:\.\d+)?$/.test(graphVersion)) {
      throw new Error('WHATSAPP_GRAPH_API_VERSION deve usar o formato versionado vNN.N.')
    }

    const webhookUrl = requireUrl(input, 'WHATSAPP_WEBHOOK_PUBLIC_URL')
    if (webhookUrl.protocol !== 'https:') {
      throw new Error('WHATSAPP_WEBHOOK_PUBLIC_URL deve usar HTTPS.')
    }
    if (
      webhookUrl.hostname.endsWith('.invalid') ||
      placeholderPattern.test(webhookUrl.hostname) ||
      webhookUrl.pathname.replace(/\/+$/, '') !== '/webhooks/whatsapp'
    ) {
      throw new Error('WHATSAPP_WEBHOOK_PUBLIC_URL deve apontar para /webhooks/whatsapp em um host real.')
    }
  }

  if (whatsappProvider === 'evolution_api') {
    requireUrl(input, 'WHATSAPP_PROVIDER_BASE_URL')
    requireSafeValue(input, 'WHATSAPP_PROVIDER_API_KEY', 16)
    requireSafeValue(input, 'WHATSAPP_WEBHOOK_SECRET', 24)
  }

  if (aiProvider === 'nvidia') {
    requireSafeValue(input, 'NVIDIA_API_KEY', 20)
    requireUrl(input, 'NVIDIA_BASE_URL')
    requireSafeValue(input, 'NVIDIA_MODEL', 3)
  }

  environment.WHATSAPP_HTTP_TIMEOUT_MS = readInteger(
    input,
    'WHATSAPP_HTTP_TIMEOUT_MS',
    10_000,
    1_000,
    60_000,
  )
  environment.WHATSAPP_OUTBOX_MAX_ATTEMPTS = readInteger(
    input,
    'WHATSAPP_OUTBOX_MAX_ATTEMPTS',
    5,
    1,
    12,
  )
  environment.WHATSAPP_OUTBOX_POLL_INTERVAL_MS = readInteger(
    input,
    'WHATSAPP_OUTBOX_POLL_INTERVAL_MS',
    1_000,
    250,
    60_000,
  )
  environment.NVIDIA_TIMEOUT_MS = readInteger(input, 'NVIDIA_TIMEOUT_MS', 20_000, 1_000, 120_000)
  environment.NVIDIA_REQUESTS_PER_MINUTE = readInteger(
    input,
    'NVIDIA_REQUESTS_PER_MINUTE',
    30,
    1,
    600,
  )
  environment.NVIDIA_MAX_CONCURRENT = readInteger(input, 'NVIDIA_MAX_CONCURRENT', 2, 1, 20)
  environment.NVIDIA_MAX_OUTPUT_TOKENS = readInteger(
    input,
    'NVIDIA_MAX_OUTPUT_TOKENS',
    600,
    64,
    4_096,
  )
  environment.PUBLIC_TRACKING_TTL_MINUTES = readInteger(
    input,
    'PUBLIC_TRACKING_TTL_MINUTES',
    1_440,
    15,
    10_080,
  )

  return environment
}

function requireValue(input: Environment, key: string) {
  const value = readOptional(input, key)
  if (!value) {
    throw new Error(`${key} e obrigatoria para o provider selecionado.`)
  }
  return value
}

function requireSafeValue(input: Environment, key: string, minLength: number) {
  const value = requireValue(input, key)
  if (value.length < minLength || placeholderPattern.test(value)) {
    throw new Error(`${key} deve conter um valor real e seguro.`)
  }
  return value
}

function requireUrl(input: Environment, key: string) {
  const value = requireValue(input, key)
  try {
    return new URL(value)
  } catch {
    throw new Error(`${key} deve conter uma URL absoluta valida.`)
  }
}

function readOptional(input: Environment, key: string) {
  const value = input[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readInteger(
  input: Environment,
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const raw = readOptional(input, key)
  const parsed = raw === null ? fallback : Number(raw)
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${key} deve ser um inteiro entre ${minimum} e ${maximum}.`)
  }
  return parsed
}
