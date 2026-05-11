import { createParamDecorator, type ExecutionContext } from '@nestjs/common'

import type { AuthenticatedRequestUser } from '../auth.types'

export const CurrentAuthUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedRequestUser | undefined => {
    const request = context.switchToHttp().getRequest<{ authUser?: AuthenticatedRequestUser }>()
    return request.authUser
  },
)
