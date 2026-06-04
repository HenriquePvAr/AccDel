import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bot,
  Clock3,
  FileText,
  MessageSquare,
  PauseCircle,
  Reply,
  Send,
  ShoppingCart,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react'

import { EmptyState } from '@/components/shared/EmptyState'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useAssignConversationMutation,
  useCloseConversationMutation,
  useConversationDetailQuery,
  useConversationsQuery,
  useCreateKnowledgeEntryMutation,
  useDiscardOrderDraftMutation,
  usePrepareOrderDraftMutation,
  useReleaseConversationMutation,
  useSendManualMessageMutation,
  useWhatsappSessionQuery,
} from '@/hooks/queries/ai-attendant'
import { useAuthStore } from '@/stores/auth-store'
import { useNewOrderStore } from '@/stores/new-order-store'
import { useToastStore } from '@/stores/toast-store'
import type {
  AiConversation,
  AiConversationStatus,
  AiKnowledgeEntryType,
  AiMessage,
  PreparedAiOrderDraft,
} from '@/contracts/ai-attendant'
import type { OrderItem } from '@/types'

import {
  conversationStatusLabels,
  formatCurrency,
  formatDateTime,
  formatRelativeDate,
  messageSenderLabels,
  messageStatusLabels,
} from './ai-attendant-labels'

type ConversationFilter = 'all' | 'waiting_human' | 'waiting_ai' | 'human_assigned' | 'closed'
type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'analysis'

const conversationFilters: Array<{ value: ConversationFilter; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'waiting_human', label: 'Aguardando humano' },
  { value: 'waiting_ai', label: 'IA respondendo' },
  { value: 'human_assigned', label: 'Humano assumiu' },
  { value: 'closed', label: 'Fechadas' },
]

export function AiConversationsTab() {
  const { data: conversations = [], isLoading } = useConversationsQuery()
  const { data: session } = useWhatsappSessionQuery()
  const [filter, setFilter] = useState<ConversationFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const filteredConversations = useMemo(
    () =>
      conversations.filter((conversation) =>
        filter === 'all' ? true : conversation.status === filter,
      ),
    [conversations, filter],
  )
  const activeConversationId =
    selectedId && conversations.some((conversation) => conversation.id === selectedId)
      ? selectedId
      : filteredConversations[0]?.id ?? conversations[0]?.id ?? null
  const { data: detail, isLoading: detailLoading } = useConversationDetailQuery(activeConversationId)
  const selectedConversation = useMemo(
    () => detail ?? conversations.find((conversation) => conversation.id === activeConversationId) ?? null,
    [activeConversationId, conversations, detail],
  )

  if (isLoading) {
    return (
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
        <Skeleton className="h-[680px]" />
        <Skeleton className="h-[680px]" />
        <Skeleton className="h-[680px]" />
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquare className="h-7 w-7" />}
        title="Nenhuma conversa encontrada"
        description="As conversas aparecem aqui somente depois de mensagens reais recebidas pelo webhook do WhatsApp ou testes reais autorizados."
      />
    )
  }

  return (
    <div className="grid min-h-[700px] gap-5 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
      <ConversationList
        conversations={filteredConversations}
        totalConversations={conversations.length}
        activeConversationId={activeConversationId}
        filter={filter}
        onFilterChange={setFilter}
        onSelect={setSelectedId}
      />

      <Card className="overflow-hidden">
        {detailLoading && !selectedConversation ? (
          <CardContent className="p-5">
            <Skeleton className="h-[640px]" />
          </CardContent>
        ) : selectedConversation ? (
          <ConversationChat
            conversation={selectedConversation}
            whatsappConnected={session?.status === 'connected'}
          />
        ) : (
          <CardContent className="p-5">
            <EmptyState
              icon={<Reply className="h-7 w-7" />}
              title="Selecione uma conversa"
              description="Abra uma conversa da lista para ver mensagens, assumir atendimento ou fechar o contato."
            />
          </CardContent>
        )}
      </Card>

      <ConversationContextPanel conversation={selectedConversation} />
    </div>
  )
}

interface ConversationListProps {
  conversations: AiConversation[]
  totalConversations: number
  activeConversationId: string | null
  filter: ConversationFilter
  onFilterChange: (filter: ConversationFilter) => void
  onSelect: (id: string) => void
}

function ConversationList({
  conversations,
  totalConversations,
  activeConversationId,
  filter,
  onFilterChange,
  onSelect,
}: ConversationListProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Inbox WhatsApp
        </CardTitle>
        <CardDescription>{totalConversations} conversa(s) retornada(s) pela API.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {conversationFilters.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onFilterChange(item.value)}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-slate-400 transition hover:border-white/20 hover:text-white data-[active=true]:border-primary/50 data-[active=true]:bg-primary/15 data-[active=true]:text-primary"
              data-active={filter === item.value}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="max-h-[560px] space-y-2 overflow-y-auto pr-2 scrollbar-thin">
          {conversations.length > 0 ? (
            conversations.map((conversation) => (
              <ConversationListItem
                key={conversation.id}
                conversation={conversation}
                active={conversation.id === activeConversationId}
                onClick={() => onSelect(conversation.id)}
              />
            ))
          ) : (
            <p className="rounded-[18px] border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-400">
              Nenhuma conversa neste filtro.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface ConversationChatProps {
  conversation: AiConversation
  whatsappConnected: boolean
}

function ConversationChat({ conversation, whatsappConnected }: ConversationChatProps) {
  const assignConversation = useAssignConversationMutation()
  const releaseConversation = useReleaseConversationMutation()
  const closeConversation = useCloseConversationMutation()
  const sendMessage = useSendManualMessageMutation()
  const currentUser = useAuthStore((state) => state.user)
  const { pushToast } = useToastStore()
  const [messageBody, setMessageBody] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)
  const pendingDelayMessage = getPendingDelayMessage(conversation)

  const handleAssign = async () => {
    if (!currentUser) {
      pushToast({
        title: 'Usuario nao identificado',
        description: 'Entre novamente para assumir a conversa.',
        variant: 'warning',
      })
      return
    }

    await assignConversation.mutateAsync({
      id: conversation.id,
      userId: currentUser.id,
    })
  }

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSendError(null)

    const body = messageBody.trim()
    if (!body) {
      pushToast({ title: 'Digite a mensagem antes de enviar', variant: 'warning' })
      return
    }

    try {
      await sendMessage.mutateAsync({
        id: conversation.id,
        payload: { body },
      })
      setMessageBody('')
    } catch (error) {
      setSendError(getErrorMessage(error, 'Nao foi possivel enviar a mensagem.'))
    }
  }

  return (
    <div className="flex h-full min-h-[700px] flex-col">
      <CardHeader className="border-b border-white/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {conversation.customerName ?? conversation.customer?.name ?? conversation.whatsappNumber}
            </CardTitle>
            <CardDescription>
              {conversation.whatsappNumber} - ultima mensagem {formatRelativeDate(conversation.lastMessageAt)}
            </CardDescription>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Badge variant={conversationBadgeVariant(conversation.status)}>
              {conversationStatusLabels[conversation.status]}
            </Badge>
            {conversation.type === 'test' ? <Badge variant="analysis">Teste real</Badge> : null}
            {conversation.isAiPaused ? <Badge variant="warning">IA pausada</Badge> : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-3">
          <Button
            size="sm"
            variant="outline"
            onClick={handleAssign}
            disabled={assignConversation.isPending || conversation.status === 'human_assigned'}
          >
            <UserCheck className="h-4 w-4" />
            Assumir
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => releaseConversation.mutateAsync(conversation.id)}
            disabled={releaseConversation.isPending || conversation.status === 'closed'}
          >
            <Bot className="h-4 w-4" />
            Devolver para IA
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => closeConversation.mutateAsync(conversation.id)}
            disabled={closeConversation.isPending || conversation.status === 'closed'}
          >
            <XCircle className="h-4 w-4" />
            Fechar
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
        {!whatsappConnected ? (
          <Alert variant="warning">
            <AlertTitle>
              <Clock3 className="h-4 w-4" />
              WhatsApp nao conectado
            </AlertTitle>
            <AlertDescription>
              Voce pode visualizar o historico, mas o envio humano fica bloqueado ate a sessao conectar.
            </AlertDescription>
          </Alert>
        ) : null}

        {conversation.isAiPaused ? (
          <Alert>
            <AlertTitle>
              <PauseCircle className="h-4 w-4" />
              IA pausada nesta conversa
            </AlertTitle>
            <AlertDescription>
              Enquanto humano assumiu ou a conversa esta fechada, o pipeline nao envia resposta automatica.
            </AlertDescription>
          </Alert>
        ) : pendingDelayMessage ? (
          <Alert variant="warning">
            <AlertTitle>
              <Clock3 className="h-4 w-4" />
              {pendingDelayMessage}
            </AlertTitle>
            <AlertDescription>
              O envio sera cancelado se um humano assumir antes do delay terminar.
            </AlertDescription>
          </Alert>
        ) : null}

        {conversation.lastError ? (
          <Alert variant="danger">
            <AlertTitle>Ultimo erro</AlertTitle>
            <AlertDescription>{conversation.lastError}</AlertDescription>
          </Alert>
        ) : conversation.lastStatus ? (
          <p className="rounded-[18px] border border-white/10 bg-white/[0.04] p-3 text-sm leading-6 text-slate-300">
            {conversation.lastStatus}
          </p>
        ) : null}

        <div className="flex-1 space-y-3 overflow-y-auto rounded-[22px] border border-white/10 bg-[#050d18]/70 p-4 scrollbar-thin">
          {conversation.messages.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="h-7 w-7" />}
              title="Sem mensagens nesta conversa"
              description="A conversa existe, mas a API ainda nao possui mensagens vinculadas."
            />
          ) : (
            conversation.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}
        </div>

        <form className="space-y-3" onSubmit={handleSend}>
          <textarea
            value={messageBody}
            onChange={(event) => setMessageBody(event.target.value)}
            rows={3}
            disabled={!whatsappConnected || conversation.status === 'closed'}
            className="w-full resize-y rounded-xl border border-white/10 bg-[#071525] px-3 py-2 text-sm leading-6 text-slate-100 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-primary/70 focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
            placeholder="Escreva uma resposta humana para o cliente."
          />
          {sendError ? <p className="text-sm leading-6 text-red-200">{sendError}</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs leading-5 text-slate-500">
              Envio manual assume a conversa e pausa a IA.
            </p>
            <Button
              type="submit"
              disabled={!whatsappConnected || sendMessage.isPending || conversation.status === 'closed'}
            >
              <Send className="h-4 w-4" />
              Enviar mensagem humana
            </Button>
          </div>
        </form>
      </CardContent>
    </div>
  )
}

function ConversationContextPanel({ conversation }: { conversation: AiConversation | null }) {
  const discardOrderDraft = useDiscardOrderDraftMutation()
  const prepareOrderDraft = usePrepareOrderDraftMutation()
  const navigate = useNavigate()
  const hydrateOrderDraft = useHydrateOrderDraft()
  const { pushToast } = useToastStore()
  const activeDrafts = conversation?.orderDrafts.filter((draft) => draft.status === 'suggested') ?? []

  const handlePrepareOrder = async (draftId: string) => {
    const prepared = await prepareOrderDraft.mutateAsync(draftId)

    if (!prepared.items.length) {
      pushToast({
        title: 'Nenhum item resolvido no catalogo',
        description: 'Revise o pedido sugerido antes de abrir Novo Pedido.',
        variant: 'warning',
      })
      return
    }

    hydrateOrderDraft(prepared)

    if (prepared.unresolvedItems.length) {
      pushToast({
        title: 'Pedido aberto com pendencias',
        description: `${prepared.unresolvedItems.length} item(ns) nao foram encontrados no catalogo ativo.`,
        variant: 'warning',
      })
    } else {
      pushToast({ title: 'Pedido sugerido carregado no Novo Pedido', variant: 'success' })
    }

    navigate('/orders/new')
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Contexto
        </CardTitle>
        <CardDescription>Cliente, historico e rascunho detectado pela IA.</CardDescription>
      </CardHeader>
      <CardContent className="max-h-[620px] space-y-4 overflow-y-auto pr-2 scrollbar-thin">
        {!conversation ? (
          <p className="rounded-[18px] border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-400">
            Selecione uma conversa para ver contexto real.
          </p>
        ) : (
          <>
            <ContextBlock title="Cliente">
              <ContextLine label="Nome" value={conversation.customer?.name ?? conversation.customerName ?? 'Nao identificado'} />
              <ContextLine label="Telefone" value={conversation.customer?.phone ?? conversation.whatsappNumber} />
              <ContextLine label="Tipo" value={conversation.type === 'test' ? 'Conversa real de teste' : 'Atendimento real'} />
            </ContextBlock>

            <ContextBlock title="Enderecos">
              {conversation.customer?.addresses.length ? (
                conversation.customer.addresses.map((address) => (
                  <div key={address.id} className="rounded-xl bg-white/[0.04] p-3 text-sm leading-6 text-slate-300">
                    <p className="font-semibold text-white">{address.label}</p>
                    <p>
                      {address.street}, {address.number} - {address.district}
                    </p>
                    <p>{address.city}/{address.state}</p>
                    {address.reference ? <p className="text-slate-500">{address.reference}</p> : null}
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-slate-400">
                  Nenhum endereco retornado para este cliente.
                </p>
              )}
            </ContextBlock>

            <ContextBlock title="Pedidos anteriores">
              {conversation.customer?.orders.length ? (
                conversation.customer.orders.map((order) => (
                  <div key={order.id} className="rounded-xl bg-white/[0.04] p-3 text-sm leading-6 text-slate-300">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-white">Pedido #{order.number}</p>
                      <span className="text-xs text-slate-500">{formatCurrency(order.total)}</span>
                    </div>
                    <p className="text-xs text-slate-500">{formatDateTime(order.createdAt)}</p>
                    {order.items.length ? (
                      <p className="mt-2 text-xs text-slate-400">
                        {order.items.map((item) => `${item.quantity}x ${item.name}`).join(', ')}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-slate-400">
                  Nenhum pedido anterior retornado para este cliente.
                </p>
              )}
            </ContextBlock>

            <AssistedLearningBlock key={conversation.id} conversation={conversation} />

            <ContextBlock title="Pedido sugerido">
              {activeDrafts.length ? (
                activeDrafts.map((draft) => (
                  <div key={draft.id} className="space-y-3 rounded-xl bg-white/[0.04] p-3">
                    {draft.parsedItems.length ? (
                      <ul className="space-y-1 text-sm leading-6 text-slate-300">
                        {draft.parsedItems.map((item, index) => (
                          <li key={`${draft.id}-${item.productName}-${index}`}>
                            {item.quantity}x {item.productName}
                            {item.notes ? ` - ${item.notes}` : ''}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm leading-6 text-slate-400">
                        A IA retornou rascunho sem itens completos.
                      </p>
                    )}
                    {draft.missingFields.length ? (
                      <p className="text-xs leading-5 text-status-warning">
                        Faltando: {draft.missingFields.join(', ')}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => handlePrepareOrder(draft.id)}
                        disabled={prepareOrderDraft.isPending}
                      >
                        <ShoppingCart className="h-4 w-4" />
                        Criar pedido
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => discardOrderDraft.mutateAsync(draft.id)}
                        disabled={discardOrderDraft.isPending}
                      >
                        Descartar sugestao
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-slate-400">
                  Nenhum rascunho ativo para esta conversa.
                </p>
              )}
            </ContextBlock>
          </>
        )}
      </CardContent>
    </Card>
  )
}

interface ConversationListItemProps {
  conversation: AiConversation
  active: boolean
  onClick: () => void
}

function ConversationListItem({ conversation, active, onClick }: ConversationListItemProps) {
  const lastMessage = conversation.messages.at(-1)

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-[20px] border border-white/10 bg-white/[0.04] p-3 text-left transition hover:-translate-y-0.5 hover:border-white/16 hover:bg-white/[0.06] data-[active=true]:border-primary/50 data-[active=true]:bg-primary/10"
      data-active={active}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-white">
            {conversation.customerName ?? conversation.customer?.name ?? conversation.whatsappNumber}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">{conversation.whatsappNumber}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge variant={conversationBadgeVariant(conversation.status)}>
            {conversationStatusLabels[conversation.status]}
          </Badge>
          {conversation.unreadCount > 0 ? (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-black text-primary-foreground">
              {conversation.unreadCount}
            </span>
          ) : null}
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-400">
        {lastMessage?.body ?? 'Sem mensagens registradas.'}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>{formatRelativeDate(conversation.lastMessageAt)}</span>
        {conversation.type === 'test' ? <span>Teste</span> : null}
        {conversation.isAiPaused ? <span>IA pausada</span> : null}
      </div>
    </button>
  )
}

function MessageBubble({ message }: { message: AiMessage }) {
  const outbound = message.direction === 'outbound'
  const failed = message.status === 'failed'

  return (
    <article className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[82%] rounded-[20px] border px-4 py-3 ${
          outbound
            ? 'border-primary/20 bg-primary/15 text-orange-50'
            : 'border-white/10 bg-white/[0.05] text-slate-100'
        } ${failed ? 'border-status-danger/40 bg-status-danger/10' : ''}`}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant={messageSenderBadgeVariant(message.senderType)}>
            {messageSenderLabels[message.senderType]}
          </Badge>
          <span className="text-xs text-slate-500">{messageStatusLabels[message.status]}</span>
          {message.scheduledSendAt && message.status === 'queued' ? (
            <span className="text-xs text-status-warning">
              Aguardando delay ate {formatDateTime(message.scheduledSendAt)}
            </span>
          ) : null}
        </div>
        <p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p>
        {message.errorMessage ? (
          <p className="mt-2 text-xs leading-5 text-status-danger">{message.errorMessage}</p>
        ) : null}
        <p className="mt-2 text-right text-[11px] text-slate-500">
          {formatDateTime(message.sentAt ?? message.createdAt)}
        </p>
      </div>
    </article>
  )
}

function AssistedLearningBlock({ conversation }: { conversation: AiConversation }) {
  const createKnowledge = useCreateKnowledgeEntryMutation()
  const { pushToast } = useToastStore()
  const seed = useMemo(() => buildLearningSeed(conversation.messages), [conversation.messages])
  const [isEditing, setIsEditing] = useState(false)
  const [type, setType] = useState<AiKnowledgeEntryType>(seed.type)
  const [title, setTitle] = useState(seed.title)
  const [content, setContent] = useState(seed.content)

  if (!seed.content) {
    return (
      <ContextBlock title="Aprendizado assistido">
        <p className="text-sm leading-6 text-slate-400">
          Responda manualmente uma pergunta do cliente para gerar uma sugestao de conhecimento.
        </p>
      </ContextBlock>
    )
  }

  const handleStart = () => {
    setType(seed.type)
    setTitle(seed.title)
    setContent(seed.content)
    setIsEditing(true)
  }

  const handleSave = async () => {
    if (title.trim().length < 2 || content.trim().length < 2) {
      pushToast({ title: 'Revise titulo e conteudo', variant: 'warning' })
      return
    }

    await createKnowledge.mutateAsync({
      type,
      title: title.trim(),
      content: content.trim(),
      isActive: true,
    })
    setIsEditing(false)
  }

  return (
    <ContextBlock title="Aprendizado assistido">
      {!isEditing ? (
        <div className="space-y-3">
          <p className="text-sm leading-6 text-slate-300">{seed.content}</p>
          <Button size="sm" variant="outline" onClick={handleStart}>
            <FileText className="h-4 w-4" />
            Adicionar a base
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <select
            value={type}
            onChange={(event) => setType(event.target.value as AiKnowledgeEntryType)}
            className="w-full rounded-xl border border-white/10 bg-[#071525] px-3 py-2 text-sm text-slate-100 outline-none focus:border-primary/70 focus:ring-2 focus:ring-primary/20"
          >
            <option value="faq">FAQ</option>
            <option value="delivery_area">Entrega</option>
            <option value="payment">Pagamento</option>
            <option value="store_info">Loja</option>
            <option value="policy">Politica</option>
            <option value="promotions">Promocoes</option>
            <option value="custom">Customizado</option>
          </select>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#071525] px-3 py-2 text-sm text-slate-100 outline-none focus:border-primary/70 focus:ring-2 focus:ring-primary/20"
          />
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={4}
            className="w-full resize-y rounded-xl border border-white/10 bg-[#071525] px-3 py-2 text-sm leading-6 text-slate-100 outline-none focus:border-primary/70 focus:ring-2 focus:ring-primary/20"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleSave} disabled={createKnowledge.isPending}>
              Salvar conhecimento
            </Button>
            <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </ContextBlock>
  )
}

function useHydrateOrderDraft() {
  const setChannel = useNewOrderStore((state) => state.setChannel)
  const setCustomerId = useNewOrderStore((state) => state.setCustomerId)
  const setAddressId = useNewOrderStore((state) => state.setAddressId)
  const setPaymentMethod = useNewOrderStore((state) => state.setPaymentMethod)
  const setNotes = useNewOrderStore((state) => state.setNotes)
  const replaceCartItems = useNewOrderStore((state) => state.replaceCartItems)
  const setSendToProduction = useNewOrderStore((state) => state.setSendToProduction)
  const setSourceAiOrderDraftId = useNewOrderStore((state) => state.setSourceAiOrderDraftId)
  const saveDraft = useNewOrderStore((state) => state.saveDraft)

  return (prepared: PreparedAiOrderDraft) => {
    const items: OrderItem[] = prepared.items.map((item) => ({
      id: crypto.randomUUID(),
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      notes: item.notes,
      options: item.options.map((option) => ({
        id: option.id,
        groupId: option.groupId,
        groupName: option.groupName,
        name: option.name,
        quantity: option.quantity,
        price: option.price,
      })),
    }))

    setChannel(prepared.channel)
    setCustomerId(prepared.customerId)
    setAddressId(prepared.addressId)
    setPaymentMethod(prepared.paymentMethod)
    setNotes(prepared.notes)
    setSendToProduction(true)
    setSourceAiOrderDraftId(prepared.draftId)
    replaceCartItems(items)
    saveDraft()
  }
}

function ContextBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-[18px] border border-white/10 bg-white/[0.04] p-4">
      <h3 className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
        {title}
      </h3>
      {children}
    </section>
  )
}

function ContextLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm leading-6">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold text-slate-100">{value}</span>
    </div>
  )
}

function getPendingDelayMessage(conversation: AiConversation) {
  const scheduledMessage = conversation.messages.find(
    (message) => message.status === 'queued' && message.scheduledSendAt,
  )

  if (!scheduledMessage?.scheduledSendAt) return null

  const seconds = Math.max(
    0,
    Math.ceil((new Date(scheduledMessage.scheduledSendAt).getTime() - Date.now()) / 1000),
  )

  return `IA respondera em ${seconds} segundos`
}

function buildLearningSeed(messages: AiMessage[]): {
  type: AiKnowledgeEntryType
  title: string
  content: string
} {
  const humanIndex = [...messages]
    .map((message, index) => ({ message, index }))
    .reverse()
    .find(({ message }) => message.direction === 'outbound' && message.senderType === 'human')

  if (!humanIndex) {
    return { type: 'faq', title: '', content: '' }
  }

  const previousCustomer = messages
    .slice(0, humanIndex.index)
    .reverse()
    .find((message) => message.direction === 'inbound' && message.senderType === 'customer')

  const question = previousCustomer?.body.trim()
  const answer = humanIndex.message.body.trim()

  if (!answer) {
    return { type: 'faq', title: '', content: '' }
  }

  const type = suggestKnowledgeType(`${question ?? ''} ${answer}`)
  const title = question
    ? question.slice(0, 80)
    : `Resposta humana de ${formatDateTime(humanIndex.message.createdAt)}`

  return {
    type,
    title,
    content: question ? `Pergunta: ${question}\nResposta: ${answer}` : answer,
  }
}

function suggestKnowledgeType(text: string): AiKnowledgeEntryType {
  const normalized = text.toLowerCase()

  if (normalized.includes('entrega') || normalized.includes('bairro') || normalized.includes('taxa')) {
    return 'delivery_area'
  }

  if (normalized.includes('pix') || normalized.includes('cartao') || normalized.includes('pagamento')) {
    return 'payment'
  }

  if (normalized.includes('promocao') || normalized.includes('cupom') || normalized.includes('desconto')) {
    return 'promotions'
  }

  if (normalized.includes('cancelamento') || normalized.includes('cancelar')) {
    return 'cancellation'
  }

  if (normalized.includes('horario') || normalized.includes('funciona') || normalized.includes('loja')) {
    return 'store_info'
  }

  return 'faq'
}

function conversationBadgeVariant(status: AiConversationStatus): BadgeVariant {
  if (status === 'human_assigned') return 'success'
  if (status === 'waiting_human' || status === 'waiting_ai') return 'warning'
  if (status === 'closed') return 'danger'
  return 'default'
}

function messageSenderBadgeVariant(senderType: AiMessage['senderType']): BadgeVariant {
  if (senderType === 'ai') return 'analysis'
  if (senderType === 'human') return 'success'
  if (senderType === 'system') return 'warning'
  return 'default'
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}
