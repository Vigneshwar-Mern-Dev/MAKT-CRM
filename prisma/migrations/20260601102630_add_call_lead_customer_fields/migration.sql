-- AlterTable
ALTER TABLE "CallLead" ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "instagram_lead_id" TEXT,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "message" TEXT,
ADD COLUMN     "ownership_type" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "sheet_sync_warning" TEXT,
ADD COLUMN     "sheet_synced_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "CallLead_instagram_lead_id_idx" ON "CallLead"("instagram_lead_id");
