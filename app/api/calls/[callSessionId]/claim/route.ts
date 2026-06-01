import { NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { requireUser } from "@/app/lib/session";

type RouteContext = {
  params: Promise<{
    callSessionId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const user = await requireUser();
  const { callSessionId } = await context.params;

  const session = await db.callSession.findUnique({
    where: { id: callSessionId },
    select: { id: true, leadId: true, assignedToId: true },
  });

  if (!session) {
    return NextResponse.json({ error: "Call session not found." }, { status: 404 });
  }

  if (session.assignedToId && session.assignedToId !== user.id) {
    return NextResponse.json(
      { error: "This call has already been claimed." },
      { status: 409 },
    );
  }

  const claimed = await db.callSession.updateMany({
    where: {
      id: callSessionId,
      OR: [{ assignedToId: null }, { assignedToId: user.id }],
    },
    data: { assignedToId: user.id },
  });

  if (claimed.count !== 1) {
    return NextResponse.json(
      { error: "This call has already been claimed." },
      { status: 409 },
    );
  }

  await db.callLead.update({
    where: { id: session.leadId },
    data: { assignedToId: user.id },
  });

  await db.callActivity.create({
    data: {
      leadId: session.leadId,
      sessionId: session.id,
      userId: user.id,
      actionType: "ASSIGNMENT_CHANGE",
      description: `Call claimed by ${user.username}`,
    },
  });

  return NextResponse.json({ ok: true });
}
