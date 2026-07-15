export class PrinterDriverError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
    readonly mayHavePrinted: boolean,
  ) {
    super(message)
    this.name = 'PrinterDriverError'
  }
}
