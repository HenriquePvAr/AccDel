import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'

import {
  createCustomerSchema,
  listCustomersQuerySchema,
  updateCustomerSchema,
  type CreateCustomerPayload,
  type ListCustomersQuery,
  type UpdateCustomerPayload,
} from '@/contracts/customers.contract'
import { Permissions } from '@/modules/auth/decorators/permissions.decorator'
import { ZodValidationPipe } from '@/shared/pipes/zod-validation.pipe'

import { CustomersService } from './customers.service'

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Permissions('orders:create')
  listCustomers(@Query(new ZodValidationPipe(listCustomersQuerySchema)) query: ListCustomersQuery) {
    return this.customersService.listCustomers(query)
  }

  @Get('search')
  @Permissions('orders:create')
  searchCustomers(@Query(new ZodValidationPipe(listCustomersQuerySchema)) query: ListCustomersQuery) {
    return this.customersService.listCustomers(query)
  }

  @Get(':id')
  @Permissions('orders:create')
  getCustomer(@Param('id') id: string) {
    return this.customersService.getCustomer(id)
  }

  @Post()
  @Permissions('orders:create')
  createCustomer(@Body(new ZodValidationPipe(createCustomerSchema)) body: CreateCustomerPayload) {
    return this.customersService.createCustomer(body)
  }

  @Patch(':id')
  @Permissions('orders:create')
  updateCustomer(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCustomerSchema)) body: UpdateCustomerPayload,
  ) {
    return this.customersService.updateCustomer(id, body)
  }
}
