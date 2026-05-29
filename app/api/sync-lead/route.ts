import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { LeadSource } from "@/app/lib/prisma-enums";
import {
  isValidLeadSyncToken,
  mapIncomingLeadRow,
  markLeadIntegrationSynced,
  upsertMappedLead,
} from "@/app/lib/lead-sync";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function parseLeadSource(value: unknown) {
  return value === LeadSource.WEBSITE
    ? LeadSource.WEBSITE
    : value === LeadSource.INSTAGRAM
      ? LeadSource.INSTAGRAM
      : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const lead = body.lead as Record<string, unknown> | undefined;
    const incomingSource = body.source || lead?.source || lead?.Source;
    const incomingToken = body.secretToken;
    const parsedSource = parseLeadSource(incomingSource);

    if (!parsedSource || !incomingToken || !lead) {
      return NextResponse.json(
        { error: "Source ('WEBSITE' | 'INSTAGRAM'), secretToken, and lead object are required." },
        { status: 400 },
      );
    }

    const integration = await db.leadIntegration.findUnique({
      where: { source: parsedSource },
    });

    if (!integration) {
      return NextResponse.json(
        { error: "Lead integration settings not found for this source. Configure them in CRM first." },
        { status: 404 },
      );
    }

    if (!isValidLeadSyncToken(integration.secretToken, String(incomingToken))) {
      return NextResponse.json(
        { error: "Unauthorized. Secret token mismatch." },
        { status: 401 },
      );
    }

    const mappedLead = mapIncomingLeadRow(lead, parsedSource);

    if (!mappedLead.atmId) {
      return NextResponse.json(
        {
          error:
            parsedSource === LeadSource.INSTAGRAM
              ? "Instagram lead must contain a phone/number column."
              : "Lead must contain a valid ATM-ID column.",
        },
        { status: 400 },
      );
    }

    await upsertMappedLead(
      parsedSource,
      mappedLead,
      `Lead synchronized in real-time via Google Sheet onChange direct trigger with ATM-ID: ${mappedLead.atmId}`,
    );
    await markLeadIntegrationSynced(parsedSource, 1, 0, "increment");

    return NextResponse.json({
      ok: true,
      message: `Lead ${mappedLead.atmId} synchronized successfully in real-time.`,
    });
  } catch (error: unknown) {
    console.error("Single Auto Sync Webhook Error:", error);
    return NextResponse.json(
      { error: errorMessage(error, "Single auto-sync webhook execution failed.") },
      { status: 500 },
    );
  }
}
