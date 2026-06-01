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

  return <CallLeadsPage agents={agents} leads={leads as CallLeadRow[]} />;
}
