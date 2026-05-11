import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'

import {
  channelAvailabilitySchema,
  listProductsQuerySchema,
  saveProductSchema,
  soldOutSchema,
  type ChannelAvailabilityPayload,
  type ListProductsQuery,
  type SaveProductPayload,
  type SoldOutPayload,
} from '@/contracts/catalog.contract'
import { Permissions } from '@/modules/auth/decorators/permissions.decorator'
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

  @Get('products')
  @Permissions('catalog:products:view')
  listProducts(@Query(new ZodValidationPipe(listProductsQuerySchema)) query: ListProductsQuery) {
    return this.catalogService.listProducts(query)
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
}
