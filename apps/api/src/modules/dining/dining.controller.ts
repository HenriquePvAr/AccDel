import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common'

import {
  addTableSessionItemSchema,
  closeTableSessionSchema,
  openTableSessionSchema,
  saveDiningTableSchema,
  splitTableSessionSchema,
  transferTableSessionSchema,
  updateDiningTableStatusSchema,
  updateTableSessionSchema,
  type AddTableSessionItemPayload,
  type CloseTableSessionPayload,
  type OpenTableSessionPayload,
  type SaveDiningTablePayload,
  type SplitTableSessionPayload,
  type TransferTableSessionPayload,
  type UpdateDiningTableStatusPayload,
  type UpdateTableSessionPayload,
} from '@/contracts/dining.contract'
import { Permissions } from '@/modules/auth/decorators/permissions.decorator'
import { ZodValidationPipe } from '@/shared/pipes/zod-validation.pipe'

import { DiningService } from './dining.service'

@Controller('dining')
export class DiningController {
  constructor(private readonly diningService: DiningService) {}

  @Get('areas')
  @Permissions('dining:view')
  listAreas() {
    return this.diningService.listAreas()
  }

  @Get('tables')
  @Permissions('dining:view')
  listTables() {
    return this.diningService.listTables()
  }

  @Get('tables/:id')
  @Permissions('dining:view')
  getTableById(@Param('id') id: string) {
    return this.diningService.getTableById(id)
  }

  @Post('tables')
  @Permissions('dining:update')
  createTable(
    @Body(new ZodValidationPipe(saveDiningTableSchema))
    body: SaveDiningTablePayload,
  ) {
    return this.diningService.createTable(body)
  }

  @Patch('tables/:id')
  @Permissions('dining:update')
  updateTable(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(saveDiningTableSchema))
    body: SaveDiningTablePayload,
  ) {
    return this.diningService.updateTable(id, body)
  }

  @Patch('tables/:id/status')
  @Permissions('dining:update')
  updateTableStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateDiningTableStatusSchema))
    body: UpdateDiningTableStatusPayload,
  ) {
    return this.diningService.updateTableStatus(id, body)
  }

  @Post('tables/:id/open-session')
  @Permissions('dining:update')
  openSession(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(openTableSessionSchema))
    body: OpenTableSessionPayload,
  ) {
    return this.diningService.openSession(id, body)
  }

  @Patch('sessions/:id')
  @Permissions('dining:update')
  updateSession(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTableSessionSchema))
    body: UpdateTableSessionPayload,
  ) {
    return this.diningService.updateSession(id, body)
  }

  @Post('sessions/:id/add-item')
  @Permissions('dining:update')
  addItem(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(addTableSessionItemSchema))
    body: AddTableSessionItemPayload,
  ) {
    return this.diningService.addItem(id, body)
  }

  @Post('sessions/:id/close')
  @Permissions('dining:update')
  closeSession(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(closeTableSessionSchema))
    body: CloseTableSessionPayload,
  ) {
    return this.diningService.closeSession(id, body)
  }

  @Post('sessions/:id/transfer')
  @Permissions('dining:update')
  transferSession(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(transferTableSessionSchema))
    body: TransferTableSessionPayload,
  ) {
    return this.diningService.transferSession(id, body)
  }

  @Post('sessions/:id/split')
  @Permissions('dining:update')
  splitSession(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(splitTableSessionSchema))
    body: SplitTableSessionPayload,
  ) {
    return this.diningService.splitSession(id, body)
  }
}
