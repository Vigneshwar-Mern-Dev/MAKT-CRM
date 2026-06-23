import "server-only";

import { db } from "./db";
import { generateUniqueFormToken } from "./short-token";

const ANSWERED_TEMPLATE = `Hi {{name}}!

Thank you for your inquiry about the ATM Franchise! It was great speaking with you today. Taking the step to start your own franchise is a fantastic start toward building a reliable, passive income source and achieving financial freedom! 🚀

Please fill out your details quickly using this secure link so we can finalize the next steps:
👉 {{formLink}}

Our team will review your details and contact you shortly.

Thank you,
ATM Franchise Team`;

const MISSED_TEMPLATE = `Hi {{name}}!

We are from ATM Franchise. Apologies for the delay in responding. We are currently receiving a high volume of inquiries.

Please fill out your details quickly using this secure link:
👉 {{formLink}}

Our team will contact you and provide complete information.

Thank you!
ATM Franchise Team`;

/**
 * Auto-queue a WhatsApp outbound message for an incoming caller.
 *
 * Rules:
 *  - Skips if autoReplyEnabled = false.
 *  - Skips if account status is PAUSED / DISCONNECTED / ERROR.
 *  - Per-contact cooldown: skips if the lead was already SENT or REPLIED
 *    within `contactCooldownDays` days (prevents re-spamming repeat callers).
 *  - DO_NOT_CONTACT → skips forever.
 *  - QUEUED → already pending, skip.
 *  - REPLIED → treat same as SENT (respect cooldown, don't re-queue if active).
 *  - NEW / FAILED / OPTED_IN → re-queue.
 *  - No lead found → create new QUEUED lead.
 */
export async function autoQueueWhatsAppForCaller(
  callerPhone: string,
  displayName: string,
  callState: "ANSWERED" | "MISSED",
): Promise<void> {
  try {
    const account = await db.whatsAppAccount.findFirst({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        autoReplyEnabled: true,
        status: true,
        contactCooldownDays: true,
      },
    });

    if (!account) return;

    if (!account.autoReplyEnabled) return;



    const existing = await db.whatsAppLead.findFirst({
      where: { phone: callerPhone },
      select: { id: true, status: true, lastSentAt: true, lastReplyAt: true },
    });

    if (existing) {
      // Never contact again
      if (existing.status === "DO_NOT_CONTACT") {
        console.log(`[whatsapp-auto-queue] Skipping ${callerPhone} — DO_NOT_CONTACT.`);
        return;
      }

      // Already waiting in queue
      if (existing.status === "QUEUED") {
        console.log(`[whatsapp-auto-queue] Skipping ${callerPhone} — already QUEUED.`);
        return;
      }

      // Check per-contact cooldown for SENT and REPLIED leads
      if (existing.status === "SENT" || existing.status === "REPLIED") {
        const lastContactDate = existing.lastReplyAt ?? existing.lastSentAt;

        if (lastContactDate && account.contactCooldownDays > 0) {
          const cooldownMs = account.contactCooldownDays * 24 * 60 * 60 * 1000;
          const timeSinceContact = Date.now() - lastContactDate.getTime();

          if (timeSinceContact < cooldownMs) {
            const hoursLeft = Math.ceil((cooldownMs - timeSinceContact) / (60 * 60 * 1000));
            console.log(
              `[whatsapp-auto-queue] Skipping ${callerPhone} — cooldown active, ${hoursLeft}h remaining.`,
            );
            return;
          }
        }
      }

      // Re-queue leads that are eligible (NEW, FAILED, OPTED_IN, or past-cooldown SENT/REPLIED)
      const selectedMessage = callState === "ANSWERED" ? ANSWERED_TEMPLATE : MISSED_TEMPLATE;
      await db.whatsAppLead.update({
        where: { id: existing.id },
        data: {
          status: "QUEUED",
          displayName,
          message: selectedMessage,
          lastError: null,
          consentAt: new Date(),
        },
      });

      console.log(
        `[whatsapp-auto-queue] Re-queued ${callerPhone} (was ${existing.status}).`,
      );
      return;
    }

    // Brand-new caller — create QUEUED lead; no explicit message so worker picks a variant
    const formToken = await generateUniqueFormToken();
    const selectedMessage = callState === "ANSWERED" ? ANSWERED_TEMPLATE : MISSED_TEMPLATE;
    await db.whatsAppLead.create({
      data: {
        accountId: account.id,
        phone: callerPhone,
        displayName,
        message: selectedMessage,
        status: "QUEUED",
        consentAt: new Date(), // caller initiated contact by calling us
        formToken,
      },
    });

    console.log(
      `[whatsapp-auto-queue] Queued new WhatsApp message for incoming caller ${callerPhone}.`,
    );
  } catch (error) {
    console.error("[whatsapp-auto-queue] Failed to queue WhatsApp message:", error);
  }
}
