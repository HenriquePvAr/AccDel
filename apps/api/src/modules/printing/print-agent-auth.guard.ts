import {
  CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import type { FastifyRequest } from 'fastify'

import { PrismaService } from '@/shared/prisma/prisma.service'
import { enterStoreContext } from '@/shared/store-context'

import type { AuthenticatedPrintAgent } from './printing.types'
import { hashOpaqueToken, secureHashMatches } from './printing.utils'

export interface PrintAgentRequest extends FastifyRequest {
  printAgent?: AuthenticatedPrintAgent
}

@Injectable()
export class PrintAgentAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<PrintAgentRequest>()
    const token = readBearerToken(request)

    if (!token?.startsWith('cpa_')) {
      throw new UnauthorizedException('Credencial do Cain Print Agent ausente ou invalida.')
    }

    const tokenHash = hashOpaqueToken(token)
    const agent = await this.prisma.printAgent.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        storeId: true,
        name: true,
        version: true,
        tokenHash: true,
        enabled: true,
        revokedAt: true,
      },
    })

    if (
      !agent ||
      !agent.enabled ||
      agent.revokedAt ||
      !secureHashMatches(agent.tokenHash, tokenHash)
    ) {
      throw new UnauthorizedException('Credencial do Cain Print Agent revogada ou invalida.')
    }

    request.printAgent = {
      id: agent.id,
      storeId: agent.storeId,
      name: agent.name,
      version: agent.version,
    }
    enterStoreContext({ storeId: agent.storeId, source: 'agent' })
    return true
  }
}

function readBearerToken(request: FastifyRequest) {
  const authorization = request.headers.authorization
  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  return authorization.slice(7).trim()
}
