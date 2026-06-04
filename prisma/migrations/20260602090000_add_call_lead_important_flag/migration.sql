ALTER TABLE "CallLead" ADD COLUMN "is_important" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "CallLead_is_important_idx" ON "CallLead"("is_important");
