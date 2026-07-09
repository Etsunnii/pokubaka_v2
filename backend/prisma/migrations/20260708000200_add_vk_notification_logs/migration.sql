CREATE TABLE "vk_notification_logs" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "sourceMessageId" TEXT NOT NULL,
    "sourceChatId" TEXT,
    "orderId" TEXT,
    "vkPeerId" TEXT NOT NULL,
    "vkMessageId" TEXT,
    "messageText" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vk_notification_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vk_notification_logs_source_sourceMessageId_vkPeerId_key"
    ON "vk_notification_logs"("source", "sourceMessageId", "vkPeerId");

CREATE INDEX "vk_notification_logs_sourceChatId_idx"
    ON "vk_notification_logs"("sourceChatId");

CREATE INDEX "vk_notification_logs_status_idx"
    ON "vk_notification_logs"("status");
