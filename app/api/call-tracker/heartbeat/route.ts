import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import {
  authenticateCompanyPhone,
  updateCompanyPhoneHealth,
} from "@/app/lib/call-tracker";

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
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
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
  const token = getBearerToken(request);

  if (!deviceId || !token) {
    return apiError("deviceId and bearer token are required.", 400, false);
  }

  const companyPhone = await authenticateCompanyPhone(deviceId, token);

  if (!companyPhone) {
    return apiError("Unauthorized device.", 401, false);
  }

  try {
    await updateCompanyPhoneHealth(companyPhone.id, {
      appVersion: parseOptionalString(body.appVersion),
      androidVersion: parseOptionalString(body.androidVersion),
      deviceModel: parseOptionalString(body.deviceModel),
      batteryPercent: parseOptionalNumber(body.batteryPercent),
      isCharging: parseOptionalBoolean(body.isCharging),
      chargingType: parseOptionalString(body.chargingType),
      networkType: parseOptionalString(body.networkType),
      pendingSyncCount: parseOptionalNumber(body.pendingSyncCount),
      lastSyncAttemptAt: parseOptionalDate(body.lastSyncAttemptAt),
      lastSuccessfulSyncAt: parseOptionalDate(body.lastSuccessfulSyncAt),
      lastSyncError:
        body.lastSyncError === null ? null : parseOptionalString(body.lastSyncError),
      lastSyncErrorAt: parseOptionalDate(body.lastSyncErrorAt),
      syncRetryCount: parseOptionalNumber(body.syncRetryCount),
      permissionStatus:
        body.permissionStatus && typeof body.permissionStatus === "object"
          ? (body.permissionStatus as Prisma.InputJsonValue)
          : undefined,
    });
  } catch (error) {
    console.error("Call tracker heartbeat failed:", error);
    return apiError("Call tracker heartbeat failed.", 500, true);
  }

  return NextResponse.json({
    ok: true,
    retryable: false,
    serverTime: new Date().toISOString(),
  });
}
