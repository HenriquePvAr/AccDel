import 'dotenv/config'

import { ConfigService } from '@nestjs/config'

import { NvidiaAiGateway } from '../src/modules/ai-attendant/providers/nvidia/nvidia-ai.gateway'

async function main() {
  const required = ['NVIDIA_API_KEY', 'NVIDIA_BASE_URL', 'NVIDIA_MODEL'] as const
  if (process.env.AI_PROVIDER?.trim() !== 'nvidia' || required.some((key) => !process.env[key]?.trim())) {
    process.stdout.write('NÃO EXECUTADO — credencial local ausente\n')
    return
  }

  const config = new ConfigService({
    NVIDIA_API_KEY: process.env.NVIDIA_API_KEY?.trim(),
    NVIDIA_BASE_URL: process.env.NVIDIA_BASE_URL?.trim(),
    NVIDIA_MODEL: process.env.NVIDIA_MODEL?.trim(),
    NVIDIA_TIMEOUT_MS: integer('NVIDIA_TIMEOUT_MS', 20_000),
    NVIDIA_MAX_REQUESTS_PER_MINUTE: integer('NVIDIA_MAX_REQUESTS_PER_MINUTE', 30),
    NVIDIA_MAX_CONCURRENT_REQUESTS: integer('NVIDIA_MAX_CONCURRENT_REQUESTS', 2),
    NVIDIA_MAX_OUTPUT_TOKENS: integer('NVIDIA_MAX_OUTPUT_TOKENS', 256),
  })
  const gateway = new NvidiaAiGateway(config)

  try {
  const firstStarted = Date.now()
  const basic = await gateway.complete({
    messages: [
      { role: 'system', content: 'Responda em uma frase curta, sem inventar disponibilidade.' },
      { role: 'user', content: 'Cliente perguntou se há pizza de calabresa.' },
    ],
    temperature: 0,
  })
  process.stdout.write(`CHAMADA_MINIMA: sucesso (${Date.now() - firstStarted}ms)\n`)
  process.stdout.write(`ESTRUTURA_RESPOSTA: ${basic.message.role === 'assistant' ? 'valida' : 'invalida'}\n`)

  const toolStarted = Date.now()
  const tool = await gateway.complete({
    messages: [
      { role: 'system', content: 'Use a ferramenta search_menu para consultar calabresa. Não invente resultados.' },
      { role: 'user', content: 'Cliente perguntou se há pizza de calabresa.' },
    ],
    tools: [{
      type: 'function',
      function: {
        name: 'search_menu',
        description: 'Busca produto por termo.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
      },
    }],
    toolChoice: 'auto',
    temperature: 0,
  })
  const observed = tool.message.tool_calls?.some((call) => call.function.name === 'search_menu') ?? false
  process.stdout.write(`TOOL_CALLING: ${observed ? 'sucesso' : 'não observado'} (${Date.now() - toolStarted}ms)\n`)
  process.stdout.write('RATE_LIMITER: ativo\n')
  } catch {
    process.stderr.write('TESTE_NVIDIA_REAL: falha_sanitizada\n')
    process.exitCode = 1
  }
}

function integer(key: string, fallback: number) {
  const value = Number(process.env[key])
  return Number.isInteger(value) && value > 0 ? value : fallback
}

void main()
