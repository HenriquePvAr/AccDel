import { Injectable } from '@nestjs/common'

import type {
  ChannelAvailabilityPayload,
  ListProductsQuery,
  SaveProductPayload,
  SoldOutPayload,
} from '@/contracts/catalog.contract'
import { buildListResponse, normalizePagination } from '@/shared/pagination'
import { PrismaService } from '@/shared/prisma/prisma.service'
import { DEFAULT_STORE_ID } from '@/shared/store-context'

import { mapCategory, mapProduct } from './catalog.mapper'

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories() {
    const categories = await this.prisma.category.findMany({
      where: {
        storeId: DEFAULT_STORE_ID,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    })

    return buildListResponse(categories.map(mapCategory), categories.length)
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
        },
        orderBy: {
          updatedAt: 'desc',
        },
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
        availability: {
          create: availability,
        },
      },
      include: {
        availability: true,
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
      },
    })

    return {
      data: mapProduct(updated),
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
}
