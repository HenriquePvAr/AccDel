import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'

import {
  createKnowledgeEntrySchema,
  sendConversationMessageSchema,
  testReplySchema,
  updateAiAttendantSettingsSchema,
  updateKnowledgeEntrySchema,
  whatsappWebhookPayloadSchema,
  type CreateKnowledgeEntryPayload,
  type SendConversationMessagePayload,
  type TestReplyPayload,
  type UpdateAiAttendantSettingsPayload,
  type UpdateKnowledgeEntryPayload,
  type WhatsappWebhookPayload,
} from '@/contracts/ai-attendant.contract'
import { Permissions } from '@/modules/auth/decorators/permissions.decorator'
import { Public } from '@/modules/auth/decorators/public.decorator'
import { ZodValidationPipe } from '@/shared/pipes/zod-validation.pipe'
import { DEFAULT_STORE_ID } from '@/shared/store-context'

import { AiAttendantService } from './ai-attendant.service'

@Controller('ai-attendant')
export class AiAttendantController {
  constructor(private readonly aiAttendantService: AiAttendantService) {}

  // ── Overview & Statistics ──────────────────────────────────────────

  @Get('overview')
  @Permissions('ai_attendant:view')
  getOverview() {
    return this.aiAttendantService.getOverview(DEFAULT_STORE_ID)
  }

  // ── Settings ────────────────────────────────────────────────────────

  @Get('settings')
  @Permissions('ai_attendant:view')
  getSettings() {
    return this.aiAttendantService.getOrCreateSettings(DEFAULT_STORE_ID)
  }

  @Patch('settings')
  @Permissions('ai_attendant:manage')
  updateSettings(
    @Body(new ZodValidationPipe(updateAiAttendantSettingsSchema))
    body: UpdateAiAttendantSettingsPayload,
  ) {
    return this.aiAttendantService.updateSettings(DEFAULT_STORE_ID, body)
  }

  // ── Knowledge Base ──────────────────────────────────────────────────

  @Get('knowledge')
  @Permissions('ai_attendant:view')
  getKnowledgeEntries() {
    return this.aiAttendantService.getKnowledgeEntries(DEFAULT_STORE_ID)
  }

  @Post('knowledge')
  @Permissions('ai_attendant:manage')
  createKnowledgeEntry(
    @Body(new ZodValidationPipe(createKnowledgeEntrySchema))
    body: CreateKnowledgeEntryPayload,
  ) {
    return this.aiAttendantService.createKnowledgeEntry(DEFAULT_STORE_ID, body)
  }

  @Patch('knowledge/:id')
  @Permissions('ai_attendant:manage')
  updateKnowledgeEntry(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateKnowledgeEntrySchema))
    body: UpdateKnowledgeEntryPayload,
  ) {
    return this.aiAttendantService.updateKnowledgeEntry(DEFAULT_STORE_ID, id, body)
  }

  @Delete('knowledge/:id')
  @Permissions('ai_attendant:manage')
  deleteKnowledgeEntry(@Param('id') id: string) {
    return this.aiAttendantService.deleteKnowledgeEntry(DEFAULT_STORE_ID, id)
  }

  // ── Test Reply ──────────────────────────────────────────────────────

  @Post('test-reply')
  @Permissions('ai_attendant:view')
  testReply(@Body(new ZodValidationPipe(testReplySchema)) body: TestReplyPayload) {
    return this.aiAttendantService.testReply(DEFAULT_STORE_ID, body.message)
  }

  // ── WhatsApp Session ────────────────────────────────────────────────

  @Get('whatsapp/session')
  @Permissions('ai_attendant:view')
  getSession() {
    return this.aiAttendantService.getSession(DEFAULT_STORE_ID)
  }

  @Post('whatsapp/session/start')
  @Permissions('ai_attendant:manage')
  startSession() {
    return this.aiAttendantService.startSession(DEFAULT_STORE_ID)
  }

  @Get('whatsapp/session/qr')
  @Permissions('ai_attendant:view')
  getQrCode() {
    return this.aiAttendantService.getQrCode(DEFAULT_STORE_ID)
  }

  @Get('whatsapp/session/status')
  @Permissions('ai_attendant:view')
  getSessionStatus() {
    return this.aiAttendantService.getSessionStatus(DEFAULT_STORE_ID)
  }

  @Post('whatsapp/session/disconnect')
  @Permissions('ai_attendant:manage')
  disconnectSession() {
    return this.aiAttendantService.disconnectSession(DEFAULT_STORE_ID)
  }

  @Post('whatsapp/session/restart')
  @Permissions('ai_attendant:manage')
  restartSession() {
    return this.aiAttendantService.restartSession(DEFAULT_STORE_ID)
  }

  // ── Webhook (Public endpoint for WhatsApp provider) ────────────────

  @Post('whatsapp/webhook')
  @Public()
  handleWebhook(
    @Body(new ZodValidationPipe(whatsappWebhookPayloadSchema))
    body: WhatsappWebhookPayload,
  ) {
    return this.aiAttendantService.handleIncomingWebhook(body)
  }

  // ── Conversations ───────────────────────────────────────────────────

  @Get('conversations')
  @Permissions('ai_attendant:view')
  getConversations() {
    return this.aiAttendantService.getConversations(DEFAULT_STORE_ID)
  }

  @Get('conversations/:id')
  @Permissions('ai_attendant:view')
  getConversationDetail(@Param('id') id: string) {
    return this.aiAttendantService.getConversationDetail(DEFAULT_STORE_ID, id)
  }

  @Post('conversations/:id/assign')
  @Permissions('ai_attendant:manage')
  assignConversation(@Param('id') id: string, @Body('userId') userId: string) {
    return this.aiAttendantService.assignConversation(DEFAULT_STORE_ID, id, userId)
  }

  @Post('conversations/:id/release')
  @Permissions('ai_attendant:manage')
  releaseConversation(@Param('id') id: string) {
    return this.aiAttendantService.releaseConversation(DEFAULT_STORE_ID, id)
  }

  @Post('conversations/:id/send')
  @Permissions('ai_attendant:manage')
  sendManualMessage(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(sendConversationMessageSchema))
    body: SendConversationMessagePayload,
    // TODO: Get userId from JWT token instead of hardcoding
    // For now, using a placeholder until auth context is properly integrated
  ) {
    const userId = 'user_placeholder' // This should come from @CurrentUser() decorator
    return this.aiAttendantService.sendManualMessage(DEFAULT_STORE_ID, id, body.body, userId)
  }

  @Post('conversations/:id/close')
  @Permissions('ai_attendant:manage')
  closeConversation(@Param('id') id: string) {
    return this.aiAttendantService.closeConversation(DEFAULT_STORE_ID, id)
  }

  // ── Order Drafts ────────────────────────────────────────────────────

  @Get('order-drafts')
  @Permissions('ai_attendant:view')
  getOrderDrafts() {
    return this.aiAttendantService.getOrderDrafts(DEFAULT_STORE_ID)
  }

  @Post('order-drafts/:id/approve')
  @Permissions('ai_attendant:manage')
  approveOrderDraft(@Param('id') id: string) {
    return this.aiAttendantService.approveOrderDraft(DEFAULT_STORE_ID, id)
  }

  @Post('order-drafts/:id/discard')
  @Permissions('ai_attendant:manage')
  discardOrderDraft(@Param('id') id: string) {
    return this.aiAttendantService.discardOrderDraft(DEFAULT_STORE_ID, id)
  }
}
