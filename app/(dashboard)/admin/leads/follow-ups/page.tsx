import { db } from "@/app/lib/db";
import { LEAD_ACTIVITY_PREVIEW_LIMIT, LEAD_LIST_LIMIT } from "@/app/lib/query-limits";
import { LeadSource } from "@/app/lib/prisma-enums";
import { LeadPage, LeadRow } from "../lead-page";

function parseLeadSource() {
  return LeadSource.WEBSITE;
}

export default async function AdminFollowUpsPage() {
  const sourceOptions = [
    { label: "Website Leads", value: LeadSource.WEBSITE },
  ];
  const selectedSource = parseLeadSource();

  // Fetch agents directory
  const agents = await db.user.findMany({
    where: { role: "USER" },
    select: { id: true, username: true, email: true, department: true },
    orderBy: { username: "asc" },
  });

  // Fetch database stored leads matching criteria (stage: FOLLOW_UP)
  // Sorted chronologically by nextFollowUpAt ASC (soonest first) so overdue and urgent calls appear first
  let leads: LeadRow[] = [];
  try {
    const queryArgs = {
      where: {
        stage: "FOLLOW_UP" as const,
      },
      orderBy: { nextFollowUpAt: "asc" as const },
      take: LEAD_LIST_LIMIT,
      include: {
        assignedTo: {
          select: { id: true, username: true, email: true, department: true },
        },
        activities: {
          include: {
            user: { select: { username: true } },
          },
          orderBy: { createdAt: "desc" as const },
          take: LEAD_ACTIVITY_PREVIEW_LIMIT,
        },
      },
    };

    leads = await db.websiteLead.findMany(queryArgs);
  } catch (err) {
    console.error("Error querying admin follow-up leads:", err);
  }

  return (
    <LeadPage
      title="Follow-ups"
      description="Monitor leads waiting for a scheduled call, message, or email follow-up."
      stageLabel="Follow-up queue"
      leads={leads}
      agents={agents}
      isAdmin={true}
      selectedSource={selectedSource}
      sourceOptions={sourceOptions}
      actionPath="/admin/leads/follow-ups"
    />
  );
}
