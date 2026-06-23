export const dynamic = "force-dynamic";

import { db } from "@/app/lib/db";
import { WhatsAppLeadStatus } from "@/app/lib/prisma-enums";
import { WhatsAppLeadsClient } from "./whatsapp-leads-client";

type PageProps = {
  searchParams: Promise<{ page?: string }>;
};

const PAGE_SIZE = 100;

function getRestTimeOffsetSeconds() {
  const now = new Date();
  if (now.getHours() === 0) {
    const restEnd = new Date(now);
    restEnd.setHours(1, 0, 0, 0); // 1:00 AM
    return Math.max(0, Math.ceil((restEnd.getTime() - now.getTime()) / 1000));
  }
  return 0;
}

export default async function AdminWhatsAppLeadsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  // Fetch last 7 days as a buffer so the client can switch between Today / Last 24h / Custom
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  // Fetch everything in parallel
  const [leads, failedCount, total, incomingCallLeads, allQueuedLeads, waAccount] = await Promise.all([
    db.whatsAppLead.findMany({
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        displayName: true,
        phone: true,
        message: true,
        status: true,
        lastSentAt: true,
        lastReplyAt: true,
        lastReplySnippet: true,
        lastError: true,
        createdAt: true,
        updatedAt: true,
        formToken: true,
        formSubmittedAt: true,
        formName: true,
        formCity: true,
        formPropertyType: true,
        formMapsLocation: true,
      },
    }),
    db.whatsAppLead.count({ where: { status: WhatsAppLeadStatus.FAILED } }),
    db.whatsAppLead.count(),
    // Pull INCOMING call leads created TODAY only — auto-cleared at midnight each day
    db.callLead.findMany({
      where: {
        sessions: {
          some: { callDirection: "INCOMING" },
        },
        phone: { not: { startsWith: "UNKNOWN-" } },
        createdAt: { gte: sevenDaysAgo },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        displayName: true,
        phone: true,
        updatedAt: true,
        createdAt: true,
      },
    }),
    // Fetch ALL queued WA leads (for accurate queue position across all pages)
    db.whatsAppLead.findMany({
      where: { status: WhatsAppLeadStatus.QUEUED },
      orderBy: { updatedAt: "asc" }, // FIFO: oldest first
      select: { id: true, phone: true, updatedAt: true },
    }),
    // Get real delay settings
    db.whatsAppAccount.findFirst({
      orderBy: { createdAt: "asc" },
      select: { minDelaySeconds: true, maxDelaySeconds: true, status: true, autoReplyEnabled: true },
    }),
  ]);

  // Also fetch all WA leads by phone for the incoming calls lookup (not just paginated)
  const allWaLeadsByPhone = await db.whatsAppLead.findMany({
    where: {
      phone: { in: incomingCallLeads.map((cl) => cl.phone) },
    },
    select: { id: true, phone: true, status: true },
  });

  const waLeadByPhone = new Map(allWaLeadsByPhone.map((l) => [l.phone, l]));

  // Build queue position map (FIFO)
  const queuePositionByPhone = new Map<string, number>();
  allQueuedLeads.forEach((ql, idx) => {
    queuePositionByPhone.set(ql.phone, idx + 1);
  });

  // Real average delay per message (in seconds)
  const avgDelay = waAccount
    ? Math.round((waAccount.minDelaySeconds + waAccount.maxDelaySeconds) / 2)
    : 120; // fallback 2 min

  const serverTime = Date.now();
  const restOffset = getRestTimeOffsetSeconds();
  const baseTime = serverTime + restOffset * 1000;

  // Annotate leads with targetTime for stable countdown
  const leadsWithTargetTime = leads.map((l) => {
    if (l.status === WhatsAppLeadStatus.QUEUED) {
      const queuePos = queuePositionByPhone.get(l.phone) ?? null;
      const targetTime = queuePos
        ? new Date(baseTime + queuePos * avgDelay * 1000).toISOString()
        : null;
      return { ...l, targetTime };
    }
    return { ...l, targetTime: null };
  });

  // Annotate each call lead with WA status + queue position + targetTime
  const callLeadsWithWaStatus = incomingCallLeads.map((cl) => {
    const waLead = waLeadByPhone.get(cl.phone);
    const queuePos = queuePositionByPhone.get(cl.phone) ?? null;
    const targetTime = queuePos
      ? new Date(baseTime + queuePos * avgDelay * 1000).toISOString()
      : null;

    return {
      ...cl,
      waStatus: waLead?.status ?? null,
      waLeadId: waLead?.id ?? null,
      queuePosition: queuePos,
      targetTime,
    };
  });

  return (
    <WhatsAppLeadsClient
      leads={leadsWithTargetTime}
      failedCount={failedCount}
      total={total}
      page={page}
      totalPages={Math.ceil(total / PAGE_SIZE)}
      incomingCallLeads={callLeadsWithWaStatus}
      avgDelaySeconds={avgDelay}
      totalQueued={allQueuedLeads.length}
      accountStatus={waAccount?.status ?? "DISCONNECTED"}
      autoReplyEnabled={waAccount?.autoReplyEnabled ?? false}
      serverTime={serverTime}
    />
  );
}
