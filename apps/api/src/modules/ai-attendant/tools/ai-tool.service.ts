import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { createHash } from 'node:crypto'

import { CatalogService } from '@/modules/catalog/catalog.service'
import { CustomersService } from '@/modules/customers/customers.service'
import { OrdersService } from '@/modules/orders/orders.service'
import { IdempotencyService } from '@/shared/security/idempotency.service'

import {
  AiConversationRepository,
  parseDraftItems,
  parseDraftMetadata,
} from './ai-conversation.repository'
import type { AiToolContext, DraftItem, DraftMetadata } from './ai-tool.types'

@Injectable()
export class AiToolService {
  constructor(
    private readonly catalog: CatalogService,
    private readonly customers: CustomersService,
    private readonly orders: OrdersService,
    private readonly idempotency: IdempotencyService,
    private readonly conversations: AiConversationRepository,
  ) {}

  async getStoreStatus(context: AiToolContext) {
    const store = await this.conversations.getStoreSnapshot(context.storeId)
    return {
      name: store.tradeName,
      timezone: store.timezone,
      businessHours: store.businessHours,
      businessDays: store.businessDays,
      channels: {
        delivery: store.deliveryEnabled,
        pickup: store.pickupEnabled,
        whatsappAi: store.whatsappAiEnabled,
      },
      minimumOrderAmount: Number(store.minimumOrderAmount),
      estimates: {
        preparationMinutes: store.estimatedPrepTimeMinutes,
        deliveryMinutes: store.estimatedDeliveryTimeMinutes,
      },
    }
  }

  async searchMenu(query: string) {
    const menu = await this.catalog.getMenuSource({ channel: 'delivery', includeUnavailable: false })
    const needle = normalizeSearch(query)
    const matches = menu.data.categories
      .flatMap((category) => category.products.map((product) => ({ category: category.name, product })))
      .filter(({ product }) =>
        normalizeSearch(`${product.name} ${product.description} ${product.tags.join(' ')}`).includes(needle),
      )
      .slice(0, 8)
      .map(({ category, product }) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        category,
        price: product.price,
        hasRequiredOptions: product.optionGroups.some((group) => group.required),
      }))
    return { query, matches }
  }

  async getProductDetails(productId: string) {
    const product = await this.findProduct(productId)
    if (!product) throw new NotFoundException('Produto indisponivel no canal de delivery.')
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      optionGroups: product.optionGroups.map((group) => ({
        id: group.id,
        name: group.name,
        required: group.required,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        options: group.options.map((option) => ({
          id: option.id,
          name: option.name,
          priceDelta: option.priceDelta,
        })),
      })),
    }
  }

  createDraft(context: AiToolContext, serviceType: DraftMetadata['serviceType']) {
    return this.conversations.createDraft(context.conversationId, context.customerId, serviceType)
  }

  async addItem(
    context: AiToolContext,
    input: Omit<DraftItem, 'options'> & { options?: DraftItem['options'] },
  ) {
    const draft =
      (await this.conversations.getActiveDraft(context.conversationId)) ??
      (await this.conversations.createDraft(context.conversationId, context.customerId, 'delivery'))
    const metadata = parseDraftMetadata(draft.metadata)
    const product = await this.findProduct(input.productId, metadata.serviceType)
    if (!product) throw new BadRequestException('Produto indisponivel ou inexistente.')
    validateSelectedOptions(product, input.options ?? [])

    const items = parseDraftItems(draft.parsedItems)
    const existingIndex = items.findIndex((item) => sameConfiguration(item, input))
    const nextItem: DraftItem = {
      productId: input.productId,
      quantity: input.quantity,
      ...(input.notes ? { notes: input.notes } : {}),
      options: input.options ?? [],
    }
    if (existingIndex >= 0) {
      items[existingIndex] = {
        ...items[existingIndex],
        quantity: items[existingIndex].quantity + input.quantity,
      }
    } else {
      items.push(nextItem)
    }

    return this.conversations.updateDraft(draft.id, draft.version, {
      items,
      metadata,
      missingFields: calculateMissing(items, metadata),
    })
  }

  async removeItem(context: AiToolContext, productId: string) {
    const draft = await this.requireDraft(context.conversationId)
    const items = parseDraftItems(draft.parsedItems).filter((item) => item.productId !== productId)
    const metadata = parseDraftMetadata(draft.metadata)
    return this.conversations.updateDraft(draft.id, draft.version, {
      items,
      metadata,
      missingFields: calculateMissing(items, metadata),
    })
  }

  async setDeliveryInformation(
    context: AiToolContext,
    input: {
      serviceType: DraftMetadata['serviceType']
      paymentMethod: NonNullable<DraftMetadata['paymentMethod']>
      addressId?: string
      address?: {
        label: string
        street: string
        number: string
        district: string
        complement?: string
        city: string
        state: string
        reference?: string
      }
    },
  ) {
    if (!context.customerId) throw new BadRequestException('Cliente nao identificado.')
    const draft =
      (await this.conversations.getActiveDraft(context.conversationId)) ??
      (await this.conversations.createDraft(context.conversationId, context.customerId, input.serviceType))
    let addressId: string | undefined
    if (input.serviceType === 'delivery') {
      if (!input.addressId && !input.address) {
        throw new BadRequestException('Endereco obrigatorio para delivery.')
      }
      const saved = await this.customers.saveWhatsappDeliveryAddress(
        context.customerId,
        input.addressId ? { addressId: input.addressId } : input.address!,
      )
      addressId = saved.data.id
    }

    const items = parseDraftItems(draft.parsedItems)
    const metadata: DraftMetadata = {
      serviceType: input.serviceType,
      paymentMethod: input.paymentMethod,
      ...(addressId ? { addressId } : {}),
    }
    return this.conversations.updateDraft(draft.id, draft.version, {
      items,
      metadata,
      missingFields: calculateMissing(items, metadata),
    })
  }

  async getDraftSummary(context: AiToolContext) {
    const draft = await this.requireDraft(context.conversationId)
    if (draft.status === 'converted' && draft.convertedOrderId) {
      return { converted: true, orderId: draft.convertedOrderId }
    }

    const items = parseDraftItems(draft.parsedItems)
    const metadata = parseDraftMetadata(draft.metadata)
    const pricedItems = []
    const invalidItems: string[] = []

    for (const item of items) {
      const product = await this.findProduct(item.productId, metadata.serviceType)
      if (!product) {
        invalidItems.push(item.productId)
        continue
      }
      try {
        validateSelectedOptions(product, item.options)
      } catch {
        invalidItems.push(item.productId)
        continue
      }
      const optionsTotal = item.options.reduce((sum, selected) => {
        const group = product.optionGroups.find((candidate) => candidate.id === selected.groupId)
        const option = group?.options.find((candidate) => candidate.id === selected.optionId)
        return sum + (option?.priceDelta ?? 0) * selected.quantity
      }, 0)
      const unitPrice = product.price + optionsTotal
      pricedItems.push({
        productId: product.id,
        name: product.name,
        quantity: item.quantity,
        unitPrice,
        total: unitPrice * item.quantity,
        options: item.options,
      })
    }

    const menu = await this.catalog.getMenuSource({
      channel: metadata.serviceType === 'delivery' ? 'delivery' : 'counter',
      includeUnavailable: false,
    })
    const subtotal = pricedItems.reduce((sum, item) => sum + item.total, 0)
    const deliveryFee = metadata.serviceType === 'delivery' ? menu.data.checkout.delivery.defaultFee : 0
    const missingFields = [...calculateMissing(items, metadata)]
    if (invalidItems.length) missingFields.push('invalid_or_unavailable_items')
    if (subtotal < menu.data.checkout.channels.minimumOrderAmount) missingFields.push('minimum_order_amount')
    if (
      metadata.paymentMethod &&
      !menu.data.checkout.paymentMethods.some(
        (method) => method.method === metadata.paymentMethod && method.availableForCheckout,
      )
    ) {
      missingFields.push('unavailable_payment_method')
    }

    return {
      draftId: draft.id,
      version: draft.version,
      serviceType: metadata.serviceType,
      paymentMethod: metadata.paymentMethod ?? null,
      addressId: metadata.addressId ?? null,
      items: pricedItems,
      invalidItems,
      subtotal: roundMoney(subtotal),
      deliveryFee: roundMoney(deliveryFee),
      total: roundMoney(subtotal + deliveryFee),
      minimumOrderAmount: menu.data.checkout.channels.minimumOrderAmount,
      missingFields: [...new Set(missingFields)],
    }
  }

  async confirmDraft(context: AiToolContext) {
    if (!context.explicitlyConfirmed) {
      throw new BadRequestException('Confirmacao explicita do cliente nao foi detectada.')
    }
    if (!context.customerId) throw new BadRequestException('Cliente nao identificado.')

    const draft = await this.requireDraft(context.conversationId, true)
    if (draft.status === 'converted' && draft.convertedOrderId) {
      return this.conversations.getCustomerOrder(context.storeId, context.customerId, draft.convertedOrderId)
    }
    const summary = await this.getDraftSummary(context)
    if (Array.isArray(summary.missingFields) && summary.missingFields.length) {
      throw new BadRequestException(`Rascunho incompleto: ${summary.missingFields.join(', ')}.`)
    }

    const items = parseDraftItems(draft.parsedItems)
    const metadata = parseDraftMetadata(draft.metadata)
    if (!metadata.paymentMethod) throw new BadRequestException('Forma de pagamento ausente.')
    const requestHash = createHash('sha256')
      .update(`${draft.id}:${draft.version}:${context.inboundExternalId}`)
      .digest('hex')
    const idempotency = await this.idempotency.begin({
      storeId: context.storeId,
      actorId: context.conversationId,
      operation: 'confirm_whatsapp_draft',
      key: context.inboundExternalId,
      requestHash,
      ttlMs: 24 * 60 * 60 * 1_000,
    })
    if (idempotency.kind === 'replay') return idempotency.response

    try {
      const result = await this.orders.createWhatsappOrder(
        {
          serviceType: metadata.serviceType,
          customerId: context.customerId,
          addressId: metadata.addressId,
          paymentMethod: metadata.paymentMethod,
          items,
        },
        {
          accountId: context.accountId,
          conversationId: context.conversationId,
        },
      )
      await this.conversations.markDraftConverted(draft.id, result.data.id, context.inboundExternalId)
      await this.idempotency.complete(idempotency.recordId, result.data)
      return result.data
    } catch (error) {
      await this.idempotency.abort(idempotency.recordId)
      throw error
    }
  }

  getOrderStatus(context: AiToolContext, orderId?: string) {
    return this.conversations.getCustomerOrder(context.storeId, context.customerId, orderId)
  }

  requestHumanHandoff(context: AiToolContext, reason: string) {
    return this.conversations.requestHandoff(context.conversationId, reason)
  }

  private async requireDraft(conversationId: string, includeConverted = false) {
    const draft = includeConverted
      ? await this.conversations.getLatestDraft(conversationId)
      : await this.conversations.getActiveDraft(conversationId)
    if (draft && (includeConverted || draft.status !== 'converted')) return draft
    throw new NotFoundException('Rascunho ativo nao encontrado.')
  }

  private async findProduct(productId: string, serviceType: DraftMetadata['serviceType'] = 'delivery') {
    const menu = await this.catalog.getMenuSource({
      channel: serviceType === 'delivery' ? 'delivery' : 'counter',
      includeUnavailable: false,
    })
    return menu.data.categories.flatMap((category) => category.products).find((product) => product.id === productId) ?? null
  }
}

type MenuProduct = NonNullable<Awaited<ReturnType<CatalogService['getMenuSource']>>['data']['categories'][number]['products'][number]>

function validateSelectedOptions(product: MenuProduct, selected: DraftItem['options']) {
  for (const option of selected) {
    const group = product.optionGroups.find((candidate) => candidate.id === option.groupId)
    const match = group?.options.find((candidate) => candidate.id === option.optionId)
    if (!group || !match) throw new BadRequestException('Opcao invalida para o produto.')
  }
  for (const group of product.optionGroups) {
    const count = selected
      .filter((option) => option.groupId === group.id)
      .reduce((sum, option) => sum + option.quantity, 0)
    if (group.required && count < group.minSelections) {
      throw new BadRequestException(`Selecione ao menos ${group.minSelections} opcao(oes) em ${group.name}.`)
    }
    if (count > group.maxSelections) {
      throw new BadRequestException(`Selecoes demais em ${group.name}.`)
    }
  }
}

function calculateMissing(items: DraftItem[], metadata: DraftMetadata) {
  return [
    ...(!items.length ? ['items'] : []),
    ...(metadata.serviceType === 'delivery' && !metadata.addressId ? ['address'] : []),
    ...(!metadata.paymentMethod ? ['payment_method'] : []),
  ]
}

function sameConfiguration(left: DraftItem, right: Omit<DraftItem, 'options'> & { options?: DraftItem['options'] }) {
  return left.productId === right.productId && JSON.stringify(left.options) === JSON.stringify(right.options ?? [])
}

function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}
