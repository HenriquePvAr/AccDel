import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type {
  ClaimedPrintJob,
  LedgerFailureReport,
  LedgerRecord,
  LedgerState,
} from './types.js'

interface LedgerFile {
  version: 1
  records: Record<string, LedgerRecord>
}

const ALLOWED_TRANSITIONS: Record<LedgerState, LedgerState[]> = {
  CLAIMED: ['SENDING', 'FAILURE_UNCONFIRMED', 'FAILED', 'RESULT_UNKNOWN'],
  SENDING: ['SENT_UNCONFIRMED', 'FAILURE_UNCONFIRMED', 'FAILED', 'RESULT_UNKNOWN'],
  SENT_UNCONFIRMED: ['CONFIRMED', 'RESULT_UNKNOWN'],
  FAILURE_UNCONFIRMED: ['FAILED', 'RESULT_UNKNOWN'],
  CONFIRMED: [],
  RESULT_UNKNOWN: [],
  FAILED: [],
}

export class PrintLedger {
  private readonly ledgerPath: string
  private data: LedgerFile = { version: 1, records: {} }
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(private readonly dataDir: string) {
    this.ledgerPath = path.join(dataDir, 'print-ledger.json')
  }

  async initialize() {
    await mkdir(this.dataDir, { recursive: true, mode: 0o700 })
    try {
      const content = await readFile(this.ledgerPath, 'utf8')
      this.data = parseLedger(content)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      await this.persist()
    }
  }

  list() {
    return Object.values(this.data.records).map((record) => structuredClone(record))
  }

  get(jobId: string) {
    const record = this.data.records[jobId]
    return record ? structuredClone(record) : null
  }

  async putClaimed(job: ClaimedPrintJob) {
    const existing = this.data.records[job.id]
    const isNewAttempt = existing && job.attemptNumber > existing.job.attemptNumber
    const canReplace =
      !existing ||
      existing.state === 'CLAIMED' ||
      (['FAILED', 'FAILURE_UNCONFIRMED'].includes(existing.state) && isNewAttempt)
    if (!canReplace) {
      throw new Error(`Ledger refuses to replace job ${job.id} in ${existing.state}.`)
    }
    const now = new Date().toISOString()
    this.data.records[job.id] = {
      job,
      state: 'CLAIMED',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    await this.persist()
  }

  async transition(
    jobId: string,
    state: LedgerState,
    details: {
      contentHash?: string
      durationMs?: number
      failureReport?: LedgerFailureReport
      lastErrorCode?: string
    } = {},
  ) {
    const current = this.data.records[jobId]
    if (!current) throw new Error(`Ledger job ${jobId} does not exist.`)
    if (current.state === state) return structuredClone(current)
    if (!ALLOWED_TRANSITIONS[current.state].includes(state)) {
      throw new Error(`Invalid ledger transition ${current.state} -> ${state}.`)
    }
    const next: LedgerRecord = {
      ...current,
      ...details,
      state,
      updatedAt: new Date().toISOString(),
    }
    this.data.records[jobId] = next
    await this.persist()
    return structuredClone(next)
  }

  recoveryCandidates() {
    return this.list().filter((record) =>
      ['CLAIMED', 'SENDING', 'SENT_UNCONFIRMED', 'FAILURE_UNCONFIRMED'].includes(
        record.state,
      ),
    )
  }

  async cleanup(confirmedRetentionMs: number, now = Date.now()) {
    let changed = false
    for (const [jobId, record] of Object.entries(this.data.records)) {
      if (
        record.state === 'CONFIRMED' &&
        new Date(record.updatedAt).getTime() < now - confirmedRetentionMs
      ) {
        delete this.data.records[jobId]
        changed = true
      }
    }
    if (changed) await this.persist()
  }

  private async persist() {
    this.writeQueue = this.writeQueue.then(async () => {
      const temporaryPath = `${this.ledgerPath}.tmp`
      await writeFile(temporaryPath, `${JSON.stringify(this.data)}\n`, {
        encoding: 'utf8',
        mode: 0o600,
      })
      await rename(temporaryPath, this.ledgerPath)
    })
    return this.writeQueue
  }
}

function parseLedger(content: string): LedgerFile {
  const parsed = JSON.parse(content) as Partial<LedgerFile>
  if (parsed.version !== 1 || !parsed.records || typeof parsed.records !== 'object') {
    throw new Error('Local print ledger is invalid. Refusing to print automatically.')
  }
  return parsed as LedgerFile
}
