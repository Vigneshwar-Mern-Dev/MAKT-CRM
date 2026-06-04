import { NextRequest, NextResponse } from "next/server";
import type { CallDirection, CallEventType, Prisma } from "@prisma/client";
import {
  authenticateCompanyPhone,
  ingestCallEvent,
} from "@/app/lib/call-tracker";

const callEventTypes = new Set(["RINGING", "ANSWERED", "ENDED", "MISSED"]);
const callDirections = new Set(["INCOMING", "OUTGOING", "UNKNOWN"]);

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

function parseOptionalNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
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
    const callDirection =
      typeof body.callDirection === "string" && callDirections.has(body.callDirection.trim())
        ? body.callDirection.trim()
        : "INCOMING";
    const occurredAt = parseOccurredAt(body.occurredAt);
    const callSessionLocalId =
      typeof body.callSessionLocalId === "string" ? body.callSessionLocalId.trim() : "";
    const androidCallLogId =
      typeof body.androidCallLogId === "string" ? body.androidCallLogId.trim() : "";
    const appVersion = typeof body.appVersion === "string" ? body.appVersion.trim() : "";
    const androidVersion =
      typeof body.androidVersion === "string" ? body.androidVersion.trim() : "";
    const deviceModel = typeof body.deviceModel === "string" ? body.deviceModel.trim() : "";
    const networkType = typeof body.networkType === "string" ? body.networkType.trim() : "";

    if (
      !eventId ||
      !deviceId ||
      !companyPhone ||
      !callEventTypes.has(eventType) ||
      !occurredAt
    ) {
      return NextResponse.json(
        {
          error:
            "eventId, deviceId, companyPhone, eventType, and valid occurredAt are required.",
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
      callSessionLocalId: callSessionLocalId || undefined,
      deviceId,
      companyPhone,
      caller: caller || undefined,
      eventType: eventType as CallEventType,
      callDirection: callDirection as CallDirection,
      occurredAt,
      durationSeconds: parseOptionalNumber(body.durationSeconds),
      androidCallLogId: androidCallLogId || undefined,
      simSlot: parseOptionalNumber(body.simSlot),
      appVersion: appVersion || undefined,
      androidVersion: androidVersion || undefined,
      deviceModel: deviceModel || undefined,
      batteryPercent: parseOptionalNumber(body.batteryPercent),
      networkType: networkType || undefined,
      pendingSyncCount: parseOptionalNumber(body.pendingSyncCount),
      permissionStatus:
        body.permissionStatus && typeof body.permissionStatus === "object"
          ? (body.permissionStatus as Prisma.InputJsonValue)
          : undefined,
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
