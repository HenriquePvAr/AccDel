import type {
  CatalogMenuSourceFilters,
  CatalogMenuSourceResponse,
  ListCategoriesResponse,
  ListCouponsResponse,
  ListProductsResponse,
  ListPromotionsResponse,
  ProductsListFilters,
  UpdateProductChannelAvailabilityRequest,
} from '@/contracts'
import { buildListResponse } from '@/services/adapters/list-response'
import type { CatalogOptionGroup, Category, Coupon, Product, Promotion, StoreProfile } from '@/types'

export function buildProductsResponse(
  products: Product[],
  filters?: ProductsListFilters,
): ListProductsResponse {
  const search = filters?.search?.trim().toLowerCase()
  const rows = products.filter((product) => {
    const matchesSearch =
      !search ||
      `${product.name} ${product.description} ${product.tags.join(' ')}`.toLowerCase().includes(search)
    const matchesCategory =
      !filters?.categoryId ||
      filters.categoryId === 'all' ||
      product.categoryId === filters.categoryId
    const matchesStatus =
      !filters?.status ||
      filters.status === 'all' ||
      (filters.status === 'active' ? product.active : !product.active)
    const matchesChannel =
      !filters?.channel ||
      filters.channel === 'all' ||
      product.availability.some(
        (entry) => entry.channel === filters.channel && entry.visible,
      )

    return matchesSearch && matchesCategory && matchesStatus && matchesChannel
  })

  return buildListResponse(rows, filters)
}

export function buildCategoriesResponse(categories: Category[]): ListCategoriesResponse {
  return buildListResponse(categories)
}

export function buildPromotionsResponse(promotions: Promotion[]): ListPromotionsResponse {
  return buildListResponse(promotions)
}

export function buildCouponsResponse(coupons: Coupon[]): ListCouponsResponse {
  return buildListResponse(coupons)
}

export function buildEmptyOptionGroupsResponse() {
  return buildListResponse<CatalogOptionGroup>([])
}

export function buildCatalogMenuSourceResponse(
  database: {
    store: StoreProfile
    catalog: {
      categories: Category[]
      products: Product[]
      promotions: Promotion[]
      coupons: Coupon[]
    }
  },
  filters: Omit<CatalogMenuSourceFilters, 'public'>,
): CatalogMenuSourceResponse {
  const now = new Date()
  const categories = database.catalog.categories
    .map((category) => {
      const visibleForChannel =
        category.active &&
        (filters.channel === 'digital_menu' ? category.visibleOnDigitalMenu : category.visibleOnPos)
      const products = database.catalog.products
        .filter((product) => product.categoryId === category.id)
        .map((product) => {
          const availability = product.availability.find((entry) => entry.channel === filters.channel) ?? null
          const orderable = Boolean(
            visibleForChannel &&
              product.active &&
              availability?.visible &&
              availability.available &&
              !availability.soldOut,
          )

          return {
            id: product.id,
            categoryId: product.categoryId,
            name: product.name,
            description: product.description,
            price: availability?.priceOverride ?? product.price,
            basePrice: product.price,
            image: product.image,
            featured: product.featured,
            active: product.active,
            preparationStation: product.preparationStation,
            sortOrder: product.sortOrder,
            tags: product.tags,
            channelAvailability: availability,
            orderable,
            unavailableReason: orderable ? null : buildUnavailableReason(visibleForChannel, product.active, availability),
            optionGroups: product.optionGroups ?? [],
          }
        })
        .filter((product) => filters.includeUnavailable || product.orderable)

      return {
        id: category.id,
        name: category.name,
        description: category.description,
        active: category.active,
        icon: category.icon,
        color: category.color,
        visibleOnPos: category.visibleOnPos,
        visibleOnDigitalMenu: category.visibleOnDigitalMenu,
        sortOrder: category.sortOrder,
        visibleForChannel,
        products,
        optionGroupLinks: [],
      }
    })
    .filter((category) => filters.includeUnavailable || (category.visibleForChannel && category.products.length > 0))

  return {
    data: {
      store: database.store,
      channel: filters.channel,
      includeUnavailable: Boolean(filters.includeUnavailable),
      generatedAt: now.toISOString(),
      categories,
      promotions: database.catalog.promotions.filter((promotion) =>
        promotion.status === 'active' &&
        (!promotion.channels.length || promotion.channels.includes(filters.channel)),
      ),
      coupons: database.catalog.coupons.filter((coupon) =>
        coupon.status === 'active' &&
        (!coupon.channels.length || coupon.channels.includes(filters.channel)),
      ),
      optionGroups: [],
      checkout: {
        channels: {
          deliveryEnabled: database.store.deliveryEnabled ?? true,
          pickupEnabled: database.store.pickupEnabled ?? true,
          digitalMenuEnabled: database.store.digitalMenuEnabled ?? true,
          minimumOrderAmount: database.store.minimumOrderAmount ?? 0,
        },
        paymentMethods: [
          {
            id: 'demo_pay_cash',
            name: 'Dinheiro',
            method: 'cash',
            provider: 'manual',
            requiresReceipt: false,
            availableForCheckout: true,
            unavailableReason: null,
          },
        ],
        delivery: {
          defaultFee: database.store.defaultDeliveryFee ?? 0,
          requiresKnownNeighborhood: false,
          neighborhoods: [],
        },
      },
    },
  }
}

export function applyChannelAvailabilityUpdate(
  product: Product,
  request: UpdateProductChannelAvailabilityRequest,
) {
  return {
    ...product,
    availability: product.availability.map((entry) =>
      entry.channel === request.channel
        ? {
            ...entry,
            available: request.available ?? entry.available,
            visible: request.visible ?? entry.visible,
            soldOut: request.soldOut ?? entry.soldOut,
          }
        : entry,
    ),
  }
}

function buildUnavailableReason(
  visibleForChannel: boolean,
  active: boolean,
  availability: Product['availability'][number] | null,
) {
  if (!visibleForChannel) {
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
