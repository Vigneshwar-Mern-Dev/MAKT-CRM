import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import type { CallEventType, Prisma } from "@prisma/client";
import { db } from "./db";

const openSessionStatuses = ["RINGING", "ANSWERED"] as const;

export type RegisterCompanyPhoneInput = {
  companyPhone: string;
  deviceId: string;
  label?: string;
};

export type CallTrackerEventInput = {
  eventId: string;
  deviceId: string;
  companyPhone: string;
  caller?: string;
  eventType: CallEventType;
  occurredAt: Date;
  rawPayload: Prisma.InputJsonValue;
};

export function normalizeIndianPhoneNumber(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  let digits = value.replace(/\D/g, "");

  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length >= 8) {
    return `+${digits}`;
  }

  return null;
}

export function hashDeviceToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isSameHash(value: string, expected: string) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);

  return (
    valueBuffer.length === expectedBuffer.length &&
    timingSafeEqual(valueBuffer, expectedBuffer)
  );
}

export function validateRegistrationSecret(secret: unknown) {
  const expected = process.env.CALL_TRACKER_REGISTRATION_SECRET;

  if (!expected) {
    throw new Error("CALL_TRACKER_REGISTRATION_SECRET is not configured.");
  }

  if (typeof secret !== "string" || !secret.trim()) {
    return false;
  }

  return isSameHash(hashDeviceToken(secret.trim()), hashDeviceToken(expected));
}

export async function registerCompanyPhone(input: RegisterCompanyPhoneInput) {
  const phoneNumber = normalizeIndianPhoneNumber(input.companyPhone);
  const deviceId = input.deviceId.trim();

  if (!phoneNumber || !deviceId) {
    throw new Error("A valid companyPhone and deviceId are required.");
  }

  const deviceToken = randomBytes(32).toString("hex");
  const authTokenHash = hashDeviceToken(deviceToken);
  const label = input.label?.trim() || phoneNumber;

  const companyPhone = await db.$transaction(async (tx) => {
    const existingPhones = await tx.companyPhone.findMany({
      where: {
        OR: [{ deviceId }, { phoneNumber }],
      },
    });
    const uniqueMatches = new Map(existingPhones.map((phone) => [phone.id, phone]));

    if (uniqueMatches.size > 1) {
      throw new Error(
        "This phone number and device ID are already linked to different company phones.",
      );
    }

    const existingPhone = existingPhones[0];

    if (existingPhone) {
      return tx.companyPhone.update({
        where: { id: existingPhone.id },
        data: {
          phoneNumber,
          label,
          deviceId,
          authTokenHash,
          isActive: true,
          lastSeenAt: new Date(),
        },
      });
    }

    return tx.companyPhone.create({
      data: {
        phoneNumber,
        label,
        deviceId,
        authTokenHash,
        isActive: true,
        lastSeenAt: new Date(),
      },
    });
  });

  return {
    companyPhone,
    deviceToken,
  };
}

export async function authenticateCompanyPhone(deviceId: string, token: string) {
  const companyPhone = await db.companyPhone.findUnique({
    where: { deviceId },
  });

  if (!companyPhone?.isActive) {
    return null;
  }

  const incomingHash = hashDeviceToken(token);

  if (!isSameHash(incomingHash, companyPhone.authTokenHash)) {
    return null;
  }

  return companyPhone;
}

function eventActivityType(eventType: CallEventType) {
  if (eventType === "RINGING") {
    return "CALL_RINGING" as const;
  }

  if (eventType === "ANSWERED") {
    return "CALL_ANSWERED" as const;
  }

  if (eventType === "MISSED") {
    return "CALL_MISSED" as const;
  }

  return "CALL_COMPLETED" as const;
}

function sessionStatusForEvent(eventType: CallEventType, wasAnswered: boolean) {
  if (eventType === "RINGING") {
    return "RINGING" as const;
  }

  if (eventType === "ANSWERED") {
    return "ANSWERED" as const;
  }

  if (eventType === "MISSED") {
    return "MISSED" as const;
  }

  return wasAnswered ? ("COMPLETED" as const) : ("MISSED" as const);
}

export async function ingestCallEvent(input: CallTrackerEventInput) {
  const callerNumber = normalizeIndianPhoneNumber(input.caller);
  const companyPhoneNumber = normalizeIndianPhoneNumber(input.companyPhone);

  if (!companyPhoneNumber) {
    throw new Error("A valid companyPhone value is required.");
  }

  const duplicateEvent = await db.callEvent.findUnique({
    where: { eventId: input.eventId },
    select: { id: true, sessionId: true },
  });

  if (duplicateEvent) {
    return {
      duplicate: true,
      eventId: duplicateEvent.id,
      sessionId: duplicateEvent.sessionId,
    };
  }

  const companyPhone = await db.companyPhone.findFirst({
    where: {
      deviceId: input.deviceId,
      phoneNumber: companyPhoneNumber,
      isActive: true,
    },
  });

  if (!companyPhone) {
    throw new Error("Registered company phone was not found or is inactive.");
  }

  return db.$transaction(async (tx) => {
    const latestOpenSession = await tx.callSession.findFirst({
      where: {
        companyPhoneId: companyPhone.id,
        status: { in: [...openSessionStatuses] },
        endedAt: null,
      },
      include: {
        lead: true,
      },
      orderBy: { firstRingAt: "desc" },
    });
    const effectiveCallerNumber =
      callerNumber || latestOpenSession?.callerNumber || `UNKNOWN-${companyPhone.id}`;
    const isUnknownCaller = effectiveCallerNumber.startsWith("UNKNOWN-");

    const lead = await tx.callLead.upsert({
      where: { phone: effectiveCallerNumber },
      update: {
        lastCompanyPhone: companyPhone.phoneNumber,
      },
      create: {
        phone: effectiveCallerNumber,
        displayName: isUnknownCaller ? "Unknown Caller" : `Caller ${effectiveCallerNumber.slice(-4)}`,
        firstCompanyPhone: companyPhone.phoneNumber,
        lastCompanyPhone: companyPhone.phoneNumber,
      },
    });

    const openSession =
      latestOpenSession?.callerNumber === effectiveCallerNumber ? latestOpenSession : null;

    const existingAnsweredAt = openSession?.answeredAt ?? null;
    const answeredAt =
      input.eventType === "ANSWERED" && !existingAnsweredAt
        ? input.occurredAt
        : existingAnsweredAt;
    const endedAt =
      input.eventType === "ENDED" || input.eventType === "MISSED"
        ? input.occurredAt
        : openSession?.endedAt ?? null;
    const status = sessionStatusForEvent(input.eventType, Boolean(answeredAt));
    const durationSeconds =
      endedAt && answeredAt
        ? Math.max(0, Math.round((endedAt.getTime() - answeredAt.getTime()) / 1000))
        : null;

    const session = openSession
      ? await tx.callSession.update({
          where: { id: openSession.id },
          data: {
            leadId: lead.id,
            answeredAt,
            endedAt,
            durationSeconds,
            status,
          },
        })
      : await tx.callSession.create({
          data: {
            companyPhoneId: companyPhone.id,
            callerNumber: effectiveCallerNumber,
            leadId: lead.id,
            firstRingAt: input.occurredAt,
            answeredAt,
            endedAt,
            durationSeconds,
            status,
          },
        });

    const event = await tx.callEvent.create({
      data: {
        eventId: input.eventId,
        companyPhoneId: companyPhone.id,
        sessionId: session.id,
        callerNumber: effectiveCallerNumber,
        eventType: input.eventType,
        occurredAt: input.occurredAt,
        rawPayload: input.rawPayload,
      },
    });

    await tx.callActivity.create({
      data: {
        leadId: lead.id,
        sessionId: session.id,
        actionType: eventActivityType(input.eventType),
        description: `Call event ${input.eventType} from ${effectiveCallerNumber} to ${companyPhone.phoneNumber}`,
        metadata: {
          eventId: input.eventId,
          companyPhone: companyPhone.phoneNumber,
          caller: effectiveCallerNumber,
        },
      },
    });

    await tx.companyPhone.update({
      where: { id: companyPhone.id },
      data: { lastSeenAt: new Date() },
    });

    return {
      duplicate: false,
      eventId: event.id,
      sessionId: session.id,
      leadId: lead.id,
      status: session.status,
    };
  });
}
