import { NextRequest, NextResponse } from "next/server";
import type { CallDirection, CallEventType, Prisma } from "@prisma/client";
import {
  authenticateCompanyPhone,
  ingestCallEvent,
} from "@/app/lib/call-tracker";

const callEventTypes = new Set(["RINGING", "ANSWERED", "ENDED", "MISSED", "OUTGOING"]);
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

function parseOptionalBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }

  return undefined;
}

function parseOptionalDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function apiError(error: string, status: number, retryable: boolean) {
  return NextResponse.json(
    {
      ok: false,
      error,
      retryable,
      serverTime: new Date().toISOString(),
    },
    { status },
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const token = getBearerToken(request);

    if (!token) {
      return apiError("Bearer token is required.", 401, false);
    }

    const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
    const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
    const companyPhone = typeof body.companyPhone === "string" ? body.companyPhone.trim() : "";
    const caller = typeof body.caller === "string" ? body.caller.trim() : "";
    const eventType = typeof body.eventType === "string" ? body.eventType.trim() : "";
    const normalizedEventType = eventType === "OUTGOING" ? "ANSWERED" : eventType;
    const callDirection =
      eventType === "OUTGOING"
        ? "OUTGOING"
        : typeof body.callDirection === "string" && callDirections.has(body.callDirection.trim())
          ? body.callDirection.trim()
          : "INCOMING";
    const occurredAt = parseOccurredAt(body.occurredAt);
    const callSessionLocalId =
      typeof body.callSessionLocalId === "string" ? body.callSessionLocalId.trim() : "";
    const androidCallLogId = parseOptionalString(body.androidCallLogId);
    const appVersion = parseOptionalString(body.appVersion);
    const androidVersion = parseOptionalString(body.androidVersion);
    const deviceModel = parseOptionalString(body.deviceModel);
    const networkType = parseOptionalString(body.networkType);
    const simDisplayName = parseOptionalString(body.simDisplayName);
    const simCarrierName = parseOptionalString(body.simCarrierName);
    const simSubscriptionId = parseOptionalString(body.simSubscriptionId);
    const localContactName = parseOptionalString(body.localContactName);
    const lastSyncError =
      body.lastSyncError === null ? null : parseOptionalString(body.lastSyncError);

    if (
      !eventId ||
      !deviceId ||
      !companyPhone ||
      !callEventTypes.has(eventType) ||
      !occurredAt
    ) {
      return apiError(
        "eventId, deviceId, companyPhone, eventType, and valid occurredAt are required.",
        400,
        false,
      );
    }

    const authenticatedPhone = await authenticateCompanyPhone(deviceId, token);

    if (!authenticatedPhone) {
      return apiError("Unauthorized device.", 401, false);
    }

    const result = await ingestCallEvent({
      eventId,
      callSessionLocalId: callSessionLocalId || undefined,
      deviceId,
      companyPhone,
      caller: caller || undefined,
      eventType: normalizedEventType as CallEventType,
      callDirection: callDirection as CallDirection,
      occurredAt,
      durationSeconds: parseOptionalNumber(body.durationSeconds),
      androidCallLogId,
      simSlot: parseOptionalNumber(body.simSlot),
      simDisplayName,
      simCarrierName,
      simSubscriptionId,
      localContactName,
      retryCount: parseOptionalNumber(body.retryCount),
      appVersion,
      androidVersion,
      deviceModel,
      batteryPercent: parseOptionalNumber(body.batteryPercent),
      isCharging: parseOptionalBoolean(body.isCharging),
      chargingType: parseOptionalString(body.chargingType),
      networkType,
      pendingSyncCount: parseOptionalNumber(body.pendingSyncCount),
      lastSyncAttemptAt: parseOptionalDate(body.lastSyncAttemptAt),
      lastSuccessfulSyncAt: parseOptionalDate(body.lastSuccessfulSyncAt),
      lastSyncError,
      lastSyncErrorAt: parseOptionalDate(body.lastSyncErrorAt),
      syncRetryCount: parseOptionalNumber(body.syncRetryCount),
      permissionStatus:
        body.permissionStatus && typeof body.permissionStatus === "object"
          ? (body.permissionStatus as Prisma.InputJsonValue)
          : undefined,
      rawPayload: body as Prisma.InputJsonValue,
    });

    return NextResponse.json({
      ok: true,
      retryable: false,
      serverTime: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error("Call tracker event ingestion failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: getErrorMessage(error, "Call tracker event ingestion failed."),
        retryable: true,
        serverTime: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
