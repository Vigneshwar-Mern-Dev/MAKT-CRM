import { db } from "@/app/lib/db";
import { LEAD_ACTIVITY_PREVIEW_LIMIT, LEAD_LIST_LIMIT } from "@/app/lib/query-limits";
import { LeadSource } from "@/app/lib/prisma-enums";
import { LeadPage, LeadRow } from "@/app/(dashboard)/admin/leads/lead-page";
import { requireRole } from "@/app/lib/session";

type UserLeadsPageProps = {
  searchParams: Promise<{
    source?: string;
  }>;
};

function parseLeadSource(value: string | undefined) {
  return value === LeadSource.INSTAGRAM
    ? LeadSource.INSTAGRAM
    : LeadSource.WEBSITE;
}

export default async function UserLeadsPage({
  searchParams,
}: UserLeadsPageProps) {
  const sourceOptions = [
    { label: "Website Leads", value: LeadSource.WEBSITE },
    { label: "Instagram Leads", value: LeadSource.INSTAGRAM },
  ];
  const params = await searchParams;
  const selectedSource = parseLeadSource(params.source);

  // Authenticate user & enforce USER role
  const user = await requireRole("USER");

  // Query database stored Website / Instagram leads assigned to the authenticated agent
  let leads: LeadRow[] = [];
  try {
    const queryArgs = {
      where: {
        assignedToId: user.id,
      },
      orderBy: { createdAt: "desc" as const },
      take: LEAD_LIST_LIMIT,
      include: {
        assignedTo: {
          select: { id: true, username: true, email: true },
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

    if (selectedSource === LeadSource.WEBSITE) {
      leads = await db.websiteLead.findMany(queryArgs);
    } else {
      leads = await db.instagramLead.findMany(queryArgs);
    }
  } catch (err) {
    console.error("Error querying agent leads from database:", err);
  }

  return (
    <LeadPage
      title="My Assigned Leads"
      description="View and progress prospects assigned specifically to you in your personal workflow pipeline."
      stageLabel="My pipeline"
      leads={leads}
      isAdmin={false}
      selectedSource={selectedSource}
      sourceOptions={sourceOptions}
      showSourceStatus={false}
      actionPath="/user/leads"
    />
  );
}
