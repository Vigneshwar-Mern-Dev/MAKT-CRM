"use server";

import { revalidatePath } from "next/cache";
import { db } from "./db";
import { requireUser } from "./session";
import type { CallLeadStatus, LeadStage } from "@prisma/client";
import { LeadSource } from "./prisma-enums";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function normalizeDigits(value: string | null | undefined) {
  return value ? value.replace(/\D/g, "") : "";
}

function buildInstagramAtmId(phone: string) {
  const digits = normalizeDigits(phone);
  return digits ? `IG-${digits}` : `IG-CALL-${Date.now()}`;
}

function parseFollowUp(value: string | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function syncInstagramLeadBackToSheet(lead: {
  atmId: string | null;
  name: string;
  phone: string | null;
  city: string | null;
  language: string | null;
  address: string | null;
  ownershipType: string | null;
  stage: string;
  notes: string | null;
  nextFollowUpAt: Date | null;
  lastContactedAt: Date | null;
}) {
  if (!lead.atmId) {
    return "Instagram sheet sync skipped because the lead has no ATM-ID.";
  }

  const integration = await db.leadIntegration.findUnique({
    where: { source: LeadSource.INSTAGRAM },
  });

  if (!integration?.appScriptUrl || !integration.spreadsheetId || !integration.sheetName) {
    return "Instagram lead saved in CRM, but Instagram sheet sync is not configured.";
  }

  try {
    const url = new URL(integration.appScriptUrl);
    const key = integration.secretToken?.replace(/^['"]|['"]$/g, "").trim();

    if (key) {
      url.searchParams.set("key", key);
    }

    const response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "updateInstagramLead",
        sheetId: integration.spreadsheetId,
        sheetName: integration.sheetName,
        lead: {
          atmId: lead.atmId,
          name: lead.name,
          phone: lead.phone,
          city: lead.city,
          language: lead.language,
          address: lead.address,
          ownershipType: lead.ownershipType,
          stage: lead.stage,
          notes: lead.notes,
          nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
          lastContactedAt: lead.lastContactedAt?.toISOString() ?? null,
        },
      }),
    });

    if (!response.ok) {
      return `Instagram lead saved in CRM, but Apps Script returned HTTP ${response.status}.`;
    }

    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      updated?: boolean;
      error?: string;
    };

    if (payload.ok === false) {
      return `Instagram lead saved in CRM, but sheet update failed: ${payload.error || "Apps Script error"}.`;
    }

    if (payload.updated !== true) {
      return "Instagram lead saved in CRM, but sheet update was not confirmed.";
    }

    return null;
  } catch (error) {
    return `Instagram lead saved in CRM, but sheet sync failed: ${getErrorMessage(error, "Unknown Apps Script error")}.`;
  }
}

function revalidateCallViews() {
  revalidatePath("/admin/calls");
  revalidatePath("/admin/calls/leads");
  revalidatePath("/admin/calls/missed");
  revalidatePath("/admin/calls/live");
  revalidatePath("/admin/leads");
}

export async function updateCallLeadDetailsAction(
  leadId: string,
  data: {
    displayName: string;
    phone: string;
    email?: string;
    city?: string;
    language?: string;
    address?: string;
    ownershipType?: string;
    provider?: string;
    message?: string;
  },
) {
  try {
    await requireUser();

    const displayName = data.displayName.trim() || `Caller ${data.phone.slice(-4)}`;
    const phone = data.phone.trim();

    if (!phone) {
      return { error: "Phone number is required." };
    }

    await db.callLead.update({
      where: { id: leadId },
      data: {
        displayName,
        phone,
        email: data.email?.trim() || null,
        city: data.city?.trim() || null,
        language: data.language?.trim() || null,
        address: data.address?.trim() || null,
        ownershipType: data.ownershipType?.trim() || null,
        provider: data.provider?.trim() || null,
        message: data.message?.trim() || null,
        lastContactedAt: new Date(),
      },
    });

    await db.callActivity.create({
      data: {
        leadId,
        actionType: "NOTE_ADDED",
        description: "Call lead customer details updated",
      },
    });

    revalidateCallViews();
    return { success: true };
  } catch (error) {
    console.error("Error updating call lead details:", error);
    return { error: getErrorMessage(error, "Call lead details update failed.") };
  }
}

export async function updateCallLeadWorkflowAction(
  leadId: string,
  data: {
    status: CallLeadStatus;
    notes?: string;
    nextFollowUpAt?: string;
    assignedToId?: string;
  },
) {
  try {
    const user = await requireUser();
    const nextFollowUpAt = parseFollowUp(data.nextFollowUpAt);
    const notes = data.notes?.trim() || null;
    const assignedToId = data.assignedToId?.trim() || undefined;

    if (assignedToId) {
      const assignee = await db.user.findUnique({
        where: { id: assignedToId },
        select: { id: true },
      });

      if (!assignee) {
        return { error: "Assigned user not found." };
      }
    }

    await db.callLead.update({
      where: { id: leadId },
      data: {
        status: data.status,
        notes,
        nextFollowUpAt,
        assignedToId,
        lastContactedAt: new Date(),
      },
    });

    if (nextFollowUpAt) {
      await db.callFollowUp.create({
        data: {
          leadId,
          dueAt: nextFollowUpAt,
          assignedToId: assignedToId || user.id,
          note: notes,
        },
      });
    }

    await db.callActivity.create({
      data: {
        leadId,
        userId: user.id,
        actionType: nextFollowUpAt ? "FOLLOW_UP_UPDATE" : "NOTE_ADDED",
        description: nextFollowUpAt
          ? `Call lead follow-up scheduled for ${nextFollowUpAt.toISOString()}`
          : `Call lead status updated to ${data.status}`,
      },
    });

    revalidateCallViews();
    return { success: true };
  } catch (error) {
    console.error("Error updating call lead workflow:", error);
    return { error: getErrorMessage(error, "Call lead workflow update failed.") };
  }
}

export async function saveCallLeadToInstagramAction(leadId: string) {
  try {
    const user = await requireUser();
    const callLead = await db.callLead.findUnique({
      where: { id: leadId },
    });

    if (!callLead) {
      return { error: "Call lead not found." };
    }

    const atmId = buildInstagramAtmId(callLead.phone);
    const instagramLead = await db.instagramLead.upsert({
      where: { atmId },
      update: {
        name: callLead.displayName,
        email: callLead.email,
        phone: callLead.phone,
        city: callLead.city,
        address: callLead.address,
        ownershipType: callLead.ownershipType,
        provider: callLead.provider || "Call Tracker",
        language: callLead.language,
        message: callLead.message || "Created from MAKT Call Tracker",
        sheetSource: "CALL_TRACKER",
        stage: callLead.status as LeadStage,
        assignedToId: callLead.assignedToId,
        lastContactedAt: callLead.lastContactedAt || new Date(),
        nextFollowUpAt: callLead.nextFollowUpAt,
        notes: callLead.notes,
      },
      create: {
        atmId,
        name: callLead.displayName,
        email: callLead.email,
        phone: callLead.phone,
        city: callLead.city,
        address: callLead.address,
        ownershipType: callLead.ownershipType,
        provider: callLead.provider || "Call Tracker",
        language: callLead.language,
        message: callLead.message || "Created from MAKT Call Tracker",
        sheetSource: "CALL_TRACKER",
        stage: callLead.status as LeadStage,
        assignedToId: callLead.assignedToId,
        lastContactedAt: callLead.lastContactedAt || new Date(),
        nextFollowUpAt: callLead.nextFollowUpAt,
        notes: callLead.notes,
      },
    });

    const warning = await syncInstagramLeadBackToSheet({
      atmId: instagramLead.atmId,
      name: instagramLead.name,
      phone: instagramLead.phone,
      city: instagramLead.city,
      language: instagramLead.language,
      address: instagramLead.address,
      ownershipType: instagramLead.ownershipType,
      stage: instagramLead.stage,
      notes: instagramLead.notes,
      nextFollowUpAt: instagramLead.nextFollowUpAt,
      lastContactedAt: instagramLead.lastContactedAt,
    });

    await db.callLead.update({
      where: { id: callLead.id },
      data: {
        instagramLeadId: instagramLead.id,
        sheetSyncedAt: warning ? null : new Date(),
        sheetSyncWarning: warning,
      },
    });

    await db.callActivity.create({
      data: {
        leadId: callLead.id,
        userId: user.id,
        actionType: "NOTE_ADDED",
        description: warning
          ? `Call lead saved to Instagram CRM lead with sheet warning: ${warning}`
          : "Call lead saved to Instagram CRM lead and synced to sheet",
      },
    });

    revalidateCallViews();
    revalidatePath("/admin/leads");
    revalidatePath("/admin/leads/instagram");
    return { success: true, warning };
  } catch (error) {
    console.error("Error saving call lead to Instagram:", error);
    return { error: getErrorMessage(error, "Saving call lead to Instagram failed.") };
  }
}
