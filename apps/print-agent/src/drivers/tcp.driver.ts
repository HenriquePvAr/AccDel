import net from 'node:net'

import type {
  AgentPrinterConfig,
  PrinterConnectionResult,
  PrinterDriver,
  PrintResult,
  RenderedEscPosDocument,
} from '../types.js'
import { PrinterDriverError } from './driver-error.js'

const MAX_PAYLOAD_BYTES = 1024 * 1024

export class TcpPrinterDriver implements PrinterDriver {
  constructor(private readonly timeoutMs: number) {}

  async testConnection(config: AgentPrinterConfig): Promise<PrinterConnectionResult> {
    try {
      const socket = await connect(config, this.timeoutMs)
      socket.destroy()
      return { ok: true, code: 'TCP_CONNECTED', message: 'TCP connection established.' }
    } catch (error) {
      const driverError = normalizeTcpError(error, false)
      return { ok: false, code: driverError.code, message: driverError.message }
    }
  }

  async print(
    document: RenderedEscPosDocument,
    config: AgentPrinterConfig,
  ): Promise<PrintResult> {
    if (document.bytes.length > MAX_PAYLOAD_BYTES) {
      throw new PrinterDriverError(
        'PAYLOAD_TOO_LARGE',
        'ESC/POS payload exceeds the one MiB safety limit.',
        false,
        false,
      )
    }
    const startedAt = Date.now()
    let socket: net.Socket | null = null
    let writeStarted = false

    try {
      socket = await connect(config, this.timeoutMs)
      writeStarted = true
      await writeAndClose(socket, document.bytes, this.timeoutMs)
      return {
        ok: true,
        contentHash: document.contentHash,
        bytesWritten: document.bytes.length,
        durationMs: Date.now() - startedAt,
      }
    } catch (error) {
      socket?.destroy()
      throw normalizeTcpError(error, writeStarted)
    }
  }
}

function connect(config: AgentPrinterConfig, timeoutMs: number) {
  const port = config.port
  if (!port || port < 1 || port > 65535) {
    throw new PrinterDriverError('INVALID_TCP_PORT', 'TCP port is invalid.', false, false)
  }
  if (!config.address || /[:/\\\s@?#]/.test(config.address) && !net.isIP(config.address)) {
    throw new PrinterDriverError('INVALID_TCP_HOST', 'TCP host is invalid.', false, false)
  }

  return new Promise<net.Socket>((resolve, reject) => {
    const socket = net.createConnection({ host: config.address, port })
    const timer = setTimeout(() => {
      socket.destroy()
      reject(new PrinterDriverError('TCP_CONNECT_TIMEOUT', 'TCP connection timed out.', true, false))
    }, timeoutMs)
    socket.once('connect', () => {
      clearTimeout(timer)
      socket.removeListener('error', onError)
      resolve(socket)
    })
    const onError = (error: Error) => {
      clearTimeout(timer)
      reject(error)
    }
    socket.once('error', onError)
  })
}

function writeAndClose(socket: net.Socket, bytes: Uint8Array, timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.removeListener('error', onError)
      if (error) reject(error)
      else resolve()
    }
    const onError = (error: Error) => finish(error)
    const timer = setTimeout(() => {
      socket.destroy()
      finish(new Error('TCP write timed out.'))
    }, timeoutMs)
    socket.once('error', onError)
    socket.end(Buffer.from(bytes), () => finish())
  })
}

function normalizeTcpError(error: unknown, mayHavePrinted: boolean) {
  if (error instanceof PrinterDriverError) return error
  const code = (error as NodeJS.ErrnoException)?.code
  const mapped =
    code === 'ECONNREFUSED'
      ? 'TCP_CONNECTION_REFUSED'
      : code === 'ETIMEDOUT'
        ? 'TCP_TIMEOUT'
        : code === 'ENOTFOUND'
          ? 'TCP_HOST_NOT_FOUND'
          : mayHavePrinted
            ? 'TCP_WRITE_UNCERTAIN'
            : 'TCP_CONNECTION_FAILED'
  return new PrinterDriverError(
    mapped,
    mayHavePrinted ? 'TCP connection failed after write started.' : 'TCP connection failed.',
    true,
    mayHavePrinted,
  )
}
