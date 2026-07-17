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
    'A configuracao foi salva para o computador de impressao.',
  )
}

export function useCreateTestPrintMutation() {
  return usePrintingMutation(
    (printerId: string) => printingService.createTestJob(printerId),
    'Pagina de teste enviada',
    'O computador conectado fara a impressao.',
  )
}

export function useUpdatePrintingSettingsMutation() {
  return usePrintingMutation(
    (request: UpdatePrintingSettingsRequest) => printingService.updateSettings(request),
    'Regras salvas',
    'As regras de criacao e recuperacao das impressoes foram atualizadas.',
  )
}

export function useSavePrintRoutingRuleMutation() {
  return usePrintingMutation(
    (request: SavePrinterRoutingRuleRequest) => printingService.saveRoutingRule(request),
    'Destino salvo',
    'Esta regra sera usada nas proximas impressoes.',
  )
}

export function useDeletePrintRoutingRuleMutation() {
  return usePrintingMutation(
    (ruleId: string) => printingService.deleteRoutingRule(ruleId),
    'Destino removido',
    'As proximas impressoes usarao outra regra ou o destino padrao.',
  )
}

export function useRetryPrintJobMutation() {
  return usePrintingMutation(
    (jobId: string) => printingService.retryJob(jobId),
    'Nova tentativa liberada',
    'A impressao voltou para a fila.',
  )
}

export function useCancelPrintJobMutation() {
  return usePrintingMutation(
    ({ jobId, reason }: { jobId: string; reason: string }) =>
      printingService.cancelJob(jobId, reason),
    'Impressao cancelada',
    'O cancelamento foi registrado na auditoria.',
  )
}

export function useReprintJobMutation() {
  return usePrintingMutation(
    ({ jobId, reason }: { jobId: string; reason: string }) =>
      printingService.reprintJob(jobId, reason),
    'Reimpressao criada',
    'Uma nova impressao foi criada a partir do registro original.',
  )
}

export function useProvisionPrintAgentMutation() {
  return usePrintingMutation(
    (request: ProvisionPrintAgentRequest) => printingService.provisionAgent(request),
    'Computador cadastrado',
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
    'Computador desativado',
    'O dispositivo nao pode mais acessar endpoints de impressao.',
  )
}
