import { Injectable } from '@nestjs/common'

import type {
  CategorySoldOutPayload,
  ChannelAvailabilityPayload,
  ListCommercialQuery,
  ListProductsQuery,
  ReorderCategoryPayload,
  SaveCategoryPayload,
  SaveCouponPayload,
  SaveProductPayload,
  SavePromotionPayload,
  SoldOutPayload,
  ValidateCouponPayload,
} from '@/contracts/catalog.contract'
import { buildListResponse, normalizePagination } from '@/shared/pagination'
import { PrismaService } from '@/shared/prisma/prisma.service'
import { DEFAULT_STORE_ID } from '@/shared/store-context'

import { mapCategory, mapCoupon, mapProduct, mapPromotion } from './catalog.mapper'

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories() {
    const categories = await this.prisma.category.findMany({
      where: {
        storeId: DEFAULT_STORE_ID,
      },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: {
        sortOrder: 'asc',
      },
    })

    return buildListResponse(categories.map(mapCategory), categories.length)
  }

  async createCategory(payload: SaveCategoryPayload) {
    const category = payload.category
    const created = await this.prisma.category.create({
      data: {
        ...(category.id ? { id: category.id } : {}),
        storeId: DEFAULT_STORE_ID,
        name: category.name,
        description: category.description,
        active: category.active,
        icon: category.icon ?? null,
        color: category.color ?? null,
        visibleOnPos: category.visibleOnPos,
        visibleOnDigitalMenu: category.visibleOnDigitalMenu,
        sortOrder: category.sortOrder,
      },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    })

    return {
      data: mapCategory(created),
    }
  }

  async updateCategory(categoryId: string, payload: SaveCategoryPayload) {
    const category = payload.category
    const updated = await this.prisma.category.update({
      where: {
        id: categoryId,
      },
      data: {
        name: category.name,
        description: category.description,
        active: category.active,
        icon: category.icon ?? null,
        color: category.color ?? null,
        visibleOnPos: category.visibleOnPos,
        visibleOnDigitalMenu: category.visibleOnDigitalMenu,
        sortOrder: category.sortOrder,
      },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    })

    return {
      data: mapCategory(updated),
    }
  }

  async reorderCategory(categoryId: string, payload: ReorderCategoryPayload) {
    const updated = await this.prisma.category.update({
      where: {
        id: categoryId,
      },
      data: {
        sortOrder: payload.sortOrder,
      },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    })

    return {
      data: mapCategory(updated),
    }
  }

  async deleteCategory(categoryId: string) {
    const productCount = await this.prisma.product.count({
      where: {
        categoryId,
      },
    })

    if (productCount > 0) {
      const updated = await this.prisma.category.update({
        where: {
          id: categoryId,
        },
        data: {
          active: false,
          visibleOnPos: false,
          visibleOnDigitalMenu: false,
        },
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      })

      return {
        data: mapCategory(updated),
        deleted: false,
      }
    }

    await this.prisma.category.delete({
      where: {
        id: categoryId,
      },
    })

    return {
      data: null,
      deleted: true,
    }
  }

  async listProducts(query: ListProductsQuery) {
    const pagination = normalizePagination(query)
    const search = query.search?.trim()
    const where = {
      storeId: DEFAULT_STORE_ID,
      ...(query.categoryId && query.categoryId !== 'all' ? { categoryId: query.categoryId } : {}),
      ...(query.status === 'active' || query.activeOnly ? { active: true } : {}),
      ...(query.status === 'inactive' ? { active: false } : {}),
      ...(query.channel && query.channel !== 'all'
        ? {
            availability: {
              some: {
                channel: query.channel,
                visible: true,
              },
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { description: { contains: search, mode: 'insensitive' as const } },
              { tags: { has: search } },
              { category: { name: { contains: search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    }
    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: {
          availability: {
            orderBy: {
              channel: 'asc',
            },
          },
          optionGroups: {
            include: {
              group: {
                include: {
                  options: {
                    orderBy: {
                      sortOrder: 'asc',
                    },
                  },
                },
              },
            },
            orderBy: {
              sortOrder: 'asc',
            },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.product.count({ where }),
    ])

    return buildListResponse(products.map(mapProduct), total, query)
  }

  async createProduct(payload: SaveProductPayload) {
    const product = payload.product
    const availability = (product.availability ?? this.defaultAvailability()).map((entry) => ({
      channel: entry.channel,
      available: entry.available,
      visible: entry.visible,
      soldOut: entry.soldOut,
      priceOverride: (entry as { priceOverride?: number | null }).priceOverride ?? undefined,
    }))
    const created = await this.prisma.product.create({
      data: {
        id: product.id,
        storeId: DEFAULT_STORE_ID,
        categoryId: product.categoryId,
        name: product.name,
        description: product.description,
        price: product.price,
        image: product.image,
        featured: product.featured,
        active: product.active,
        preparationStation: product.preparationStation,
        tags: product.tags,
        sortOrder: product.sortOrder,
        availability: {
          create: availability,
        },
      },
      include: {
        availability: true,
        optionGroups: {
          include: {
            group: {
              include: {
                options: true,
              },
            },
          },
        },
      },
    })

    return {
      data: mapProduct(created),
    }
  }

  async updateProduct(productId: string, payload: SaveProductPayload) {
    const product = payload.product
    const updated = await this.prisma.product.update({
      where: {
        id: productId,
      },
      data: {
        categoryId: product.categoryId,
        name: product.name,
        description: product.description,
        price: product.price,
        image: product.image,
        featured: product.featured,
        active: product.active,
        preparationStation: product.preparationStation,
        tags: product.tags,
        sortOrder: product.sortOrder,
        ...(product.availability
          ? {
              availability: {
                upsert: product.availability.map((entry) => ({
                  where: {
                    productId_channel: {
                      productId,
                      channel: entry.channel,
                    },
                  },
                  update: {
                    available: entry.available,
                    visible: entry.visible,
                    soldOut: entry.soldOut,
                    priceOverride: 'priceOverride' in entry ? entry.priceOverride : undefined,
                  },
                  create: {
                    channel: entry.channel,
                    available: entry.available,
                    visible: entry.visible,
                    soldOut: entry.soldOut,
                    priceOverride: 'priceOverride' in entry ? entry.priceOverride : undefined,
                  },
                })),
              },
            }
          : {}),
      },
      include: {
        availability: true,
        optionGroups: {
          include: {
            group: {
              include: {
                options: true,
              },
            },
          },
        },
      },
    })

    return {
      data: mapProduct(updated),
    }
  }

  async toggleSoldOut(productId: string, payload: SoldOutPayload) {
    const current = await this.prisma.productChannelAvailability.findUniqueOrThrow({
      where: {
        productId_channel: {
          productId,
          channel: payload.channel,
        },
      },
    })
    const updated = await this.prisma.product.update({
      where: {
        id: productId,
      },
      data: {
        availability: {
          update: {
            where: {
              productId_channel: {
                productId,
                channel: payload.channel,
              },
            },
            data: {
              soldOut: !current.soldOut,
            },
          },
        },
      },
      include: {
        availability: true,
        optionGroups: {
          include: {
            group: {
              include: {
                options: true,
              },
            },
          },
        },
      },
    })

    return {
      data: mapProduct(updated),
    }
  }

  async updateChannel(productId: string, payload: ChannelAvailabilityPayload) {
    const updated = await this.prisma.product.update({
      where: {
        id: productId,
      },
      data: {
        availability: {
          upsert: {
            where: {
              productId_channel: {
                productId,
                channel: payload.channel,
              },
            },
            update: {
              available: payload.available,
              visible: payload.visible,
              soldOut: payload.soldOut,
            },
            create: {
              channel: payload.channel,
              available: payload.available ?? true,
              visible: payload.visible ?? true,
              soldOut: payload.soldOut ?? false,
            },
          },
        },
      },
      include: {
        availability: true,
        optionGroups: {
          include: {
            group: {
              include: {
                options: true,
              },
            },
          },
        },
      },
    })

    return {
      data: mapProduct(updated),
    }
  }

  async toggleCategorySoldOut(categoryId: string, payload: CategorySoldOutPayload) {
    const category = await this.prisma.category.findFirstOrThrow({
      where: {
        id: categoryId,
        storeId: DEFAULT_STORE_ID,
      },
    })
    const products = await this.prisma.product.findMany({
      where: {
        categoryId: category.id,
        storeId: DEFAULT_STORE_ID,
      },
      select: {
        id: true,
      },
    })

    if (!products.length) {
      return {
        data: {
          categoryId: category.id,
          affected: 0,
          soldOut: payload.soldOut,
          channels: payload.channels,
        },
      }
    }

    await this.prisma.$transaction(
      products.flatMap((product) =>
        payload.channels.map((channel) =>
          this.prisma.productChannelAvailability.upsert({
            where: {
              productId_channel: {
                productId: product.id,
                channel,
              },
            },
            update: {
              available: true,
              visible: true,
              soldOut: payload.soldOut,
            },
            create: {
              productId: product.id,
              channel,
              available: true,
              visible: true,
              soldOut: payload.soldOut,
            },
          }),
        ),
      ),
    )

    return {
      data: {
        categoryId: category.id,
        affected: products.length,
        soldOut: payload.soldOut,
        channels: payload.channels,
      },
    }
  }

  async listPromotions(query: ListCommercialQuery) {
    const pagination = normalizePagination(query)
    const search = query.search?.trim()
    const where = {
      storeId: DEFAULT_STORE_ID,
      ...(query.status && query.status !== 'all' ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { description: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [promotions, total] = await this.prisma.$transaction([
      this.prisma.promotion.findMany({
        where,
        orderBy: {
          updatedAt: 'desc',
        },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.promotion.count({ where }),
    ])

    return buildListResponse(promotions.map(mapPromotion), total, query)
  }

  async createPromotion(payload: SavePromotionPayload) {
    const promotion = payload.promotion
    const created = await this.prisma.promotion.create({
      data: {
        ...(promotion.id ? { id: promotion.id } : {}),
        storeId: DEFAULT_STORE_ID,
        name: promotion.name,
        description: promotion.description ?? null,
        type: promotion.type,
        discountValue: promotion.discountValue ?? null,
        status: promotion.status,
        startsAt: this.parseDate(promotion.startsAt),
        endsAt: this.parseDate(promotion.endsAt),
        channels: promotion.channels,
        productIds: promotion.productIds,
        categoryIds: promotion.categoryIds,
        rules: promotion.rules ?? undefined,
      },
    })

    return {
      data: mapPromotion(created),
    }
  }

  async updatePromotion(promotionId: string, payload: SavePromotionPayload) {
    const promotion = payload.promotion
    const updated = await this.prisma.promotion.update({
      where: {
        id: promotionId,
      },
      data: {
        name: promotion.name,
        description: promotion.description ?? null,
        type: promotion.type,
        discountValue: promotion.discountValue ?? null,
        status: promotion.status,
        startsAt: this.parseDate(promotion.startsAt),
        endsAt: this.parseDate(promotion.endsAt),
        channels: promotion.channels,
        productIds: promotion.productIds,
        categoryIds: promotion.categoryIds,
        rules: promotion.rules ?? undefined,
      },
    })

    return {
      data: mapPromotion(updated),
    }
  }

  async deletePromotion(promotionId: string) {
    const updated = await this.prisma.promotion.update({
      where: {
        id: promotionId,
      },
      data: {
        status: 'inactive',
      },
    })

    return {
      data: mapPromotion(updated),
    }
  }

  async listCoupons(query: ListCommercialQuery) {
    const pagination = normalizePagination(query)
    const search = query.search?.trim()
    const where = {
      storeId: DEFAULT_STORE_ID,
      ...(query.status && query.status !== 'all' ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' as const } },
              { description: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [coupons, total] = await this.prisma.$transaction([
      this.prisma.coupon.findMany({
        where,
        orderBy: {
          updatedAt: 'desc',
        },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.coupon.count({ where }),
    ])

    return buildListResponse(coupons.map(mapCoupon), total, query)
  }

  async createCoupon(payload: SaveCouponPayload) {
    const coupon = payload.coupon
    const created = await this.prisma.coupon.create({
      data: {
        ...(coupon.id ? { id: coupon.id } : {}),
        storeId: DEFAULT_STORE_ID,
        code: coupon.code.trim().toUpperCase(),
        description: coupon.description ?? null,
        type: coupon.type,
        value: coupon.value,
        minOrderAmount: coupon.minOrderAmount,
        maxUses: coupon.maxUses ?? null,
        uses: coupon.uses,
        status: coupon.status,
        validFrom: this.parseDate(coupon.validFrom),
        validUntil: this.parseDate(coupon.validUntil),
        channels: coupon.channels,
      },
    })

    return {
      data: mapCoupon(created),
    }
  }

  async updateCoupon(couponId: string, payload: SaveCouponPayload) {
    const coupon = payload.coupon
    const updated = await this.prisma.coupon.update({
      where: {
        id: couponId,
      },
      data: {
        code: coupon.code.trim().toUpperCase(),
        description: coupon.description ?? null,
        type: coupon.type,
        value: coupon.value,
        minOrderAmount: coupon.minOrderAmount,
        maxUses: coupon.maxUses ?? null,
        uses: coupon.uses,
        status: coupon.status,
        validFrom: this.parseDate(coupon.validFrom),
        validUntil: this.parseDate(coupon.validUntil),
        channels: coupon.channels,
      },
    })

    return {
      data: mapCoupon(updated),
    }
  }

  async validateCoupon(payload: ValidateCouponPayload) {
    const coupon = await this.prisma.coupon.findFirst({
      where: {
        storeId: DEFAULT_STORE_ID,
        code: payload.code.trim().toUpperCase(),
        status: 'active',
      },
    })

    if (!coupon) {
      return {
        data: {
          valid: false,
          reason: 'Cupom nao encontrado ou inativo.',
        },
      }
    }

    const now = new Date()
    if (coupon.validFrom && coupon.validFrom > now) {
      return {
        data: {
          valid: false,
          reason: 'Cupom ainda nao esta valido.',
        },
      }
    }

    if (coupon.validUntil && coupon.validUntil < now) {
      return {
        data: {
          valid: false,
          reason: 'Cupom expirado.',
        },
      }
    }

    if (coupon.maxUses && coupon.uses >= coupon.maxUses) {
      return {
        data: {
          valid: false,
          reason: 'Cupom atingiu o limite de uso.',
        },
      }
    }

    if (coupon.channels.length && !coupon.channels.includes(payload.channel)) {
      return {
        data: {
          valid: false,
          reason: 'Cupom nao vale para este canal.',
        },
      }
    }

    const minOrderAmount = Number(coupon.minOrderAmount)
    if (payload.orderTotal < minOrderAmount) {
      return {
        data: {
          valid: false,
          reason: `Pedido minimo de R$ ${minOrderAmount.toFixed(2)}.`,
        },
      }
    }

    const value = Number(coupon.value)
    const discount =
      coupon.type === 'percent'
        ? Math.min(payload.orderTotal, (payload.orderTotal * value) / 100)
        : Math.min(payload.orderTotal, value)

    return {
      data: {
        valid: true,
        discount,
        coupon: mapCoupon(coupon),
      },
    }
  }

  async deleteCoupon(couponId: string) {
    const updated = await this.prisma.coupon.update({
      where: {
        id: couponId,
      },
      data: {
        status: 'inactive',
      },
    })

    return {
      data: mapCoupon(updated),
    }
  }

  private defaultAvailability() {
    return (['dine_in', 'delivery', 'digital_menu', 'counter'] as const).map((channel) => ({
      channel,
      available: true,
      visible: true,
      soldOut: false,
    }))
  }

  private parseDate(value?: string | null) {
    if (!value) {
      return null
    }

    return new Date(value)
  }
}
