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
  const [incomingCounts, outgoingCounts, outgoingSessions, durationSessions] = leadIds.length
    ? await Promise.all([
        db.callSession.groupBy({
          by: ["leadId"],
          where: {
            leadId: { in: leadIds },
            callDirection: "INCOMING",
          },
          _count: { _all: true },
        }),
        db.callSession.groupBy({
          by: ["leadId"],
          where: {
            leadId: { in: leadIds },
            callDirection: "OUTGOING",
          },
          _count: { _all: true },
        }),
        db.callSession.findMany({
          where: {
            leadId: { in: leadIds },
            callDirection: "OUTGOING",
          },
          include: {
            companyPhone: {
              select: { label: true, phoneNumber: true },
            },
          },
          orderBy: { firstRingAt: "desc" },
        }),
        db.callSession.findMany({
          where: {
            leadId: { in: leadIds },
            durationSeconds: { not: null },
          },
          include: {
            companyPhone: {
              select: { label: true, phoneNumber: true },
            },
          },
          orderBy: { firstRingAt: "desc" },
        }),
      ])
    : [[], [], [], []];
  const incomingCountByLeadId = new Map(
    incomingCounts.map((count) => [count.leadId, count._count._all]),
  );
  const outgoingCountByLeadId = new Map(
    outgoingCounts.map((count) => [count.leadId, count._count._all]),
  );
  const latestOutgoingSessionByLeadId = new Map<string, (typeof outgoingSessions)[number]>();
  const latestDurationSessionByLeadId = new Map<string, (typeof durationSessions)[number]>();

  for (const session of outgoingSessions) {
    if (!latestOutgoingSessionByLeadId.has(session.leadId)) {
      latestOutgoingSessionByLeadId.set(session.leadId, session);
    }
  }

  for (const session of durationSessions) {
    if (!latestDurationSessionByLeadId.has(session.leadId)) {
      latestDurationSessionByLeadId.set(session.leadId, session);
    }
  }

  const rows: CallLeadRow[] = leads.map((lead) => ({
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
    latestOutgoingSession: latestOutgoingSessionByLeadId.get(lead.id) || null,
    latestDurationSession: latestDurationSessionByLeadId.get(lead.id) || null,
    outgoingCallCount: outgoingCountByLeadId.get(lead.id) || 0,
    activities: lead.activities,
    _count: lead._count,
  }));

  return <CallLeadsPage agents={agents} initialAgentId={params.agent || "ALL"} leads={rows} />;
}
