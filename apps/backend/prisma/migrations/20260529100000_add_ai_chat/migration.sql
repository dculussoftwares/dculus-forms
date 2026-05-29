-- CreateTable: AIChatConversation
-- Added to schema after add_ai_usage migration was created; no migration existed for production.
CREATE TABLE IF NOT EXISTS "ai_chat_conversation" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New conversation',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chat_conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AIChatMessage
CREATE TABLE IF NOT EXISTS "ai_chat_message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "operations" JSONB,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chat_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ai_chat_conversation_formId_userId_idx" ON "ai_chat_conversation"("formId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ai_chat_message_conversationId_idx" ON "ai_chat_message"("conversationId");

-- AddForeignKey
ALTER TABLE "ai_chat_conversation" ADD CONSTRAINT "ai_chat_conversation_formId_fkey"
    FOREIGN KEY ("formId") REFERENCES "form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_chat_conversation" ADD CONSTRAINT "ai_chat_conversation_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_chat_conversation" ADD CONSTRAINT "ai_chat_conversation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_chat_message" ADD CONSTRAINT "ai_chat_message_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "ai_chat_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
