export type NvidiaChatRole = 'system' | 'user' | 'assistant' | 'tool'

export interface NvidiaChatMessage {
  role: NvidiaChatRole
  content: string | null
  name?: string
  tool_call_id?: string
  tool_calls?: NvidiaToolCall[]
}

export interface NvidiaToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface NvidiaToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface NvidiaCompletionRequest {
  messages: NvidiaChatMessage[]
  tools?: NvidiaToolDefinition[]
  toolChoice?: 'auto' | 'none'
  responseFormat?: { type: 'json_object' }
  temperature?: number
}

export interface NvidiaCompletionResult {
  message: NvidiaChatMessage
  finishReason: string | null
  model: string
  usage: {
    promptTokens: number | null
    completionTokens: number | null
  }
}
