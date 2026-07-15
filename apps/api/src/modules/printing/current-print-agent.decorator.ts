import { createParamDecorator, type ExecutionContext } from '@nestjs/common'

import type { AuthenticatedPrintAgent } from './printing.types'

export const CurrentPrintAgent = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedPrintAgent | undefined => {
    const request = context
      .switchToHttp()
      .getRequest<{ printAgent?: AuthenticatedPrintAgent }>()
    return request.printAgent
  },
)
