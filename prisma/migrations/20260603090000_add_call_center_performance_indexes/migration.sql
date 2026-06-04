CREATE INDEX "CallLead_assigned_to_id_status_idx" ON "CallLead"("assigned_to_id", "status");
CREATE INDEX "CallLead_assigned_to_id_sheet_synced_at_idx" ON "CallLead"("assigned_to_id", "sheet_synced_at");
CREATE INDEX "CallLead_status_updated_at_idx" ON "CallLead"("status", "updated_at");

CREATE INDEX "CallSession_status_ended_at_idx" ON "CallSession"("status", "ended_at");
CREATE INDEX "CallSession_status_first_ring_at_idx" ON "CallSession"("status", "first_ring_at");
CREATE INDEX "CallSession_call_direction_first_ring_at_idx" ON "CallSession"("call_direction", "first_ring_at");
CREATE INDEX "CallSession_assigned_to_id_first_ring_at_idx" ON "CallSession"("assigned_to_id", "first_ring_at");

CREATE INDEX "CallActivity_lead_id_created_at_idx" ON "CallActivity"("lead_id", "created_at");
CREATE INDEX "CallActivity_user_id_created_at_idx" ON "CallActivity"("user_id", "created_at");
CREATE INDEX "CallActivity_user_id_action_type_created_at_idx" ON "CallActivity"("user_id", "action_type", "created_at");

CREATE INDEX "CallFollowUp_assigned_to_id_completed_at_idx" ON "CallFollowUp"("assigned_to_id", "completed_at");
