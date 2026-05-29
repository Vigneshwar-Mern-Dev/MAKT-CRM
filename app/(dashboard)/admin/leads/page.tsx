import { db } from "@/app/lib/db";
import { LEAD_ACTIVITY_PREVIEW_LIMIT, LEAD_LIST_LIMIT } from "@/app/lib/query-limits";
import { LeadSource, SheetConnectionStatus } from "@/app/lib/prisma-enums";
import { LeadPage, LeadRow } from "./lead-page";

const sourceMeta = [
  {
    source: LeadSource.WEBSITE,
    title: "Website Leads",
    tone: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
  },
  {
    source: LeadSource.INSTAGRAM,
    title: "Instagram Leads",
    tone: "border-fuchsia-300/20 bg-fuchsia-300/10 text-fuchsia-100",
  },
];

function statusLabel(status: SheetConnectionStatus) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

async function getSourceStatuses() {
  try {
    const integrations = await db.leadIntegration.findMany();

    return {
      error: null,
      statuses: sourceMeta.map((meta) => {
        const integration = integrations.find(
          (item) => item.source === meta.source,
        );

        return {
          failedCount: integration?.failedCount ?? 0,
          importedCount: integration?.importedCount ?? 0,
          lastSyncedAt: integration?.lastSyncedAt ?? null,
          lastTestedAt: integration?.lastTestedAt ?? null,
          lastError: integration?.lastError ?? null,
          source: meta.source,
          status: statusLabel(
            integration?.status ?? SheetConnectionStatus.NOT_CONNECTED,
          ),
          title: meta.title,
          tone: meta.tone,
          secretToken: integration?.secretToken ?? null,
          sheetName: integration?.sheetName ?? null,
          spreadsheetId: integration?.spreadsheetId ?? null,
        };
      }),
    };
  } catch {
    return {
      error: "Database is unreachable. Sheet sync status cannot be loaded.",
      statuses: sourceMeta.map((meta) => ({
        failedCount: 0,
        importedCount: 0,
        lastSyncedAt: null,
        lastTestedAt: null,
        lastError: null,
        source: meta.source,
        status: "Unavailable",
        title: meta.title,
        tone: meta.tone,
        secretToken: null,
        sheetName: null,
        spreadsheetId: null,
      })),
    };
  }
}

type AdminLeadsPageProps = {
  searchParams: Promise<{
    source?: string;
  }>;
};

function parseLeadSource(value: string | undefined) {
  return value === LeadSource.INSTAGRAM
    ? LeadSource.INSTAGRAM
    : LeadSource.WEBSITE;
}

export default async function AdminLeadsPage({
  searchParams,
}: AdminLeadsPageProps) {
  const sourceOptions = [
    { label: "Website Leads", value: LeadSource.WEBSITE },
    { label: "Instagram Leads", value: LeadSource.INSTAGRAM },
  ];
  const params = await searchParams;
  const selectedSource = parseLeadSource(params.source);

  // Fetch agents directory
  const agents = await db.user.findMany({
    where: { role: "USER" },
    select: { id: true, username: true, email: true, department: true },
    orderBy: { username: "asc" },
  });

  // Fetch statuses
  const { error: statusError, statuses } = await getSourceStatuses();

  // Fetch database stored leads matching selectedSource
  let leads: LeadRow[] = [];
  try {
    const queryArgs = {
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

    if (selectedSource === LeadSource.WEBSITE) {
      leads = await db.websiteLead.findMany(queryArgs);
    } else {
      leads = await db.instagramLead.findMany(queryArgs);
    }
  } catch (err) {
    console.error("Error querying database leads in admin panel:", err);
  }

  return (
    <LeadPage
      title="All Leads"
      description="View every prospect in the CRM pipeline across all stages and owners."
      stageLabel="All leads"
      leads={leads}
      agents={agents}
      isAdmin={true}
      selectedSource={selectedSource}
      sourceOptions={sourceOptions}
      showSourceStatus={true}
      sourceStatusError={statusError}
      sourceStatuses={statuses}
      actionPath="/admin/leads"
    />
  );
}
