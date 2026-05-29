-- Add composite indexes for user dashboard and sidebar workload queries.
CREATE INDEX "Task_assignedToId_status_idx" ON "Task"("assignedToId", "status");
CREATE INDEX "Task_assignedToId_dueDate_idx" ON "Task"("assignedToId", "dueDate");
CREATE INDEX "WebsiteLead_assigned_to_id_stage_idx" ON "WebsiteLead"("assigned_to_id", "stage");
CREATE INDEX "InstagramLead_assigned_to_id_stage_idx" ON "InstagramLead"("assigned_to_id", "stage");
