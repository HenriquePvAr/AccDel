import { useMemo, useState, type FormEvent } from 'react'
import {
  Bot,
  Clock3,
  MessageSquare,
  Reply,
  Send,
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
  useReleaseConversationMutation,
  useSendManualMessageMutation,
  useWhatsappSessionQuery,
} from '@/hooks/queries/ai-attendant'
import { useAuthStore } from '@/stores/auth-store'
import { useToastStore } from '@/stores/toast-store'
import type { AiConversation, AiMessage } from '@/contracts/ai-attendant'

import {
  conversationStatusLabels,
  formatDateTime,
  formatRelativeDate,
  messageSenderLabels,
  messageStatusLabels,
} from './ai-attendant-labels'

export function AiConversationsTab() {
  const { data: conversations = [], isLoading } = useConversationsQuery()
  const { data: session } = useWhatsappSessionQuery()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const activeConversationId =
    selectedId && conversations.some((conversation) => conversation.id === selectedId)
      ? selectedId
      : conversations[0]?.id ?? null
  const { data: detail, isLoading: detailLoading } = useConversationDetailQuery(activeConversationId)
  const assignConversation = useAssignConversationMutation()
  const releaseConversation = useReleaseConversationMutation()
  const closeConversation = useCloseConversationMutation()
  const sendMessage = useSendManualMessageMutation()
  const currentUser = useAuthStore((state) => state.user)
  const { pushToast } = useToastStore()
  const [messageBody, setMessageBody] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)

  const selectedConversation = useMemo(
    () => detail ?? conversations.find((conversation) => conversation.id === activeConversationId) ?? null,
    [activeConversationId, conversations, detail],
  )

  const whatsappConnected = session?.status === 'connected'

  const handleAssign = async () => {
    if (!selectedConversation) {
      return
    }

    if (!currentUser) {
      pushToast({
        title: 'Usuario nao identificado',
        description: 'Entre novamente para assumir a conversa.',
        variant: 'warning',
      })
      return
    }

    await assignConversation.mutateAsync({
      id: selectedConversation.id,
      userId: currentUser.id,
    })
  }

  const handleRelease = async () => {
    if (selectedConversation) {
      await releaseConversation.mutateAsync(selectedConversation.id)
    }
  }

  const handleClose = async () => {
    if (selectedConversation) {
      await closeConversation.mutateAsync(selectedConversation.id)
    }
  }

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSendError(null)

    if (!selectedConversation) {
      return
    }

    const body = messageBody.trim()
    if (!body) {
      pushToast({ title: 'Digite a mensagem antes de enviar', variant: 'warning' })
      return
    }

    try {
      await sendMessage.mutateAsync({
        id: selectedConversation.id,
        payload: { body },
      })
      setMessageBody('')
    } catch (error) {
      setSendError(getErrorMessage(error, 'Nao foi possivel enviar a mensagem.'))
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Skeleton className="h-[620px]" />
        <Skeleton className="h-[620px]" />
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquare className="h-7 w-7" />}
        title="Nenhuma conversa encontrada"
        description="As conversas aparecem aqui somente depois de mensagens reais recebidas pelo webhook do WhatsApp."
      />
    )
  }

  return (
    <div className="grid min-h-[640px] gap-5 xl:grid-cols-[360px_1fr]">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Conversas reais
          </CardTitle>
          <CardDescription>{conversations.length} conversa(s) retornada(s) pela API.</CardDescription>
        </CardHeader>
        <CardContent className="max-h-[520px] space-y-2 overflow-y-auto pr-2 scrollbar-thin">
          {conversations.map((conversation) => (
            <ConversationListItem
              key={conversation.id}
              conversation={conversation}
              active={conversation.id === activeConversationId}
              onClick={() => setSelectedId(conversation.id)}
            />
          ))}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        {detailLoading && !selectedConversation ? (
          <CardContent className="p-5">
            <Skeleton className="h-[560px]" />
          </CardContent>
        ) : selectedConversation ? (
          <div className="flex h-full min-h-[640px] flex-col">
            <CardHeader className="border-b border-white/10">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    {selectedConversation.customerName ?? selectedConversation.whatsappNumber}
                  </CardTitle>
                  <CardDescription>
                    {selectedConversation.whatsappNumber} · ultima mensagem {formatRelativeDate(selectedConversation.lastMessageAt)}
                  </CardDescription>
                </div>
                <Badge variant={conversationBadgeVariant(selectedConversation.status)}>
                  {conversationStatusLabels[selectedConversation.status]}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2 pt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAssign}
                  disabled={assignConversation.isPending || selectedConversation.status === 'human_assigned'}
                >
                  <UserCheck className="h-4 w-4" />
                  Assumir
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRelease}
                  disabled={releaseConversation.isPending || selectedConversation.status === 'closed'}
                >
                  <Bot className="h-4 w-4" />
                  Devolver para IA
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={handleClose}
                  disabled={closeConversation.isPending || selectedConversation.status === 'closed'}
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

              {selectedConversation.orderDrafts.length > 0 ? (
                <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                    Rascunhos de pedido
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedConversation.orderDrafts.map((draft) => (
                      <Badge key={draft.id} variant={draft.status === 'approved' ? 'success' : 'warning'}>
                        {draft.status}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex-1 space-y-3 overflow-y-auto rounded-[22px] border border-white/10 bg-[#050d18]/70 p-4 scrollbar-thin">
                {selectedConversation.messages.length === 0 ? (
                  <EmptyState
                    icon={<MessageSquare className="h-7 w-7" />}
                    title="Sem mensagens nesta conversa"
                    description="A conversa existe, mas a API ainda nao possui mensagens vinculadas."
                  />
                ) : (
                  selectedConversation.messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))
                )}
              </div>

              <form className="space-y-3" onSubmit={handleSend}>
                <textarea
                  value={messageBody}
                  onChange={(event) => setMessageBody(event.target.value)}
                  rows={3}
                  disabled={!whatsappConnected || selectedConversation.status === 'closed'}
                  className="w-full resize-y rounded-xl border border-white/10 bg-[#071525] px-3 py-2 text-sm leading-6 text-slate-100 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-primary/70 focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="Escreva uma resposta humana para o cliente."
                />
                {sendError ? (
                  <p className="text-sm leading-6 text-red-200">{sendError}</p>
                ) : null}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="submit"
                    disabled={!whatsappConnected || sendMessage.isPending || selectedConversation.status === 'closed'}
                  >
                    <Send className="h-4 w-4" />
                    Enviar mensagem humana
                  </Button>
                </div>
              </form>
            </CardContent>
          </div>
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
    </div>
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
            {conversation.customerName ?? conversation.whatsappNumber}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">{conversation.whatsappNumber}</p>
        </div>
        <Badge variant={conversationBadgeVariant(conversation.status)}>
          {conversationStatusLabels[conversation.status]}
        </Badge>
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-400">
        {lastMessage?.body ?? 'Sem mensagens registradas.'}
      </p>
      <p className="mt-2 text-xs text-slate-500">{formatRelativeDate(conversation.lastMessageAt)}</p>
    </button>
  )
}

function MessageBubble({ message }: { message: AiMessage }) {
  const outbound = message.direction === 'outbound'

  return (
    <article className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[82%] rounded-[20px] border px-4 py-3 ${
          outbound
            ? 'border-primary/20 bg-primary/15 text-orange-50'
            : 'border-white/10 bg-white/[0.05] text-slate-100'
        }`}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant={message.senderType === 'ai' ? 'analysis' : message.senderType === 'human' ? 'success' : 'default'}>
            {messageSenderLabels[message.senderType]}
          </Badge>
          <span className="text-xs text-slate-500">{messageStatusLabels[message.status]}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p>
        <p className="mt-2 text-right text-[11px] text-slate-500">{formatDateTime(message.createdAt)}</p>
      </div>
    </article>
  )
}

function conversationBadgeVariant(status: AiConversation['status']) {
  if (status === 'human_assigned') {
    return 'success'
  }

  if (status === 'waiting_human' || status === 'waiting_ai') {
    return 'warning'
  }

  if (status === 'closed') {
    return 'danger'
  }

  return 'default'
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}
