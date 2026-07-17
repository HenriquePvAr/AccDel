import type { PrintAgentConfig } from '../config.js'
import type { AgentPrinterConfig, PrinterDriver } from '../types.js'
import { DryRunPrinterDriver } from './dry-run.driver.js'
import { TcpPrinterDriver } from './tcp.driver.js'
import { WindowsPrinterDriver } from './windows.driver.js'

export class PrinterDriverFactory {
  private readonly dryRun: DryRunPrinterDriver
  private readonly tcp: TcpPrinterDriver
  private readonly windows = new WindowsPrinterDriver()

  constructor(private readonly config: PrintAgentConfig) {
    this.dryRun = new DryRunPrinterDriver(config.outputDir, config.dryRunRetentionHours)
    this.tcp = new TcpPrinterDriver(config.tcpTimeoutMs)
  }

  forPrinter(printer: AgentPrinterConfig): PrinterDriver {
    if (this.config.dryRun || printer.connectionType === 'FILE_OR_VIRTUAL') return this.dryRun
    if (printer.connectionType === 'NETWORK_TCP') return this.tcp
    return this.windows
  }

  isLocallySupported(printer: AgentPrinterConfig) {
    return this.config.dryRun || printer.connectionType !== 'WINDOWS_PRINTER'
  }
}
