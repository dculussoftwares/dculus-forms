-- CreateTable
CREATE TABLE "ai_model_config" (
    "id" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "primaryModel" TEXT NOT NULL,
    "fastModel" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "ai_model_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_model_config_plan_key" ON "ai_model_config"("plan");
