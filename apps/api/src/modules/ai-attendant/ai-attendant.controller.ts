import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'

import {
  createKnowledgeEntrySchema,
  markOrderDraftConvertedSchema,
  sendConversationMessageSchema,
  testChatMessageSchema,
  testReplySchema,
  testWhatsappSendSchema,
  updateAiAttendantSettingsSchema,
  updateKnowledgeEntrySchema,
  whatsappWebhookPayloadSchema,
  type CreateKnowledgeEntryPayload,
  type MarkOrderDraftConvertedPayload,
  type SendConversationMessagePayload,
  type TestChatMessagePayload,
  type TestReplyPayload,
  type TestWhatsappSendPayload,
  type UpdateAiAttendantSettingsPayload,
  type UpdateKnowledgeEntryPayload,
  type WhatsappWebhookPayload,
} from '@/contracts/ai-attendant.contract'
import { Permissions } from '@/modules/auth/decorators/permissions.decorator'
import { Public } from '@/modules/auth/decorators/public.decorator'
import { CurrentAuthUser } from '@/modules/auth/decorators/current-auth-user.decorator'
import type { AuthenticatedRequestUser } from '@/modules/auth/auth.types'
import { ZodValidationPipe } from '@/shared/pipes/zod-validation.pipe'
import { getCurrentStoreId } from '@/shared/store-context'

import { AiAttendantService } from './ai-attendant.service'

@Controller('ai-attendant')
export class AiAttendantController {
  constructor(private readonly aiAttendantService: AiAttendantService) {}

  // ── Overview & Statistics ──────────────────────────────────────────

  @Get('overview')
  @Permissions('ai_attendant:view')
  getOverview() {
    return this.aiAttendantService.getOverview(getCurrentStoreId())
  }

  @Get('dashboard')
  @Permissions('ai_attendant:view')
  getDashboard() {
    return this.aiAttendantService.getDashboard(getCurrentStoreId())
  }

  // ── Settings ────────────────────────────────────────────────────────

  @Get('integrations/lovable-supabase/status')
  @Permissions('ai_attendant:view')
  getLovableSupabaseStatus() {
    return this.aiAttendantService.getLovableSupabaseStatus()
  }

  @Post('integrations/lovable-supabase/test')
  @Permissions('ai_attendant:manage')
  testLovableSupabaseConnection() {
    return this.aiAttendantService.testLovableSupabaseConnection()
  }

  @Get('settings')
  @Permissions('ai_attendant:view')
  getSettings() {
    return this.aiAttendantService.getOrCreateSettings(getCurrentStoreId())
  }

  @Patch('settings')
  @Permissions('ai_attendant:manage')
  updateSettings(
    @Body(new ZodValidationPipe(updateAiAttendantSettingsSchema))
    body: UpdateAiAttendantSettingsPayload,
  ) {
    return this.aiAttendantService.updateSettings(getCurrentStoreId(), body)
  }

  // ── Knowledge Base ──────────────────────────────────────────────────

  @Get('knowledge')
  @Permissions('ai_attendant:view')
  getKnowledgeEntries() {
    return this.aiAttendantService.getKnowledgeEntries(getCurrentStoreId())
  }

  @Post('knowledge')
  @Permissions('ai_attendant:manage')
  createKnowledgeEntry(
    @Body(new ZodValidationPipe(createKnowledgeEntrySchema))
    body: CreateKnowledgeEntryPayload,
  ) {
    return this.aiAttendantService.createKnowledgeEntry(getCurrentStoreId(), body)
  }

  @Patch('knowledge/:id')
  @Permissions('ai_attendant:manage')
  updateKnowledgeEntry(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateKnowledgeEntrySchema))
    body: UpdateKnowledgeEntryPayload,
  ) {
    return this.aiAttendantService.updateKnowledgeEntry(getCurrentStoreId(), id, body)
  }

  @Delete('knowledge/:id')
  @Permissions('ai_attendant:manage')
  deleteKnowledgeEntry(@Param('id') id: string) {
    return this.aiAttendantService.deleteKnowledgeEntry(getCurrentStoreId(), id)
  }

  // ── Test Reply ──────────────────────────────────────────────────────

  @Post('test-reply')
  @Permissions('ai_attendant:view')
  testReply(@Body(new ZodValidationPipe(testReplySchema)) body: TestReplyPayload) {
    return this.aiAttendantService.testReply(getCurrentStoreId(), body)
  }

  @Post('test-chat/message')
  @Permissions('ai_attendant:view')
  testChatMessage(
    @Body(new ZodValidationPipe(testChatMessageSchema))
    body: TestChatMessagePayload,
  ) {
    return this.aiAttendantService.testChatMessage(getCurrentStoreId(), body)
  }

  @Post('test-whatsapp/send')
  @Permissions('ai_attendant:manage')
  sendTestWhatsappMessage(
    @Body(new ZodValidationPipe(testWhatsappSendSchema))
    body: TestWhatsappSendPayload,
  ) {
    return this.aiAttendantService.sendTestWhatsappMessage(getCurrentStoreId(), body)
  }

  // ── WhatsApp Session ────────────────────────────────────────────────

  @Get('whatsapp/session')
  @Permissions('ai_attendant:view')
  getSession() {
    return this.aiAttendantService.getSession(getCurrentStoreId())
  }

  @Post('whatsapp/session/start')
  @Permissions('ai_attendant:manage')
  startSession() {
    return this.aiAttendantService.startSession(getCurrentStoreId())
  }

  @Get('whatsapp/session/qr')
  @Permissions('ai_attendant:view')
  getQrCode() {
    return this.aiAttendantService.getQrCode(getCurrentStoreId())
  }

  @Get('whatsapp/session/status')
  @Permissions('ai_attendant:view')
  getSessionStatus() {
    return this.aiAttendantService.getSessionStatus(getCurrentStoreId())
  }

  @Post('whatsapp/session/disconnect')
  @Permissions('ai_attendant:manage')
  disconnectSession() {
    return this.aiAttendantService.disconnectSession(getCurrentStoreId())
  }

  @Post('whatsapp/session/restart')
  @Permissions('ai_attendant:manage')
  restartSession() {
    return this.aiAttendantService.restartSession(getCurrentStoreId())
  }

  @Get('whatsapp/logs')
  @Permissions('ai_attendant:view')
  getWhatsappLogs() {
    return this.aiAttendantService.getWhatsappLogs(getCurrentStoreId())
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
    return this.aiAttendantService.getConversations(getCurrentStoreId())
  }

  @Get('conversations/:id')
  @Permissions('ai_attendant:view')
  getConversationDetail(@Param('id') id: string) {
    return this.aiAttendantService.getConversationDetail(getCurrentStoreId(), id)
  }

  @Post('conversations/:id/assign')
  @Permissions('ai_attendant:manage')
  assignConversation(@Param('id') id: string, @Body('userId') userId: string) {
    return this.aiAttendantService.assignConversation(getCurrentStoreId(), id, userId)
  }

  @Post('conversations/:id/release')
  @Permissions('ai_attendant:manage')
  releaseConversation(@Param('id') id: string) {
    return this.aiAttendantService.releaseConversation(getCurrentStoreId(), id)
  }

  @Post('conversations/:id/send')
  @Permissions('ai_attendant:manage')
  sendManualMessage(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(sendConversationMessageSchema))
    body: SendConversationMessagePayload,
    @CurrentAuthUser() authUser: AuthenticatedRequestUser,
  ) {
    return this.aiAttendantService.sendManualMessage(getCurrentStoreId(), id, body.body, authUser.sub)
  }

  @Post('conversations/:id/close')
  @Permissions('ai_attendant:manage')
  closeConversation(@Param('id') id: string) {
    return this.aiAttendantService.closeConversation(getCurrentStoreId(), id)
  }

  // ── Order Drafts ────────────────────────────────────────────────────

  @Get('order-drafts')
  @Permissions('ai_attendant:view')
  getOrderDrafts() {
    return this.aiAttendantService.getOrderDrafts(getCurrentStoreId())
  }

  @Post('order-drafts/:id/approve')
  @Permissions('ai_attendant:manage')
  approveOrderDraft(@Param('id') id: string) {
    return this.aiAttendantService.approveOrderDraft(getCurrentStoreId(), id)
  }

  @Post('order-drafts/:id/discard')
  @Permissions('ai_attendant:manage')
  discardOrderDraft(@Param('id') id: string) {
    return this.aiAttendantService.discardOrderDraft(getCurrentStoreId(), id)
  }

  @Post('order-drafts/:id/prepare-order')
  @Permissions('ai_attendant:manage')
  prepareOrderDraft(@Param('id') id: string) {
    return this.aiAttendantService.prepareOrderDraft(getCurrentStoreId(), id)
  }

  @Post('order-drafts/:id/mark-converted')
  @Permissions('ai_attendant:manage')
  markOrderDraftConverted(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(markOrderDraftConvertedSchema))
    body: MarkOrderDraftConvertedPayload,
  ) {
    return this.aiAttendantService.markOrderDraftConverted(getCurrentStoreId(), id, body.orderId)
  }
}
