import { ServiceUnavailableException } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'

export function readJwtSecret(configService: ConfigService) {
  const secret = configService.get<string>('JWT_ACCESS_SECRET')?.trim()

  if (!secret || secret.length < 32 || /change|example|placeholder/i.test(secret)) {
    throw new ServiceUnavailableException(
      'JWT_ACCESS_SECRET precisa ser configurado com pelo menos 32 caracteres.',
    )
  }

  return secret
}
