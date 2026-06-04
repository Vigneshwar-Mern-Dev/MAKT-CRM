ALTER TABLE "CallLead" ADD COLUMN "location_sent" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "CallLead_location_sent_idx" ON "CallLead"("location_sent");
