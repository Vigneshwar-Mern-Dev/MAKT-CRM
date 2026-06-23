"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { requireRole } from "@/app/lib/session";
import { WhatsAppConnectionStatus, WhatsAppLeadStatus } from "@/app/lib/prisma-enums";
import { generateUniqueFormToken } from "@/app/lib/short-token";

function formString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function formInt(formData: FormData, key: string, fallback: number) {
  const value = Number.parseInt(formString(formData, key), 10);
  return Number.isFinite(value) ? value : fallback;
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

export async function ensureWhatsAppAccount() {
  const existing = await db.whatsAppAccount.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    return existing;
  }

  return db.whatsAppAccount.create({
    data: {
      label: "Primary WhatsApp",
      minDelaySeconds: 120,
      maxDelaySeconds: 180,
      hourlySendLimit: 10,
      contactCooldownDays: 7,
      autoPauseThreshold: 3,
      messageVariants: [
        `Hi! We are from ATM Franchise. Apologies for the delay in responding. We are currently receiving a high volume of inquiries.\n\nPlease fill out your details quickly using this secure link:\n👉 {{formLink}}\nour team will contact you and provide complete information\nThank you!`,
      ].join("\n\n---\n\n"),
    },
  });
}

export async function saveWhatsAppSettingsAction(formData: FormData) {
  await requireRole("ADMIN");
  const account = await ensureWhatsAppAccount();
  const minDelaySeconds = Math.max(30, formInt(formData, "minDelaySeconds", 120));
  const maxDelaySeconds = Math.max(minDelaySeconds, formInt(formData, "maxDelaySeconds", 180));
  const dailySendLimit = Math.min(300, Math.max(1, formInt(formData, "dailySendLimit", 100)));
  const hourlySendLimit = Math.min(60, Math.max(1, formInt(formData, "hourlySendLimit", 10)));
  const autoPauseThreshold = Math.max(1, formInt(formData, "autoPauseThreshold", 3));
  const contactCooldownDays = Math.max(0, formInt(formData, "contactCooldownDays", 7));
  const warmupRampPerDay = Math.max(1, formInt(formData, "warmupRampPerDay", 5));
  const warmupEnabled = formData.get("warmupEnabled") === "on";

  await db.whatsAppAccount.update({
    where: { id: account.id },
    data: {
      label: formString(formData, "label") || "Primary WhatsApp",
      minDelaySeconds,
      maxDelaySeconds,
      dailySendLimit,
      hourlySendLimit,
      autoPauseThreshold,
      contactCooldownDays,
      requireOptIn: formData.get("requireOptIn") === "on",
      autoReplyEnabled: formData.get("autoReplyEnabled") === "on",
      warmupEnabled,
      warmupRampPerDay,
      // Auto-set warmup start date when enabling warmup for first time
      warmupStartDate:
        warmupEnabled && !account.warmupStartDate
          ? new Date()
          : !warmupEnabled
            ? null
            : account.warmupStartDate,
      quietHoursStart: formString(formData, "quietHoursStart") || "21:00",
      quietHoursEnd: formString(formData, "quietHoursEnd") || "09:00",
      messageVariants: formString(formData, "messageVariants"),
    },
  });

  revalidatePath("/admin/whatsapp");
  revalidatePath("/admin/whatsapp/settings");
}

export async function requestWhatsAppQrAction() {
  await requireRole("ADMIN");
  const account = await ensureWhatsAppAccount();

  await db.whatsAppAccount.update({
    where: { id: account.id },
    data: {
      status: WhatsAppConnectionStatus.QR_REQUIRED,
      qrCodeData: null,
      lastError: null,
    },
  });

  revalidatePath("/admin/whatsapp");
}

export async function pauseWhatsAppAction() {
  await requireRole("ADMIN");
  const account = await ensureWhatsAppAccount();

  await db.whatsAppAccount.update({
    where: { id: account.id },
    data: { status: WhatsAppConnectionStatus.PAUSED },
  });

  revalidatePath("/admin/whatsapp");
}

export async function logoutWhatsAppAction() {
  await requireRole("ADMIN");
  const account = await ensureWhatsAppAccount();

  await db.whatsAppAccount.update({
    where: { id: account.id },
    data: { status: WhatsAppConnectionStatus.DISCONNECTED },
  });

  revalidatePath("/admin/whatsapp");
}

export async function createWhatsAppLeadAction(formData: FormData) {
  await requireRole("ADMIN");
  const account = await ensureWhatsAppAccount();
  const phone = normalizePhone(formString(formData, "phone"));
  const displayName = formString(formData, "displayName");

  if (!phone || !displayName) {
    return;
  }

  const message = formString(formData, "message") || null;

  // Check if a lead already exists for this phone
  const existing = await db.whatsAppLead.findFirst({ where: { phone } });

  if (existing) {
    // Re-queue the existing lead with updated info
    await db.whatsAppLead.update({
      where: { id: existing.id },
      data: {
        displayName,
        message,
        status: WhatsAppLeadStatus.QUEUED,
        consentAt: new Date(),
        lastError: null,
      },
    });
  } else {
    // Create new lead and immediately queue it
    const formToken = await generateUniqueFormToken();
    await db.whatsAppLead.create({
      data: {
        accountId: account.id,
        phone,
        displayName,
        message,
        status: WhatsAppLeadStatus.QUEUED,
        consentAt: new Date(),
        formToken,
      },
    });
  }

  revalidatePath("/admin/whatsapp");
  revalidatePath("/admin/whatsapp/leads");
}

export async function deleteWhatsAppLeadAction(formData: FormData) {
  await requireRole("ADMIN");
  const leadId = formString(formData, "leadId");

  if (!leadId) {
    return;
  }

  const lead = await db.whatsAppLead.findUnique({
    where: { id: leadId },
    select: { phone: true },
  });

  if (lead) {
    await db.whatsAppLead.delete({
      where: { id: leadId },
    });

    await db.callLead.deleteMany({
      where: { phone: lead.phone },
    });
  }

  revalidatePath("/admin/whatsapp");
  revalidatePath("/admin/whatsapp/leads");
}

export async function deleteCallLeadDirectAction(formData: FormData) {
  await requireRole("ADMIN");
  const callLeadId = formString(formData, "callLeadId");

  if (!callLeadId) {
    return;
  }

  await db.callLead.delete({
    where: { id: callLeadId },
  });

  revalidatePath("/admin/whatsapp");
  revalidatePath("/admin/whatsapp/leads");
}

export async function retryWhatsAppLeadAction(formData: FormData) {
  await requireRole("ADMIN");
  const leadId = formString(formData, "leadId");

  if (!leadId) {
    return;
  }

  await db.whatsAppLead.update({
    where: { id: leadId },
    data: { status: WhatsAppLeadStatus.QUEUED, message: null, lastError: null },
  });

  revalidatePath("/admin/whatsapp");
  revalidatePath("/admin/whatsapp/leads");
}

export async function retryFailedLeadsAction() {
  await requireRole("ADMIN");
  const account = await ensureWhatsAppAccount();

  await db.whatsAppLead.updateMany({
    where: { accountId: account.id, status: WhatsAppLeadStatus.FAILED },
    data: { status: WhatsAppLeadStatus.QUEUED, message: null, lastError: null },
  });

  revalidatePath("/admin/whatsapp");
  revalidatePath("/admin/whatsapp/leads");
}

export async function resumeWhatsAppAction() {
  await requireRole("ADMIN");
  const account = await ensureWhatsAppAccount();

  await db.whatsAppAccount.update({
    where: { id: account.id },
    data: {
      status: WhatsAppConnectionStatus.CONNECTING,
      consecutiveFailures: 0,
      lastError: null,
    },
  });

  revalidatePath("/admin/whatsapp");
}

export async function manualQueueWhatsAppForCallLeadAction(callLeadId: string) {
  await requireRole("ADMIN");
  const account = await ensureWhatsAppAccount();

  const callLead = await db.callLead.findUnique({
    where: { id: callLeadId },
  });

  if (!callLead || !callLead.phone) {
    return;
  }

  const existing = await db.whatsAppLead.findFirst({
    where: { phone: callLead.phone },
  });

  if (existing) {
    await db.whatsAppLead.update({
      where: { id: existing.id },
      data: {
        status: WhatsAppLeadStatus.QUEUED,
        message: null,
        lastError: null,
        consentAt: new Date(),
      },
    });
  } else {
    const formToken = await generateUniqueFormToken();
    await db.whatsAppLead.create({
      data: {
        accountId: account.id,
        phone: callLead.phone,
        displayName: callLead.displayName || "Caller",
        status: WhatsAppLeadStatus.QUEUED,
        consentAt: new Date(),
        formToken,
      },
    });
  }

  revalidatePath("/admin/calls/leads");
  revalidatePath("/admin/whatsapp/leads");
}
