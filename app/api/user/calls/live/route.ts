import { NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { expireStaleRingingCalls } from "@/app/lib/call-session-maintenance";
import { requireRole } from "@/app/lib/session";

export async function GET() {
  const user = await requireRole("USER");
  await expireStaleRingingCalls();

  const calls = await db.callSession.findMany({
    where: {
      status: { in: ["RINGING", "ANSWERED"] },
      endedAt: null,
      OR: [
        { assignedToId: user.id },
        { lead: { assignedToId: user.id } },
      ],
    },
    include: {
      companyPhone: {
        select: { id: true, phoneNumber: true, label: true },
      },
      lead: {
        select: {
          id: true,
          phone: true,
          displayName: true,
          status: true,
          assignedToId: true,
          createdAt: true,
          localContactName: true,
          _count: { select: { sessions: true } },
        },
      },
      assignedTo: {
        select: { id: true, username: true, email: true },
      },
    },
    orderBy: { firstRingAt: "desc" },
  });

  return NextResponse.json({ ok: true, serverTime: new Date().toISOString(), calls });
}
