import assert from 'node:assert/strict'
import net from 'node:net'
import test from 'node:test'

import { PrinterDriverError } from '../src/drivers/driver-error.js'
import { TcpPrinterDriver } from '../src/drivers/tcp.driver.js'
import type { AgentPrinterConfig } from '../src/types.js'

test('TCP mock recebe todos os bytes e encerra o socket', async () => {
  const received: Buffer[] = []
  const server = net.createServer((socket) => {
    socket.on('data', (chunk) => received.push(chunk))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  try {
    const driver = new TcpPrinterDriver(2_000)
    const result = await driver.print(
      {
        jobId: 'job-tcp-12345678',
        bytes: Uint8Array.from([1, 2, 3, 4, 5]),
        text: 'mock',
        contentHash: 'd'.repeat(64),
      },
      printer(address.port),
    )
    await new Promise((resolve) => setTimeout(resolve, 20))
    assert.equal(result.bytesWritten, 5)
    assert.deepEqual(Buffer.concat(received), Buffer.from([1, 2, 3, 4, 5]))
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
})

test('conexao recusada e retryable sem afirmar impressao', async () => {
  const server = net.createServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  await new Promise<void>((resolve) => server.close(() => resolve()))

  const driver = new TcpPrinterDriver(500)
  await assert.rejects(
    () =>
      driver.print(
        {
          jobId: 'job-refused-12345678',
          bytes: Uint8Array.of(1),
          text: 'mock',
          contentHash: 'e'.repeat(64),
        },
        printer(address.port),
      ),
    (error: unknown) =>
      error instanceof PrinterDriverError &&
      error.code === 'TCP_CONNECTION_REFUSED' &&
      error.retryable &&
      !error.mayHavePrinted,
  )
})

function printer(port: number): AgentPrinterConfig {
  return {
    id: 'printer-tcp',
    name: 'TCP mock',
    station: { id: 'station-a', code: 'COZINHA', name: 'Cozinha' },
    connectionType: 'NETWORK_TCP',
    address: '127.0.0.1',
    port,
    paperWidth: 80,
    encoding: 'CP860',
    enabled: true,
  }
}
