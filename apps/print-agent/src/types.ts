export type PrintConnectionType = 'NETWORK_TCP' | 'WINDOWS_PRINTER' | 'FILE_OR_VIRTUAL'
export type PrintEncoding = 'CP860' | 'CP850' | 'ASCII'

export interface AgentPrinterConfig {
  id: string
  name: string
  station: { id: string; code: string; name: string }
  connectionType: PrintConnectionType
  address: string
  port: number | null
  paperWidth: 58 | 80
  encoding: PrintEncoding
  enabled: boolean
}

export interface ClaimedPrintJob {
  id: string
  jobType: string
  templateKey: string
  templateVersion: string
  payloadSnapshot: unknown
  payloadHash: string
  attemptNumber: number
  leaseToken: string
  leaseExpiresAt: string
  printer: Omit<AgentPrinterConfig, 'station' | 'enabled'>
  station: { id: string; code: string; name: string } | null
}

export interface EscPosBlock {
  text: string
  align?: 'left' | 'center' | 'right'
  bold?: boolean
  width?: 1 | 2
  height?: 1 | 2
  wrap?: boolean
}

export interface EscPosDocument {
  jobId: string
  paperWidth: 58 | 80
  encoding: PrintEncoding
  blocks: EscPosBlock[]
  cut: boolean
}

export interface RenderedEscPosDocument {
  jobId: string
  bytes: Uint8Array
  text: string
  contentHash: string
}

export interface PrinterConnectionResult {
  ok: boolean
  code: string
  message: string
}

export interface PrintResult {
  ok: true
  contentHash: string
  bytesWritten: number
  durationMs: number
  artifacts?: { textPath: string; binaryPath: string; metadataPath: string }
}

export interface PrinterDriver {
  testConnection(config: AgentPrinterConfig): Promise<PrinterConnectionResult>
  print(document: RenderedEscPosDocument, config: AgentPrinterConfig): Promise<PrintResult>
}

export type LedgerState =
  | 'CLAIMED'
  | 'SENDING'
  | 'SENT_UNCONFIRMED'
  | 'FAILURE_UNCONFIRMED'
  | 'CONFIRMED'
  | 'RESULT_UNKNOWN'
  | 'FAILED'

export interface LedgerFailureReport {
  retryable: boolean
  errorCode: string
  errorMessage: string
  durationMs: number
}

export interface LedgerRecord {
  job: ClaimedPrintJob
  state: LedgerState
  contentHash?: string
  durationMs?: number
  failureReport?: LedgerFailureReport
  updatedAt: string
  createdAt: string
  lastErrorCode?: string
}
