import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma, ProductChannel } from '@prisma/client'

import type {
  ApplyOptionGroupToCategoryPayload,
  CatalogMenuSourceQuery,
  CategorySoldOutPayload,
  ChannelAvailabilityPayload,
  ListCommercialQuery,
  ListProductsQuery,
  OptionAvailabilityPayload,
  ProductOptionGroupLinkPayload,
  ReorderCategoryPayload,
  SaveCategoryPayload,
  SaveCouponPayload,
  SaveOptionGroupPayload,
  SaveProductPayload,
  SavePromotionPayload,
  SoldOutPayload,
  ValidateCouponPayload,
} from '@/contracts/catalog.contract'
import { buildListResponse, normalizePagination } from '@/shared/pagination'
import { PrismaService } from '@/shared/prisma/prisma.service'
import { AdminRealtimeService } from '@/shared/realtime/admin-realtime.service'
import { getCurrentStoreId } from '@/shared/store-context'

import { mapCategory, mapCoupon, mapOptionGroup, mapProduct, mapPromotion } from './catalog.mapper'

const catalogChannels = ['dine_in', 'delivery', 'digital_menu', 'counter'] as const

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: AdminRealtimeService,
  ) {}

  async listCategories() {
    const categories = await this.prisma.category.findMany({
      where: {
        storeId: getCurrentStoreId(),
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
        storeId: getCurrentStoreId(),
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
      storeId: getCurrentStoreId(),
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

  async getMenuSource(query: CatalogMenuSourceQuery) {
    const channel = query.channel
    const includeUnavailable = Boolean(query.includeUnavailable)
    const now = new Date()
    const [store, categories, promotions, coupons, optionGroups, paymentMethods, deliveryZones] =
      await Promise.all([
      this.prisma.store.findUniqueOrThrow({
        where: { id: getCurrentStoreId() },
        select: {
          id: true,
          name: true,
          tradeName: true,
          logoUrl: true,
          phone: true,
          publicWhatsapp: true,
          addressLine: true,
          city: true,
          state: true,
          neighborhood: true,
          timezone: true,
          businessHours: true,
          businessDays: true,
          greetingMessage: true,
          outOfHoursMessage: true,
          cancellationPolicy: true,
          generalNotes: true,
          defaultDeliveryFee: true,
          minimumOrderAmount: true,
          deliveryEnabled: true,
          pickupEnabled: true,
          counterEnabled: true,
          dineInEnabled: true,
          digitalMenuEnabled: true,
          whatsappAiEnabled: true,
          estimatedPrepTimeMinutes: true,
          estimatedDeliveryTimeMinutes: true,
          estimatedDineInTimeMinutes: true,
          estimatedCounterTimeMinutes: true,
          estimatedPickupTimeMinutes: true,
        },
      }),
      this.prisma.category.findMany({
        where: { storeId: getCurrentStoreId() },
        include: {
          optionGroupLinks: {
            include: {
              group: {
                include: {
                  options: {
                    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
                  },
                },
              },
            },
            orderBy: [{ sortOrder: 'asc' }],
          },
          products: {
            include: {
              availability: true,
              optionGroups: {
                include: {
                  group: {
                    include: {
                      options: {
                        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
                      },
                    },
                  },
                },
                orderBy: [{ sortOrder: 'asc' }],
              },
            },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.promotion.findMany({
        where: { storeId: getCurrentStoreId(), status: 'active' },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.coupon.findMany({
        where: { storeId: getCurrentStoreId(), status: 'active' },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.productOptionGroup.findMany({
        where: { storeId: getCurrentStoreId() },
        include: {
          options: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
          categoryLinks: true,
          productLinks: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.paymentMethodConfig.findMany({
        where: {
          storeId: getCurrentStoreId(),
          active: true,
          channels: {
            has: 'digital_menu',
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.deliveryZone.findMany({
        where: {
          storeId: getCurrentStoreId(),
        },
        orderBy: [{ sortOrder: 'asc' }, { neighborhood: 'asc' }],
      }),
    ])

    const mappedCategories = categories
      .map((category) => {
        const categoryVisible = this.isCategoryVisibleForChannel(category, channel)
        const products = category.products
          .map((product) => {
            const availability = product.availability.find((entry) => entry.channel === channel)
            const orderable = this.isProductOrderable(categoryVisible, product.active, availability)
            const price = availability?.priceOverride ?? product.price
            const optionGroupsForProduct = product.optionGroups
              .slice()
              .sort((left, right) => left.sortOrder - right.sortOrder)
              .map((link) => ({
                id: link.group.id,
                name: link.group.name,
                description: link.description ?? link.group.description ?? undefined,
                required: link.required,
                minSelections: link.minSelections,
                maxSelections: link.maxSelections,
                sortOrder: link.sortOrder,
                autoApplied: link.autoApplied,
                options: link.group.options
                  .map((option) => ({
                    id: option.id,
                    name: option.name,
                    description: option.description ?? undefined,
                    image: option.image ?? undefined,
                    priceDelta: Number(option.priceDelta),
                    active: option.active,
                    available: option.available,
                    soldOut: option.soldOut,
                    sortOrder: option.sortOrder,
                    orderable: this.isOptionOrderable(option),
                  }))
                  .filter((option) => includeUnavailable || option.orderable),
              }))
              .filter((group) => includeUnavailable || group.options.length > 0)

            return {
              id: product.id,
              categoryId: product.categoryId,
              name: product.name,
              description: product.description,
              price: Number(price),
              basePrice: Number(product.price),
              image: product.image,
              featured: product.featured,
              active: product.active,
              preparationStation: product.preparationStation,
              sortOrder: product.sortOrder,
              tags: product.tags,
              channelAvailability: availability
                ? {
                    channel: availability.channel,
                    available: availability.available,
                    visible: availability.visible,
                    soldOut: availability.soldOut,
                    priceOverride: availability.priceOverride
                      ? Number(availability.priceOverride)
                      : undefined,
                  }
                : null,
              orderable,
              unavailableReason: this.productUnavailableReason(categoryVisible, product.active, availability),
              optionGroups: optionGroupsForProduct,
            }
          })
          .filter((product) => includeUnavailable || product.orderable)

        return {
          id: category.id,
          name: category.name,
          description: category.description,
          active: category.active,
          icon: category.icon ?? undefined,
          color: category.color ?? undefined,
          visibleOnPos: category.visibleOnPos,
          visibleOnDigitalMenu: category.visibleOnDigitalMenu,
          sortOrder: category.sortOrder,
          visibleForChannel: categoryVisible,
          products,
          optionGroupLinks: category.optionGroupLinks.map((link) => ({
            groupId: link.groupId,
            groupName: link.group.name,
            required: link.required,
            minSelections: link.minSelections,
            maxSelections: link.maxSelections,
            sortOrder: link.sortOrder,
            description: link.description ?? undefined,
            autoApply: link.autoApply,
            options: link.group.options.map((option) => ({
              id: option.id,
              name: option.name,
              description: option.description ?? undefined,
              image: option.image ?? undefined,
              priceDelta: Number(option.priceDelta),
              active: option.active,
              available: option.available,
              soldOut: option.soldOut,
              sortOrder: option.sortOrder,
              orderable: this.isOptionOrderable(option),
            })),
          })),
        }
      })
      .filter((category) => includeUnavailable || (category.visibleForChannel && category.products.length > 0))

    const sellableProductIds = new Set(
      mappedCategories.flatMap((category) =>
        category.products.filter((product) => product.orderable).map((product) => product.id),
      ),
    )
    const sellableCategoryIds = new Set(
      mappedCategories
        .filter((category) => category.visibleForChannel)
        .map((category) => category.id),
    )

    return {
      data: {
        store,
        channel,
        includeUnavailable,
        generatedAt: now.toISOString(),
        categories: mappedCategories,
        promotions: promotions
          .filter((promotion) => this.isPromotionActiveForChannel(promotion, channel, now))
          .map((promotion) => ({
            ...mapPromotion(promotion),
            productIds: promotion.productIds.filter((productId) => sellableProductIds.has(productId)),
            categoryIds: promotion.categoryIds.filter((categoryId) => sellableCategoryIds.has(categoryId)),
          })),
        coupons: coupons
          .filter((coupon) => this.isCouponActiveForChannel(coupon, channel, now))
          .map(mapCoupon),
        optionGroups: optionGroups.map(mapOptionGroup),
        checkout: {
          channels: {
            deliveryEnabled: store.deliveryEnabled,
            pickupEnabled: store.pickupEnabled,
            digitalMenuEnabled: store.digitalMenuEnabled,
            minimumOrderAmount: Number(store.minimumOrderAmount),
          },
          paymentMethods: paymentMethods.map((method) => this.mapPublicPaymentMethod(method)),
          delivery: {
            defaultFee: Number(store.defaultDeliveryFee),
            requiresKnownNeighborhood: deliveryZones.some((zone) => zone.active),
            neighborhoods: deliveryZones
              .filter((zone) => zone.active)
              .map((zone) => ({
                id: zone.id,
                neighborhood: zone.neighborhood,
                fee: Number(zone.fee),
                active: zone.active,
                estimatedDeliveryTimeMinutes:
                  zone.estimatedDeliveryTimeMinutes ?? store.estimatedDeliveryTimeMinutes,
              })),
          },
        },
      },
    }
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
    const autoAppliedOptionGroups = await this.getAutoAppliedOptionGroupData(product.categoryId)
    const created = await this.prisma.product.create({
      data: {
        id: product.id,
        storeId: getCurrentStoreId(),
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
        ...(autoAppliedOptionGroups.length
          ? {
              optionGroups: {
                create: autoAppliedOptionGroups,
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

    this.realtime.emit('catalog.product_updated', { productId: created.id })
    return {
      data: mapProduct(created),
    }
  }

  async updateProduct(productId: string, payload: SaveProductPayload) {
    const product = payload.product
    const autoAppliedOptionGroups = await this.getAutoAppliedOptionGroupData(product.categoryId)
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
        ...(autoAppliedOptionGroups.length
          ? {
              optionGroups: {
                createMany: {
                  data: autoAppliedOptionGroups,
                  skipDuplicates: true,
                },
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

    this.realtime.emit('catalog.product_updated', { productId: updated.id })
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

    this.realtime.emit('catalog.product_updated', { productId: updated.id })
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

    this.realtime.emit('catalog.product_updated', { productId: updated.id })
    return {
      data: mapProduct(updated),
    }
  }

  async listOptionGroups() {
    const groups = await this.prisma.productOptionGroup.findMany({
      where: { storeId: getCurrentStoreId() },
      include: {
        options: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
        categoryLinks: true,
        productLinks: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })

    return buildListResponse(groups.map(mapOptionGroup), groups.length)
  }

  async saveOptionGroup(payload: SaveOptionGroupPayload) {
    const saved = await this.prisma.$transaction(async (tx) => {
      const group = payload.group.id
        ? await tx.productOptionGroup.upsert({
            where: { id: payload.group.id },
            update: {
              name: payload.group.name,
              description: payload.group.description ?? null,
              sortOrder: payload.group.sortOrder,
            },
            create: {
              id: payload.group.id,
              storeId: getCurrentStoreId(),
              name: payload.group.name,
              description: payload.group.description ?? null,
              sortOrder: payload.group.sortOrder,
            },
          })
        : await tx.productOptionGroup.create({
            data: {
              storeId: getCurrentStoreId(),
              name: payload.group.name,
              description: payload.group.description ?? null,
              sortOrder: payload.group.sortOrder,
            },
          })

      for (const option of payload.group.options) {
        if (option.id) {
          await tx.productOption.upsert({
            where: { id: option.id },
            update: {
              name: option.name,
              description: option.description ?? null,
              image: option.image ?? null,
              priceDelta: option.priceDelta,
              active: option.active,
              available: option.available,
              soldOut: option.soldOut,
              sortOrder: option.sortOrder,
            },
            create: {
              id: option.id,
              groupId: group.id,
              name: option.name,
              description: option.description ?? null,
              image: option.image ?? null,
              priceDelta: option.priceDelta,
              active: option.active,
              available: option.available,
              soldOut: option.soldOut,
              sortOrder: option.sortOrder,
            },
          })
        } else {
          await tx.productOption.create({
            data: {
              groupId: group.id,
              name: option.name,
              description: option.description ?? null,
              image: option.image ?? null,
              priceDelta: option.priceDelta,
              active: option.active,
              available: option.available,
              soldOut: option.soldOut,
              sortOrder: option.sortOrder,
            },
          })
        }
      }

      return tx.productOptionGroup.findUniqueOrThrow({
        where: { id: group.id },
        include: {
          options: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
          categoryLinks: true,
          productLinks: true,
        },
      })
    })

    return { data: mapOptionGroup(saved) }
  }

  async updateOptionAvailability(optionId: string, payload: OptionAvailabilityPayload) {
    const data: Prisma.ProductOptionUpdateInput = {
      active: payload.active,
      available:
        payload.available ??
        (payload.soldOut === true ? false : payload.soldOut === false ? true : undefined),
      soldOut: payload.soldOut,
    }
    const option = await this.prisma.productOption.update({
      where: { id: optionId },
      data,
      include: {
        group: {
          include: {
            options: true,
            categoryLinks: true,
            productLinks: true,
          },
        },
      },
    })

    this.realtime.emit('catalog.product_updated', { productId: '*' })
    return { data: mapOptionGroup(option.group) }
  }

  async applyOptionGroupToCategory(
    groupId: string,
    payload: ApplyOptionGroupToCategoryPayload,
  ) {
    const [category, group] = await Promise.all([
      this.prisma.category.findFirst({
        where: { id: payload.categoryId, storeId: getCurrentStoreId() },
      }),
      this.prisma.productOptionGroup.findFirst({
        where: { id: groupId, storeId: getCurrentStoreId() },
      }),
    ])

    if (!category) {
      throw new NotFoundException('Categoria nao encontrada.')
    }

    if (!group) {
      throw new NotFoundException('Grupo de opcoes nao encontrado.')
    }

    const products = await this.prisma.product.findMany({
      where: { storeId: getCurrentStoreId(), categoryId: category.id },
      select: { id: true },
    })

    await this.prisma.$transaction([
      this.prisma.productOptionGroupCategoryLink.upsert({
        where: {
          categoryId_groupId: {
            categoryId: category.id,
            groupId,
          },
        },
        update: {
          required: payload.required,
          minSelections: payload.minSelections,
          maxSelections: payload.maxSelections,
          sortOrder: payload.sortOrder,
          description: payload.description ?? null,
          autoApply: true,
        },
        create: {
          categoryId: category.id,
          groupId,
          required: payload.required,
          minSelections: payload.minSelections,
          maxSelections: payload.maxSelections,
          sortOrder: payload.sortOrder,
          description: payload.description ?? null,
          autoApply: true,
        },
      }),
      this.prisma.productOptionGroupLink.createMany({
        data: products.map((product) => ({
          productId: product.id,
          groupId,
          required: payload.required,
          minSelections: payload.minSelections,
          maxSelections: payload.maxSelections,
          sortOrder: payload.sortOrder,
          description: payload.description ?? null,
          autoApplied: true,
        })),
        skipDuplicates: true,
      }),
    ])

    return {
      data: {
        categoryId: category.id,
        groupId,
        affectedProducts: products.length,
      },
    }
  }

  async updateProductOptionGroupLink(
    productId: string,
    groupId: string,
    payload: ProductOptionGroupLinkPayload,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId: getCurrentStoreId() },
      select: { id: true },
    })
    const group = await this.prisma.productOptionGroup.findFirst({
      where: { id: groupId, storeId: getCurrentStoreId() },
      select: { id: true },
    })

    if (!product) {
      throw new NotFoundException('Produto nao encontrado.')
    }

    if (!group) {
      throw new NotFoundException('Grupo de opcoes nao encontrado.')
    }

    if (!payload.enabled) {
      await this.prisma.productOptionGroupLink.deleteMany({
        where: { productId, groupId },
      })
      return { data: mapProduct(await this.getProductOrThrow(productId)) }
    }

    if (payload.minSelections > payload.maxSelections) {
      throw new BadRequestException('Minimo de opcoes nao pode ser maior que o maximo.')
    }

    await this.prisma.productOptionGroupLink.upsert({
      where: {
        productId_groupId: {
          productId,
          groupId,
        },
      },
      update: {
        required: payload.required,
        minSelections: payload.minSelections,
        maxSelections: payload.maxSelections,
        sortOrder: payload.sortOrder,
        description: payload.description ?? null,
        autoApplied: false,
      },
      create: {
        productId,
        groupId,
        required: payload.required,
        minSelections: payload.minSelections,
        maxSelections: payload.maxSelections,
        sortOrder: payload.sortOrder,
        description: payload.description ?? null,
        autoApplied: false,
      },
    })

    return { data: mapProduct(await this.getProductOrThrow(productId)) }
  }

  async toggleCategorySoldOut(categoryId: string, payload: CategorySoldOutPayload) {
    const category = await this.prisma.category.findFirstOrThrow({
      where: {
        id: categoryId,
        storeId: getCurrentStoreId(),
      },
    })
    const products = await this.prisma.product.findMany({
      where: {
        categoryId: category.id,
        storeId: getCurrentStoreId(),
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
      storeId: getCurrentStoreId(),
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
        storeId: getCurrentStoreId(),
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
      storeId: getCurrentStoreId(),
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
        storeId: getCurrentStoreId(),
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
        storeId: getCurrentStoreId(),
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
    return catalogChannels.map((channel) => ({
      channel,
      available: true,
      visible: true,
      soldOut: false,
    }))
  }

  private getProductOrThrow(productId: string) {
    return this.prisma.product.findFirstOrThrow({
      where: { id: productId, storeId: getCurrentStoreId() },
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
  }

  private async getAutoAppliedOptionGroupData(categoryId: string) {
    const links = await this.prisma.productOptionGroupCategoryLink.findMany({
      where: {
        categoryId,
        autoApply: true,
      },
      orderBy: [{ sortOrder: 'asc' }],
    })

    return links.map((link) => ({
      groupId: link.groupId,
      required: link.required,
      minSelections: link.minSelections,
      maxSelections: link.maxSelections,
      sortOrder: link.sortOrder,
      description: link.description,
      autoApplied: true,
    }))
  }

  private isCategoryVisibleForChannel(
    category: {
      active: boolean
      visibleOnDigitalMenu: boolean
      visibleOnPos: boolean
    },
    channel: ProductChannel,
  ) {
    if (!category.active) {
      return false
    }

    if (channel === 'digital_menu') {
      return category.visibleOnDigitalMenu
    }

    return category.visibleOnPos
  }

  private isProductOrderable(
    categoryVisible: boolean,
    active: boolean,
    availability:
      | {
          visible: boolean
          available: boolean
          soldOut: boolean
        }
      | undefined,
  ) {
    return Boolean(
      categoryVisible &&
        active &&
        availability?.visible &&
        availability.available &&
        !availability.soldOut,
    )
  }

  private productUnavailableReason(
    categoryVisible: boolean,
    active: boolean,
    availability:
      | {
          visible: boolean
          available: boolean
          soldOut: boolean
        }
      | undefined,
  ) {
    if (!categoryVisible) {
      return 'Categoria indisponivel neste canal.'
    }

    if (!active) {
      return 'Produto inativo.'
    }

    if (!availability?.visible) {
      return 'Produto oculto neste canal.'
    }

    if (availability.soldOut) {
      return 'Produto esgotado neste canal.'
    }

    if (!availability.available) {
      return 'Produto indisponivel neste canal.'
    }

    return null
  }

  private isOptionOrderable(option: {
    active: boolean
    available: boolean
    soldOut: boolean
  }) {
    return option.active && option.available && !option.soldOut
  }

  private isPromotionActiveForChannel(
    promotion: {
      startsAt: Date | null
      endsAt: Date | null
      channels: ProductChannel[]
    },
    channel: ProductChannel,
    now: Date,
  ) {
    const channelAllowed = promotion.channels.length === 0 || promotion.channels.includes(channel)
    const dateAllowed = (!promotion.startsAt || promotion.startsAt <= now) && (!promotion.endsAt || promotion.endsAt >= now)

    return channelAllowed && dateAllowed
  }

  private isCouponActiveForChannel(
    coupon: {
      validFrom: Date | null
      validUntil: Date | null
      channels: ProductChannel[]
    },
    channel: ProductChannel,
    now: Date,
  ) {
    const channelAllowed = coupon.channels.length === 0 || coupon.channels.includes(channel)
    const dateAllowed = (!coupon.validFrom || coupon.validFrom <= now) && (!coupon.validUntil || coupon.validUntil >= now)

    return channelAllowed && dateAllowed
  }

  private mapPublicPaymentMethod(method: {
    id: string
    name: string
    method: string | null
    provider: string
    requiresReceipt: boolean
    externalEnabled: boolean
  }) {
    const unavailableReason = this.getPaymentUnavailableReason(method)

    return {
      id: method.id,
      name: method.name,
      method: method.method ?? undefined,
      provider: method.provider,
      requiresReceipt: method.requiresReceipt,
      availableForCheckout: !unavailableReason,
      unavailableReason,
    }
  }

  private getPaymentUnavailableReason(method: {
    method: string | null
    provider: string
    externalEnabled: boolean
  }) {
    if (!method.method) {
      return 'Forma de pagamento sem metodo operacional vinculado.'
    }

    if (method.provider === 'picpay' && !method.externalEnabled) {
      return 'PicPay ainda nao esta configurado para checkout real.'
    }

    return null
  }

  private parseDate(value?: string | null) {
    if (!value) {
      return null
    }

    return new Date(value)
  }
}
