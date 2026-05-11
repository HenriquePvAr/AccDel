import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  MessageEvent,
  Param,
  Patch,
  Post,
  Sse,
} from '@nestjs/common'
import type { Observable } from 'rxjs'

import {
  previewDriverRouteSchema,
  saveDriverLocationSchema,
  saveDriverSchema,
  simulateDriverLocationSchema,
  updateDriverQueueSchema,
  updateDriverAvailabilitySchema,
  type PreviewDriverRoutePayload,
  type SaveDriverLocationPayload,
  type SaveDriverPayload,
  type SimulateDriverLocationPayload,
  type UpdateDriverQueuePayload,
  type UpdateDriverAvailabilityPayload,
} from '@/contracts/drivers.contract'
import { CurrentAuthUser } from '@/modules/auth/decorators/current-auth-user.decorator'
import { Permissions } from '@/modules/auth/decorators/permissions.decorator'
import type { AuthenticatedRequestUser } from '@/modules/auth/auth.types'
import { ZodValidationPipe } from '@/shared/pipes/zod-validation.pipe'

import { DriversService } from './drivers.service'

@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get()
  @Permissions('drivers:view')
  listDrivers() {
    return this.driversService.listDrivers()
  }

  @Get('locations/active')
  @Permissions('drivers:view')
  listActiveLocations() {
    return this.driversService.listActiveLocations()
  }

  @Sse('stream/live')
  @Permissions('drivers:view')
  streamOperationalFeed(): Observable<MessageEvent> {
    return this.driversService.streamOperationalFeed()
  }

  @Get('me/app-state')
  @Permissions('drivers:view')
  getMyDriverAppState(@CurrentAuthUser() authUser: AuthenticatedRequestUser) {
    return this.driversService.getDriverAppState(this.ensureDriverAccess(authUser))
  }

  @Get('me/tracking-policy')
  @Permissions('drivers:view')
  getMyTrackingPolicy(@CurrentAuthUser() authUser: AuthenticatedRequestUser) {
    return this.driversService.getDriverTrackingPolicy(this.ensureDriverAccess(authUser))
  }

  @Get('me/location')
  @Permissions('drivers:view')
  getMyLocation(@CurrentAuthUser() authUser: AuthenticatedRequestUser) {
    return this.driversService.getDriverLocation(this.ensureDriverAccess(authUser))
  }

  @Get('me/route')
  @Permissions('drivers:view')
  getMyRoute(@CurrentAuthUser() authUser: AuthenticatedRequestUser) {
    return this.driversService.getDriverRoute(this.ensureDriverAccess(authUser))
  }

  @Post('me/location')
  @Permissions('drivers:view')
  saveMyLocation(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Body(new ZodValidationPipe(saveDriverLocationSchema)) body: SaveDriverLocationPayload,
  ) {
    return this.driversService.saveDriverLocation(this.ensureDriverAccess(authUser), body)
  }

  @Patch('me/status')
  @Permissions('drivers:view')
  updateMyStatus(
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
    @Body(new ZodValidationPipe(updateDriverAvailabilitySchema))
    body: UpdateDriverAvailabilityPayload,
  ) {
    return this.driversService.updateOwnAvailability(
      this.ensureDriverAccess(authUser),
      body,
    )
  }

  @Post('me/delivery/start')
  @Permissions('drivers:view')
  startMyDelivery(@CurrentAuthUser() authUser: AuthenticatedRequestUser) {
    return this.driversService.startCurrentDelivery(this.ensureDriverAccess(authUser))
  }

  @Post('me/delivery/complete')
  @Permissions('drivers:view')
  completeMyDelivery(@CurrentAuthUser() authUser: AuthenticatedRequestUser) {
    return this.driversService.completeCurrentDelivery(this.ensureDriverAccess(authUser))
  }

  @Get(':id')
  @Permissions('drivers:view')
  getDriverById(@Param('id') id: string) {
    return this.driversService.getDriverById(id)
  }

  @Get(':id/tracking-policy')
  @Permissions('drivers:view')
  getDriverTrackingPolicy(@Param('id') id: string) {
    return this.driversService.getDriverTrackingPolicy(id)
  }

  @Get(':id/location')
  @Permissions('drivers:view')
  getDriverLocation(@Param('id') id: string) {
    return this.driversService.getDriverLocation(id)
  }

  @Get(':id/route')
  @Permissions('drivers:view')
  getDriverRoute(@Param('id') id: string) {
    return this.driversService.getDriverRoute(id)
  }

  @Get(':id/dispatch-candidates')
  @Permissions('drivers:view')
  getDriverDispatchCandidates(@Param('id') id: string) {
    return this.driversService.getDispatchCandidates(id)
  }

  @Post(':id/route-preview')
  @Permissions('drivers:view')
  previewDriverRoute(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(previewDriverRouteSchema))
    body: PreviewDriverRoutePayload,
  ) {
    return this.driversService.previewRoute(id, body)
  }

  @Post()
  @Permissions('settings:delivery:manage')
  createDriver(@Body(new ZodValidationPipe(saveDriverSchema)) body: SaveDriverPayload) {
    return this.driversService.createDriver(body)
  }

  @Post(':id/location')
  @Permissions('drivers:view')
  saveDriverLocation(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(saveDriverLocationSchema)) body: SaveDriverLocationPayload,
  ) {
    return this.driversService.saveDriverLocation(id, body)
  }

  @Post(':id/simulate-location')
  @Permissions('settings:delivery:manage')
  simulateDriverLocation(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(simulateDriverLocationSchema))
    body: SimulateDriverLocationPayload,
  ) {
    return this.driversService.simulateDriverLocation(id, body)
  }

  @Patch(':id')
  @Permissions('settings:delivery:manage')
  updateDriver(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(saveDriverSchema)) body: SaveDriverPayload,
  ) {
    return this.driversService.updateDriver(id, body)
  }

  @Patch(':id/queue')
  @Permissions('settings:delivery:manage')
  updateDriverQueue(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateDriverQueueSchema))
    body: UpdateDriverQueuePayload,
  ) {
    return this.driversService.updateQueue(id, body)
  }

  private ensureDriverAccess(authUser: AuthenticatedRequestUser) {
    if (authUser.role !== 'driver') {
      throw new ForbiddenException('Endpoint disponivel apenas para motoboys.')
    }

    return authUser.sub
  }
}
