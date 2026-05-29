import "server-only";

import { timingSafeEqual } from "crypto";
import type { LeadIntegration } from "@prisma/client";
import { db } from "./db";
import { LeadSource, SheetConnectionStatus } from "./prisma-enums";

const ATM_ID_KEYS = ["ATM-ID", "ATM ID", "atmId", "AtmId", "atm-id"];
const PHONE_KEYS = [
  "Phone",
  "phone",
  "Mobile",
  "mobile",
  "Mobile Number",
  "mobileNumber",
  "WhatsApp",
  "Whatsapp",
  "WhatsApp Number",
  "Number",
  "number",
  "Contact",
  "contact",
];
const NAME_KEYS = ["Name", "name", "Full Name", "Customer Name", "Instagram Name", "Username"];
const CITY_KEYS = ["City", "city", "City / State", "State", "Location", "Address"];
const ADDRESS_KEYS = ["Address", "address", "Full Address", "Location Address"];
const OWNERSHIP_KEYS = ["Own/Rental", "Own / Rental", "Ownership", "Ownership Type", "Property Type"];
const PROVIDER_KEYS = ["Provider", "provider", "Business", "Business Type"];
const LANGUAGE_KEYS = ["Language", "language", "Lang"];
const MESSAGE_KEYS = ["Message", "message", "DM", "Comment", "Query", "Note"];
const SOURCE_KEYS = ["Source", "source"];
const TIMESTAMP_KEYS = ["Timestamp", "timestamp", "syncedAt", "Date", "date", "Created At"];

export type MappedLeadRow = {
  atmId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  address: string | null;
  ownershipType: string | null;
  provider: string | null;
  language: string | null;
  message: string | null;
  sheetSource: string;
  parsedTimestamp: Date;
};

export function cleanLeadSyncToken(token: string | null | undefined) {
  return token ? token.replace(/^['"]|['"]$/g, "").trim() : "";
}

export function isValidLeadSyncToken(
  expectedToken: string | null | undefined,
  incomingToken: string | null | undefined,
) {
  const expected = cleanLeadSyncToken(expectedToken);
  const incoming = cleanLeadSyncToken(incomingToken);

  if (!expected || !incoming) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const incomingBuffer = Buffer.from(incoming);

  return (
    expectedBuffer.length === incomingBuffer.length &&
    timingSafeEqual(expectedBuffer, incomingBuffer)
  );
}

export function buildLeadAppsScriptUrl(appScriptUrl: string, secretToken: string | null) {
  const url = new URL(appScriptUrl);
  const key = cleanLeadSyncToken(secretToken);

  if (key) {
    url.searchParams.set("key", key);
  }

  return url;
}

function readLeadValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];

    if (value === undefined || value === null) {
      continue;
    }

    const text = String(value).trim();

    if (text) {
      return text;
    }
  }

  return null;
}

function normalizePhoneNumber(value: string | null) {
  if (!value) {
    return null;
  }

  let digits = value.replace(/\D/g, "");

  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  return digits.length >= 6 ? digits : null;
}

function buildFallbackAtmId(
  row: Record<string, unknown>,
  source: LeadSource,
  phone: string | null,
) {
  if (phone) {
    return source === LeadSource.INSTAGRAM ? `IG-${phone}` : `WEB-${phone}`;
  }

  const rowNumber = readLeadValue(row, ["rowNumber", "sheetRow"]);

  if (rowNumber) {
    return `${source === LeadSource.INSTAGRAM ? "IG" : "WEB"}-ROW-${rowNumber}`;
  }

  return null;
}

export function mapIncomingLeadRow(
  row: Record<string, unknown>,
  source: LeadSource,
): MappedLeadRow {
  const rawPhone = readLeadValue(row, PHONE_KEYS);
  const normalizedPhone = normalizePhoneNumber(rawPhone);
  const phone =
    source === LeadSource.INSTAGRAM ? normalizedPhone || rawPhone : rawPhone;
  const atmId =
    readLeadValue(row, ATM_ID_KEYS) || buildFallbackAtmId(row, source, phone);
  const lastFour = phone ? phone.slice(-4) : "";
  const fallbackName =
    source === LeadSource.INSTAGRAM && lastFour
      ? `Instagram Lead - ${lastFour}`
      : "Unknown";
  const timestamp = readLeadValue(row, TIMESTAMP_KEYS);
  let parsedTimestamp = new Date();

  if (timestamp) {
    const parsed = new Date(timestamp);

    if (!Number.isNaN(parsed.getTime())) {
      parsedTimestamp = parsed;
    }
  }

  return {
    atmId,
    name: readLeadValue(row, NAME_KEYS) || fallbackName,
    email: readLeadValue(row, ["Email", "email"]),
    phone,
    city: readLeadValue(row, CITY_KEYS),
    address: readLeadValue(row, ADDRESS_KEYS),
    ownershipType: readLeadValue(row, OWNERSHIP_KEYS),
    provider: readLeadValue(row, PROVIDER_KEYS),
    language: readLeadValue(row, LANGUAGE_KEYS),
    message: readLeadValue(row, MESSAGE_KEYS),
    sheetSource: readLeadValue(row, SOURCE_KEYS) || source,
    parsedTimestamp,
  };
}

export async function upsertMappedLead(
  source: LeadSource,
  lead: MappedLeadRow,
  activityDescription: string,
) {
  if (!lead.atmId) {
    return { imported: false, reason: "missing_atm_id" as const };
  }

  const updateData = {
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    city: lead.city,
    address: lead.address,
    ownershipType: lead.ownershipType,
    provider: lead.provider,
    language: lead.language,
    message: lead.message,
    sheetSource: lead.sheetSource,
  };

  if (source === LeadSource.WEBSITE) {
    const existing = await db.websiteLead.findUnique({
      where: { atmId: lead.atmId },
      select: { id: true },
    });

    if (existing) {
      await db.websiteLead.update({
        where: { atmId: lead.atmId },
        data: updateData,
      });
      return { imported: true, created: false };
    }

    const createdLead = await db.websiteLead.create({
      data: {
        ...updateData,
        atmId: lead.atmId,
        timestamp: lead.parsedTimestamp,
        stage: "NEW",
      },
    });

    await db.leadActivity.create({
      data: {
        actionType: "CREATION",
        description: activityDescription,
        websiteLeadId: createdLead.id,
      },
    });

    return { imported: true, created: true };
  }

  const existing = await db.instagramLead.findUnique({
    where: { atmId: lead.atmId },
    select: { id: true },
  });

  if (existing) {
    await db.instagramLead.update({
      where: { atmId: lead.atmId },
      data: updateData,
    });
    return { imported: true, created: false };
  }

  const createdLead = await db.instagramLead.create({
    data: {
      ...updateData,
      atmId: lead.atmId,
      timestamp: lead.parsedTimestamp,
      stage: "NEW",
    },
  });

  await db.leadActivity.create({
    data: {
      actionType: "CREATION",
      description: activityDescription,
      instagramLeadId: createdLead.id,
    },
  });

  return { imported: true, created: true };
}

export async function syncLeadRows(options: {
  source: LeadSource;
  rows: Record<string, unknown>[];
  activityPrefix: string;
}) {
  let importCount = 0;
  let failCount = 0;

  for (const row of options.rows) {
    try {
      const lead = mapIncomingLeadRow(row, options.source);

      if (!lead.atmId) {
        continue;
      }

      await upsertMappedLead(
        options.source,
        lead,
        `${options.activityPrefix} with ATM-ID: ${lead.atmId}`,
      );
      importCount++;
    } catch (error) {
      console.error("Failed to sync lead row", row, error);
      failCount++;
    }
  }

  return { importCount, failCount };
}

export async function markLeadIntegrationSynced(
  source: LeadSource,
  importCount: number,
  failCount: number,
  mode: "set" | "increment" = "set",
) {
  await db.leadIntegration.update({
    where: { source },
    data: {
      status: SheetConnectionStatus.CONNECTED,
      lastSyncedAt: new Date(),
      importedCount: mode === "increment" ? { increment: importCount } : importCount,
      failedCount: mode === "increment" ? { increment: failCount } : failCount,
      lastError: null,
    },
  });
}

export function ensureIntegrationCanSync(integration: LeadIntegration) {
  return Boolean(
    integration.appScriptUrl &&
      integration.spreadsheetId &&
      integration.sheetName,
  );
}
