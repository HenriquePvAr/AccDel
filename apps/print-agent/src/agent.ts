import { ApiUnavailableError, CainPrintApiClient } from './api-client.js'
import type { PrintAgentConfig } from './config.js'
import { PrinterDriverError } from './drivers/driver-error.js'
import { PrinterDriverFactory } from './drivers/factory.js'
import { renderEscPos } from './escpos/renderer.js'
import { hashJson } from './hash.js'
import { PrintLedger } from './ledger.js'
import { Logger, sanitizeLogText } from './logger.js'
import { buildDocument, TemplateValidationError } from './templates/v1.js'
import type { AgentPrinterConfig, ClaimedPrintJob, LedgerState } from './types.js'

export class CainPrintAgent {
  private readonly api: CainPrintApiClient
  private readonly ledger: PrintLedger
  private readonly drivers: PrinterDriverFactory
  private readonly logger: Logger
  private printers: AgentPrinterConfig[] = []
  private availablePrinterIds: string[] = []
  private stopped = false
  private lastHeartbeatAt = 0

  constructor(private readonly config: PrintAgentConfig) {
    this.api = new CainPrintApiClient(config)
    this.ledger = new PrintLedger(config.dataDir)
    this.drivers = new PrinterDriverFactory(config)
    this.logger = new Logger(config.logLevel, { component: 'print-agent', agentName: config.name })
  }

  async start() {
    await this.ledger.initialize()
    await this.ledger.cleanup(24 * 60 * 60 * 1000)
    this.logger.info('Cain Print Agent started.', {
      version: this.config.version,
      dryRun: this.config.dryRun,
      maxConcurrentJobs: this.config.maxConcurrentJobs,
    })
    await this.refreshConfiguration()
    await this.reconcileLocalJobs()

    while (!this.stopped) {
      const startedAt = Date.now()
      try {
        if (startedAt - this.lastHeartbeatAt >= this.config.heartbeatIntervalMs) {
          await this.sendHeartbeat()
        }
        await this.reconcileLocalJobs()
        await this.pollOnce()
      } catch (error) {
        this.logger.warn('Print agent loop could not reach the API.', {
          code: errorCode(error),
        })
      }
      const elapsed = Date.now() - startedAt
      await sleep(Math.max(50, this.config.pollIntervalMs - elapsed))
    }
  }

  stop() {
    this.stopped = true
    this.logger.info('Cain Print Agent shutdown requested.')
  }

  async pollOnce() {
    if (!this.availablePrinterIds.length) return
    const response = await this.api.claim(this.availablePrinterIds)
    if (!response.data.length) return
    this.logger.info('Print jobs claimed.', { count: response.data.length })
    await Promise.allSettled(response.data.map((job) => this.processJob(job)))
  }

  private async refreshConfiguration() {
    const response = await this.api.getConfiguration()
    this.printers = response.data.printers
    this.availablePrinterIds = await this.detectAvailablePrinters()
    this.logger.info('Printer configuration refreshed.', {
      configuredPrinters: this.printers.length,
      availablePrinters: this.availablePrinterIds.length,
    })
  }

  private async detectAvailablePrinters() {
    const available: string[] = []
    for (const printer of this.printers.filter((entry) => entry.enabled)) {
      if (!this.drivers.isLocallySupported(printer)) {
        this.logger.warn('Printer driver is not supported locally.', {
          printerId: printer.id,
          connectionType: printer.connectionType,
        })
        continue
      }
      const result = await this.drivers.forPrinter(printer).testConnection(printer)
      if (result.ok) available.push(printer.id)
      else {
        this.logger.warn('Printer is unavailable.', {
          printerId: printer.id,
          code: result.code,
        })
      }
    }
    return available
  }

  private async sendHeartbeat() {
    await this.refreshConfiguration()
    await this.api.heartbeat(this.availablePrinterIds)
    this.lastHeartbeatAt = Date.now()
  }

  private async reconcileLocalJobs() {
    for (const record of this.ledger.recoveryCandidates()) {
      if (record.state === 'CLAIMED') {
        if (new Date(record.job.leaseExpiresAt).getTime() > Date.now()) {
          await this.processJob(record.job, true)
        } else {
          await this.ledger.transition(record.job.id, 'FAILED', {
            lastErrorCode: 'LOCAL_LEASE_EXPIRED_BEFORE_START',
          })
        }
        continue
      }

      try {
        if (record.state === 'SENT_UNCONFIRMED' && record.contentHash) {
          await this.api.success(record.job, record.contentHash, record.durationMs ?? 0)
          await this.ledger.transition(record.job.id, 'CONFIRMED')
          this.logger.info('Delayed print confirmation delivered.', { jobId: record.job.id })
        } else if (record.state === 'FAILURE_UNCONFIRMED' && record.failureReport) {
          await this.api.failure(record.job, record.failureReport)
          await this.ledger.transition(record.job.id, 'FAILED', {
            lastErrorCode: record.failureReport.errorCode,
          })
          this.logger.info('Delayed print failure report delivered.', { jobId: record.job.id })
        } else {
          await this.api.unknown(
            record.job,
            'LOCAL_LEDGER_AMBIGUOUS_AFTER_RESTART',
            'O agente reiniciou depois do inicio do envio fisico.',
          )
          await this.ledger.transition(record.job.id, 'RESULT_UNKNOWN', {
            lastErrorCode: 'LOCAL_LEDGER_AMBIGUOUS_AFTER_RESTART',
          })
          this.logger.warn('Ambiguous local job reported for manual resolution.', {
            jobId: record.job.id,
            previousState: record.state,
          })
        }
      } catch (error) {
        this.logger.warn('Local job report remains pending API recovery.', {
          jobId: record.job.id,
          code: errorCode(error),
        })
      }
    }
  }

  private async processJob(job: ClaimedPrintJob, recovering = false) {
    const logger = this.logger.child({ jobId: job.id, attempt: job.attemptNumber })
    if (!recovering) await this.ledger.putClaimed(job)
    let localState: LedgerState = this.ledger.get(job.id)?.state ?? 'CLAIMED'
    const startedAt = Date.now()

    try {
      if (hashJson(job.payloadSnapshot) !== job.payloadHash) {
        throw new PrinterDriverError(
          'PAYLOAD_HASH_MISMATCH',
          'Payload snapshot hash does not match the backend claim.',
          false,
          false,
        )
      }
      const printer = printerFromJob(job)
      const logicalDocument = buildDocument(job)
      const rendered = renderEscPos(logicalDocument)

      await this.api.started(job)
      await this.ledger.transition(job.id, 'SENDING')
      localState = 'SENDING'
      const result = await this.drivers.forPrinter(printer).print(rendered, printer)
      await this.ledger.transition(job.id, 'SENT_UNCONFIRMED', {
        contentHash: result.contentHash,
        durationMs: result.durationMs,
      })
      localState = 'SENT_UNCONFIRMED'

      try {
        await this.api.success(job, result.contentHash, result.durationMs)
        await this.ledger.transition(job.id, 'CONFIRMED', {
          contentHash: result.contentHash,
        })
        logger.info('Print job confirmed.', {
          contentHash: result.contentHash,
          durationMs: result.durationMs,
          bytesWritten: result.bytesWritten,
        })
      } catch (error) {
        logger.warn('Print completed locally but backend confirmation is pending.', {
          code: errorCode(error),
        })
      }
    } catch (error) {
      if (error instanceof ApiUnavailableError && localState === 'CLAIMED') {
        logger.warn('Job remains locally claimed until API returns.', { code: errorCode(error) })
        return
      }
      if (localState === 'SENT_UNCONFIRMED') return

      const driverError = normalizeProcessingError(error, localState)
      if (driverError.mayHavePrinted || localState === 'SENDING' && !(error instanceof PrinterDriverError)) {
        await this.reportUnknown(job, driverError, logger)
        return
      }

      const failureReport = {
        retryable: driverError.retryable,
        errorCode: driverError.code,
        errorMessage: sanitizeLogText(driverError.message),
        durationMs: Date.now() - startedAt,
      }
      await this.ledger.transition(job.id, 'FAILURE_UNCONFIRMED', {
        failureReport,
        lastErrorCode: driverError.code,
      })
      localState = 'FAILURE_UNCONFIRMED'

      try {
        await this.api.failure(job, failureReport)
        await this.ledger.transition(job.id, 'FAILED', {
          lastErrorCode: driverError.code,
        })
        logger.warn('Print failure reported.', {
          code: driverError.code,
          retryable: driverError.retryable,
        })
      } catch (reportError) {
        logger.warn('Print failure could not be reported yet.', {
          code: errorCode(reportError),
        })
      }
    }
  }

  private async reportUnknown(
    job: ClaimedPrintJob,
    error: PrinterDriverError,
    logger: Logger,
  ) {
    try {
      await this.api.unknown(job, error.code, sanitizeLogText(error.message))
      await this.ledger.transition(job.id, 'RESULT_UNKNOWN', {
        lastErrorCode: error.code,
      })
      logger.warn('Print result is unknown and requires manual resolution.', {
        code: error.code,
      })
    } catch (reportError) {
      logger.warn('Ambiguous print remains in the local ledger.', {
        code: errorCode(reportError),
      })
    }
  }
}

function printerFromJob(job: ClaimedPrintJob): AgentPrinterConfig {
  return {
    ...job.printer,
    station: job.station ?? { id: 'unknown', code: 'UNKNOWN', name: 'Unknown' },
    enabled: true,
  }
}

function normalizeProcessingError(error: unknown, state: LedgerState) {
  if (error instanceof PrinterDriverError) return error
  if (error instanceof TemplateValidationError) {
    return new PrinterDriverError(error.code, error.message, false, false)
  }
  return new PrinterDriverError(
    state === 'SENDING' ? 'UNEXPECTED_ERROR_DURING_SEND' : 'INVALID_PRINT_JOB',
    error instanceof Error ? error.message : 'Unexpected print processing error.',
    state === 'CLAIMED',
    state === 'SENDING',
  )
}

function errorCode(error: unknown) {
  if (error instanceof PrinterDriverError) return error.code
  if (error instanceof TemplateValidationError) return error.code
  if (error instanceof ApiUnavailableError) return 'API_UNAVAILABLE'
  return 'UNEXPECTED_ERROR'
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
