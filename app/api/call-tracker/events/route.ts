import { NextRequest, NextResponse } from "next/server";
import type { CallEventType, Prisma } from "@prisma/client";
import {
  authenticateCompanyPhone,
  ingestCallEvent,
} from "@/app/lib/call-tracker";

const callEventTypes = new Set(["RINGING", "ANSWERED", "ENDED", "MISSED"]);

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
}

function parseOccurredAt(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json({ error: "Bearer token is required." }, { status: 401 });
    }

    const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
    const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
    const companyPhone = typeof body.companyPhone === "string" ? body.companyPhone.trim() : "";
    const caller = typeof body.caller === "string" ? body.caller.trim() : "";
    const eventType = typeof body.eventType === "string" ? body.eventType.trim() : "";
    const occurredAt = parseOccurredAt(body.occurredAt);

    if (
      !eventId ||
      !deviceId ||
      !companyPhone ||
      !caller ||
      !callEventTypes.has(eventType) ||
      !occurredAt
    ) {
      return NextResponse.json(
        {
          error:
            "eventId, deviceId, companyPhone, caller, eventType, and valid occurredAt are required.",
        },
        { status: 400 },
      );
    }

    const authenticatedPhone = await authenticateCompanyPhone(deviceId, token);

    if (!authenticatedPhone) {
      return NextResponse.json({ error: "Unauthorized device." }, { status: 401 });
    }

    const result = await ingestCallEvent({
      eventId,
      deviceId,
      companyPhone,
      caller,
      eventType: eventType as CallEventType,
      occurredAt,
      rawPayload: body as Prisma.InputJsonValue,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Call tracker event ingestion failed:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Call tracker event ingestion failed.") },
      { status: 500 },
    );
  }
}
