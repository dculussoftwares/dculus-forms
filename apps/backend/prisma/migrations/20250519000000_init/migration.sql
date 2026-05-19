-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN,
    "image" TEXT,
    "role" TEXT DEFAULT 'user',
    "banned" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "activeOrganizationId" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "metadata" TEXT,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."member" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "inviterId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."form" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "shortUrl" TEXT NOT NULL,
    "formSchema" JSONB NOT NULL,
    "settings" JSONB,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "sharingScope" TEXT NOT NULL DEFAULT 'PRIVATE',
    "defaultPermission" TEXT NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."response" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "metadata" JSONB,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."form_template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "formSchema" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."collaborative_document" (
    "id" TEXT NOT NULL,
    "documentName" TEXT NOT NULL,
    "state" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collaborative_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."form_metadata" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "fieldCount" INTEGER NOT NULL DEFAULT 0,
    "backgroundImageKey" TEXT,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."form_file" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_file_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."form_view_analytics" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "operatingSystem" TEXT,
    "browser" TEXT,
    "browserVersion" TEXT,
    "countryCode" TEXT,
    "countryAlpha2" TEXT,
    "regionCode" TEXT,
    "region" TEXT,
    "city" TEXT,
    "longitude" DOUBLE PRECISION,
    "latitude" DOUBLE PRECISION,
    "timezone" TEXT,
    "language" TEXT,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),

    CONSTRAINT "form_view_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."form_submission_analytics" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "operatingSystem" TEXT,
    "browser" TEXT,
    "browserVersion" TEXT,
    "countryCode" TEXT,
    "countryAlpha2" TEXT,
    "regionCode" TEXT,
    "region" TEXT,
    "city" TEXT,
    "longitude" DOUBLE PRECISION,
    "latitude" DOUBLE PRECISION,
    "timezone" TEXT,
    "language" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completionTimeSeconds" INTEGER,

    CONSTRAINT "form_submission_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."form_permission" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "grantedById" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."response_edit_history" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "editedById" TEXT,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editType" TEXT NOT NULL DEFAULT 'MANUAL',
    "editReason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "totalChanges" INTEGER NOT NULL DEFAULT 0,
    "changesSummary" TEXT,

    CONSTRAINT "response_edit_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."response_field_change" (
    "id" TEXT NOT NULL,
    "editHistoryId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "fieldLabel" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "changeType" TEXT NOT NULL,
    "valueChangeSize" INTEGER,

    CONSTRAINT "response_field_change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."form_plugin" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "events" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_plugin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."plugin_delivery" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "response" JSONB,
    "errorMessage" TEXT,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plugin_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."subscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "chargebeeCustomerId" TEXT NOT NULL,
    "chargebeeSubscriptionId" TEXT,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "viewsUsed" INTEGER NOT NULL DEFAULT 0,
    "submissionsUsed" INTEGER NOT NULL DEFAULT 0,
    "viewsLimit" INTEGER,
    "submissionsLimit" INTEGER,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "public"."user"("email");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "public"."account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "public"."session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "public"."session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "public"."organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "member_organizationId_userId_key" ON "public"."member"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "invitation_organizationId_idx" ON "public"."invitation"("organizationId");

-- CreateIndex
CREATE INDEX "invitation_status_idx" ON "public"."invitation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "form_shortUrl_key" ON "public"."form"("shortUrl");

-- CreateIndex
CREATE INDEX "form_organizationId_idx" ON "public"."form"("organizationId");

-- CreateIndex
CREATE INDEX "response_formId_idx" ON "public"."response"("formId");

-- CreateIndex
CREATE INDEX "response_formId_submittedAt_idx" ON "public"."response"("formId", "submittedAt");

-- CreateIndex
CREATE INDEX "response_data_idx" ON "public"."response" USING GIN ("data" jsonb_ops);

-- CreateIndex
CREATE INDEX "response_metadata_idx" ON "public"."response" USING GIN ("metadata" jsonb_ops);

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "public"."verification"("identifier");

-- CreateIndex
CREATE INDEX "verification_expiresAt_idx" ON "public"."verification"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "collaborative_document_documentName_key" ON "public"."collaborative_document"("documentName");

-- CreateIndex
CREATE UNIQUE INDEX "form_metadata_formId_key" ON "public"."form_metadata"("formId");

-- CreateIndex
CREATE UNIQUE INDEX "form_file_key_key" ON "public"."form_file"("key");

-- CreateIndex
CREATE INDEX "form_file_formId_idx" ON "public"."form_file"("formId");

-- CreateIndex
CREATE INDEX "form_view_analytics_formId_idx" ON "public"."form_view_analytics"("formId");

-- CreateIndex
CREATE INDEX "form_view_analytics_viewedAt_idx" ON "public"."form_view_analytics"("viewedAt");

-- CreateIndex
CREATE INDEX "form_view_analytics_sessionId_idx" ON "public"."form_view_analytics"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "form_submission_analytics_responseId_key" ON "public"."form_submission_analytics"("responseId");

-- CreateIndex
CREATE INDEX "form_submission_analytics_formId_idx" ON "public"."form_submission_analytics"("formId");

-- CreateIndex
CREATE INDEX "form_submission_analytics_submittedAt_idx" ON "public"."form_submission_analytics"("submittedAt");

-- CreateIndex
CREATE INDEX "form_submission_analytics_sessionId_idx" ON "public"."form_submission_analytics"("sessionId");

-- CreateIndex
CREATE INDEX "form_submission_analytics_completionTimeSeconds_idx" ON "public"."form_submission_analytics"("completionTimeSeconds");

-- CreateIndex
CREATE INDEX "form_permission_formId_idx" ON "public"."form_permission"("formId");

-- CreateIndex
CREATE INDEX "form_permission_userId_idx" ON "public"."form_permission"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "form_permission_formId_userId_key" ON "public"."form_permission"("formId", "userId");

-- CreateIndex
CREATE INDEX "response_edit_history_responseId_idx" ON "public"."response_edit_history"("responseId");

-- CreateIndex
CREATE INDEX "response_edit_history_editedById_idx" ON "public"."response_edit_history"("editedById");

-- CreateIndex
CREATE INDEX "response_edit_history_editedAt_idx" ON "public"."response_edit_history"("editedAt");

-- CreateIndex
CREATE INDEX "response_field_change_editHistoryId_idx" ON "public"."response_field_change"("editHistoryId");

-- CreateIndex
CREATE INDEX "response_field_change_fieldId_idx" ON "public"."response_field_change"("fieldId");

-- CreateIndex
CREATE INDEX "response_field_change_changeType_idx" ON "public"."response_field_change"("changeType");

-- CreateIndex
CREATE INDEX "form_plugin_formId_idx" ON "public"."form_plugin"("formId");

-- CreateIndex
CREATE INDEX "form_plugin_type_idx" ON "public"."form_plugin"("type");

-- CreateIndex
CREATE INDEX "form_plugin_enabled_idx" ON "public"."form_plugin"("enabled");

-- CreateIndex
CREATE INDEX "plugin_delivery_pluginId_idx" ON "public"."plugin_delivery"("pluginId");

-- CreateIndex
CREATE INDEX "plugin_delivery_eventType_idx" ON "public"."plugin_delivery"("eventType");

-- CreateIndex
CREATE INDEX "plugin_delivery_status_idx" ON "public"."plugin_delivery"("status");

-- CreateIndex
CREATE INDEX "plugin_delivery_deliveredAt_idx" ON "public"."plugin_delivery"("deliveredAt");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_organizationId_key" ON "public"."subscription"("organizationId");

-- CreateIndex
CREATE INDEX "subscription_status_idx" ON "public"."subscription"("status");

-- CreateIndex
CREATE INDEX "subscription_planId_idx" ON "public"."subscription"("planId");

-- AddForeignKey
ALTER TABLE "public"."account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."member" ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."member" ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invitation" ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invitation" ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."form" ADD CONSTRAINT "form_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."form" ADD CONSTRAINT "form_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."response" ADD CONSTRAINT "response_formId_fkey" FOREIGN KEY ("formId") REFERENCES "public"."form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."form_file" ADD CONSTRAINT "form_file_formId_fkey" FOREIGN KEY ("formId") REFERENCES "public"."form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."form_view_analytics" ADD CONSTRAINT "form_view_analytics_formId_fkey" FOREIGN KEY ("formId") REFERENCES "public"."form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."form_submission_analytics" ADD CONSTRAINT "form_submission_analytics_formId_fkey" FOREIGN KEY ("formId") REFERENCES "public"."form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."form_submission_analytics" ADD CONSTRAINT "form_submission_analytics_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "public"."response"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."form_permission" ADD CONSTRAINT "form_permission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "public"."form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."form_permission" ADD CONSTRAINT "form_permission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."form_permission" ADD CONSTRAINT "form_permission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."response_edit_history" ADD CONSTRAINT "response_edit_history_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "public"."response"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."response_edit_history" ADD CONSTRAINT "response_edit_history_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."response_field_change" ADD CONSTRAINT "response_field_change_editHistoryId_fkey" FOREIGN KEY ("editHistoryId") REFERENCES "public"."response_edit_history"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."form_plugin" ADD CONSTRAINT "form_plugin_formId_fkey" FOREIGN KEY ("formId") REFERENCES "public"."form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plugin_delivery" ADD CONSTRAINT "plugin_delivery_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "public"."form_plugin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscription" ADD CONSTRAINT "subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

