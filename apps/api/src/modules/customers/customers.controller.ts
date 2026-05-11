import { Controller, Get } from '@nestjs/common'

import { Permissions } from '@/modules/auth/decorators/permissions.decorator'

import { CustomersService } from './customers.service'

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Permissions('orders:create')
  listCustomers() {
    return this.customersService.listCustomers()
  }
}
