import type { ListResponse, PaginationParams } from '@/contracts/common'

export type PrintConnectionType = 'NETWORK_TCP' | 'WINDOWS_PRINTER' | 'FILE_OR_VIRTUAL'
export type PrintFallbackPolicy = 'DEFAULT_STATION' | 'BLOCK'
export type PrintRoutingScope = 'PRODUCT' | 'CATEGORY'
export type PrintJobStatus =
  | 'PENDING'
  | 'CLAIMED'
  | 'PRINTING'
  | 'PRINTED'
  | 'RETRY_WAIT'
  | 'FAILED'
  | 'CANCELLED'
  | 'PRINT_RESULT_UNKNOWN'
export type PrintJobType =
  | 'ORDER_INITIAL'
  | 'ORDER_ADDITION'
  | 'ORDER_REMOVAL'
  | 'ORDER_CORRECTION'
  | 'ORDER_CANCELLATION'
  | 'CASHIER_RECEIPT'
  | 'DISPATCH_ORDER'
  | 'CUSTOMER_RECEIPT'
  | 'TEST_PAGE'
  | 'REPRINT'

export interface PrintingSettings {
  id: string
  storeId: string
  enabled: boolean
  fallbackPolicy: PrintFallbackPolicy
  fallbackStationId: string | null
  printOrderReady: boolean
  printPaymentConfirmed: boolean
  printCancellation: boolean
  customerReceiptEnabled: boolean
  defaultMaxAttempts: number
  leaseDurationSeconds: number
  createdAt: string
  updatedAt: string
}

export interface PrinterStation {
  id: string
  storeId: string
  code: string
  name: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface PrintAgentSummary {
  id: string
  name: string
  deviceName: string
  version: string | null
  tokenPrefix: string
  enabled: boolean
  online: boolean
  lastSeenAt: string | null
  revokedAt: string | null
  printers: Array<{ id: string; name: string; enabled: boolean }>
  availablePrinterIds: string[]
}

export interface Printer {
  id: string
  storeId: string
  stationId: string
  agentId: string | null
  name: string
  connectionType: PrintConnectionType
  address: string
  port: number | null
  paperWidth: number
  encoding: 'CP860' | 'CP850' | 'ASCII'
  enabled: boolean
  isDefault: boolean
  createdAt: string
  updatedAt: string
  station: PrinterStation
  agent: { id: string; name: string; online: boolean } | null
}

export interface PrinterRoutingRule {
  id: string
  scope: PrintRoutingScope
  productId: string | null
  categoryId: string | null
  stationId: string
  priority: number
  enabled: boolean
  station: PrinterStation
  product: { id: string; name: string } | null
  category: { id: string; name: string } | null
}

export interface PrintTemplateSummary {
  id: string
  key: string
  version: string
  jobType: PrintJobType
  enabled: boolean
}

export interface PrintJobAttempt {
  id: string
  attemptNumber: number
  status: string
  contentHash: string | null
  errorCode: string | null
  errorMessageSanitized: string | null
  durationMs: number | null
  startedAt: string
  finishedAt: string | null
}

export interface PrintJob {
  id: string
  orderId: string | null
  jobType: PrintJobType
  status: PrintJobStatus
  priority: number
  templateKey: string
  templateVersion: string
  stationCode: string | null
  attemptCount: number
  maxAttempts: number
  availableAt: string
  printedAt: string | null
  failedAt: string | null
  ambiguousAt: string | null
  lastErrorCode: string | null
  lastErrorMessageSanitized: string | null
  originalJobId: string | null
  reprintReason: string | null
  createdAt: string
  updatedAt: string
  printer: { id: string; name: string } | null
  station: { id: string; code: string; name: string } | null
  claimedByAgent: { id: string; name: string } | null
  attempts: PrintJobAttempt[]
}

export interface PrintingOverviewResponse {
  data: {
    settings: PrintingSettings
    stations: PrinterStation[]
    printers: Printer[]
    routes: PrinterRoutingRule[]
    templates: PrintTemplateSummary[]
    agents: PrintAgentSummary[]
    jobCounts: Partial<Record<PrintJobStatus, number>>
  }
}

export interface ListPrintJobsFilters extends PaginationParams {
  status?: PrintJobStatus | 'all'
  type?: PrintJobType | 'all'
  stationId?: string
  printerId?: string
  orderId?: string
}

export type ListPrintJobsResponse = ListResponse<PrintJob>

export interface SavePrinterStationRequest {
  id?: string
  code: string
  name: string
  enabled: boolean
}

export interface SavePrinterRequest {
  id?: string
  name: string
  stationId: string
  agentId?: string | null
  connectionType: PrintConnectionType
  address: string
  port?: number | null
  paperWidth: 58 | 80
  encoding: 'CP860' | 'CP850' | 'ASCII'
  enabled: boolean
  isDefault: boolean
}

export type UpdatePrintingSettingsRequest = Omit<
  PrintingSettings,
  'id' | 'storeId' | 'createdAt' | 'updatedAt'
>

export interface SavePrinterRoutingRuleRequest {
  scope: PrintRoutingScope
  productId?: string | null
  categoryId?: string | null
  stationId: string
  priority: number
  enabled: boolean
}

export interface ProvisionPrintAgentRequest {
  name: string
  deviceName: string
}

export interface PrintAgentCredentialResponse {
  data: {
    agent: Omit<PrintAgentSummary, 'online' | 'printers' | 'availablePrinterIds'>
    token: string
    warning: string
  }
}

export interface PrintingMutationResponse<T> {
  data: T
}
