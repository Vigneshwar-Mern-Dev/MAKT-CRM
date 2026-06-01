import { db } from "@/app/lib/db";
import { LEAD_ACTIVITY_PREVIEW_LIMIT, LEAD_LIST_LIMIT } from "@/app/lib/query-limits";
import { LeadSource } from "@/app/lib/prisma-enums";
import { LeadPage, LeadRow } from "../lead-page";

function parseLeadSource() {
  return LeadSource.WEBSITE;
}

export default async function AdminNewLeadsPage() {
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

  // Fetch unread, unassigned leads waiting for first admin action.
  let leads: LeadRow[] = [];
  try {
    const queryArgs = {
      where: {
        stage: "NEW" as const,
        assignedToId: null,
        readAt: null,
      },
      orderBy: { createdAt: "desc" as const },
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
    console.error("Error querying new leads:", err);
  }

  return (
    <LeadPage
      title="New Leads"
      description="Review unread, unassigned prospects before assignment or qualification."
      stageLabel="Unread unassigned leads"
      leads={leads}
      agents={agents}
      isAdmin={true}
      selectedSource={selectedSource}
      sourceOptions={sourceOptions}
      actionPath="/admin/leads/new"
      showMarkReadAction={true}
    />
  );
}
