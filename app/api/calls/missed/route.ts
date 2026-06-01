import { NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";

export async function GET() {
  await requireUser();

  const calls = await db.callSession.findMany({
    where: { status: "MISSED" },
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
          nextFollowUpAt: true,
        },
      },
      assignedTo: {
        select: { id: true, username: true, email: true },
      },
    },
    orderBy: { firstRingAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ ok: true, calls });
}
