import type {
  ListPrintJobsFilters,
  ListPrintJobsResponse,
  PrintAgentCredentialResponse,
  PrintAgentSummary,
  PrintJob,
  Printer,
  PrinterRoutingRule,
  PrinterStation,
  PrintingMutationResponse,
  PrintingOverviewResponse,
  PrintingSettings,
  ProvisionPrintAgentRequest,
  SavePrinterRequest,
  SavePrinterRoutingRuleRequest,
  SavePrinterStationRequest,
  UpdatePrintingSettingsRequest,
} from '@/contracts'
import { ApiClientError, apiClient, buildQueryString, shouldUseApi } from '@/services/http/api-client'

function requireRealApi() {
  if (!shouldUseApi) {
    throw new ApiClientError('A administracao de impressao exige a API real.', 400)
  }
}

export const printingService = {
  async getOverview(): Promise<PrintingOverviewResponse> {
    requireRealApi()
    return apiClient.get<PrintingOverviewResponse>('/printing/overview')
  },

  async listJobs(filters: ListPrintJobsFilters): Promise<ListPrintJobsResponse> {
    requireRealApi()
    return apiClient.get<ListPrintJobsResponse>(`/printing/jobs${buildQueryString(filters)}`)
  },

  async saveStation(request: SavePrinterStationRequest) {
    requireRealApi()
    const { id, ...body } = request
    return id
      ? apiClient.patch<PrintingMutationResponse<PrinterStation>, typeof body>(
          `/printing/stations/${id}`,
          body,
        )
      : apiClient.post<PrintingMutationResponse<PrinterStation>, typeof body>(
          '/printing/stations',
          body,
        )
  },

  async savePrinter(request: SavePrinterRequest) {
    requireRealApi()
    const { id, ...body } = request
    return id
      ? apiClient.patch<PrintingMutationResponse<Printer>, typeof body>(
          `/printing/printers/${id}`,
          body,
        )
      : apiClient.post<PrintingMutationResponse<Printer>, typeof body>(
          '/printing/printers',
          body,
        )
  },

  async createTestJob(printerId: string) {
    requireRealApi()
    return apiClient.post<PrintingMutationResponse<PrintJob>>(
      `/printing/printers/${printerId}/test`,
    )
  },

  async updateSettings(request: UpdatePrintingSettingsRequest) {
    requireRealApi()
    return apiClient.patch<PrintingMutationResponse<PrintingSettings>, typeof request>(
      '/printing/settings',
      request,
    )
  },

  async saveRoutingRule(request: SavePrinterRoutingRuleRequest) {
    requireRealApi()
    return apiClient.post<PrintingMutationResponse<PrinterRoutingRule>, typeof request>(
      '/printing/routing-rules',
      request,
    )
  },

  async deleteRoutingRule(ruleId: string) {
    requireRealApi()
    return apiClient.delete<PrintingMutationResponse<{ id: string; deleted: boolean }>>(
      `/printing/routing-rules/${ruleId}`,
    )
  },

  async retryJob(jobId: string) {
    requireRealApi()
    return apiClient.post<PrintingMutationResponse<PrintJob>>(`/printing/jobs/${jobId}/retry`)
  },

  async cancelJob(jobId: string, reason: string) {
    requireRealApi()
    return apiClient.post<PrintingMutationResponse<PrintJob>, { reason: string }>(
      `/printing/jobs/${jobId}/cancel`,
      { reason },
    )
  },

  async reprintJob(jobId: string, reason: string) {
    requireRealApi()
    return apiClient.post<PrintingMutationResponse<PrintJob>, { reason: string }>(
      `/printing/jobs/${jobId}/reprint`,
      { reason },
    )
  },

  async provisionAgent(request: ProvisionPrintAgentRequest) {
    requireRealApi()
    return apiClient.post<PrintAgentCredentialResponse, ProvisionPrintAgentRequest>(
      '/printing/agents',
      request,
    )
  },

  async rotateAgent(agentId: string) {
    requireRealApi()
    return apiClient.post<PrintAgentCredentialResponse>(`/printing/agents/${agentId}/rotate`)
  },

  async revokeAgent(agentId: string) {
    requireRealApi()
    return apiClient.post<PrintingMutationResponse<PrintAgentSummary>>(
      `/printing/agents/${agentId}/revoke`,
    )
  },
}
