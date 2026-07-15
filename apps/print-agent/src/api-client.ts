import type { PrintAgentConfig } from './config.js'
import type { AgentPrinterConfig, ClaimedPrintJob } from './types.js'

export class ApiUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiUnavailableError'
  }
}

export class CainPrintApiClient {
  constructor(private readonly config: PrintAgentConfig) {}

  async getConfiguration() {
    return this.request<{
      data: { agent: { id: string; name: string; storeId: string }; printers: AgentPrinterConfig[] }
    }>('GET', '/print-agent/configuration')
  }

  async heartbeat(availablePrinterIds: string[]) {
    return this.request('POST', '/print-agent/heartbeat', {
      version: this.config.version,
      availablePrinterIds,
    })
  }

  async claim(availablePrinterIds: string[]) {
    return this.request<{ data: ClaimedPrintJob[] }>('POST', '/print-agent/jobs/claim', {
      limit: this.config.maxConcurrentJobs,
      availablePrinterIds,
    })
  }

  async started(job: ClaimedPrintJob) {
    return this.request('POST', `/print-agent/jobs/${encodeURIComponent(job.id)}/started`, {
      leaseToken: job.leaseToken,
    })
  }

  async success(job: ClaimedPrintJob, contentHash: string, durationMs: number) {
    return this.request('POST', `/print-agent/jobs/${encodeURIComponent(job.id)}/success`, {
      leaseToken: job.leaseToken,
      contentHash,
      durationMs,
    })
  }

  async failure(
    job: ClaimedPrintJob,
    input: { retryable: boolean; errorCode: string; errorMessage: string; durationMs: number },
  ) {
    return this.request('POST', `/print-agent/jobs/${encodeURIComponent(job.id)}/failure`, {
      leaseToken: job.leaseToken,
      ...input,
    })
  }

  async unknown(job: ClaimedPrintJob, errorCode: string, errorMessage: string) {
    return this.request('POST', `/print-agent/jobs/${encodeURIComponent(job.id)}/unknown`, {
      leaseToken: job.leaseToken,
      errorCode,
      errorMessage,
    })
  }

  private async request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.config.httpTimeoutMs)

    try {
      const response = await fetch(`${this.config.apiBaseUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${this.config.token}`,
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      if (!response.ok) {
        const responseBody = await response.json().catch(() => null)
        const code = readErrorCode(responseBody) ?? `HTTP_${response.status}`
        throw new ApiUnavailableError(`Cain API request failed with ${code}.`)
      }

      return (await response.json()) as T
    } catch (error) {
      if (error instanceof ApiUnavailableError) throw error
      const code = error instanceof Error && error.name === 'AbortError' ? 'HTTP_TIMEOUT' : 'HTTP_UNAVAILABLE'
      throw new ApiUnavailableError(`Cain API is unavailable (${code}).`)
    } finally {
      clearTimeout(timeout)
    }
  }
}

function readErrorCode(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  return typeof record.code === 'string' ? record.code : null
}
