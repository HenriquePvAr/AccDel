import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { compare } from 'bcryptjs'

import type { LoginPayload } from '@/contracts/auth.contract'
import { getCurrentStoreId } from '@/shared/store-context'
import { PrismaService } from '@/shared/prisma/prisma.service'

import { getPermissionsForRole } from './auth.permissions'
import type { AuthTokenPayload } from './auth.types'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(payload: LoginPayload) {
    const membership = await this.prisma.storeUser.findFirst({
      where: {
        storeId: getCurrentStoreId(),
        active: true,
        user: {
          email: payload.email.trim().toLowerCase(),
          status: 'active',
        },
      },
      include: {
        store: true,
        user: true,
      },
    })

    if (!membership) {
      throw new UnauthorizedException('E-mail ou senha inválidos.')
    }

    const validPassword = await compare(payload.password, membership.user.passwordHash)

    if (!validPassword) {
      throw new UnauthorizedException('E-mail ou senha inválidos.')
    }

    await this.prisma.user.update({
      where: {
        id: membership.userId,
      },
      data: {
        lastLoginAt: new Date(),
      },
    })

    const permissions = getPermissionsForRole(membership.role)
    const tokenPayload: AuthTokenPayload = {
      sub: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
      storeId: membership.storeId,
      role: membership.role,
      permissions,
    }
    const accessTokenExpiresIn =
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '8h'
    const accessToken = await this.jwtService.signAsync(tokenPayload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET') ?? 'cain-admin-local-secret',
      expiresIn: accessTokenExpiresIn as never,
    })

    return {
      data: {
        accessToken,
        user: this.mapSessionUser(tokenPayload, membership.store.name, membership.store.tradeName),
      },
    }
  }

  async getCurrentUser(userId: string) {
    const membership = await this.prisma.storeUser.findFirst({
      where: {
        storeId: getCurrentStoreId(),
        userId,
        active: true,
        user: {
          status: 'active',
        },
      },
      include: {
        store: true,
        user: true,
      },
    })

    if (!membership) {
      throw new UnauthorizedException('Sessão sem vínculo ativo com a loja.')
    }

    const payload: AuthTokenPayload = {
      sub: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
      storeId: membership.storeId,
      role: membership.role,
      permissions: getPermissionsForRole(membership.role),
    }

    return {
      data: this.mapSessionUser(payload, membership.store.name, membership.store.tradeName),
    }
  }

  private mapSessionUser(
    payload: AuthTokenPayload,
    storeName: string,
    storeTradeName: string,
  ) {
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      status: 'active' as const,
      initials: this.buildInitials(payload.name),
      permissions: payload.permissions,
      store: {
        id: payload.storeId,
        name: storeName,
        tradeName: storeTradeName,
      },
    }
  }

  private buildInitials(name: string) {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((chunk) => chunk[0]?.toUpperCase() ?? '')
      .join('')
  }
}
