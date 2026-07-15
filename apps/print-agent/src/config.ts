import path from 'node:path'
import process from 'node:process'

export interface PrintAgentConfig {
  apiBaseUrl: string
  token: string
  name: string
  version: string
  pollIntervalMs: number
  heartbeatIntervalMs: number
  maxConcurrentJobs: number
  dryRun: boolean
  outputDir: string
  dataDir: string
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  httpTimeoutMs: number
  tcpTimeoutMs: number
  dryRunRetentionHours: number
}

export function loadLocalEnv() {
  try {
    process.loadEnvFile?.('.env')
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') {
      throw error
    }
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): PrintAgentConfig {
  const apiBaseUrl = required(env.CAIN_API_BASE_URL, 'CAIN_API_BASE_URL')
  const parsedUrl = new URL(apiBaseUrl)
  if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
    throw new Error('CAIN_API_BASE_URL must be an HTTP(S) URL without embedded credentials.')
  }

  const token = required(env.CAIN_PRINT_AGENT_TOKEN, 'CAIN_PRINT_AGENT_TOKEN')
  if (!/^cpa_[a-f0-9]{12}_[A-Za-z0-9_-]{32,}$/.test(token)) {
    throw new Error('CAIN_PRINT_AGENT_TOKEN is not a Cain Print Agent credential.')
  }

  const logLevel = env.CAIN_PRINT_LOG_LEVEL ?? 'info'
  if (!['debug', 'info', 'warn', 'error'].includes(logLevel)) {
    throw new Error('CAIN_PRINT_LOG_LEVEL must be debug, info, warn or error.')
  }

  return {
    apiBaseUrl: parsedUrl.toString().replace(/\/$/, ''),
    token,
    name: required(env.CAIN_PRINT_AGENT_NAME, 'CAIN_PRINT_AGENT_NAME').slice(0, 120),
    version: (env.CAIN_PRINT_AGENT_VERSION ?? '0.1.0').trim(),
    pollIntervalMs: integer(env.CAIN_PRINT_POLL_INTERVAL_MS, 2_000, 250, 60_000),
    heartbeatIntervalMs: integer(
      env.CAIN_PRINT_HEARTBEAT_INTERVAL_MS,
      30_000,
      5_000,
      300_000,
    ),
    maxConcurrentJobs: integer(env.CAIN_PRINT_MAX_CONCURRENT_JOBS, 1, 1, 10),
    dryRun: booleanValue(env.CAIN_PRINT_DRY_RUN, true),
    outputDir: path.resolve(env.CAIN_PRINT_OUTPUT_DIR?.trim() || './var/print-output'),
    dataDir: path.resolve(env.CAIN_PRINT_DATA_DIR?.trim() || './var'),
    logLevel: logLevel as PrintAgentConfig['logLevel'],
    httpTimeoutMs: integer(env.CAIN_PRINT_HTTP_TIMEOUT_MS, 10_000, 1_000, 60_000),
    tcpTimeoutMs: integer(env.CAIN_PRINT_TCP_TIMEOUT_MS, 5_000, 500, 60_000),
    dryRunRetentionHours: integer(env.CAIN_PRINT_DRY_RUN_RETENTION_HOURS, 24, 1, 720),
  }
}

function required(value: string | undefined, name: string) {
  const normalized = value?.trim()
  if (!normalized) {
    throw new Error(`${name} is required.`)
  }
  return normalized
}

function integer(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = value == null || value.trim() === '' ? fallback : Number(value)
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Numeric configuration must be between ${minimum} and ${maximum}.`)
  }
  return parsed
}

function booleanValue(value: string | undefined, fallback: boolean) {
  if (value == null || value.trim() === '') {
    return fallback
  }
  if (value === 'true') return true
  if (value === 'false') return false
  throw new Error('Boolean configuration must be true or false.')
}
