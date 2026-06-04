import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'

import {
  applyOptionGroupToCategorySchema,
  catalogMenuSourceQuerySchema,
  categorySoldOutSchema,
  channelAvailabilitySchema,
  listCommercialQuerySchema,
  listProductsQuerySchema,
  optionAvailabilitySchema,
  productOptionGroupLinkSchema,
  reorderCategorySchema,
  saveCategorySchema,
  saveCouponSchema,
  saveOptionGroupSchema,
  saveProductSchema,
  savePromotionSchema,
  soldOutSchema,
  validateCouponSchema,
  type ApplyOptionGroupToCategoryPayload,
  type CatalogMenuSourceQuery,
  type CategorySoldOutPayload,
  type ChannelAvailabilityPayload,
  type ListCommercialQuery,
  type ListProductsQuery,
  type OptionAvailabilityPayload,
  type ProductOptionGroupLinkPayload,
  type ReorderCategoryPayload,
  type SaveCategoryPayload,
  type SaveCouponPayload,
  type SaveOptionGroupPayload,
  type SaveProductPayload,
  type SavePromotionPayload,
  type SoldOutPayload,
  type ValidateCouponPayload,
} from '@/contracts/catalog.contract'
import { Permissions } from '@/modules/auth/decorators/permissions.decorator'
import { Public } from '@/modules/auth/decorators/public.decorator'
import { ZodValidationPipe } from '@/shared/pipes/zod-validation.pipe'

import { CatalogService } from './catalog.service'

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('categories')
  @Permissions('catalog:categories:view')
  listCategories() {
    return this.catalogService.listCategories()
  }

  @Post('categories')
  @Permissions('catalog:categories:manage')
  createCategory(@Body(new ZodValidationPipe(saveCategorySchema)) body: SaveCategoryPayload) {
    return this.catalogService.createCategory(body)
  }

  @Patch('categories/:id')
  @Permissions('catalog:categories:manage')
  updateCategory(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(saveCategorySchema)) body: SaveCategoryPayload,
  ) {
    return this.catalogService.updateCategory(id, body)
  }

  @Patch('categories/:id/reorder')
  @Permissions('catalog:categories:manage')
  reorderCategory(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(reorderCategorySchema)) body: ReorderCategoryPayload,
  ) {
    return this.catalogService.reorderCategory(id, body)
  }

  @Delete('categories/:id')
  @Permissions('catalog:categories:manage')
  deleteCategory(@Param('id') id: string) {
    return this.catalogService.deleteCategory(id)
  }

  @Patch('categories/:id/sold-out')
  @Permissions('catalog:categories:manage')
  toggleCategorySoldOut(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(categorySoldOutSchema)) body: CategorySoldOutPayload,
  ) {
    return this.catalogService.toggleCategorySoldOut(id, body)
  }

  @Get('products')
  @Permissions('catalog:products:view')
  listProducts(@Query(new ZodValidationPipe(listProductsQuerySchema)) query: ListProductsQuery) {
    return this.catalogService.listProducts(query)
  }

  @Get('menu-source')
  @Permissions('catalog:products:view')
  getMenuSource(
    @Query(new ZodValidationPipe(catalogMenuSourceQuerySchema)) query: CatalogMenuSourceQuery,
  ) {
    return this.catalogService.getMenuSource(query)
  }

  @Get('public-menu')
  @Public()
  getPublicMenuSource(
    @Query(new ZodValidationPipe(catalogMenuSourceQuerySchema)) query: CatalogMenuSourceQuery,
  ) {
    return this.catalogService.getMenuSource({
      ...query,
      channel: 'digital_menu',
    })
  }

  @Post('products')
  @Permissions('catalog:products:manage')
  createProduct(@Body(new ZodValidationPipe(saveProductSchema)) body: SaveProductPayload) {
    return this.catalogService.createProduct(body)
  }

  @Patch('products/:id')
  @Permissions('catalog:products:manage')
  updateProduct(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(saveProductSchema)) body: SaveProductPayload,
  ) {
    return this.catalogService.updateProduct(id, body)
  }

  @Patch('products/:id/sold-out')
  @Permissions('catalog:products:manage')
  toggleSoldOut(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(soldOutSchema)) body: SoldOutPayload,
  ) {
    return this.catalogService.toggleSoldOut(id, body)
  }

  @Patch('products/:id/channels')
  @Permissions('catalog:products:manage')
  updateChannel(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(channelAvailabilitySchema)) body: ChannelAvailabilityPayload,
  ) {
    return this.catalogService.updateChannel(id, body)
  }

  @Patch('products/:productId/option-groups/:groupId')
  @Permissions('catalog:products:manage')
  updateProductOptionGroupLink(
    @Param('productId') productId: string,
    @Param('groupId') groupId: string,
    @Body(new ZodValidationPipe(productOptionGroupLinkSchema))
    body: ProductOptionGroupLinkPayload,
  ) {
    return this.catalogService.updateProductOptionGroupLink(productId, groupId, body)
  }

  @Get('option-groups')
  @Permissions('catalog:products:view')
  listOptionGroups() {
    return this.catalogService.listOptionGroups()
  }

  @Post('option-groups')
  @Permissions('catalog:products:manage')
  createOptionGroup(
    @Body(new ZodValidationPipe(saveOptionGroupSchema)) body: SaveOptionGroupPayload,
  ) {
    return this.catalogService.saveOptionGroup(body)
  }

  @Patch('option-groups/:id')
  @Permissions('catalog:products:manage')
  updateOptionGroup(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(saveOptionGroupSchema)) body: SaveOptionGroupPayload,
  ) {
    return this.catalogService.saveOptionGroup({
      group: {
        ...body.group,
        id,
      },
    })
  }

  @Post('option-groups/:id/apply-category')
  @Permissions('catalog:products:manage')
  applyOptionGroupToCategory(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(applyOptionGroupToCategorySchema))
    body: ApplyOptionGroupToCategoryPayload,
  ) {
    return this.catalogService.applyOptionGroupToCategory(id, body)
  }

  @Patch('options/:id/availability')
  @Permissions('catalog:products:manage')
  updateOptionAvailability(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(optionAvailabilitySchema)) body: OptionAvailabilityPayload,
  ) {
    return this.catalogService.updateOptionAvailability(id, body)
  }

  @Get('promotions')
  @Permissions('catalog:promotions:view')
  listPromotions(
    @Query(new ZodValidationPipe(listCommercialQuerySchema)) query: ListCommercialQuery,
  ) {
    return this.catalogService.listPromotions(query)
  }

  @Post('promotions')
  @Permissions('catalog:promotions:manage')
  createPromotion(@Body(new ZodValidationPipe(savePromotionSchema)) body: SavePromotionPayload) {
    return this.catalogService.createPromotion(body)
  }

  @Patch('promotions/:id')
  @Permissions('catalog:promotions:manage')
  updatePromotion(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(savePromotionSchema)) body: SavePromotionPayload,
  ) {
    return this.catalogService.updatePromotion(id, body)
  }

  @Delete('promotions/:id')
  @Permissions('catalog:promotions:manage')
  deletePromotion(@Param('id') id: string) {
    return this.catalogService.deletePromotion(id)
  }

  @Get('coupons')
  @Permissions('catalog:coupons:view')
  listCoupons(@Query(new ZodValidationPipe(listCommercialQuerySchema)) query: ListCommercialQuery) {
    return this.catalogService.listCoupons(query)
  }

  @Post('coupons')
  @Permissions('catalog:coupons:manage')
  createCoupon(@Body(new ZodValidationPipe(saveCouponSchema)) body: SaveCouponPayload) {
    return this.catalogService.createCoupon(body)
  }

  @Patch('coupons/:id')
  @Permissions('catalog:coupons:manage')
  updateCoupon(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(saveCouponSchema)) body: SaveCouponPayload,
  ) {
    return this.catalogService.updateCoupon(id, body)
  }

  @Post('coupons/validate')
  @Permissions('catalog:coupons:view')
  validateCoupon(@Body(new ZodValidationPipe(validateCouponSchema)) body: ValidateCouponPayload) {
    return this.catalogService.validateCoupon(body)
  }

  @Delete('coupons/:id')
  @Permissions('catalog:coupons:manage')
  deleteCoupon(@Param('id') id: string) {
    return this.catalogService.deleteCoupon(id)
  }
}
