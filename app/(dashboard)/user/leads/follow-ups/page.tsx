import { db } from "@/app/lib/db";
import { LEAD_ACTIVITY_PREVIEW_LIMIT, LEAD_LIST_LIMIT } from "@/app/lib/query-limits";
import { LeadSource } from "@/app/lib/prisma-enums";
import { LeadPage, LeadRow } from "@/app/(dashboard)/admin/leads/lead-page";
import { requireRole } from "@/app/lib/session";

type UserFollowUpsPageProps = {
  searchParams: Promise<{
    source?: string;
  }>;
};

function parseLeadSource(value: string | undefined) {
  return value === LeadSource.INSTAGRAM
    ? LeadSource.INSTAGRAM
    : LeadSource.WEBSITE;
}

export default async function UserFollowUpsPage({
  searchParams,
}: UserFollowUpsPageProps) {
  const sourceOptions = [
    { label: "Website Leads", value: LeadSource.WEBSITE },
    { label: "Instagram Leads", value: LeadSource.INSTAGRAM },
  ];
  const params = await searchParams;
  const selectedSource = parseLeadSource(params.source);

  // Authenticate user & enforce USER role
  const user = await requireRole("USER");

  // Query database Website / Instagram leads assigned to this agent where stage === FOLLOW_UP
  // Sorted chronologically by nextFollowUpAt ASC so urgent follow-ups appear at the top
  let leads: LeadRow[] = [];
  try {
    const queryArgs = {
      where: {
        assignedToId: user.id,
        stage: "FOLLOW_UP" as const,
      },
      orderBy: { nextFollowUpAt: "asc" as const },
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
    console.error("Error querying agent follow-up leads:", err);
  }

  return (
    <LeadPage
      title="My Follow-ups"
      description="Monitor leads waiting for a scheduled call, message, or email follow-up."
      stageLabel="Follow-up queue"
      leads={leads}
      isAdmin={false}
      selectedSource={selectedSource}
      sourceOptions={sourceOptions}
      showSourceStatus={false}
      actionPath="/user/leads/follow-ups"
    />
  );
}
