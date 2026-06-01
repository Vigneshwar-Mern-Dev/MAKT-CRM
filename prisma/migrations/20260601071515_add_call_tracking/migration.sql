-- CreateEnum
CREATE TYPE "CallEventType" AS ENUM ('RINGING', 'ANSWERED', 'ENDED', 'MISSED');

-- CreateEnum
CREATE TYPE "CallSessionStatus" AS ENUM ('RINGING', 'ANSWERED', 'MISSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CallLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'FOLLOW_UP', 'INTERESTED', 'NOT_INTERESTED', 'NO_RESPONSE', 'CONVERTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CallActivityType" AS ENUM ('CALL_CREATED', 'CALL_RINGING', 'CALL_ANSWERED', 'CALL_MISSED', 'CALL_COMPLETED', 'ASSIGNMENT_CHANGE', 'NOTE_ADDED', 'FOLLOW_UP_UPDATE');

-- CreateTable
CREATE TABLE "CompanyPhone" (
    "id" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "auth_token_hash" TEXT NOT NULL,
    "last_seen_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyPhone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallLead" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" "CallLeadStatus" NOT NULL DEFAULT 'NEW',
    "assigned_to_id" TEXT,
    "first_company_phone" TEXT,
    "last_company_phone" TEXT,
    "last_contacted_at" TIMESTAMP(3),
    "next_follow_up_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallEvent" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "company_phone_id" TEXT NOT NULL,
    "session_id" TEXT,
    "caller_number" TEXT NOT NULL,
    "event_type" "CallEventType" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw_payload" JSONB NOT NULL,

    CONSTRAINT "CallEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallSession" (
    "id" TEXT NOT NULL,
    "company_phone_id" TEXT NOT NULL,
    "caller_number" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "status" "CallSessionStatus" NOT NULL DEFAULT 'RINGING',
    "first_ring_at" TIMESTAMP(3) NOT NULL,
    "answered_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "duration_seconds" INTEGER,
    "assigned_to_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallActivity" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "session_id" TEXT,
    "action_type" "CallActivityType" NOT NULL,
    "description" TEXT NOT NULL,
    "user_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallFollowUp" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "assigned_to_id" TEXT,
    "due_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyPhone_phone_number_key" ON "CompanyPhone"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyPhone_device_id_key" ON "CompanyPhone"("device_id");

-- CreateIndex
CREATE INDEX "CompanyPhone_device_id_idx" ON "CompanyPhone"("device_id");

-- CreateIndex
CREATE INDEX "CompanyPhone_phone_number_idx" ON "CompanyPhone"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "CallLead_phone_key" ON "CallLead"("phone");

-- CreateIndex
CREATE INDEX "CallLead_status_idx" ON "CallLead"("status");

-- CreateIndex
CREATE INDEX "CallLead_assigned_to_id_idx" ON "CallLead"("assigned_to_id");

-- CreateIndex
CREATE INDEX "CallLead_next_follow_up_at_idx" ON "CallLead"("next_follow_up_at");

-- CreateIndex
CREATE UNIQUE INDEX "CallEvent_event_id_key" ON "CallEvent"("event_id");

-- CreateIndex
CREATE INDEX "CallEvent_company_phone_id_idx" ON "CallEvent"("company_phone_id");

-- CreateIndex
CREATE INDEX "CallEvent_session_id_idx" ON "CallEvent"("session_id");

-- CreateIndex
CREATE INDEX "CallEvent_caller_number_idx" ON "CallEvent"("caller_number");

-- CreateIndex
CREATE INDEX "CallEvent_event_type_idx" ON "CallEvent"("event_type");

-- CreateIndex
CREATE INDEX "CallEvent_occurred_at_idx" ON "CallEvent"("occurred_at");

-- CreateIndex
CREATE INDEX "CallSession_company_phone_id_idx" ON "CallSession"("company_phone_id");

-- CreateIndex
CREATE INDEX "CallSession_caller_number_idx" ON "CallSession"("caller_number");

-- CreateIndex
CREATE INDEX "CallSession_lead_id_idx" ON "CallSession"("lead_id");

-- CreateIndex
CREATE INDEX "CallSession_status_idx" ON "CallSession"("status");

-- CreateIndex
CREATE INDEX "CallSession_assigned_to_id_idx" ON "CallSession"("assigned_to_id");

-- CreateIndex
CREATE INDEX "CallSession_first_ring_at_idx" ON "CallSession"("first_ring_at");

-- CreateIndex
CREATE INDEX "CallActivity_lead_id_idx" ON "CallActivity"("lead_id");

-- CreateIndex
CREATE INDEX "CallActivity_session_id_idx" ON "CallActivity"("session_id");

-- CreateIndex
CREATE INDEX "CallActivity_user_id_idx" ON "CallActivity"("user_id");

-- CreateIndex
CREATE INDEX "CallActivity_action_type_idx" ON "CallActivity"("action_type");

-- CreateIndex
CREATE INDEX "CallFollowUp_lead_id_idx" ON "CallFollowUp"("lead_id");

-- CreateIndex
CREATE INDEX "CallFollowUp_assigned_to_id_idx" ON "CallFollowUp"("assigned_to_id");

-- CreateIndex
CREATE INDEX "CallFollowUp_due_at_idx" ON "CallFollowUp"("due_at");

-- CreateIndex
CREATE INDEX "CallFollowUp_completed_at_idx" ON "CallFollowUp"("completed_at");

-- AddForeignKey
ALTER TABLE "CallLead" ADD CONSTRAINT "CallLead_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallEvent" ADD CONSTRAINT "CallEvent_company_phone_id_fkey" FOREIGN KEY ("company_phone_id") REFERENCES "CompanyPhone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallEvent" ADD CONSTRAINT "CallEvent_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "CallSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_company_phone_id_fkey" FOREIGN KEY ("company_phone_id") REFERENCES "CompanyPhone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "CallLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallActivity" ADD CONSTRAINT "CallActivity_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "CallLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallActivity" ADD CONSTRAINT "CallActivity_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "CallSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallActivity" ADD CONSTRAINT "CallActivity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallFollowUp" ADD CONSTRAINT "CallFollowUp_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "CallLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallFollowUp" ADD CONSTRAINT "CallFollowUp_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
