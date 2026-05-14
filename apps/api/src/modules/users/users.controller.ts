import { Controller, Get } from '@nestjs/common'

import { Permissions } from '@/modules/auth/decorators/permissions.decorator'

import { UsersService } from './users.service'

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions('users:view')
  listUsers() {
    return this.usersService.listUsers()
  }
}
