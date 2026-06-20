import { db } from "@/app/lib/db";
import { CallLeadsPage, type CallLeadRow } from "./call-leads-page";

type AdminCallLeadsPageProps = {
  searchParams: Promise<{
    agent?: string;
  }>;
};

export default async function AdminCallLeadsPage({ searchParams }: AdminCallLeadsPageProps) {
  const params = await searchParams;
  const [leads, agents] = await Promise.all([
    db.callLead.findMany({
    where: {
      phone: { not: { startsWith: "UNKNOWN-" } },
    },
    include: {
      assignedTo: { select: { id: true, username: true, email: true, department: true } },
      sessions: {
        include: {
          companyPhone: {
            select: { label: true, phoneNumber: true },
          },
        },
        orderBy: { firstRingAt: "desc" },
        take: 50,
      },
      activities: {
        include: {
          user: { select: { username: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      _count: { select: { sessions: true, followUps: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    }),
    db.user.findMany({
      where: { role: "USER" },
      select: { id: true, username: true, email: true, department: true },
      orderBy: { username: "asc" },
    }),
  ]);
  const leadIds = leads.map((lead) => lead.id);
  // Combine incoming/outgoing counts into a single groupBy query
  const sessionDirectionCounts = leadIds.length
    ? await db.callSession.groupBy({
        by: ["leadId", "callDirection"],
        where: {
          leadId: { in: leadIds },
          callDirection: { in: ["INCOMING", "OUTGOING"] },
        },
        _count: { _all: true },
      })
    : [];

  const incomingCountByLeadId = new Map<string, number>();
  const outgoingCountByLeadId = new Map<string, number>();

  for (const item of sessionDirectionCounts) {
    if (item.callDirection === "INCOMING") {
      incomingCountByLeadId.set(item.leadId, item._count._all);
    } else if (item.callDirection === "OUTGOING") {
      outgoingCountByLeadId.set(item.leadId, item._count._all);
    }
  }

  const rows: CallLeadRow[] = leads.map((lead) => {
    // Find the latest outgoing session and latest duration session from pre-fetched relation
    const latestOutgoingSession = lead.sessions.find((s) => s.callDirection === "OUTGOING") ?? null;
    const latestDurationSession = lead.sessions.find((s) => s.durationSeconds !== null) ?? null;

    return {
      id: lead.id,
      phone: lead.phone,
      displayName: lead.displayName,
      email: lead.email,
      city: lead.city,
      address: lead.address,
      ownershipType: lead.ownershipType,
      language: lead.language,
      message: lead.message,
      status: lead.status,
      assignedToId: lead.assignedToId,
      lastCompanyPhone: lead.lastCompanyPhone,
      lastContactedAt: lead.lastContactedAt,
      nextFollowUpAt: lead.nextFollowUpAt,
      notes: lead.notes,
      isImportant: lead.isImportant,
      locationSent: lead.locationSent,
      instagramLeadId: lead.instagramLeadId,
      sheetSyncedAt: lead.sheetSyncedAt,
      sheetSyncWarning: lead.sheetSyncWarning,
      updatedAt: lead.updatedAt,
      assignedTo: lead.assignedTo,
      sessions: lead.sessions,
      incomingCallCount: incomingCountByLeadId.get(lead.id) || 0,
      latestOutgoingSession,
      latestDurationSession,
      outgoingCallCount: outgoingCountByLeadId.get(lead.id) || 0,
      activities: lead.activities,
      _count: lead._count,
    };
  });

  return <CallLeadsPage agents={agents} initialAgentId={params.agent || "ALL"} leads={rows} />;
}
