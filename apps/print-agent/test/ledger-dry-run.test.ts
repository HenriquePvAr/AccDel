import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { DryRunPrinterDriver } from '../src/drivers/dry-run.driver.js'
import { PrintLedger } from '../src/ledger.js'
import type { AgentPrinterConfig, ClaimedPrintJob } from '../src/types.js'

test('dry-run grava TXT, bytes e hash apenas no diretorio local configurado', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cain-print-dry-run-'))
  try {
    const driver = new DryRunPrinterDriver(directory, 24)
    const result = await driver.print(
      {
        jobId: 'job-dry-run-12345678',
        bytes: Uint8Array.from([0x1b, 0x40, 0x0a]),
        text: 'Cupom ficticio\n',
        contentHash: 'a'.repeat(64),
      },
      printer(),
    )
    assert.equal(result.contentHash, 'a'.repeat(64))
    assert.equal(await readFile(result.artifacts!.textPath, 'utf8'), 'Cupom ficticio\n')
    assert.equal(path.dirname(result.artifacts!.binaryPath), directory)
    assert.match(await readFile(result.artifacts!.metadataPath, 'utf8'), /"contentHash"/)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('ledger persiste reinicio e identifica envio nao confirmado', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cain-print-ledger-'))
  try {
    const first = new PrintLedger(directory)
    await first.initialize()
    await first.putClaimed(job())
    await first.transition('job-ledger-12345678', 'SENDING')
    await first.transition('job-ledger-12345678', 'SENT_UNCONFIRMED', {
      contentHash: 'b'.repeat(64),
    })

    const restarted = new PrintLedger(directory)
    await restarted.initialize()
    const candidate = restarted.recoveryCandidates()[0]
    assert.equal(candidate?.state, 'SENT_UNCONFIRMED')
    assert.equal(candidate?.contentHash, 'b'.repeat(64))
    await restarted.transition('job-ledger-12345678', 'RESULT_UNKNOWN')
    await assert.rejects(() => restarted.transition('job-ledger-12345678', 'SENDING'))
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('ledger preserva relatorios pendentes e aceita uma tentativa posterior segura', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cain-print-ledger-retry-'))
  try {
    const ledger = new PrintLedger(directory)
    await ledger.initialize()
    await ledger.putClaimed(job())
    await ledger.transition('job-ledger-12345678', 'SENDING')
    await ledger.transition('job-ledger-12345678', 'FAILURE_UNCONFIRMED', {
      failureReport: {
        retryable: true,
        errorCode: 'TCP_CONNECTION_REFUSED',
        errorMessage: 'Conexao recusada.',
        durationMs: 12,
      },
    })

    const restarted = new PrintLedger(directory)
    await restarted.initialize()
    const pending = restarted.recoveryCandidates()[0]
    assert.equal(pending?.state, 'FAILURE_UNCONFIRMED')
    assert.equal(pending?.failureReport?.errorCode, 'TCP_CONNECTION_REFUSED')

    const retry = job()
    retry.attemptNumber = 2
    retry.leaseToken = 'second-lease-token-long-enough-for-local-ledger'
    await restarted.putClaimed(retry)
    assert.equal(restarted.get(retry.id)?.job.attemptNumber, 2)
    assert.equal(restarted.get(retry.id)?.state, 'CLAIMED')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

function printer(): AgentPrinterConfig {
  return {
    id: 'printer-a',
    name: 'Virtual',
    station: { id: 'station-a', code: 'COZINHA', name: 'Cozinha' },
    connectionType: 'FILE_OR_VIRTUAL',
    address: 'dry-run',
    port: null,
    paperWidth: 80,
    encoding: 'CP860',
    enabled: true,
  }
}

function job(): ClaimedPrintJob {
  return {
    id: 'job-ledger-12345678',
    jobType: 'ORDER_INITIAL',
    templateKey: 'kitchen-order',
    templateVersion: 'v1',
    payloadSnapshot: {},
    payloadHash: 'c'.repeat(64),
    attemptNumber: 1,
    leaseToken: 'lease-token-long-enough-for-local-ledger',
    leaseExpiresAt: '2099-01-01T00:00:00.000Z',
    printer: {
      id: 'printer-a',
      name: 'Virtual',
      connectionType: 'FILE_OR_VIRTUAL',
      address: 'dry-run',
      port: null,
      paperWidth: 80,
      encoding: 'CP860',
    },
    station: { id: 'station-a', code: 'COZINHA', name: 'Cozinha' },
  }
}
