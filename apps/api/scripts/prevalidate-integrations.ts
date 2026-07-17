import 'dotenv/config'

import { validateEnvironment } from '../src/config/environment.validation'

type Status = 'configurado' | 'ausente' | 'invalido'

const keys = [
  'WHATSAPP_PROVIDER',
  'WHATSAPP_GRAPH_API_VERSION',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_BUSINESS_ACCOUNT_ID',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_VERIFY_TOKEN',
  'WHATSAPP_APP_SECRET',
  'WHATSAPP_STORE_ID',
  'WHATSAPP_WEBHOOK_PUBLIC_URL',
  'AI_PROVIDER',
  'NVIDIA_API_KEY',
  'NVIDIA_BASE_URL',
  'NVIDIA_MODEL',
  'NVIDIA_TIMEOUT_MS',
  'NVIDIA_MAX_REQUESTS_PER_MINUTE',
  'NVIDIA_MAX_CONCURRENT_REQUESTS',
  'NVIDIA_MAX_OUTPUT_TOKENS',
  'MESSAGING_SANDBOX_MODE',
  'MESSAGING_ALLOWED_RECIPIENTS',
] as const

for (const key of keys) {
  process.stdout.write(`${key}: ${inspect(key)}\n`)
}

let generalStatus: Status = 'configurado'
if (!read('WHATSAPP_PROVIDER') && !read('AI_PROVIDER')) {
  generalStatus = 'ausente'
} else {
  try {
    validateEnvironment(process.env)
  } catch {
    generalStatus = 'invalido'
  }
}
process.stdout.write(`CONFIGURACAO_GERAL: ${generalStatus}\n`)

function inspect(key: typeof keys[number]): Status {
  const value = read(key)
  if (!value) return 'ausente'

  if (key === 'WHATSAPP_PROVIDER') {
    return ['cloud', 'whatsapp_cloud', 'evolution_api'].includes(value) ? 'configurado' : 'invalido'
  }
  if (key === 'AI_PROVIDER') return value === 'nvidia' ? 'configurado' : 'invalido'
  if (key === 'WHATSAPP_GRAPH_API_VERSION') return /^v\d+(?:\.\d+)?$/.test(value) ? 'configurado' : 'invalido'
  if (key === 'WHATSAPP_WEBHOOK_PUBLIC_URL') {
    return isUrl(value, true, '/webhooks/whatsapp') ? 'configurado' : 'invalido'
  }
  if (key === 'NVIDIA_BASE_URL') return isUrl(value) ? 'configurado' : 'invalido'
  if (key === 'MESSAGING_SANDBOX_MODE') return ['true', 'false'].includes(value) ? 'configurado' : 'invalido'
  if (key === 'MESSAGING_ALLOWED_RECIPIENTS') {
    return value.split(/[;,\r\n]+/).filter(Boolean).every((entry) => /^\d{8,15}$/.test(entry.replace(/\D/g, '')))
      ? 'configurado'
      : 'invalido'
  }
  if (['NVIDIA_TIMEOUT_MS', 'NVIDIA_MAX_REQUESTS_PER_MINUTE', 'NVIDIA_MAX_CONCURRENT_REQUESTS', 'NVIDIA_MAX_OUTPUT_TOKENS'].includes(key)) {
    return Number.isInteger(Number(value)) && Number(value) > 0 ? 'configurado' : 'invalido'
  }
  if (['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_APP_SECRET', 'NVIDIA_API_KEY'].includes(key)) {
    return value.length >= 20 && !/change|example|placeholder|your[_-]/i.test(value)
      ? 'configurado'
      : 'invalido'
  }
  return value.length >= 3 ? 'configurado' : 'invalido'
}

function read(key: string) {
  return process.env[key]?.trim() ?? ''
}

function isUrl(value: string, httpsOnly = false, path?: string) {
  try {
    const url = new URL(value)
    return (!httpsOnly || url.protocol === 'https:') && (!path || url.pathname.replace(/\/+$/, '') === path)
  } catch {
    return false
  }
}
