import { db } from "@/app/lib/db";
import { expireStaleRingingCalls } from "@/app/lib/call-session-maintenance";
import { requireRole } from "@/app/lib/session";
import { UserCallbacksPageClient } from "./callbacks-page";

export default async function UserCallbacksPage() {
  const user = await requireRole("USER");
  await expireStaleRingingCalls();
  const actionableStatuses = ["NEW", "CONTACTED", "FOLLOW_UP", "INTERESTED", "NO_RESPONSE"] as const;

  const leadSelect = {
    id: true,
    displayName: true,
    phone: true,
    email: true,
    city: true,
    address: true,
    ownershipType: true,
    locationSent: true,
    language: true,
    message: true,
    status: true,
    assignedToId: true,
    nextFollowUpAt: true,
    notes: true,
    createdAt: true,
    localContactName: true,
    _count: { select: { sessions: true } },
  };

  const [activeCalls, openLeads, calls] = await Promise.all([
    db.callSession.findMany({
      where: {
        status: { in: ["RINGING", "ANSWERED"] },
        endedAt: null,
        OR: [
          { assignedToId: user.id },
          { lead: { assignedToId: user.id } },
        ],
      },
      include: {
        companyPhone: { select: { label: true, phoneNumber: true } },
        lead: { select: leadSelect },
      },
      orderBy: { firstRingAt: "desc" },
      take: 25,
    }),
    db.callLead.findMany({
      where: {
        assignedToId: null,
        phone: { not: { startsWith: "UNKNOWN-" } },
        status: { in: [...actionableStatuses] },
      },
      select: leadSelect,
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    db.callSession.findMany({
      where: {
        status: "MISSED",
        lead: { assignedToId: null, status: { notIn: ["CONVERTED", "CLOSED", "NOT_INTERESTED"] } },
      },
      orderBy: { firstRingAt: "asc" },
      take: 100,
      include: {
        companyPhone: { select: { label: true, phoneNumber: true } },
        lead: { select: leadSelect },
      },
    }),
  ]);

  return <UserCallbacksPageClient activeCalls={activeCalls} calls={calls} currentUserId={user.id} openLeads={openLeads} />;
}
