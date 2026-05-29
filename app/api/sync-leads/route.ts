import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { LeadSource } from "@/app/lib/prisma-enums";
import {
  buildLeadAppsScriptUrl,
  ensureIntegrationCanSync,
  isValidLeadSyncToken,
  markLeadIntegrationSynced,
  syncLeadRows,
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

// Public POST webhook used by Google Apps Script to trigger a Website/Instagram sheet sync.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsedSource = parseLeadSource(body.source);
    const incomingToken = body.secretToken;

    if (!parsedSource || !incomingToken) {
      return NextResponse.json(
        { error: "Source ('WEBSITE' | 'INSTAGRAM') and secretToken are required." },
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

    if (!ensureIntegrationCanSync(integration)) {
      return NextResponse.json(
        { error: "Integration settings are incomplete. Save Apps Script Web App URL and Sheet ID in Settings first." },
        { status: 400 },
      );
    }

    const response = await fetch(
      buildLeadAppsScriptUrl(integration.appScriptUrl!, integration.secretToken),
      {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sheetId: integration.spreadsheetId,
          sheetName: integration.sheetName,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Apps Script Web App responded with HTTP ${response.status}.`);
    }

    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      rows?: Record<string, unknown>[];
    };

    if (payload.ok === false) {
      throw new Error(payload.error || "Apps Script returned an error.");
    }

    const { importCount, failCount } = await syncLeadRows({
      source: parsedSource,
      rows: payload.rows || [],
      activityPrefix: "Lead imported from Google Sheet auto-trigger sync",
    });

    await markLeadIntegrationSynced(parsedSource, importCount, failCount);

    return NextResponse.json({
      ok: true,
      message: "Sync completed successfully.",
      importedCount: importCount,
      failedCount: failCount,
    });
  } catch (error: unknown) {
    console.error("Auto Sync Webhook Error:", error);
    return NextResponse.json(
      { error: errorMessage(error, "Auto-sync triggered sync execution failed.") },
      { status: 500 },
    );
  }
}
