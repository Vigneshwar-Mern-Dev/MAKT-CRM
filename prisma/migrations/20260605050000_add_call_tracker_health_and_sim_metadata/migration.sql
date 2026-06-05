-- AlterTable
ALTER TABLE "CompanyPhone" ADD COLUMN     "charging_type" TEXT,
ADD COLUMN     "is_charging" BOOLEAN,
ADD COLUMN     "last_successful_sync_at" TIMESTAMP(3),
ADD COLUMN     "last_sync_attempt_at" TIMESTAMP(3),
ADD COLUMN     "last_sync_error" TEXT,
ADD COLUMN     "last_sync_error_at" TIMESTAMP(3),
ADD COLUMN     "sync_retry_count" INTEGER;

-- AlterTable
ALTER TABLE "CallLead" ADD COLUMN     "local_contact_name" TEXT;

-- AlterTable
ALTER TABLE "CallEvent" ADD COLUMN     "local_contact_name" TEXT,
ADD COLUMN     "retry_count" INTEGER,
ADD COLUMN     "sim_carrier_name" TEXT,
ADD COLUMN     "sim_display_name" TEXT,
ADD COLUMN     "sim_slot" INTEGER,
ADD COLUMN     "sim_subscription_id" TEXT;

-- AlterTable
ALTER TABLE "CallSession" ADD COLUMN     "local_contact_name" TEXT,
ADD COLUMN     "sim_carrier_name" TEXT,
ADD COLUMN     "sim_display_name" TEXT,
ADD COLUMN     "sim_subscription_id" TEXT;

-- CreateIndex
CREATE INDEX "CompanyPhone_last_seen_at_idx" ON "CompanyPhone"("last_seen_at");

-- CreateIndex
CREATE INDEX "CompanyPhone_pending_sync_count_idx" ON "CompanyPhone"("pending_sync_count");

-- CreateIndex
CREATE INDEX "CallEvent_sim_slot_idx" ON "CallEvent"("sim_slot");

-- CreateIndex
CREATE INDEX "CallSession_sim_slot_idx" ON "CallSession"("sim_slot");
