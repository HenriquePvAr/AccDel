import { Body, Controller, Get, Post } from '@nestjs/common'

import { loginSchema, type LoginPayload } from '@/contracts/auth.contract'
import { ZodValidationPipe } from '@/shared/pipes/zod-validation.pipe'
import { RateLimit } from '@/shared/security/rate-limit.decorator'

import { CurrentAuthUser } from './decorators/current-auth-user.decorator'
import { Public } from './decorators/public.decorator'
import type { AuthenticatedRequestUser } from './auth.types'
import { AuthService } from './auth.service'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @RateLimit({ limit: 8, windowMs: 60_000, scopes: ['ip', 'store'] })
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginPayload) {
    return this.authService.login(body)
  }

  @Get('me')
  me(@CurrentAuthUser() authUser: AuthenticatedRequestUser) {
    return this.authService.getCurrentUser(authUser.sub)
  }
}
