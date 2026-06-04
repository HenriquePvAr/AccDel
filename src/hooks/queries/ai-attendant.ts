import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type {
  CreateKnowledgeEntryPayload,
  SendConversationMessagePayload,
  TestChatMessagePayload,
  TestReplyPayload,
  TestWhatsappSendPayload,
  UpdateAiAttendantSettingsPayload,
  UpdateKnowledgeEntryPayload,
} from '@/contracts/ai-attendant'
import { aiAttendantService } from '@/services/ai-attendant/ai-attendant-service'
import { queryKeys } from '@/hooks/queries/query-keys'
import { useToastStore } from '@/stores/toast-store'

// ── Overview ────────────────────────────────────────────────────────

export function useAiAttendantOverviewQuery() {
  return useQuery({
    queryKey: queryKeys.aiAttendant.overview,
    queryFn: () => aiAttendantService.getOverview(),
    refetchInterval: 30000, // Refetch every 30 seconds
  })
}

export function useAiAttendantDashboardQuery() {
  return useQuery({
    queryKey: queryKeys.aiAttendant.dashboard,
    queryFn: () => aiAttendantService.getDashboard(),
    refetchInterval: 30000,
  })
}
// ── Settings ────────────────────────────────────────────────────────

export function useAiAttendantSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.aiAttendant.settings,
    queryFn: () => aiAttendantService.getSettings(),
  })
}

export function useUpdateAiAttendantSettingsMutation() {
  const queryClient = useQueryClient()
  const { pushToast } = useToastStore()

  return useMutation({
    mutationFn: (payload: UpdateAiAttendantSettingsPayload) =>
      aiAttendantService.updateSettings(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.settings })
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.overview })
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.whatsappLogs })
      pushToast({ title: 'Configurações atualizadas com sucesso', variant: 'success' })
    },
    onError: () => {
      pushToast({ title: 'Erro ao atualizar configurações', variant: 'danger' })
    },
  })
}

// ── Knowledge Base ──────────────────────────────────────────────────

export function useKnowledgeEntriesQuery() {
  return useQuery({
    queryKey: queryKeys.aiAttendant.knowledge,
    queryFn: () => aiAttendantService.getKnowledgeEntries(),
  })
}

export function useCreateKnowledgeEntryMutation() {
  const queryClient = useQueryClient()
  const { pushToast } = useToastStore()

  return useMutation({
    mutationFn: (payload: CreateKnowledgeEntryPayload) =>
      aiAttendantService.createKnowledgeEntry(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.knowledge })
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.overview })
      pushToast({ title: 'Entrada criada com sucesso', variant: 'success' })
    },
    onError: () => {
      pushToast({ title: 'Erro ao criar entrada', variant: 'danger' })
    },
  })
}

export function useUpdateKnowledgeEntryMutation() {
  const queryClient = useQueryClient()
  const { pushToast } = useToastStore()

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateKnowledgeEntryPayload }) =>
      aiAttendantService.updateKnowledgeEntry(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.knowledge })
      pushToast({ title: 'Entrada atualizada com sucesso', variant: 'success' })
    },
    onError: () => {
      pushToast({ title: 'Erro ao atualizar entrada', variant: 'danger' })
    },
  })
}

export function useDeleteKnowledgeEntryMutation() {
  const queryClient = useQueryClient()
  const { pushToast } = useToastStore()

  return useMutation({
    mutationFn: (id: string) => aiAttendantService.deleteKnowledgeEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.knowledge })
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.overview })
      pushToast({ title: 'Entrada excluída com sucesso', variant: 'success' })
    },
    onError: () => {
      pushToast({ title: 'Erro ao excluir entrada', variant: 'danger' })
    },
  })
}

// ── Test Reply ──────────────────────────────────────────────────────

export function useTestReplyMutation() {
  const { pushToast } = useToastStore()

  return useMutation({
    mutationFn: (payload: TestReplyPayload) => aiAttendantService.testReply(payload),
    onError: () => {
      pushToast({ title: 'Erro ao gerar resposta de teste', variant: 'danger' })
    },
  })
}

// ── WhatsApp Session ────────────────────────────────────────────────

export function useWhatsappSessionQuery() {
  return useQuery({
    queryKey: queryKeys.aiAttendant.whatsappSession,
    queryFn: () => aiAttendantService.getSession(),
    refetchInterval: 10000, // Refetch every 10 seconds to check status
  })
}

export function useStartWhatsappSessionMutation() {
  const queryClient = useQueryClient()
  const { pushToast } = useToastStore()

  return useMutation({
    mutationFn: () => aiAttendantService.startSession(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.whatsappSession })
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.overview })
      pushToast({ title: 'Sessão iniciada. Aguardando QR Code...', variant: 'success' })
    },
    onError: (error: Error) => {
      pushToast({ title: error.message || 'Erro ao iniciar sessão', variant: 'danger' })
    },
  })
}

export function useWhatsappQrCodeQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.aiAttendant.whatsappQr,
    queryFn: () => aiAttendantService.getQrCode(),
    enabled,
    refetchInterval: 5000, // Refetch every 5 seconds while waiting for QR
  })
}

export function useWhatsappStatusQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.aiAttendant.whatsappStatus,
    queryFn: () => aiAttendantService.getSessionStatus(),
    enabled,
    refetchInterval: 5000, // Refetch every 5 seconds
  })
}

export function useWhatsappLogsQuery() {
  return useQuery({
    queryKey: queryKeys.aiAttendant.whatsappLogs,
    queryFn: () => aiAttendantService.getWhatsappLogs(),
    refetchInterval: 10000,
  })
}

export function useDisconnectWhatsappSessionMutation() {
  const queryClient = useQueryClient()
  const { pushToast } = useToastStore()

  return useMutation({
    mutationFn: () => aiAttendantService.disconnectSession(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.whatsappSession })
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.overview })
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.whatsappLogs })
      pushToast({ title: 'WhatsApp desconectado', variant: 'success' })
    },
    onError: () => {
      pushToast({ title: 'Erro ao desconectar WhatsApp', variant: 'danger' })
    },
  })
}

export function useRestartWhatsappSessionMutation() {
  const queryClient = useQueryClient()
  const { pushToast } = useToastStore()

  return useMutation({
    mutationFn: () => aiAttendantService.restartSession(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.whatsappSession })
      pushToast({ title: 'Sessão reiniciada', variant: 'success' })
    },
    onError: () => {
      pushToast({ title: 'Erro ao reiniciar sessão', variant: 'danger' })
    },
  })
}

// ── Conversations ───────────────────────────────────────────────────

export function useConversationsQuery() {
  return useQuery({
    queryKey: queryKeys.aiAttendant.conversations,
    queryFn: () => aiAttendantService.getConversations(),
    refetchInterval: 15000, // Refetch every 15 seconds
  })
}

export function useConversationDetailQuery(id: string | null) {
  return useQuery({
    queryKey: queryKeys.aiAttendant.conversationDetail(id || ''),
    queryFn: () => aiAttendantService.getConversationDetail(id!),
    enabled: !!id,
    refetchInterval: 5000, // Refetch every 5 seconds when viewing a conversation
  })
}

export function useAssignConversationMutation() {
  const queryClient = useQueryClient()
  const { pushToast } = useToastStore()

  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      aiAttendantService.assignConversation(id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.conversations })
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.overview })
      pushToast({ title: 'Conversa assumida', variant: 'success' })
    },
    onError: () => {
      pushToast({ title: 'Erro ao assumir conversa', variant: 'danger' })
    },
  })
}

export function useReleaseConversationMutation() {
  const queryClient = useQueryClient()
  const { pushToast } = useToastStore()

  return useMutation({
    mutationFn: (id: string) => aiAttendantService.releaseConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.conversations })
      pushToast({ title: 'Conversa devolvida para IA', variant: 'success' })
    },
    onError: () => {
      pushToast({ title: 'Erro ao devolver conversa', variant: 'danger' })
    },
  })
}

export function useSendManualMessageMutation() {
  const queryClient = useQueryClient()
  const { pushToast } = useToastStore()

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SendConversationMessagePayload }) =>
      aiAttendantService.sendManualMessage(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.conversations })
    },
    onError: () => {
      pushToast({ title: 'Erro ao enviar mensagem', variant: 'danger' })
    },
  })
}

export function useCloseConversationMutation() {
  const queryClient = useQueryClient()
  const { pushToast } = useToastStore()

  return useMutation({
    mutationFn: (id: string) => aiAttendantService.closeConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.conversations })
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.overview })
      pushToast({ title: 'Conversa fechada', variant: 'success' })
    },
    onError: () => {
      pushToast({ title: 'Erro ao fechar conversa', variant: 'danger' })
    },
  })
}

// ── Order Drafts ────────────────────────────────────────────────────

export function useOrderDraftsQuery() {
  return useQuery({
    queryKey: queryKeys.aiAttendant.orderDrafts,
    queryFn: () => aiAttendantService.getOrderDrafts(),
  })
}

export function useApproveOrderDraftMutation() {
  const queryClient = useQueryClient()
  const { pushToast } = useToastStore()

  return useMutation({
    mutationFn: (id: string) => aiAttendantService.approveOrderDraft(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.orderDrafts })
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.dashboard })
      pushToast({ title: 'Pedido aprovado', variant: 'success' })
    },
    onError: () => {
      pushToast({ title: 'Erro ao aprovar pedido', variant: 'danger' })
    },
  })
}

export function useDiscardOrderDraftMutation() {
  const queryClient = useQueryClient()
  const { pushToast } = useToastStore()

  return useMutation({
    mutationFn: (id: string) => aiAttendantService.discardOrderDraft(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.orderDrafts })
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.dashboard })
      pushToast({ title: 'Pedido descartado', variant: 'success' })
    },
    onError: () => {
      pushToast({ title: 'Erro ao descartar pedido', variant: 'danger' })
    },
  })
}

export function usePrepareOrderDraftMutation() {
  const { pushToast } = useToastStore()

  return useMutation({
    mutationFn: (id: string) => aiAttendantService.prepareOrderDraft(id),
    onError: (error: Error) => {
      pushToast({ title: error.message || 'Erro ao preparar pedido sugerido', variant: 'danger' })
    },
  })
}

export function useMarkOrderDraftConvertedMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, orderId }: { id: string; orderId: string }) =>
      aiAttendantService.markOrderDraftConverted(id, orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.orderDrafts })
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.dashboard })
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.conversations })
    },
  })
}

export function useTestChatMessageMutation() {
  const { pushToast } = useToastStore()

  return useMutation({
    mutationFn: (payload: TestChatMessagePayload) => aiAttendantService.testChatMessage(payload),
    onError: () => {
      pushToast({ title: 'Erro ao testar IA', variant: 'danger' })
    },
  })
}

export function useTestWhatsappSendMutation() {
  const queryClient = useQueryClient()
  const { pushToast } = useToastStore()

  return useMutation({
    mutationFn: (payload: TestWhatsappSendPayload) =>
      aiAttendantService.sendTestWhatsappMessage(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.conversations })
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.whatsappLogs })
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.whatsappSession })
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAttendant.whatsappLogs })
      pushToast({ title: 'Mensagem de teste enviada', variant: 'success' })
    },
    onError: (error: Error) => {
      pushToast({ title: error.message || 'Erro ao enviar teste real', variant: 'danger' })
    },
  })
}
