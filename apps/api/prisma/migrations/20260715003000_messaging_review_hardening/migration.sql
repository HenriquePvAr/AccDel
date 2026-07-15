-- Add worker-oriented indexes identified during the post-implementation concurrency review.
CREATE INDEX "outbound_messages_status_locked_at_idx"
  ON "outbound_messages"("status", "locked_at");

CREATE INDEX "outbound_messages_conversation_id_status_created_at_idx"
  ON "outbound_messages"("conversation_id", "status", "created_at");

CREATE INDEX "inbound_events_status_processed_at_idx"
  ON "inbound_events"("status", "processed_at");

CREATE INDEX "order_notifications_status_processed_at_idx"
  ON "order_notifications"("status", "processed_at");
