import type {
  AiAttendantMode,
  AiAttendantTone,
  AiConversationStatus,
  AiKnowledgeEntryType,
  TestReplyResult,
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

export const knowledgeTypeLabels: Record<AiKnowledgeEntryType, string> = {
  faq: 'FAQ',
  policy: 'Politica',
  store_info: 'Informacao da loja',
  delivery_area: 'Entrega',
  payment: 'Pagamento',
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
  waiting_ai: 'Aguardando IA',
  waiting_human: 'Aguardando humano',
  human_assigned: 'Humano assumiu',
  closed: 'Fechada',
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
  sent: 'Enviada',
  failed: 'Falhou',
}

export const recommendedActionLabels: Record<TestReplyResult['recommendedAction'], string> = {
  respond_automatically: 'Responder automaticamente',
  request_human_help: 'Chamar atendente humano',
  ask_more_info: 'Pedir mais informacoes',
}

export const knowledgeTypes = Object.keys(knowledgeTypeLabels) as AiKnowledgeEntryType[]
export const aiModes = Object.keys(aiModeLabels) as AiAttendantMode[]
export const aiTones = Object.keys(aiToneLabels) as AiAttendantTone[]

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
