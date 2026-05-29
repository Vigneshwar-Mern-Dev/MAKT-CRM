"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "./db";
import { mapIncomingLeadRow, syncLeadRows } from "./lead-sync";
import { LeadSource, SheetConnectionStatus } from "./prisma-enums";
import { requireRole } from "./session";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalFormValue(formData: FormData, key: string) {
  const value = formValue(formData, key);
  return value || null;
}

function parseLeadSource(value: string) {
  if (Object.values(LeadSource).includes(value as LeadSource)) {
    return value as LeadSource;
  }

  redirect("/admin/settings?error=Invalid lead source.");
}

function defaultSheetName(source: LeadSource) {
  return source === "WEBSITE" ? "Website Leads" : "Instagram Leads";
}

function settingsRedirect(params: string): never {
  redirect(`/admin/settings?${params}`);
}

function revalidateLeadIntegrationViews() {
  revalidatePath("/admin/settings");
  revalidatePath("/admin/leads");
}

function buildAppsScriptUrl(appScriptUrl: string, secretToken: string | null) {
  const url = new URL(appScriptUrl);

  if (secretToken) {
    const cleanToken = secretToken.replace(/^['"]|['"]$/g, "").trim();
    url.searchParams.set("key", cleanToken);
  }

  return url;
}

function normalizeSpreadsheetId(value: string | null) {
  if (!value) {
    return null;
  }

  const cleaned = value.trim().replace(/^['"\[\(]+|['"\]\)]+$/g, "").trim();
  const match = cleaned.match(/\/spreadsheets\/d\/([A-Za-z0-9-_]+)/);
  return match?.[1] ?? cleaned;
}

function isRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function analyzeIntegrationConfig(input: {
  appScriptUrl: string | null;
  secretToken: string | null;
  sheetName: string;
  spreadsheetId: string | null;
}) {
  const checks: string[] = [];
  const fixes: string[] = [];
  const expectedHeaders = [
    "Timestamp",
    "ATM-ID",
    "Name",
    "Email",
    "Phone",
    "City",
    "Provider",
    "Language",
    "Message",
    "Source",
  ];

  if (!input.appScriptUrl) {
    fixes.push("Add the deployed Apps Script Web App URL ending in /exec.");
  } else {
    try {
      const url = new URL(input.appScriptUrl);
      if (
        url.hostname !== "script.google.com" ||
        !url.pathname.includes("/macros/s/") ||
        !url.pathname.endsWith("/exec")
      ) {
        fixes.push("Apps Script URL should look like https://script.google.com/macros/s/.../exec.");
      } else {
        checks.push("Apps Script URL format looks valid.");
      }
    } catch {
      fixes.push("Apps Script Web App URL is not a valid URL.");
    }
  }

  if (!input.spreadsheetId) {
    fixes.push("Add the Google Sheet ID from the URL between /d/ and /edit.");
  } else if (!/^[A-Za-z0-9-_]{20,}$/.test(input.spreadsheetId)) {
    fixes.push(
      "Google Sheet ID looks wrong. Do not type a sheet name like 'Sankar'; paste only the long ID from the sheet URL.",
    );
  } else {
    checks.push("Google Sheet ID format looks valid.");
  }

  if (!input.sheetName) {
    fixes.push("Add the exact tab name, for example Sheet1.");
  } else {
    checks.push(`Sheet tab configured as '${input.sheetName}'.`);
  }

  if (!input.secretToken) {
    fixes.push("Add a shared secret token so random requests cannot push leads.");
  } else if (input.secretToken.length < 8) {
    fixes.push("Shared secret token should be at least 8 characters.");
  } else {
    checks.push("Shared secret token is present.");
  }

  checks.push(`Expected headers: ${expectedHeaders.join(", ")}.`);

  if (!fixes.length) {
    checks.push("Configuration is ready for Apps Script test. If Test fails, redeploy Apps Script as Web App with access permissions.");
  }

  return [`Checks:`, ...checks.map((item) => `- ${item}`), `Fixes:`, ...(fixes.length ? fixes.map((item) => `- ${item}`) : ["- No configuration issues found."])].join("\n");
}

async function updateIntegrationError(source: LeadSource, message: string) {
  await db.leadIntegration.upsert({
    where: { source },
    update: {
      status: SheetConnectionStatus.ERROR,
      lastError: message,
      lastTestedAt: new Date(),
    },
    create: {
      source,
      sheetName: defaultSheetName(source),
      status: SheetConnectionStatus.ERROR,
      lastError: message,
      lastTestedAt: new Date(),
    },
  });
}

export async function saveAndDiagnoseLeadIntegrationAction(formData: FormData) {
  await requireRole("ADMIN");

  const source = parseLeadSource(formValue(formData, "source"));
  const appScriptUrl = optionalFormValue(formData, "appScriptUrl");
  const spreadsheetId = normalizeSpreadsheetId(
    optionalFormValue(formData, "spreadsheetId"),
  );
  const sheetName = formValue(formData, "sheetName") || defaultSheetName(source);
  const secretToken = optionalFormValue(formData, "secretToken");

  if (appScriptUrl) {
    try {
      new URL(appScriptUrl);
    } catch {
      settingsRedirect(`saved=${source}&error=Enter a valid Apps Script Web App URL.`);
    }
  }

  // 1. Save settings
  await db.leadIntegration.upsert({
    where: { source },
    update: {
      appScriptUrl,
      spreadsheetId,
      sheetName,
      secretToken,
      status: SheetConnectionStatus.NOT_CONNECTED,
      lastError: null,
    },
    create: {
      source,
      appScriptUrl,
      spreadsheetId,
      sheetName,
      secretToken,
      status: SheetConnectionStatus.NOT_CONNECTED,
      lastError: null,
    },
  });

  // 2. Perform validation analysis
  const analysisReport = analyzeIntegrationConfig({
    appScriptUrl,
    secretToken,
    sheetName,
    spreadsheetId,
  });

  const hasConfigFixes = analysisReport.includes("Add ") || analysisReport.includes("Save ");
  if (hasConfigFixes) {
    await db.leadIntegration.update({
      where: { source },
      data: {
        status: SheetConnectionStatus.ERROR,
        lastError: analysisReport,
        lastTestedAt: new Date(),
      },
    });
    revalidateLeadIntegrationViews();
    settingsRedirect(`saved=${source}&result=error`);
  }

  // 3. Perform live diagnostic test & sync!
  if (!appScriptUrl || !spreadsheetId || !sheetName) {
    revalidateLeadIntegrationViews();
    settingsRedirect(`saved=${source}`);
  }

  let redirectParams = "";

  try {
    const cleanToken = secretToken ? secretToken.replace(/^['"]|['"]$/g, "").trim() : "";
    const response = await fetch(
      buildAppsScriptUrl(appScriptUrl, cleanToken).toString(),
      {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sheetId: spreadsheetId,
          sheetName,
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
      throw new Error(payload.error || "Apps Script Web App returned an error.");
    }

    const { importCount, failCount } = await syncLeadRows({
      source,
      rows: payload.rows || [],
      activityPrefix: "Lead imported from Google Sheet sync",
    });

    // Save success connection details & clear error!
    await db.leadIntegration.update({
      where: { source },
      data: {
        status: SheetConnectionStatus.CONNECTED,
        lastTestedAt: new Date(),
        lastSyncedAt: new Date(),
        importedCount: importCount,
        failedCount: failCount,
        lastError: null,
      },
    });

    revalidateLeadIntegrationViews();
    redirectParams = `saved=${source}&result=success`;
  } catch (error: unknown) {
    if (isRedirectError(error)) {
      throw error;
    }
    const message = errorMessage(error, "Apps Script connection failed.");
    await updateIntegrationError(source, message);
    revalidateLeadIntegrationViews();
    redirectParams = `saved=${source}&result=error`;
  }

  if (redirectParams) {
    settingsRedirect(redirectParams);
  }
}

export async function testLeadIntegrationAction(formData: FormData) {
  await requireRole("ADMIN");

  const source = parseLeadSource(formValue(formData, "source"));
  const integration = await db.leadIntegration.findUnique({ where: { source } });

  if (!integration || !integration.appScriptUrl) {
    await updateIntegrationError(source, "Save an Apps Script URL before testing.");
    revalidateLeadIntegrationViews();
    settingsRedirect(`tested=${source}&result=error`);
  }

  const appScriptUrl = integration!.appScriptUrl!;
  const secretToken = integration!.secretToken;
  const spreadsheetId = integration!.spreadsheetId;
  const sheetName = integration!.sheetName;

  if (!spreadsheetId || !sheetName) {
    await updateIntegrationError(
      source,
      "Save Google Sheet ID and sheet tab name before testing.",
    );
    revalidateLeadIntegrationViews();
    settingsRedirect(`tested=${source}&result=error`);
  }

  let result: "ok" | "error" = "ok";

  try {
    const response = await fetch(
      buildAppsScriptUrl(appScriptUrl, secretToken),
      {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sheetId: spreadsheetId,
          sheetName,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Apps Script responded with HTTP ${response.status}.`);
    }

    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
    };

    if (payload.ok === false) {
      throw new Error(payload.error || "Apps Script returned an error.");
    }

    await db.leadIntegration.update({
      where: { source },
      data: {
        status: SheetConnectionStatus.CONNECTED,
        lastTestedAt: new Date(),
        lastError: null,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Apps Script test failed.";
    await updateIntegrationError(source, message);
    result = "error";
  }

  revalidateLeadIntegrationViews();
  settingsRedirect(`tested=${source}&result=${result}`);
}

export async function syncLeadIntegrationAction(formData: FormData) {
  await requireRole("ADMIN");

  const source = parseLeadSource(formValue(formData, "source"));
  const integration = await db.leadIntegration.findUnique({ where: { source } });

  if (!integration || !integration.appScriptUrl) {
    await updateIntegrationError(source, "Save an Apps Script URL before syncing.");
    revalidateLeadIntegrationViews();
    settingsRedirect(`synced=${source}&result=error`);
  }

  const appScriptUrl = integration!.appScriptUrl!;
  const secretToken = integration!.secretToken;
  const spreadsheetId = integration!.spreadsheetId;
  const sheetName = integration!.sheetName;

  if (!spreadsheetId || !sheetName) {
    await updateIntegrationError(
      source,
      "Save Google Sheet ID and sheet tab name before syncing.",
    );
    revalidateLeadIntegrationViews();
    settingsRedirect(`synced=${source}&result=error`);
  }

  let result: "ok" | "error" = "ok";

  try {
    const response = await fetch(
      buildAppsScriptUrl(appScriptUrl, secretToken),
      {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sheetId: spreadsheetId,
          sheetName,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Apps Script responded with HTTP ${response.status}.`);
    }

    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      rows?: Record<string, unknown>[];
      count?: number;
      failedCount?: number;
      importedCount?: number;
    };

    if (payload.ok === false) {
      throw new Error(payload.error || "Apps Script returned an error.");
    }

    const { importCount, failCount } = await syncLeadRows({
      source,
      rows: payload.rows || [],
      activityPrefix: "Lead imported from Google Sheet sync",
    });

    await db.leadIntegration.update({
      where: { source },
      data: {
        status: SheetConnectionStatus.CONNECTED,
        lastSyncedAt: new Date(),
        importedCount: importCount,
        failedCount: failCount,
        lastError: null,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Apps Script sync failed.";
    await updateIntegrationError(source, message);
    result = "error";
  }

  revalidateLeadIntegrationViews();
  settingsRedirect(`synced=${source}&result=${result}`);
}

export async function syncLeadsFromModalAction(source: LeadSource) {
  await requireRole("ADMIN");

  const integration = await db.leadIntegration.findUnique({ where: { source } });

  if (!integration || !integration.appScriptUrl) {
    return { ok: false, error: "Save an Apps Script URL in CRM Settings first." };
  }

  const appScriptUrl = integration.appScriptUrl;
  const secretToken = integration.secretToken;
  const spreadsheetId = integration.spreadsheetId;
  const sheetName = integration.sheetName;

  if (!spreadsheetId || !sheetName) {
    return { ok: false, error: "Save Google Sheet ID and sheet tab name in CRM Settings first." };
  }

  try {
    const cleanToken = secretToken ? secretToken.replace(/^['"]|['"]$/g, "").trim() : "";
    const response = await fetch(
      buildAppsScriptUrl(appScriptUrl, cleanToken).toString(),
      {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sheetId: spreadsheetId,
          sheetName,
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
      throw new Error(payload.error || "Apps Script Web App returned an error.");
    }

    const { importCount, failCount } = await syncLeadRows({
      source,
      rows: payload.rows || [],
      activityPrefix: "Lead imported from Google Sheet sync",
    });

    await db.leadIntegration.update({
      where: { source },
      data: {
        status: SheetConnectionStatus.CONNECTED,
        lastSyncedAt: new Date(),
        importedCount: importCount,
        failedCount: failCount,
        lastError: null,
      },
    });

    revalidateLeadIntegrationViews();
    return { ok: true, importedCount: importCount, failedCount: failCount };
  } catch (error: unknown) {
    const message = errorMessage(error, "Apps Script sync failed.");
    await updateIntegrationError(source, message);
    revalidateLeadIntegrationViews();
    return { ok: false, error: message };
  }
}

export async function syncAllLeadsFromModalAction() {
  await requireRole("ADMIN");

  const sources = [
    { source: LeadSource.WEBSITE, title: "Website Leads" },
    { source: LeadSource.INSTAGRAM, title: "Instagram Leads" },
  ];

  const results = [];

  for (const { source, title } of sources) {
    const result = await syncLeadsFromModalAction(source);
    const importedCount = result.ok ? result.importedCount ?? 0 : 0;
    const failedCount = result.ok ? result.failedCount ?? 0 : 0;

    results.push({
      source,
      title,
      ok: result.ok,
      importedCount,
      failedCount,
      error: result.ok ? null : result.error || "Sync failed.",
    });
  }

  return {
    ok: results.every((result) => result.ok),
    importedCount: results.reduce((total, result) => total + result.importedCount, 0),
    failedCount: results.reduce((total, result) => total + result.failedCount, 0),
    results,
  };
}

export async function analyzeGoogleSheetAction(source: LeadSource) {
  await requireRole("ADMIN");

  const integration = await db.leadIntegration.findUnique({ where: { source } });

  if (!integration || !integration.appScriptUrl) {
    return { ok: false, error: "Save an Apps Script URL in CRM Settings first." };
  }

  const appScriptUrl = integration.appScriptUrl;
  const secretToken = integration.secretToken;
  const spreadsheetId = integration.spreadsheetId;
  const sheetName = integration.sheetName;

  if (!spreadsheetId || !sheetName) {
    return { ok: false, error: "Save Google Sheet ID and sheet tab name in CRM Settings first." };
  }

  try {
    const cleanToken = secretToken ? secretToken.replace(/^['"]|['"]$/g, "").trim() : "";
    const response = await fetch(
      buildAppsScriptUrl(appScriptUrl, cleanToken).toString(),
      {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sheetId: spreadsheetId,
          sheetName,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Apps Script responded with HTTP ${response.status}.`);
    }

    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      rows?: Record<string, unknown>[];
    };

    if (payload.ok === false) {
      throw new Error(payload.error || "Apps Script returned an error.");
    }

    const mappedRows = (payload.rows || [])
      .map((row) => mapIncomingLeadRow(row, source))
      .filter((row) => row.atmId);
    const sheetAtmIds = Array.from(
      new Set(mappedRows.map((row) => row.atmId!.trim())),
    );
    const existingAtmIds = new Set<string>();

    if (sheetAtmIds.length) {
      const dbLeads =
        source === LeadSource.WEBSITE
          ? await db.websiteLead.findMany({
              where: { atmId: { in: sheetAtmIds } },
              select: { atmId: true },
            })
          : await db.instagramLead.findMany({
              where: { atmId: { in: sheetAtmIds } },
              select: { atmId: true },
            });

      for (const lead of dbLeads) {
        if (lead.atmId) {
          existingAtmIds.add(lead.atmId.trim());
        }
      }
    }

    const alreadySynced = mappedRows.filter((row) =>
      existingAtmIds.has(row.atmId!.trim()),
    ).length;
    const missing = mappedRows.length - alreadySynced;

    return {
      ok: true,
      totalRows: mappedRows.length,
      alreadySyncedCount: alreadySynced,
      missingCount: missing,
    };
  } catch (error: unknown) {
    return { ok: false, error: errorMessage(error, "Failed to analyze spreadsheet.") };
  }
}
