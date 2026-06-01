import { db } from "@/app/lib/db";
import { LEAD_ACTIVITY_PREVIEW_LIMIT, LEAD_LIST_LIMIT } from "@/app/lib/query-limits";
import { LeadSource } from "@/app/lib/prisma-enums";
import { LeadPage, LeadRow } from "../lead-page";

function parseLeadSource() {
  return LeadSource.WEBSITE;
}

export default async function AdminAssignedLeadsPage() {
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

  // Fetch database stored leads matching criteria (assignedToId is not null)
  let leads: LeadRow[] = [];
  try {
    const queryArgs = {
      where: {
        assignedToId: { not: null },
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
    console.error("Error querying assigned leads:", err);
  }

  return (
    <LeadPage
      title="Assigned Leads"
      description="Track prospects that have already been assigned to team members."
      stageLabel="Assigned leads"
      leads={leads}
      agents={agents}
      isAdmin={true}
      selectedSource={selectedSource}
      sourceOptions={sourceOptions}
      actionPath="/admin/leads/assigned"
    />
  );
}
