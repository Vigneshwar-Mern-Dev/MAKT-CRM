import process from "node:process";
import "dotenv/config";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;

const CRM_BASE_URL = process.env.CRM_BASE_URL || "http://127.0.0.1:3000";
const BRIDGE_TOKEN = process.env.WHATSAPP_BRIDGE_TOKEN;
const ACCOUNT_ID = process.env.WHATSAPP_ACCOUNT_ID || undefined;
const POLL_MS = Number.parseInt(process.env.WHATSAPP_POLL_MS || "10000", 10);
const SEND_TYPING = process.env.WHATSAPP_SEND_TYPING !== "false";

if (!BRIDGE_TOKEN) {
  console.error("WHATSAPP_BRIDGE_TOKEN is required.");
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout(promise, timeoutMs, errorMsg = "Operation timed out") {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMsg)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

function randomDelay(minSeconds, maxSeconds) {
  const min = Math.max(30, Number(minSeconds) || 120);
  const max = Math.max(min, Number(maxSeconds) || 180);
  return Math.floor((min + Math.random() * (max - min)) * 1000);
}

function isRestHour(now = new Date()) {
  const hours = now.getHours();
  return hours === 0; // 00:00:00 to 00:59:59 is 12:00 AM to 1:00 AM (rest time)
}

async function postBridge(payload) {
  const response = await fetch(`${CRM_BASE_URL}/api/whatsapp/bridge`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-whatsapp-bridge-token": BRIDGE_TOKEN,
    },
    body: JSON.stringify({ accountId: ACCOUNT_ID, ...payload }),
  });

  if (!response.ok) {
    throw new Error(`Bridge update failed: ${response.status}`);
  }
}

async function getOutboxLead() {
  const response = await fetch(`${CRM_BASE_URL}/api/whatsapp/outbox`, {
    headers: { "x-whatsapp-bridge-token": BRIDGE_TOKEN },
  });

  if (!response.ok) {
    throw new Error(`Outbox fetch failed: ${response.status}`);
  }

  return response.json();
}

async function postOutboxResult(leadId, ok, error = null) {
  const response = await fetch(`${CRM_BASE_URL}/api/whatsapp/outbox`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-whatsapp-bridge-token": BRIDGE_TOKEN,
    },
    body: JSON.stringify({ leadId, ok, error }),
  });

  if (!response.ok) {
    throw new Error(`Outbox result failed: ${response.status}`);
  }
}

async function postInboxReply(phone, message) {
  try {
    const response = await fetch(`${CRM_BASE_URL}/api/whatsapp/inbox`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-whatsapp-bridge-token": BRIDGE_TOKEN,
      },
      body: JSON.stringify({ phone, message, receivedAt: new Date().toISOString() }),
    });

    if (!response.ok) {
      console.warn(`[inbox] Failed to post reply for ${phone}: ${response.status}`);
    }
  } catch (err) {
    console.error("[inbox] Error posting reply:", err);
  }
}

function toWhatsAppId(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return `${digits}@c.us`;
}

function fromWhatsAppId(chatId) {
  // "919876543210@c.us" → "+919876543210"
  const digits = String(chatId || "").split("@")[0];
  return digits ? `+${digits}` : null;
}

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: ACCOUNT_ID || "primary",
    dataPath: ".whatsapp-auth-new",
  }),
  webVersionCache: {
    type: "remote",
    remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
  },
  puppeteer: {
    headless: process.env.WHATSAPP_HEADLESS !== "false",
    protocolTimeout: 300000, // 5 minutes
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
      "--disable-extensions",
    ],
  },
});

let ready = false;
let sending = false;

// Reconnection variables
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let reconnecting = false;

async function handleReconnect(reason = "Connection lost") {
  if (reconnecting) return;
  reconnecting = true;
  ready = false;

  reconnectAttempts++;
  console.log(`[worker] Attempting reconnection (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in 10 seconds... Reason: ${reason}`);

  if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
    console.error("[worker] Max reconnection attempts reached. Pausing worker.");
    await postBridge({ status: "ERROR", lastError: "Max reconnection attempts reached. Please scan QR or click Resume." }).catch(() => {});
    reconnecting = false;
    return;
  }

  await postBridge({ status: "CONNECTING", lastError: `Reconnecting (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...` }).catch(() => {});

  setTimeout(async () => {
    try {
      console.log("[worker] Destroying client...");
      await client.destroy().catch(() => {});

      // If it was an authentication failure, clear the auth directory to force a clean login/QR
      if (reason.toLowerCase().includes("auth") || reason.toLowerCase().includes("fail")) {
        console.log("[worker] Clearing auth session directory due to auth failure...");
        const fs = await import("fs");
        if (fs.existsSync(".whatsapp-auth-new")) {
          fs.rmSync(".whatsapp-auth-new", { recursive: true, force: true });
        }
      }

      console.log("[worker] Re-initializing client...");
      await client.initialize();
      reconnecting = false;
    } catch (err) {
      console.error("[worker] Reconnection initialization failed:", err);
      reconnecting = false;
      // Schedule next attempt
      handleReconnect(reason);
    }
  }, 10000);
}

client.on("qr", async (qr) => {
  ready = false;
  console.log("QR received. Open /admin/whatsapp and scan it.");
  await postBridge({ status: "QR_REQUIRED", qrCodeData: qr, lastError: null });
});

client.on("authenticated", async () => {
  console.log("WhatsApp authenticated.");
  await postBridge({ status: "CONNECTING", qrCodeData: null, lastError: null });
});

client.on("ready", async () => {
  ready = true;
  reconnectAttempts = 0; // Reset reconnection attempts on successful connection
  const info = client.info;
  console.log("WhatsApp ready.");
  await postBridge({
    status: "CONNECTED",
    phoneNumber: info?.wid?.user || null,
    qrCodeData: null,
    lastError: null,
  });
});

client.on("disconnected", async (reason) => {
  ready = false;
  console.error("WhatsApp disconnected:", reason);
  await postBridge({ status: "DISCONNECTED", lastError: String(reason || "") }).catch(() => {});
  handleReconnect(String(reason || "Disconnected"));
});

client.on("auth_failure", async (msg) => {
  console.error("WhatsApp authentication failure:", msg);
  await postBridge({ status: "ERROR", lastError: "Auth failure: " + String(msg) }).catch(() => {});
  handleReconnect("Authentication failure: " + String(msg));
});

// ── Incoming message listener (reply detection) ──────────────────────────────
client.on("message", async (msg) => {
  // Ignore: outgoing, status updates, group messages, broadcasts
  if (msg.fromMe) return;
  if (msg.isStatus) return;
  if (msg.from.endsWith("@g.us")) return;  // group
  if (msg.from.endsWith("@broadcast")) return;

  const phone = fromWhatsAppId(msg.from);

  if (!phone) return;

  console.log(`[inbox] Received reply from ${phone}: "${msg.body?.slice(0, 60)}"`);
  await postInboxReply(phone, msg.body || "");
});

// ── Outbound sending loop ────────────────────────────────────────────────────
async function sendNextLead() {
  if (!ready || sending) return;

  sending = true;
  let currentLeadId = null;

  try {
    const outbox = await getOutboxLead();

    if (!outbox.ok) return;

    if (outbox.logoutRequested) {
      console.log("[worker] Logout requested by server. Destroying session...");
      await postBridge({ status: "QR_REQUIRED", lastError: "Session reset." }).catch(() => {});
      try {
        await client.logout();
      } catch (e) {}
      import("fs").then(fs => fs.rmSync(".whatsapp-auth-new", { recursive: true, force: true }));
      process.exit(0);
    }

    // Paused, daily capped, or hourly rate-limited — wait quietly
    if (outbox.paused || outbox.capped || outbox.rateLimited || !outbox.lead) {
      if (outbox.rateLimited) {
        console.log(
          `[outbox] Hourly limit reached (${outbox.sentLastHour}/${outbox.hourlyLimit}). Waiting.`,
        );
      }
      return;
    }

    if (isRestHour()) {
      console.log("[outbox] Midnight rest hour active (12:00 AM - 01:00 AM). Resting...");
      return;
    }

    currentLeadId = outbox.lead.id;

    const delay = randomDelay(outbox.account.minDelaySeconds, outbox.account.maxDelaySeconds);
    console.log(`Waiting ${Math.round(delay / 1000)}s before sending to ${outbox.lead.phone}.`);
    await sleep(delay);

    const chatId = toWhatsAppId(outbox.lead.phone);

    // Validate if user has a registered WhatsApp account before interacting
    let isRegistered = false;
    try {
      isRegistered = await withTimeout(client.isRegisteredUser(chatId), 30000, "Registration check timed out");
    } catch (regErr) {
      console.warn(`[worker] Registration check failed for ${chatId}:`, regErr.message || regErr);
    }

    if (!isRegistered) {
      throw new Error(`Phone number ${outbox.lead.phone} is not registered on WhatsApp.`);
    }

    let chat = null;
    try {
      chat = await withTimeout(client.getChatById(chatId), 30000, "Get chat timed out");
    } catch (chatErr) {
      console.warn(`[worker] Could not get chat for ${chatId} (likely new contact):`, chatErr.message || chatErr);
    }

    if (SEND_TYPING && chat) {
      try {
        await withTimeout(chat.sendStateTyping(), 10000, "sendStateTyping timed out");
        await sleep(Math.min(5000, Math.max(1500, outbox.lead.message.length * 35)));
      } catch (typingErr) {
        console.warn("[worker] sendStateTyping failed (ignoring):", typingErr.message);
      }
      try {
        await withTimeout(chat.clearState(), 10000, "clearState timed out");
      } catch (clearErr) {
        console.warn("[worker] clearState failed (ignoring):", clearErr.message);
      }
    }

    await withTimeout(client.sendMessage(chatId, outbox.lead.message), 60000, "sendMessage timed out");
    await postOutboxResult(outbox.lead.id, true);
    console.log(`Sent WhatsApp message to ${outbox.lead.phone}.`);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Unknown worker error";

    // If the error happened during/after lead pickup, mark it FAILED
    // so it doesn't stay stuck in QUEUED indefinitely.
    if (currentLeadId) {
      await postOutboxResult(currentLeadId, false, message).catch(() => {});
    } else {
      // Pre-lead error (e.g. outbox fetch failed) — report bridge status only
      await postBridge({ status: "ERROR", lastError: message }).catch(() => {});
    }
  } finally {
    sending = false;
  }
}

setInterval(() => {
  sendNextLead().catch((error) => console.error(error));
}, Math.max(5000, POLL_MS));

process.on("SIGINT", async () => {
  await postBridge({ status: "DISCONNECTED" }).catch(() => {});
  await client.destroy();
  process.exit(0);
});

console.log(`Starting WhatsApp worker for ${CRM_BASE_URL}... Waiting for server to be ready.`);

(async () => {
  // Wait for the Next.js server to be fully up before starting WhatsApp
  while (true) {
    try {
      await postBridge({ status: "CONNECTING", lastError: null });
      break; // Success! Server is up.
    } catch (error) {
      if (error.cause && error.cause.code === 'ECONNREFUSED') {
        // Server not ready yet, wait 1 second and retry silently
        await sleep(1000);
      } else {
        console.error("Bridge ping failed:", error);
        await sleep(2000);
      }
    }
  }

  console.log("Server is ready. Initializing WhatsApp client...");
  client.initialize();
})();
