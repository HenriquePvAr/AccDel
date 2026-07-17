import type {
  AiAttendantMode,
  AiResponseLength,
  AiAttendantTone,
  AiTestChannel,
  AiConversationStatus,
  AiKnowledgeEntryType,
  IntegrationLogStatus,
  TestReplyResult,
  WhatsappIntegrationLogType,
  WhatsappMessageSenderType,
  WhatsappMessageStatus,
  WhatsappSessionStatus,
} from '@/contracts/ai-attendant'

export const aiModeLabels: Record<AiAttendantMode, string> = {
  off: 'Desligado',
  suggestion: 'Sugestao',
  automatic: 'Automatico',
  hybrid: 'Hibrido',
}

export const aiToneLabels: Record<AiAttendantTone, string> = {
  professional: 'Profissional',
  friendly: 'Amigavel',
  casual: 'Casual',
  premium: 'Premium',
}

export const aiResponseLengthLabels: Record<AiResponseLength, string> = {
  short: 'Curtas',
  medium: 'Medias',
  detailed: 'Detalhadas',
}

export const aiTestChannelLabels: Record<AiTestChannel, string> = {
  whatsapp: 'WhatsApp',
  delivery: 'Delivery',
  counter: 'Balcao',
  dine_in: 'Salao',
}

export const knowledgeTypeLabels: Record<AiKnowledgeEntryType, string> = {
  faq: 'FAQ',
  policy: 'Politica',
  store_info: 'Informacao da loja',
  delivery_area: 'Entrega',
  payment: 'Pagamento',
  promotions: 'Promocoes',
  cancellation: 'Cancelamento',
  custom: 'Custom',
}

export const whatsappStatusLabels: Record<WhatsappSessionStatus, string> = {
  disconnected: 'Desconectado',
  waiting_qr: 'Aguardando QR',
  connecting: 'Conectando',
  connected: 'Conectado',
  expired: 'Expirado',
  error: 'Erro',
}

export const conversationStatusLabels: Record<AiConversationStatus, string> = {
  open: 'Aberta',
  waiting_ai: 'Resposta automatica em andamento',
  waiting_human: 'Aguardando atendente',
  human_assigned: 'Atendimento humano',
  closed: 'Fechada',
  ai_active: 'Resposta automatica ativa',
  human_active: 'Atendimento humano',
  paused: 'Pausada',
}

export const messageSenderLabels: Record<WhatsappMessageSenderType, string> = {
  customer: 'Cliente',
  ai: 'IA',
  human: 'Humano',
  system: 'Sistema',
}

export const messageStatusLabels: Record<WhatsappMessageStatus, string> = {
  received: 'Recebida',
  queued: 'Na fila',
  sending: 'Enviando',
  sent: 'Enviada',
  delivered: 'Entregue',
  read: 'Lida',
  failed: 'Falhou',
}

export const integrationLogTypeLabels: Record<WhatsappIntegrationLogType, string> = {
  provider_status: 'Estado do servico',
  session_started: 'Sessao iniciada',
  session_disconnected: 'Sessao desconectada',
  session_restarted: 'Sessao reiniciada',
  qr_requested: 'QR Code solicitado',
  webhook_received: 'Mensagem recebida pelo servico',
  message_received: 'Mensagem recebida',
  message_sent: 'Mensagem enviada',
  message_failed: 'Falha de envio',
  ai_reply_generated: 'Resposta da IA',
  ai_reply_failed: 'Falha da IA',
  delay_scheduled: 'Delay agendado',
  delay_cancelled: 'Delay cancelado',
  human_assigned: 'Atendimento humano iniciado',
  human_released: 'Devolvida para resposta automatica',
  conversation_closed: 'Conversa fechada',
  test_chat: 'Teste de IA',
  test_whatsapp_sent: 'Teste WhatsApp',
  duplicate_ignored: 'Duplicata ignorada',
  outbox_enqueued: 'Mensagem enfileirada',
  outbox_retry: 'Nova tentativa de envio',
  notification_queued: 'Notificacao enfileirada',
  tracking_created: 'Acompanhamento criado',
  ai_tool_called: 'Ferramenta de IA executada',
}

export const integrationLogStatusLabels: Record<IntegrationLogStatus, string> = {
  info: 'Info',
  success: 'Sucesso',
  warning: 'Aviso',
  error: 'Erro',
}

export const recommendedActionLabels: Record<TestReplyResult['recommendedAction'], string> = {
  respond_automatically: 'Responder automaticamente',
  request_human_help: 'Chamar atendente humano',
  ask_more_info: 'Pedir mais informacoes',
}

export const knowledgeTypes = Object.keys(knowledgeTypeLabels) as AiKnowledgeEntryType[]
export const aiModes = Object.keys(aiModeLabels) as AiAttendantMode[]
export const aiTones = Object.keys(aiToneLabels) as AiAttendantTone[]
export const aiResponseLengths = Object.keys(aiResponseLengthLabels) as AiResponseLength[]
export const aiTestChannels = Object.keys(aiTestChannelLabels) as AiTestChannel[]

export function formatDateTime(value: string | null) {
  if (!value) {
    return 'Nao disponivel'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function formatRelativeDate(value: string | null) {
  if (!value) {
    return 'Sem mensagens'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}
