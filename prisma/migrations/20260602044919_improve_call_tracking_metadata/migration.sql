-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('INCOMING', 'OUTGOING', 'UNKNOWN');

-- AlterTable
ALTER TABLE "CallEvent" ADD COLUMN     "call_direction" "CallDirection" NOT NULL DEFAULT 'INCOMING',
ADD COLUMN     "duration_seconds" INTEGER,
ADD COLUMN     "local_session_id" TEXT;

-- AlterTable
ALTER TABLE "CallSession" ADD COLUMN     "android_call_log_id" TEXT,
ADD COLUMN     "call_direction" "CallDirection" NOT NULL DEFAULT 'INCOMING',
ADD COLUMN     "local_session_id" TEXT,
ADD COLUMN     "sim_slot" INTEGER;

-- AlterTable
ALTER TABLE "CompanyPhone" ADD COLUMN     "android_version" TEXT,
ADD COLUMN     "app_version" TEXT,
ADD COLUMN     "battery_percent" INTEGER,
ADD COLUMN     "device_model" TEXT,
ADD COLUMN     "network_type" TEXT,
ADD COLUMN     "pending_sync_count" INTEGER,
ADD COLUMN     "permission_status" JSONB;

-- CreateIndex
CREATE INDEX "CallEvent_local_session_id_idx" ON "CallEvent"("local_session_id");

-- CreateIndex
CREATE INDEX "CallSession_local_session_id_idx" ON "CallSession"("local_session_id");
