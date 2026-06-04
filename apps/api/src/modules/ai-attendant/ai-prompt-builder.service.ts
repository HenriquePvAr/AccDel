import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import {
  AiAttendantSettings,
  Coupon,
  Customer,
  CustomerAddress,
  Order,
  OrderItem,
  PaymentMethodConfig,
  Prisma,
  ProductChannel,
  Promotion,
  Store,
} from '@prisma/client'

import { PrismaService } from '../../shared/prisma/prisma.service'
import { CatalogService } from '../catalog/catalog.service'
import { AiReplyContext } from './ai-provider.adapter'

export const DEFAULT_AI_MAIN_PROMPT =
  'Voce e um atendente virtual de delivery. Responda de forma educada, clara e humanizada. Use apenas informacoes oficiais da loja, cardapio e base de conhecimento. Se nao souber, chame um atendente humano.'

type AiPromptChannel = AiReplyContext['channel']
type AiPromptOrderMode = AiReplyContext['orderMode']

interface BuildAiPromptInput {
  storeId: string
  conversationId: string
  message: string
  customerId?: string | null
  customerName?: string | null
  customerPhone?: string | null
  channel: AiPromptChannel
  conversationHistory: AiReplyContext['conversationHistory']
}

interface BuildAiPromptResult {
  replyContext: AiReplyContext
  settings: AiAttendantSettings
}

type StoreWithAiContext = Store & {
  categories: {
    id: string
    name: string
    description: string
    active: boolean
    visibleOnDigitalMenu: boolean
    sortOrder: number
  }[]
  products: {
    id: string
    name: string
    description: string
    price: Prisma.Decimal
    active: boolean
    tags: string[]
    sortOrder: number
    category: {
      id: string
      name: string
      active: boolean
    }
    availability: {
      channel: ProductChannel
      available: boolean
      visible: boolean
      soldOut: boolean
      priceOverride: Prisma.Decimal | null
    }[]
    optionGroups: {
      required: boolean
      minSelections: number
      maxSelections: number
      sortOrder: number
      description: string | null
      group: {
        id: string
        name: string
        description: string | null
        options: {
          id: string
          name: string
          description: string | null
          priceDelta: Prisma.Decimal
          active: boolean
          sortOrder: number
        }[]
      }
    }[]
  }[]
  promotions: Promotion[]
  coupons: Coupon[]
  paymentMethodConfigs: PaymentMethodConfig[]
}

type CustomerWithAddresses = Customer & {
  addresses: CustomerAddress[]
}

type CustomerOrder = Pick<
  Order,
  | 'id'
  | 'number'
  | 'status'
  | 'serviceType'
  | 'total'
  | 'createdAt'
  | 'dueAt'
  | 'addressText'
> & {
  items: Pick<OrderItem, 'name' | 'quantity'>[]
  driver: { name: string } | null
  deliveryAssignments: {
    status: string
    driver: { name: string }
    assignedAt: Date
    completedAt: Date | null
  }[]
  etaSnapshots: {
    etaMinutes: number
    distanceMeters: number
    message: string | null
    createdAt: Date
  }[]
}

type CatalogMenuSourceData = Awaited<ReturnType<CatalogService['getMenuSource']>>['data']

@Injectable()
export class AiPromptBuilderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogService: CatalogService,
  ) {}

  async build(input: BuildAiPromptInput): Promise<BuildAiPromptResult> {
    const settings = await this.getOrCreateSettings(input.storeId)
    const store = await this.getStoreContext(input.storeId)

    if (!store) {
      throw new HttpException('Store not found.', HttpStatus.NOT_FOUND)
    }

    const customer = await this.getCustomer(input.storeId, input.customerId, input.customerPhone)
    const customerOrders = customer
      ? await this.getCustomerOrders(input.storeId, customer.id)
      : []
    const knowledgeEntries = await this.prisma.aiKnowledgeEntry.findMany({
      where: {
        storeId: input.storeId,
        isActive: true,
        OR: [
          { channels: { has: input.channel } },
          { channels: { isEmpty: true } },
        ],
      },
      orderBy: [{ priority: 'desc' }, { type: 'asc' }, { updatedAt: 'desc' }],
    })

    const productChannel = this.resolveProductChannel(input.channel)
    const orderMode = this.resolveOrderMode(input.channel)
    const catalogSource = await this.catalogService.getMenuSource({
      channel: productChannel,
      includeUnavailable: true,
    })
    const catalogContext = this.buildCatalogSourceContext(catalogSource.data)
    const knowledgeEntriesContext = knowledgeEntries.length
      ? knowledgeEntries
          .map((entry) => {
            const channels = entry.channels.length ? entry.channels.join(', ') : 'todos'
            return `[${entry.type}; prioridade ${entry.priority}; canais ${channels}] ${entry.title}: ${entry.content}`
          })
          .join('\n')
      : ''
    const settingsContext = this.buildSettingsContext(settings)
    const customerContext = this.buildCustomerContext(
      customer,
      customerOrders,
      input.customerName,
      input.customerPhone,
    )
    const systemPrompt = [
      this.buildIdentitySection(settings, store, input.channel, orderMode),
      this.buildSafetySection(settings),
      this.buildStoreSection(store),
      catalogContext || 'Catalogo: nenhum produto ativo encontrado para este canal.',
      this.buildCommercialSourceSection(catalogSource.data, settings),
      this.buildPaymentSection(store.paymentMethodConfigs),
      knowledgeEntriesContext
        ? `Base de conhecimento ativa:\n${knowledgeEntriesContext}`
        : 'Base de conhecimento ativa: nenhuma entrada cadastrada.',
      customerContext,
      this.buildTransferSection(settings),
      this.buildResponseSection(settings),
    ].join('\n\n')

    return {
      settings,
      replyContext: {
        conversationId: input.conversationId,
        storeId: input.storeId,
        channel: input.channel,
        orderMode,
        message: input.message,
        customer: {
          name: customer?.name ?? input.customerName ?? null,
          phone: customer?.phone ?? input.customerPhone ?? null,
        },
        conversationHistory: input.conversationHistory.slice(-20),
        storeName: store.name,
        systemPrompt,
        catalogContext,
        settingsContext,
        knowledgeEntriesContext,
      },
    }
  }

  private async getOrCreateSettings(storeId: string) {
    const settings = await this.prisma.aiAttendantSettings.findUnique({ where: { storeId } })

    if (settings) {
      return settings
    }

    return this.prisma.aiAttendantSettings.create({
      data: {
        storeId,
        isEnabled: false,
        mode: 'off',
        assistantName: 'Atendente Cain',
        mainPrompt: DEFAULT_AI_MAIN_PROMPT,
        minDelaySeconds: 8,
        maxDelaySeconds: 25,
        messageGroupingSeconds: 6,
        answerOnlyDuringBusinessHours: true,
        transferOnLowConfidence: true,
        transferOnComplaint: true,
        transferOnCancellation: true,
        transferOnHumanRequest: true,
        tone: 'friendly',
        useEmojis: true,
        callCustomerByName: true,
        responseLength: 'medium',
        neverInventPrice: true,
        neverInventProduct: true,
        neverInventPromotion: true,
        neverPromiseDeliveryTime: true,
        upsellEnabled: true,
        upsellMaxSuggestions: 2,
        greetingMessage: 'Ola! Como posso te ajudar hoje?',
        outOfHoursMessage: 'Ola! No momento estamos fechados. Responderemos assim que reabrirmos.',
        humanHandoffMessage: 'Entendido. Estou transferindo voce para um de nossos atendentes humanos.',
      },
    })
  }

  private getStoreContext(storeId: string) {
    return this.prisma.store.findUnique({
      where: { id: storeId },
      include: {
        categories: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            description: true,
            active: true,
            visibleOnDigitalMenu: true,
            sortOrder: true,
          },
        },
        products: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            active: true,
            tags: true,
            sortOrder: true,
            category: {
              select: {
                id: true,
                name: true,
                active: true,
              },
            },
            availability: {
              select: {
                channel: true,
                available: true,
                visible: true,
                soldOut: true,
                priceOverride: true,
              },
            },
            optionGroups: {
              orderBy: { sortOrder: 'asc' },
              select: {
                required: true,
                minSelections: true,
                maxSelections: true,
                sortOrder: true,
                description: true,
                group: {
                  select: {
                    id: true,
                    name: true,
                    description: true,
                    options: {
                      where: { active: true },
                      orderBy: { sortOrder: 'asc' },
                      select: {
                        id: true,
                        name: true,
                        description: true,
                        priceDelta: true,
                        active: true,
                        sortOrder: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        promotions: {
          where: { status: 'active' },
          orderBy: { updatedAt: 'desc' },
          take: 20,
        },
        coupons: {
          where: { status: 'active' },
          orderBy: { updatedAt: 'desc' },
          take: 20,
        },
        paymentMethodConfigs: {
          where: { active: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
    }) as Promise<StoreWithAiContext | null>
  }

  private getCustomer(storeId: string, customerId?: string | null, customerPhone?: string | null) {
    const phone = customerPhone?.replace(/\D/g, '')

    if (!customerId && !phone) {
      return Promise.resolve(null)
    }

    return this.prisma.customer.findFirst({
      where: customerId ? { id: customerId, storeId } : { phone: phone ?? '', storeId },
      include: {
        addresses: {
          orderBy: { updatedAt: 'desc' },
          take: 3,
        },
      },
    }) as Promise<CustomerWithAddresses | null>
  }

  private getCustomerOrders(storeId: string, customerId: string) {
    return this.prisma.order.findMany({
      where: { storeId, customerId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        number: true,
        status: true,
        serviceType: true,
        total: true,
        createdAt: true,
        dueAt: true,
        addressText: true,
        driver: {
          select: {
            name: true,
          },
        },
        deliveryAssignments: {
          orderBy: { assignedAt: 'desc' },
          take: 1,
          select: {
            status: true,
            assignedAt: true,
            completedAt: true,
            driver: {
              select: {
                name: true,
              },
            },
          },
        },
        etaSnapshots: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            etaMinutes: true,
            distanceMeters: true,
            message: true,
            createdAt: true,
          },
        },
        items: {
          select: {
            name: true,
            quantity: true,
          },
        },
      },
    }) as Promise<CustomerOrder[]>
  }

  private buildIdentitySection(
    settings: AiAttendantSettings,
    store: StoreWithAiContext,
    channel: AiPromptChannel,
    orderMode: AiPromptOrderMode,
  ) {
    return [
      `Identidade da IA: ${settings.assistantName}.`,
      `Loja: ${store.tradeName || store.name}. Canal: ${channel}. Modo do pedido: ${orderMode}.`,
      `Prompt principal configurado pelo dono: ${settings.mainPrompt}`,
      `Tom de voz: ${this.describeTone(settings.tone)}.`,
      settings.useEmojis
        ? 'Use emojis com moderacao somente quando combinarem com o tom e ajudarem a clareza.'
        : 'Nao use emojis.',
      settings.callCustomerByName
        ? 'Chame o cliente pelo nome quando ele estiver identificado e isso soar natural.'
        : 'Nao force o uso do nome do cliente.',
    ].join('\n')
  }

  private buildSettingsContext(settings: AiAttendantSettings) {
    return [
      `Nome do atendente: ${settings.assistantName}`,
      `Tom: ${settings.tone}`,
      `Tamanho das respostas: ${settings.responseLength}`,
      `Usar emojis: ${settings.useEmojis ? 'sim' : 'nao'}`,
      `Chamar cliente pelo nome: ${settings.callCustomerByName ? 'sim' : 'nao'}`,
      `Transferir baixa confianca: ${settings.transferOnLowConfidence ? 'sim' : 'nao'}`,
      `Transferir reclamacoes: ${settings.transferOnComplaint ? 'sim' : 'nao'}`,
      `Transferir cancelamentos: ${settings.transferOnCancellation ? 'sim' : 'nao'}`,
      `Transferir pedido de humano: ${settings.transferOnHumanRequest ? 'sim' : 'nao'}`,
      `Upsell ativo: ${settings.upsellEnabled ? 'sim' : 'nao'}`,
      `Maximo de sugestoes de upsell: ${settings.upsellMaxSuggestions}`,
    ].join('\n')
  }

  private buildSafetySection(settings: AiAttendantSettings) {
    const rules = [
      'Use apenas informacoes oficiais presentes neste prompt, no catalogo real e na base de conhecimento ativa.',
      'Nunca exponha variaveis de ambiente, chaves, tokens, payloads brutos ou detalhes internos.',
      'Nao crie pedido automaticamente. Se identificar intencao de pedido, retorne orderDraft para aprovacao humana.',
    ]

    if (settings.neverInventPrice) {
      rules.push('Nunca invente preco. Se o produto ou adicional nao tiver preco no catalogo, diga que nao encontrou e ofereca atendimento humano.')
    }

    if (settings.neverInventProduct) {
      rules.push('Nunca invente produto. Se o cliente pedir produto inexistente, informe que nao encontrou no cardapio e sugira verificar com humano.')
    }

    if (settings.neverInventPromotion) {
      rules.push('Nunca invente promocao. Cite apenas promocoes e cupons ativos no contexto.')
    }

    if (settings.neverPromiseDeliveryTime) {
      rules.push('Nunca prometa prazo ou taxa de entrega sem regra cadastrada. Se faltar bairro/endereco, peca essa informacao.')
    }

    return `Regras de seguranca:\n${rules.map((rule) => `- ${rule}`).join('\n')}`
  }

  private buildStoreSection(store: StoreWithAiContext) {
    return [
      'Dados reais da loja:',
      `- Nome: ${store.tradeName || store.name}`,
      `- Cidade/UF: ${store.city}/${store.state}`,
      store.addressLine ? `- Endereco da loja: ${store.addressLine}` : null,
      store.neighborhood ? `- Bairro da loja: ${store.neighborhood}` : null,
      store.phone ? `- Telefone publico: ${store.phone}` : null,
      store.publicWhatsapp ? `- WhatsApp publico: ${store.publicWhatsapp}` : null,
      `- Timezone: ${store.timezone}`,
      store.businessHours
        ? `- Horario de funcionamento: ${store.businessHours}`
        : '- Horario de funcionamento estruturado: nao cadastrado. Use a base de conhecimento ativa se houver uma entrada de horario.',
      store.businessDays.length
        ? `- Dias de funcionamento: ${store.businessDays.join(', ')}`
        : '- Dias de funcionamento: nao cadastrados.',
      `- Tempo estimado preparo: ${store.estimatedPrepTimeMinutes} min`,
      `- Tempo estimado delivery: ${store.estimatedDeliveryTimeMinutes} min`,
      `- Tempo estimado retirada: ${store.estimatedPickupTimeMinutes} min`,
      `- Tempo estimado balcao: ${store.estimatedCounterTimeMinutes} min`,
      `- Tempo estimado salao: ${store.estimatedDineInTimeMinutes} min`,
      `- Delivery ativo: ${store.deliveryEnabled ? 'sim' : 'nao'}`,
      `- Retirada ativa: ${store.pickupEnabled ? 'sim' : 'nao'}`,
      `- Pedido minimo: R$ ${store.minimumOrderAmount.toNumber().toFixed(2).replace('.', ',')}`,
      `- Taxa padrao de entrega: R$ ${store.defaultDeliveryFee.toNumber().toFixed(2).replace('.', ',')}`,
      store.greetingMessage ? `- Saudacao oficial: ${store.greetingMessage}` : null,
      store.outOfHoursMessage ? `- Mensagem fora do horario: ${store.outOfHoursMessage}` : null,
      store.cancellationPolicy ? `- Politica de cancelamento: ${store.cancellationPolicy}` : null,
      store.generalNotes ? `- Observacoes operacionais: ${store.generalNotes}` : null,
      '- Areas/taxas de entrega por bairro aparecem no checkout/catalogo quando cadastradas. Se faltar bairro/endereco, peca essa informacao e nao invente valor.',
    ]
      .filter((line): line is string => line !== null)
      .join('\n')
  }

  private buildCatalogSourceContext(source: CatalogMenuSourceData) {
    const categoryLines = source.categories.map((category) => {
      const visibility = category.visibleForChannel ? '' : ' (nao vender neste canal)'
      return `- ${category.name}: ${category.products.length} produto(s)${visibility}`
    })

    const productLines = source.categories.flatMap((category) =>
      category.products.map((product) => {
        const state = product.orderable
          ? ''
          : ` (${product.unavailableReason ?? 'indisponivel; nao vender'})`
        const description = product.description ? ` - ${product.description}` : ''
        const tags = product.tags.length ? ` Tags: ${product.tags.join(', ')}.` : ''
        const groups = product.optionGroups
          .map((group) => {
            const requirement = group.required
              ? `obrigatorio ${group.minSelections}-${group.maxSelections}`
              : `opcional max ${group.maxSelections}`
            const options = group.options
              .map((option) => {
                const price = option.priceDelta > 0
                  ? ` +R$ ${option.priceDelta.toFixed(2).replace('.', ',')}`
                  : ''
                const optionState = option.orderable ? '' : ' (esgotado/indisponivel; nao oferecer)'
                return `${option.name} (optionId: ${option.id}${price})${optionState}`
              })
              .join(', ')
            return `${group.name} (groupId: ${group.id}, ${requirement}): ${options || 'sem opcoes vendaveis'}`
          })
          .join(' | ')

        return `- [${category.name}] ${product.name} (id: ${product.id}): R$ ${product.price.toFixed(2).replace('.', ',')}${description}${state}${tags}${groups ? ` Opcoes reais: ${groups}.` : ''}`
      }),
    )

    return [
      `Catalogo estruturado unico do Cain Delivery para o canal ${source.channel}:`,
      categoryLines.length ? `Categorias:\n${categoryLines.join('\n')}` : 'Categorias: nenhuma disponivel.',
      productLines.length ? `Produtos e opcoes:\n${productLines.join('\n')}` : 'Produtos e opcoes: nenhum item encontrado.',
      'Regra operacional: produto, sabor ou adicional marcado como esgotado/indisponivel nao pode ser oferecido, vendido, usado em promocao nem colocado em orderDraft.',
    ].join('\n')
  }

  private buildCommercialSourceSection(
    source: CatalogMenuSourceData,
    settings: AiAttendantSettings,
  ) {
    const promotionLines = source.promotions.map((promotion) => {
      const discount = promotion.discountValue
        ? ` Desconto: ${promotion.type} ${promotion.discountValue.toFixed(2).replace('.', ',')}.`
        : ''
      const description = promotion.description ? ` ${promotion.description}` : ''
      const scope = [
        promotion.productIds.length ? `produtos ${promotion.productIds.join(', ')}` : null,
        promotion.categoryIds.length ? `categorias ${promotion.categoryIds.join(', ')}` : null,
      ].filter((entry): entry is string => entry !== null).join('; ')
      return `- ${promotion.name}.${description}${discount}${scope ? ` Escopo vendavel: ${scope}.` : ''}`
    })

    const couponLines = source.coupons.map((coupon) => {
      const description = coupon.description ? ` ${coupon.description}` : ''
      return `- ${coupon.code}: ${coupon.type} ${coupon.value.toFixed(2).replace('.', ',')}. Pedido minimo R$ ${coupon.minOrderAmount.toFixed(2).replace('.', ',')}.${description}`
    })

    return [
      'Promocoes, cupons e upsell vindos do catalogo unico:',
      settings.upsellEnabled
        ? `Upsell permitido: sim. Sugira no maximo ${settings.upsellMaxSuggestions} item(ns), somente com produtos/opcoes orderable=true e promocoes/cupons ativos listados abaixo.`
        : 'Upsell permitido: nao. Nao ofereca adicionais ou combos proativamente.',
      promotionLines.length ? `Promocoes:\n${promotionLines.join('\n')}` : 'Promocoes: nenhuma ativa para este canal.',
      couponLines.length ? `Cupons:\n${couponLines.join('\n')}` : 'Cupons: nenhum ativo para este canal.',
    ].join('\n')
  }

  private buildPaymentSection(paymentMethods: PaymentMethodConfig[]) {
    if (!paymentMethods.length) {
      return 'Formas de pagamento ativas: nenhuma configurada.'
    }

    const lines = paymentMethods.map((method) => {
      const channels = method.channels.length ? ` Canais: ${method.channels.join(', ')}.` : ''
      const receipt = method.requiresReceipt ? ' Requer comprovante.' : ''
      return `- ${method.name} (${method.method ?? method.provider}).${channels}${receipt}`
    })

    return `Formas de pagamento ativas:\n${lines.join('\n')}`
  }

  private buildCustomerContext(
    customer: CustomerWithAddresses | null,
    orders: CustomerOrder[],
    fallbackName?: string | null,
    fallbackPhone?: string | null,
  ) {
    const name = customer?.name ?? fallbackName ?? 'Nao identificado'
    const phone = customer?.phone ?? fallbackPhone ?? 'Nao informado'
    const totalSpent = orders.reduce((sum, order) => sum + Number(order.total), 0)
    const districts = customer?.addresses
      .map((address) => address.district)
      .filter((district) => district.trim().length > 0) ?? []
    const favoriteItems = this.buildFavoriteItems(orders)
    const addressLines = customer?.addresses.map((address) => {
      const complement = address.complement ? `, ${address.complement}` : ''
      return `- ${address.label}: ${address.street}, ${address.number}${complement} - ${address.district}, ${address.city}/${address.state}`
    }) ?? []
    const orderLines = orders.map((order) => {
      const items = order.items.map((item) => `${item.quantity}x ${item.name}`).join(', ')
      const address = order.addressText ? ` Entrega: ${order.addressText}.` : ''
      const driver =
        order.driver?.name ??
        order.deliveryAssignments[0]?.driver.name ??
        null
      const eta = order.etaSnapshots[0]
      const etaText = eta
        ? ` ETA real mais recente: ${eta.etaMinutes} min, ${Math.round(eta.distanceMeters / 1000)} km.`
        : ''
      const driverText = driver ? ` Motoboy: ${driver}.` : ''
      const dueText = ` Previsao/dueAt: ${order.dueAt.toISOString()}.`
      return `- #${order.number}: ${order.status}, ${order.serviceType}, total R$ ${this.formatMoney(order.total)}, itens: ${items || 'sem itens'}.${address}${driverText}${etaText}${dueText}`
    })

    return [
      'Contexto do cliente:',
      `- Nome: ${name}`,
      `- Telefone: ${phone}`,
      `- Frequencia historica recente: ${orders.length} pedido(s) nos ultimos registros retornados.`,
      `- Valor gasto recente: R$ ${totalSpent.toFixed(2).replace('.', ',')}.`,
      `- Bairro(s) conhecidos: ${districts.length ? [...new Set(districts)].join(', ') : 'nenhum'}.`,
      `- Itens recorrentes: ${favoriteItems || 'nenhum padrao identificado'}.`,
      addressLines.length ? `Enderecos recentes:\n${addressLines.join('\n')}` : 'Enderecos recentes: nenhum cadastrado.',
      orderLines.length ? `Pedidos reais recentes e status:\n${orderLines.join('\n')}` : 'Pedidos recentes: nenhum encontrado.',
    ].join('\n')
  }

  private buildFavoriteItems(orders: CustomerOrder[]) {
    const counts = new Map<string, number>()

    orders.forEach((order) => {
      order.items.forEach((item) => {
        counts.set(item.name, (counts.get(item.name) ?? 0) + item.quantity)
      })
    })

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, quantity]) => `${name} (${quantity}x)`)
      .join(', ')
  }

  private buildTransferSection(settings: AiAttendantSettings) {
    const transferRules = [
      settings.transferOnComplaint ? '- Se houver reclamacao, marque shouldTransferToHuman=true e explique o motivo.' : null,
      settings.transferOnCancellation ? '- Se houver pedido de cancelamento, marque shouldTransferToHuman=true.' : null,
      settings.transferOnLowConfidence ? '- Se a confianca for baixa, marque shouldTransferToHuman=true.' : null,
      settings.transferOnHumanRequest ? '- Se o cliente pedir atendente humano, marque shouldTransferToHuman=true.' : null,
      '- Se o assunto sair do escopo de delivery, cardapio, pedido, pagamento ou informacoes oficiais, chame humano.',
    ].filter((rule): rule is string => rule !== null)

    return `Instrucoes de transferencia para humano:\n${transferRules.join('\n')}`
  }

  private buildResponseSection(settings: AiAttendantSettings) {
    const lengthInstruction = {
      short: 'Respostas curtas: 1 a 2 frases objetivas.',
      medium: 'Respostas medias: responda com clareza em ate 1 paragrafo curto.',
      detailed: 'Respostas detalhadas: explique com mais contexto, mas sem enrolar.',
    } satisfies Record<AiAttendantSettings['responseLength'], string>

    return [
      'Formato e comportamento da resposta:',
      `- ${lengthInstruction[settings.responseLength]}`,
      '- Quando precisar de dado faltante, faca uma pergunta objetiva.',
      '- Para venda guiada, conduza uma etapa por vez: produto, tamanho/opcoes obrigatorias, adicionais, endereco e pagamento.',
      '- Quando identificar pedido parcial, retorne orderDraft com produtos e opcoes ja confirmados e missingFields com dados pendentes. Nao diga que o pedido foi criado.',
      '- Use productId/groupId/optionId quando o item existir no catalogo real. Se nao tiver certeza, use apenas nomes e inclua o campo pendente em missingFields.',
      '- Para consulta de status, responda somente usando Pedidos reais recentes e status. Se nao houver pedido compatível, peca mais dados ou chame humano.',
      '- Para upsell, cite apenas combos/promocoes/cupons ativos ou relacoes inferidas de tags reais do catalogo. Nunca crie desconto inexistente.',
      '- Se usar fontes, preencha sourcesUsed com nomes como catalogo, base_conhecimento, promocoes, cupons, pagamentos, historico_cliente.',
      '- Se transferir para humano, preencha transferReason com uma frase segura e curta.',
    ].join('\n')
  }

  private resolveProductChannel(channel: AiPromptChannel): ProductChannel {
    if (channel === 'dine_in') return 'dine_in'
    if (channel === 'counter') return 'counter'
    return 'delivery'
  }

  private resolveOrderMode(channel: AiPromptChannel): AiPromptOrderMode {
    if (channel === 'dine_in') return 'dine_in'
    if (channel === 'counter') return 'counter'
    return 'delivery'
  }

  private describeTone(tone: AiAttendantSettings['tone']) {
    const toneLabels = {
      professional: 'profissional, claro e objetivo',
      friendly: 'amigavel, acolhedor e natural',
      casual: 'descontraido, simples e ainda educado',
      premium: 'premium, cuidadoso e elegante',
    } satisfies Record<AiAttendantSettings['tone'], string>

    return toneLabels[tone]
  }

  private formatMoney(value: Prisma.Decimal) {
    return Number(value).toFixed(2).replace('.', ',')
  }
}
