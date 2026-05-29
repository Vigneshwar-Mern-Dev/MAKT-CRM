-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WEBSITE', 'INSTAGRAM');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('NEW', 'CONTACTED', 'FOLLOW_UP', 'INTERESTED', 'NOT_INTERESTED', 'NO_RESPONSE', 'CONVERTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "LeadActivityType" AS ENUM ('ASSIGNMENT_CHANGE', 'STAGE_CHANGE', 'NOTE_ADDED', 'FOLLOW_UP_UPDATE', 'SYSTEM_SYNC', 'CREATION');

-- CreateEnum
CREATE TYPE "SheetConnectionStatus" AS ENUM ('NOT_CONNECTED', 'CONNECTED', 'ERROR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "department" TEXT NOT NULL DEFAULT 'Other',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "assignedToId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "website_lead_id" TEXT,
    "instagram_lead_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskComment" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadIntegration" (
    "id" TEXT NOT NULL,
    "source" "LeadSource" NOT NULL,
    "appScriptUrl" TEXT,
    "spreadsheetId" TEXT,
    "sheetName" TEXT NOT NULL,
    "secretToken" TEXT,
    "status" "SheetConnectionStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
    "lastTestedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteLead" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atm_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "city" TEXT,
    "address" TEXT,
    "ownership_type" TEXT,
    "provider" TEXT,
    "language" TEXT,
    "message" TEXT,
    "sheet_source" TEXT,
    "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
    "assigned_to_id" TEXT,
    "last_contacted_at" TIMESTAMP(3),
    "next_follow_up_at" TIMESTAMP(3),
    "notes" TEXT,
    "read_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstagramLead" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atm_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "city" TEXT,
    "address" TEXT,
    "ownership_type" TEXT,
    "provider" TEXT,
    "language" TEXT,
    "message" TEXT,
    "sheet_source" TEXT,
    "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
    "assigned_to_id" TEXT,
    "last_contacted_at" TIMESTAMP(3),
    "next_follow_up_at" TIMESTAMP(3),
    "notes" TEXT,
    "read_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL,
    "action_type" "LeadActivityType" NOT NULL,
    "description" TEXT NOT NULL,
    "user_id" TEXT,
    "website_lead_id" TEXT,
    "instagram_lead_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Task_assignedToId_idx" ON "Task"("assignedToId");

-- CreateIndex
CREATE INDEX "Task_assignedById_idx" ON "Task"("assignedById");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");

-- CreateIndex
CREATE INDEX "Task_website_lead_id_idx" ON "Task"("website_lead_id");

-- CreateIndex
CREATE INDEX "Task_instagram_lead_id_idx" ON "Task"("instagram_lead_id");

-- CreateIndex
CREATE INDEX "TaskComment_taskId_idx" ON "TaskComment"("taskId");

-- CreateIndex
CREATE INDEX "TaskComment_authorId_idx" ON "TaskComment"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadIntegration_source_key" ON "LeadIntegration"("source");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteLead_atm_id_key" ON "WebsiteLead"("atm_id");

-- CreateIndex
CREATE INDEX "WebsiteLead_stage_idx" ON "WebsiteLead"("stage");

-- CreateIndex
CREATE INDEX "WebsiteLead_assigned_to_id_idx" ON "WebsiteLead"("assigned_to_id");

-- CreateIndex
CREATE INDEX "WebsiteLead_atm_id_idx" ON "WebsiteLead"("atm_id");

-- CreateIndex
CREATE INDEX "WebsiteLead_read_at_idx" ON "WebsiteLead"("read_at");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramLead_atm_id_key" ON "InstagramLead"("atm_id");

-- CreateIndex
CREATE INDEX "InstagramLead_stage_idx" ON "InstagramLead"("stage");

-- CreateIndex
CREATE INDEX "InstagramLead_assigned_to_id_idx" ON "InstagramLead"("assigned_to_id");

-- CreateIndex
CREATE INDEX "InstagramLead_atm_id_idx" ON "InstagramLead"("atm_id");

-- CreateIndex
CREATE INDEX "InstagramLead_read_at_idx" ON "InstagramLead"("read_at");

-- CreateIndex
CREATE INDEX "LeadActivity_website_lead_id_idx" ON "LeadActivity"("website_lead_id");

-- CreateIndex
CREATE INDEX "LeadActivity_instagram_lead_id_idx" ON "LeadActivity"("instagram_lead_id");

-- CreateIndex
CREATE INDEX "LeadActivity_user_id_idx" ON "LeadActivity"("user_id");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_website_lead_id_fkey" FOREIGN KEY ("website_lead_id") REFERENCES "WebsiteLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_instagram_lead_id_fkey" FOREIGN KEY ("instagram_lead_id") REFERENCES "InstagramLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteLead" ADD CONSTRAINT "WebsiteLead_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramLead" ADD CONSTRAINT "InstagramLead_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_website_lead_id_fkey" FOREIGN KEY ("website_lead_id") REFERENCES "WebsiteLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_instagram_lead_id_fkey" FOREIGN KEY ("instagram_lead_id") REFERENCES "InstagramLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

