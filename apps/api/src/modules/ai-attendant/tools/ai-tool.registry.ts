import { Injectable } from '@nestjs/common'
import { z } from 'zod'

import type { NvidiaToolDefinition } from '../providers/nvidia/nvidia-ai.types'
import { AiConversationRepository } from './ai-conversation.repository'
import { AiToolService } from './ai-tool.service'
import type { AiToolContext } from './ai-tool.types'

const emptySchema = z.object({}).strict()
const schemas = {
  get_store_status: emptySchema,
  search_menu: z.object({ query: z.string().trim().min(1).max(80) }).strict(),
  get_product_details: z.object({ productId: z.string().trim().min(1).max(80) }).strict(),
  create_draft_order: z.object({ serviceType: z.enum(['delivery', 'pickup']) }).strict(),
  add_item_to_draft: z.object({
    productId: z.string().trim().min(1).max(80),
    quantity: z.number().int().min(1).max(99),
    notes: z.string().trim().max(280).optional(),
    options: z.array(z.object({
      groupId: z.string().trim().min(1).max(80),
      optionId: z.string().trim().min(1).max(80),
      quantity: z.number().int().min(1).max(20).default(1),
    }).strict()).max(30).optional(),
  }).strict(),
  remove_item_from_draft: z.object({ productId: z.string().trim().min(1).max(80) }).strict(),
  get_draft_summary: emptySchema,
  set_delivery_information: z.object({
    serviceType: z.enum(['delivery', 'pickup']),
    paymentMethod: z.enum(['pix', 'credit_card', 'debit_card', 'cash', 'meal_voucher', 'payment_link']),
    addressId: z.string().trim().min(1).max(80).optional(),
    address: z.object({
      label: z.string().trim().min(1).max(80).default('Principal'),
      street: z.string().trim().min(1).max(160),
      number: z.string().trim().min(1).max(24),
      district: z.string().trim().min(1).max(80),
      complement: z.string().trim().max(120).optional(),
      city: z.string().trim().min(1).max(80),
      state: z.string().trim().length(2),
      reference: z.string().trim().max(160).optional(),
    }).strict().optional(),
  }).strict(),
  confirm_draft_order: emptySchema,
  get_order_status: z.object({ orderId: z.string().trim().min(1).max(80).optional() }).strict(),
  request_human_handoff: z.object({ reason: z.string().trim().min(2).max(160) }).strict(),
} as const

export type AiToolName = keyof typeof schemas

@Injectable()
export class AiToolRegistry {
  constructor(
    private readonly tools: AiToolService,
    private readonly conversations: AiConversationRepository,
  ) {}

  definitions(): NvidiaToolDefinition[] {
    return toolDefinitions
  }

  async execute(input: {
    executionId: string
    name: string
    rawArguments: string
    context: AiToolContext
  }) {
    const startedAt = Date.now()
    const audit = await this.conversations.createToolCall(
      input.executionId,
      input.name.slice(0, 100),
      input.rawArguments,
    )

    try {
      if (!isToolName(input.name)) {
        await this.conversations.completeToolCall(audit.id, 'REJECTED', 'tool_not_allowed', Date.now() - startedAt)
        return { ok: false, code: 'tool_not_allowed' }
      }
      if (Buffer.byteLength(input.rawArguments, 'utf8') > 10_240) {
        await this.conversations.completeToolCall(audit.id, 'REJECTED', 'arguments_too_large', Date.now() - startedAt)
        return { ok: false, code: 'arguments_too_large' }
      }

      const parsedJson: unknown = input.rawArguments.trim() ? JSON.parse(input.rawArguments) : {}
      const parsed = schemas[input.name].safeParse(parsedJson)
      if (!parsed.success) {
        await this.conversations.completeToolCall(audit.id, 'REJECTED', 'invalid_arguments', Date.now() - startedAt)
        return { ok: false, code: 'invalid_arguments' }
      }

      const operationalStatus = await this.conversations.getOperationalStatus(input.context.conversationId)
      if (operationalStatus !== 'AI_ACTIVE' && input.name !== 'request_human_handoff') {
        await this.conversations.completeToolCall(audit.id, 'REJECTED', 'conversation_not_ai_active', Date.now() - startedAt)
        return { ok: false, code: 'conversation_not_ai_active' }
      }

      const result = await this.dispatch(input.name, parsed.data, input.context)
      await this.conversations.completeToolCall(audit.id, 'SUCCEEDED', 'ok', Date.now() - startedAt)
      return { ok: true, data: result }
    } catch (error) {
      const code = error instanceof SyntaxError ? 'invalid_json' : 'tool_execution_failed'
      await this.conversations.completeToolCall(audit.id, 'FAILED', code, Date.now() - startedAt)
      return { ok: false, code }
    }
  }

  private dispatch(name: AiToolName, args: unknown, context: AiToolContext) {
    switch (name) {
      case 'get_store_status':
        return this.tools.getStoreStatus(context)
      case 'search_menu':
        return this.tools.searchMenu((args as z.infer<typeof schemas.search_menu>).query)
      case 'get_product_details':
        return this.tools.getProductDetails((args as z.infer<typeof schemas.get_product_details>).productId)
      case 'create_draft_order':
        return this.tools.createDraft(context, (args as z.infer<typeof schemas.create_draft_order>).serviceType)
      case 'add_item_to_draft':
        return this.tools.addItem(context, args as z.infer<typeof schemas.add_item_to_draft>)
      case 'remove_item_from_draft':
        return this.tools.removeItem(context, (args as z.infer<typeof schemas.remove_item_from_draft>).productId)
      case 'get_draft_summary':
        return this.tools.getDraftSummary(context)
      case 'set_delivery_information':
        return this.tools.setDeliveryInformation(context, args as z.infer<typeof schemas.set_delivery_information>)
      case 'confirm_draft_order':
        return this.tools.confirmDraft(context)
      case 'get_order_status':
        return this.tools.getOrderStatus(context, (args as z.infer<typeof schemas.get_order_status>).orderId)
      case 'request_human_handoff':
        return this.tools.requestHumanHandoff(context, (args as z.infer<typeof schemas.request_human_handoff>).reason)
    }
  }
}

function isToolName(name: string): name is AiToolName {
  return Object.prototype.hasOwnProperty.call(schemas, name)
}

const toolDefinitions: NvidiaToolDefinition[] = [
  definition('get_store_status', 'Consulta horarios, canais e estimativas atuais da loja.', {}),
  definition('search_menu', 'Busca poucos produtos disponiveis no cardapio atual.', {
    query: { type: 'string', minLength: 1, maxLength: 80 },
  }, ['query']),
  definition('get_product_details', 'Consulta detalhes e opcoes atuais de um produto pelo id.', {
    productId: { type: 'string' },
  }, ['productId']),
  definition('create_draft_order', 'Cria ou recupera um rascunho controlado de pedido.', {
    serviceType: { type: 'string', enum: ['delivery', 'pickup'] },
  }, ['serviceType']),
  definition('add_item_to_draft', 'Adiciona item validado ao rascunho.', {
    productId: { type: 'string' },
    quantity: { type: 'integer', minimum: 1, maximum: 99 },
    notes: { type: 'string', maxLength: 280 },
    options: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          groupId: { type: 'string' },
          optionId: { type: 'string' },
          quantity: { type: 'integer', minimum: 1, maximum: 20 },
        },
        required: ['groupId', 'optionId'],
      },
    },
  }, ['productId', 'quantity']),
  definition('remove_item_from_draft', 'Remove todas as configuracoes de um produto do rascunho.', {
    productId: { type: 'string' },
  }, ['productId']),
  definition('get_draft_summary', 'Revalida e resume o rascunho com precos atuais.', {}),
  definition('set_delivery_information', 'Define modalidade, pagamento e endereco do rascunho.', {
    serviceType: { type: 'string', enum: ['delivery', 'pickup'] },
    paymentMethod: {
      type: 'string',
      enum: ['pix', 'credit_card', 'debit_card', 'cash', 'meal_voucher', 'payment_link'],
    },
    addressId: { type: 'string' },
    address: {
      type: 'object',
      additionalProperties: false,
      properties: {
        label: { type: 'string' },
        street: { type: 'string' },
        number: { type: 'string' },
        district: { type: 'string' },
        complement: { type: 'string' },
        city: { type: 'string' },
        state: { type: 'string' },
        reference: { type: 'string' },
      },
      required: ['label', 'street', 'number', 'district', 'city', 'state'],
    },
  }, ['serviceType', 'paymentMethod']),
  definition('confirm_draft_order', 'Converte o rascunho em pedido real somente com confirmacao explicita na mensagem atual.', {}),
  definition('get_order_status', 'Consulta o pedido mais recente do cliente ou um pedido proprio pelo id.', {
    orderId: { type: 'string' },
  }),
  definition('request_human_handoff', 'Pausa a IA e solicita atendimento humano.', {
    reason: { type: 'string', minLength: 2, maxLength: 160 },
  }, ['reason']),
]

function definition(
  name: AiToolName,
  description: string,
  properties: Record<string, unknown>,
  required: string[] = [],
): NvidiaToolDefinition {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties,
        ...(required.length ? { required } : {}),
      },
    },
  }
}
