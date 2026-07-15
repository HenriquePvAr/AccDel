import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type {
  ListPrintJobsFilters,
  ProvisionPrintAgentRequest,
  SavePrinterRequest,
  SavePrinterRoutingRuleRequest,
  SavePrinterStationRequest,
  UpdatePrintingSettingsRequest,
} from '@/contracts'
import { queryKeys } from '@/hooks/queries/query-keys'
import { printingService } from '@/services'
import { useToastStore } from '@/stores/toast-store'

function usePrintingMutation<TInput, TOutput>(
  mutationFn: (input: TInput) => Promise<TOutput>,
  title: string,
  description: string,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.printing.all })
      useToastStore.getState().pushToast({ title, description, variant: 'success' })
    },
  })
}

export function usePrintingOverviewQuery() {
  return useQuery({
    queryKey: queryKeys.printing.overview,
    queryFn: () => printingService.getOverview(),
    refetchInterval: 30_000,
  })
}

export function usePrintJobsQuery(filters: ListPrintJobsFilters) {
  return useQuery({
    queryKey: queryKeys.printing.jobs(filters),
    queryFn: () => printingService.listJobs(filters),
    refetchInterval: 10_000,
  })
}

export function useSavePrinterStationMutation() {
  return usePrintingMutation(
    (request: SavePrinterStationRequest) => printingService.saveStation(request),
    'Estacao salva',
    'O setor de impressao foi atualizado.',
  )
}

export function useSavePrinterMutation() {
  return usePrintingMutation(
    (request: SavePrinterRequest) => printingService.savePrinter(request),
    'Impressora salva',
    'A configuracao foi persistida para o agente local.',
  )
}

export function useCreateTestPrintMutation() {
  return usePrintingMutation(
    (printerId: string) => printingService.createTestJob(printerId),
    'Pagina de teste enfileirada',
    'O Print Agent executara o job quando estiver online.',
  )
}

export function useUpdatePrintingSettingsMutation() {
  return usePrintingMutation(
    (request: UpdatePrintingSettingsRequest) => printingService.updateSettings(request),
    'Politicas salvas',
    'As regras de criacao e recuperacao de jobs foram atualizadas.',
  )
}

export function useSavePrintRoutingRuleMutation() {
  return usePrintingMutation(
    (request: SavePrinterRoutingRuleRequest) => printingService.saveRoutingRule(request),
    'Roteamento salvo',
    'O backend usara esta regra nos proximos eventos.',
  )
}

export function useDeletePrintRoutingRuleMutation() {
  return usePrintingMutation(
    (ruleId: string) => printingService.deleteRoutingRule(ruleId),
    'Roteamento removido',
    'Os proximos jobs usarao outra regra ou o fallback configurado.',
  )
}

export function useRetryPrintJobMutation() {
  return usePrintingMutation(
    (jobId: string) => printingService.retryJob(jobId),
    'Job liberado para retry',
    'A mesma impressao persistente voltara para a fila.',
  )
}

export function useCancelPrintJobMutation() {
  return usePrintingMutation(
    ({ jobId, reason }: { jobId: string; reason: string }) =>
      printingService.cancelJob(jobId, reason),
    'Job cancelado',
    'O cancelamento foi registrado na auditoria.',
  )
}

export function useReprintJobMutation() {
  return usePrintingMutation(
    ({ jobId, reason }: { jobId: string; reason: string }) =>
      printingService.reprintJob(jobId, reason),
    'Reimpressao criada',
    'Um novo job auditado foi criado a partir do snapshot original.',
  )
}

export function useProvisionPrintAgentMutation() {
  return usePrintingMutation(
    (request: ProvisionPrintAgentRequest) => printingService.provisionAgent(request),
    'Agente provisionado',
    'Copie a credencial exibida agora; ela nao sera mostrada novamente.',
  )
}

export function useRotatePrintAgentMutation() {
  return usePrintingMutation(
    (agentId: string) => printingService.rotateAgent(agentId),
    'Credencial rotacionada',
    'O token anterior foi invalidado imediatamente.',
  )
}

export function useRevokePrintAgentMutation() {
  return usePrintingMutation(
    (agentId: string) => printingService.revokeAgent(agentId),
    'Agente revogado',
    'O dispositivo nao pode mais acessar endpoints de impressao.',
  )
}
