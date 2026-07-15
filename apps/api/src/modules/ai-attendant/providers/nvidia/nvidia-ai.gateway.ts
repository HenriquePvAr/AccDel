import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type {
  NvidiaCompletionRequest,
  NvidiaCompletionResult,
  NvidiaToolCall,
} from './nvidia-ai.types'

interface ProviderFailure extends Error {
  retryable: boolean
  code: string
}

@Injectable()
export class NvidiaAiGateway {
  private activeRequests = 0
  private queuedRequests = 0
  private requestStarts: number[] = []
  private consecutiveFailures = 0
  private circuitOpenUntil = 0

  constructor(private readonly config: ConfigService) {}

  async complete(request: NvidiaCompletionRequest): Promise<NvidiaCompletionResult> {
    if (Date.now() < this.circuitOpenUntil) {
      throw new ServiceUnavailableException('Provider de IA temporariamente indisponivel.')
    }
    if (this.queuedRequests >= 100) {
      throw new ServiceUnavailableException('Fila interna do provider de IA esta cheia.')
    }

    this.queuedRequests += 1
    await this.acquireCapacity()
    this.queuedRequests -= 1

    try {
      const result = await this.executeWithRetry(request)
      this.consecutiveFailures = 0
      return result
    } catch (error) {
      this.consecutiveFailures += 1
      if (this.consecutiveFailures >= 5) {
        this.circuitOpenUntil = Date.now() + 30_000
      }
      throw error
    } finally {
      this.activeRequests -= 1
    }
  }

  private async acquireCapacity() {
    const maxConcurrent = this.config.get<number>('NVIDIA_MAX_CONCURRENT') ?? 2
    const requestsPerMinute = this.config.get<number>('NVIDIA_REQUESTS_PER_MINUTE') ?? 30

    while (true) {
      const now = Date.now()
      this.requestStarts = this.requestStarts.filter((timestamp) => now - timestamp < 60_000)
      if (this.activeRequests < maxConcurrent && this.requestStarts.length < requestsPerMinute) {
        this.activeRequests += 1
        this.requestStarts.push(now)
        return
      }

      const oldest = this.requestStarts[0]
      const rateWait = oldest ? Math.max(50, 60_000 - (now - oldest)) : 50
      await delay(Math.min(rateWait, 1_000))
    }
  }

  private async executeWithRetry(request: NvidiaCompletionRequest) {
    let lastError: unknown
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.execute(request)
      } catch (error) {
        lastError = error
        const failure = error as Partial<ProviderFailure>
        if (!failure.retryable || attempt === 3) break
        await delay(500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250))
      }
    }
    throw lastError
  }

  private async execute(request: NvidiaCompletionRequest): Promise<NvidiaCompletionResult> {
    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.get<number>('NVIDIA_TIMEOUT_MS') ?? 20_000,
    )

    try {
      const response = await fetch(`${this.baseUrl()}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.required('NVIDIA_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.required('NVIDIA_MODEL'),
          messages: request.messages,
          temperature: request.temperature ?? 0.1,
          max_tokens: this.config.get<number>('NVIDIA_MAX_OUTPUT_TOKENS') ?? 600,
          ...(request.tools?.length
            ? { tools: request.tools, tool_choice: request.toolChoice ?? 'auto' }
            : {}),
          ...(request.responseFormat ? { response_format: request.responseFormat } : {}),
        }),
        signal: controller.signal,
      })
      const payload = await readJson(response)
      if (!response.ok) {
        throw providerFailure(
          `NVIDIA NIM retornou HTTP ${response.status}.`,
          `http_${response.status}`,
          [408, 409, 425, 429].includes(response.status) || response.status >= 500,
        )
      }

      return parseCompletion(payload, this.required('NVIDIA_MODEL'))
    } catch (error) {
      if (isProviderFailure(error)) throw error
      if (error instanceof Error && error.name === 'AbortError') {
        throw providerFailure('Timeout no provider NVIDIA NIM.', 'timeout', true)
      }
      throw providerFailure('Falha de rede no provider NVIDIA NIM.', 'network_error', true)
    } finally {
      clearTimeout(timeout)
    }
  }

  private baseUrl() {
    return this.required('NVIDIA_BASE_URL').replace(/\/+$/, '')
  }

  private required(name: string) {
    const value = this.config.get<string>(name)?.trim()
    if (!value) throw new ServiceUnavailableException(`${name} nao esta configurada.`)
    return value
  }
}

function parseCompletion(payload: Record<string, unknown>, configuredModel: string): NvidiaCompletionResult {
  const choices = Array.isArray(payload.choices) ? payload.choices : []
  const first = isRecord(choices[0]) ? choices[0] : {}
  const rawMessage = isRecord(first.message) ? first.message : {}
  const role = rawMessage.role === 'assistant' ? 'assistant' : null
  if (!role) throw providerFailure('Resposta NVIDIA sem assistant message.', 'invalid_response', true)

  const rawToolCalls = Array.isArray(rawMessage.tool_calls) ? rawMessage.tool_calls : []
  const toolCalls = rawToolCalls.map(parseToolCall).filter((value): value is NvidiaToolCall => value !== null)
  const usage = isRecord(payload.usage) ? payload.usage : {}

  return {
    message: {
      role,
      content: typeof rawMessage.content === 'string' ? rawMessage.content : null,
      ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
    },
    finishReason: typeof first.finish_reason === 'string' ? first.finish_reason : null,
    model: typeof payload.model === 'string' ? payload.model : configuredModel,
    usage: {
      promptTokens: finiteNumber(usage.prompt_tokens),
      completionTokens: finiteNumber(usage.completion_tokens),
    },
  }
}

function parseToolCall(value: unknown): NvidiaToolCall | null {
  if (!isRecord(value) || !isRecord(value.function)) return null
  const id = typeof value.id === 'string' ? value.id : null
  const name = typeof value.function.name === 'string' ? value.function.name : null
  const args = typeof value.function.arguments === 'string' ? value.function.arguments : null
  if (!id || !name || args === null) return null
  return { id, type: 'function', function: { name, arguments: args } }
}

function providerFailure(message: string, code: string, retryable: boolean): ProviderFailure {
  return Object.assign(new Error(message), { code, retryable })
}

function isProviderFailure(value: unknown): value is ProviderFailure {
  return value instanceof Error && 'retryable' in value && 'code' in value
}

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await response.json()
    return isRecord(value) ? value : {}
  } catch {
    return {}
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
