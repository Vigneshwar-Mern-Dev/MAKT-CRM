import { db } from "@/app/lib/db";
import { CallLeadsPage, type CallLeadRow } from "./call-leads-page";

export default async function AdminCallLeadsPage() {
  const [leads, agents] = await Promise.all([
    db.callLead.findMany({
    include: {
      assignedTo: { select: { id: true, username: true, email: true, department: true } },
      sessions: {
        include: {
          companyPhone: {
            select: { label: true, phoneNumber: true },
          },
        },
        orderBy: { firstRingAt: "desc" },
        take: 1,
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
  const rows: CallLeadRow[] = leads.map((lead) => ({
    id: lead.id,
    phone: lead.phone,
    displayName: lead.displayName,
    email: lead.email,
    city: lead.city,
    address: lead.address,
    ownershipType: lead.ownershipType,
    provider: lead.provider,
    language: lead.language,
    message: lead.message,
    status: lead.status,
    assignedToId: lead.assignedToId,
    lastCompanyPhone: lead.lastCompanyPhone,
    lastContactedAt: lead.lastContactedAt,
    nextFollowUpAt: lead.nextFollowUpAt,
    notes: lead.notes,
    instagramLeadId: lead.instagramLeadId,
    sheetSyncedAt: lead.sheetSyncedAt,
    sheetSyncWarning: lead.sheetSyncWarning,
    updatedAt: lead.updatedAt,
    assignedTo: lead.assignedTo,
    sessions: lead.sessions,
    activities: lead.activities,
    _count: lead._count,
  }));

  return <CallLeadsPage agents={agents} leads={rows} />;
}
