import { mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type {
  AgentPrinterConfig,
  PrinterConnectionResult,
  PrinterDriver,
  PrintResult,
  RenderedEscPosDocument,
} from '../types.js'
import { PrinterDriverError } from './driver-error.js'

export class DryRunPrinterDriver implements PrinterDriver {
  constructor(
    private readonly outputDir: string,
    private readonly retentionHours: number,
  ) {}

  async testConnection(_config: AgentPrinterConfig): Promise<PrinterConnectionResult> {
    void _config
    await mkdir(this.outputDir, { recursive: true, mode: 0o700 })
    return { ok: true, code: 'DRY_RUN_READY', message: 'Dry-run output directory is writable.' }
  }

  async print(
    document: RenderedEscPosDocument,
    _config: AgentPrinterConfig,
  ): Promise<PrintResult> {
    void _config
    const startedAt = Date.now()
    const baseName = safeJobFileName(document.jobId)
    await mkdir(this.outputDir, { recursive: true, mode: 0o700 })

    try {
      const textPath = path.join(this.outputDir, `${baseName}.txt`)
      const binaryPath = path.join(this.outputDir, `${baseName}.bin`)
      const metadataPath = path.join(this.outputDir, `${baseName}.json`)
      await atomicWrite(textPath, document.text)
      await atomicWrite(binaryPath, document.bytes)
      await atomicWrite(
        metadataPath,
        `${JSON.stringify({
          jobId: document.jobId,
          contentHash: document.contentHash,
          bytes: document.bytes.length,
          generatedAt: new Date().toISOString(),
        })}\n`,
      )
      await this.cleanup()
      return {
        ok: true,
        contentHash: document.contentHash,
        bytesWritten: document.bytes.length,
        durationMs: Date.now() - startedAt,
        artifacts: { textPath, binaryPath, metadataPath },
      }
    } catch (error) {
      throw new PrinterDriverError(
        'DRY_RUN_WRITE_FAILED',
        error instanceof Error ? error.message : 'Dry-run write failed.',
        true,
        false,
      )
    }
  }

  private async cleanup() {
    const cutoff = Date.now() - this.retentionHours * 60 * 60 * 1000
    const entries = await readdir(this.outputDir, { withFileTypes: true })
    await Promise.all(
      entries
        .filter(
          (entry) =>
            entry.isFile() && /^[A-Za-z0-9-]{8,128}\.(txt|bin|json)$/.test(entry.name),
        )
        .map(async (entry) => {
          const filePath = path.join(this.outputDir, entry.name)
          const details = await stat(filePath)
          if (details.mtimeMs < cutoff) await rm(filePath, { force: true })
        }),
    )
  }
}

function safeJobFileName(value: string) {
  if (!/^[A-Za-z0-9-]{8,128}$/.test(value)) {
    throw new PrinterDriverError(
      'INVALID_JOB_ID',
      'Job id cannot be used as a dry-run file name.',
      false,
      false,
    )
  }
  return value
}

async function atomicWrite(target: string, data: string | Uint8Array) {
  const temporary = `${target}.tmp`
  await writeFile(temporary, data, { mode: 0o600 })
  await rename(temporary, target)
}
