export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const order: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

export class Logger {
  constructor(
    private readonly minimumLevel: LogLevel,
    private readonly context: Record<string, unknown> = {},
  ) {}

  child(context: Record<string, unknown>) {
    return new Logger(this.minimumLevel, { ...this.context, ...context })
  }

  debug(message: string, data?: Record<string, unknown>) {
    this.write('debug', message, data)
  }

  info(message: string, data?: Record<string, unknown>) {
    this.write('info', message, data)
  }

  warn(message: string, data?: Record<string, unknown>) {
    this.write('warn', message, data)
  }

  error(message: string, data?: Record<string, unknown>) {
    this.write('error', message, data)
  }

  private write(level: LogLevel, message: string, data?: Record<string, unknown>) {
    if (order[level] < order[this.minimumLevel]) return
    const record = {
      timestamp: new Date().toISOString(),
      level,
      message: sanitizeLogText(message),
      ...redactObject(this.context),
      ...(data ? redactObject(data) : {}),
    }
    process.stdout.write(`${JSON.stringify(record)}\n`)
  }
}

export function sanitizeLogText(value: string) {
  return value
    .replace(/cpa_[a-f0-9]{12}_[A-Za-z0-9_-]+/gi, '[REDACTED_AGENT_TOKEN]')
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [REDACTED]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 300)
}

function redactObject(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      /(token|secret|password|payload|snapshot|address|phone)/i.test(key)
        ? '[REDACTED]'
        : typeof entry === 'string'
          ? sanitizeLogText(entry)
          : entry,
    ]),
  )
}
