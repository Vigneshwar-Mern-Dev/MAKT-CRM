"use server";

import "server-only";

import { db } from "./db";

const RINGING_TIMEOUT_MS = 30 * 1000;

export async function expireStaleRingingCalls() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - RINGING_TIMEOUT_MS);
  const staleCalls = await db.callSession.findMany({
    where: {
      status: "RINGING",
      endedAt: null,
      firstRingAt: { lte: cutoff },
    },
    select: {
      id: true,
      leadId: true,
      callerNumber: true,
      companyPhone: { select: { phoneNumber: true } },
    },
  });

  if (!staleCalls.length) {
    return 0;
  }

  await db.$transaction(
    staleCalls.flatMap((call) => [
      db.callSession.update({
        where: { id: call.id },
        data: {
          status: "MISSED",
          endedAt: now,
        },
      }),
      db.callActivity.create({
        data: {
          leadId: call.leadId,
          sessionId: call.id,
          actionType: "CALL_MISSED",
          description: `Call auto-marked missed after 30 seconds from ${call.callerNumber} to ${call.companyPhone.phoneNumber}`,
        },
      }),
    ]),
  );

  return staleCalls.length;
}
