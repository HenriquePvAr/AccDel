import type {
  AgentPrinterConfig,
  PrinterConnectionResult,
  PrinterDriver,
  PrintResult,
  RenderedEscPosDocument,
} from '../types.js'
import { PrinterDriverError } from './driver-error.js'

export class WindowsPrinterDriver implements PrinterDriver {
  async testConnection(_config: AgentPrinterConfig): Promise<PrinterConnectionResult> {
    void _config
    return {
      ok: false,
      code: 'WINDOWS_SPOOLER_NOT_IMPLEMENTED',
      message: 'The controlled RAW Windows spooler adapter is not enabled in this release.',
    }
  }

  async print(
    _document: RenderedEscPosDocument,
    _config: AgentPrinterConfig,
  ): Promise<PrintResult> {
    void _document
    void _config
    throw new PrinterDriverError(
      'WINDOWS_SPOOLER_NOT_IMPLEMENTED',
      'The controlled RAW Windows spooler adapter is not enabled in this release.',
      false,
      false,
    )
  }
}
