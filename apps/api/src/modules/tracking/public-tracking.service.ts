import { Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash, randomBytes } from 'node:crypto'

import { PrismaService } from '@/shared/prisma/prisma.service'

@Injectable()
export class PublicTrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async issue(storeId: string, orderId: string) {
    const rawToken = randomBytes(32).toString('base64url')
    const tokenHash = hashToken(rawToken)
    const ttlMinutes = this.config.get<number>('PUBLIC_TRACKING_TTL_MINUTES') ?? 1_440
    await this.prisma.publicTrackingToken.create({
      data: {
        storeId,
        orderId,
        tokenHash,
        expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
      },
    })
    return {
      path: `/tracking/${rawToken}`,
      url: `${this.publicBaseUrl()}${`/tracking/${rawToken}`}`,
    }
  }

  async resolve(rawToken: string) {
    if (!/^[A-Za-z0-9_-]{40,80}$/.test(rawToken)) throw new NotFoundException()
    const now = new Date()
    const token = await this.prisma.publicTrackingToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: {
        order: {
          select: {
            number: true,
            status: true,
            dueAt: true,
            updatedAt: true,
            driverLocations: {
              where: { isActive: true },
              orderBy: { capturedAt: 'desc' },
              take: 1,
              select: { latitude: true, longitude: true, capturedAt: true },
            },
          },
        },
      },
    })
    if (!token || token.revokedAt || token.expiresAt <= now) throw new NotFoundException()

    await this.prisma.publicTrackingToken.update({
      where: { id: token.id },
      data: { lastAccessAt: now },
    })
    const location = token.order.driverLocations[0]
    return {
      orderNumber: token.order.number,
      status: token.order.status,
      message: trackingMessage(token.order.status),
      etaMinutes: Math.max(0, Math.round((token.order.dueAt.getTime() - now.getTime()) / 60_000)),
      location: location
        ? {
            latitude: roundPublicCoordinate(Number(location.latitude)),
            longitude: roundPublicCoordinate(Number(location.longitude)),
            capturedAt: location.capturedAt.toISOString(),
          }
        : null,
      updatedAt: token.order.updatedAt.toISOString(),
    }
  }

  private publicBaseUrl() {
    const configured =
      this.config.get<string>('PUBLIC_WEB_URL')?.trim() ??
      this.config.get<string>('WEB_ORIGIN')?.split(',')[0]?.trim() ??
      'http://localhost:5173'
    return configured.replace(/\/+$/, '')
  }
}

export function hashToken(rawToken: string) {
  return createHash('sha256').update(rawToken).digest('hex')
}

export function roundPublicCoordinate(value: number) {
  return Math.round(value * 1_000) / 1_000
}

function trackingMessage(status: string) {
  if (status === 'out_for_delivery') return 'Seu pedido esta em rota.'
  if (status === 'ready') return 'Seu pedido esta pronto.'
  if (status === 'in_preparation') return 'Seu pedido esta em preparo.'
  return 'Acompanhe aqui a situacao atual do pedido.'
}
