"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { WhatsAppLeadStatus } from "@/app/lib/prisma-enums";
import {
  retryFailedLeadsAction,
  deleteWhatsAppLeadAction,
  manualQueueWhatsAppForCallLeadAction,
  deleteCallLeadDirectAction,
  retryWhatsAppLeadAction,
} from "@/app/lib/whatsapp-actions";
import { WhatsAppLeadStatus as WLS } from "@/app/lib/prisma-enums";

function LiveCountdown({
  targetTime,
  serverTime,
  accountStatus,
  autoReplyEnabled,
}: {
  targetTime: string | null;
  serverTime: number;
  accountStatus?: string;
  autoReplyEnabled?: boolean;
}) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!targetTime) return;
    const target = new Date(targetTime).getTime();
    const initialRemaining = Math.max(0, Math.ceil((target - serverTime) / 1000));
    const pageLoadTime = Date.now();

    function update() {
      const elapsed = Math.floor((Date.now() - pageLoadTime) / 1000);
      const remaining = Math.max(0, initialRemaining - elapsed);
      setSeconds(remaining);
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetTime, serverTime]);

  if (!targetTime) return <span className="text-slate-500">—</span>;

  if (accountStatus && accountStatus !== "CONNECTED") {
    return <span className="text-amber-400/80">Worker offline</span>;
  }
  if (autoReplyEnabled === false) {
    return <span className="text-amber-400/80">Paused</span>;
  }

  // Check if currently in rest hour (12:00 AM - 1:00 AM) based on serverTime
  const serverDate = new Date(serverTime);
  if (serverDate.getHours() === 0) {
    if (seconds === 0) return <span className="animate-pulse text-cyan-300">Resting...</span>;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return <span className="text-cyan-300">Resting ({mins}m {secs}s)</span>;
  }

  if (seconds === 0) return <span className="animate-pulse text-emerald-300">Sending soon</span>;
  if (seconds > 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return <span>{mins}m {secs}s</span>;
  }
  return <span>{seconds}s</span>;
}

type Lead = {
  id: string;
  displayName: string;
  phone: string;
  message: string | null;
  status: WhatsAppLeadStatus;
  lastSentAt: Date | null;
  lastReplyAt: Date | null;
  lastReplySnippet: string | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  formToken: string | null;
  formSubmittedAt: Date | null;
  formName: string | null;
  formCity: string | null;
  formPropertyType: string | null;
  formMapsLocation: string | null;
  targetTime: string | null;
};

function formatDate(value: Date | null) {
  if (!value) return "Never";
  return value.toLocaleString("en-IN", { day: "2-digit", hour: "2-digit", minute: "2-digit", month: "short" });
}

function statusTone(status: string) {
  const tones: Record<string, string> = {
    OPTED_IN: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
    QUEUED: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
    SENT: "border-sky-300/20 bg-sky-300/10 text-sky-100",
    REPLIED: "border-violet-300/20 bg-violet-300/10 text-violet-100",
    FAILED: "border-rose-300/20 bg-rose-300/10 text-rose-100",
    DO_NOT_CONTACT: "border-zinc-300/20 bg-zinc-300/10 text-zinc-200",
    NEW: "border-white/10 bg-white/5 text-slate-300",
  };
  return tones[status] ?? tones.NEW;
}

const priorityOrder: Record<string, number> = {
  FAILED: 0, REPLIED: 1, QUEUED: 2, NEW: 3, OPTED_IN: 4, SENT: 5, DO_NOT_CONTACT: 6,
};

export function WhatsAppLeadsClient({
  leads,
  failedCount,
  total,
  page,
  totalPages,
  incomingCallLeads,
  avgDelaySeconds,
  totalQueued,
  accountStatus,
  autoReplyEnabled,
  serverTime,
}: {
  leads: Lead[];
  failedCount: number;
  total: number;
  page: number;
  totalPages: number;
  incomingCallLeads: {
    id: string;
    displayName: string;
    phone: string;
    updatedAt: Date;
    createdAt: Date;
    waStatus: WhatsAppLeadStatus | null;
    waLeadId: string | null;
    queuePosition: number | null;
    targetTime: string | null;
  }[];
  avgDelaySeconds: number;
  totalQueued: number;
  accountStatus: string;
  autoReplyEnabled: boolean;
  serverTime: number;
}) {
  const [search, setSearch] = useState("");
  const [loadingCallIds, setLoadingCallIds] = useState<Record<string, boolean>>({});
  const router = useRouter();

  // ── Incoming calls date filter ────────────────────────────────────────────
  type DateMode = "today" | "last24h" | "custom";
  const [dateMode, setDateMode] = useState<DateMode>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const filteredIncomingCallLeads = useMemo(() => {
    const now = Date.now();
    return incomingCallLeads.filter((call) => {
      const t = new Date(call.createdAt).getTime();
      if (dateMode === "today") {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        return t >= todayStart.getTime() && t <= todayEnd.getTime();
      }
      if (dateMode === "last24h") {
        return t >= now - 24 * 60 * 60 * 1000;
      }
      if (dateMode === "custom") {
        const from = customFrom ? new Date(customFrom).getTime() : 0;
        const to = customTo ? new Date(customTo + "T23:59:59").getTime() : Infinity;
        return t >= from && t <= to;
      }
      return true;
    });
  }, [incomingCallLeads, dateMode, customFrom, customTo]);

  const handleManualQueue = async (callId: string) => {
    setLoadingCallIds((prev) => ({ ...prev, [callId]: true }));
    try {
      await manualQueueWhatsAppForCallLeadAction(callId);
      router.refresh();
    } catch (err) {
      console.error("[whatsapp-leads-client] Failed to manual queue:", err);
    } finally {
      setTimeout(() => {
        setLoadingCallIds((prev) => ({ ...prev, [callId]: false }));
      }, 1200);
    }
  };
  const [origin, setOrigin] = useState("http://127.0.0.1:3000");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  // Auto-sync polling to get new incoming calls/queue updates immediately
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 5000);
    return () => clearInterval(interval);
  }, [router]);

  const filtered = leads
    .filter((lead) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return lead.displayName.toLowerCase().includes(q) || lead.phone.includes(q);
    })
    .sort((a, b) => (priorityOrder[a.status] ?? 9) - (priorityOrder[b.status] ?? 9));

  const queuedLeads = leads
    .filter((l) => l.status === "QUEUED")
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

  const getQueuePosition = (id: string) => {
    const idx = queuedLeads.findIndex((l) => l.id === id);
    return idx >= 0 ? idx + 1 : null;
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-cyan-400">
          WhatsApp
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          WhatsApp leads
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Contacts, consent state, reply history, and message queue. Replied
          leads appear first.
        </p>
      </header>

      {/* ── System Warnings ─────────────────────────────────────────── */}
      {(accountStatus !== "CONNECTED" || !autoReplyEnabled) && (
        <div className="flex flex-col gap-3">
          {accountStatus !== "CONNECTED" && (
            <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
              <svg className="h-5 w-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-red-200">Device not connected</p>
                <p className="text-xs text-red-300/70 mt-0.5">
                  The WhatsApp worker is currently <span className="font-bold">{accountStatus}</span>. Messages in the queue will not be sent until you reconnect your device in settings.
                </p>
              </div>
            </div>
          )}

          {!autoReplyEnabled && (
            <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3">
              <svg className="h-5 w-5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-amber-200">Auto-reply is paused</p>
                <p className="text-xs text-amber-300/70 mt-0.5">
                  Automatic sending is currently turned off. The queue will build up but no messages will be dispatched.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <section className="mt-4 grid gap-5 items-start">

        {/* ── Left column: Add lead + Incoming calls ─────────────────── */}
        <div className="space-y-4">
        {/* ── Incoming calls from CallLead table ──────────────────────── */}
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Incoming calls</h2>
              <p className="mt-1 text-xs text-slate-400">
                Recent incoming calls — automatically queued for WhatsApp. First in, first out.
                {totalQueued > 0 && (
                  <span className="ml-1 text-cyan-300">({totalQueued} in queue • avg {Math.round(avgDelaySeconds / 60)}min gap)</span>
                )}
              </p>
            </div>
            {/* ── Date range filter ── */}
            <div className="flex flex-wrap items-center gap-2">
              {(["today", "last24h", "custom"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDateMode(mode)}
                  className={`h-7 rounded-md border px-3 text-[11px] font-semibold transition ${
                    dateMode === mode
                      ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-300"
                      : "border-white/10 bg-black/30 text-slate-400 hover:border-white/20 hover:text-slate-200"
                  }`}
                >
                  {mode === "today" ? "Today" : mode === "last24h" ? "Last 24 Hours" : "Custom"}
                </button>
              ))}
              {dateMode === "custom" && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="h-7 rounded-md border border-white/10 bg-black/40 px-2 text-[11px] text-slate-200 outline-none focus:border-cyan-400"
                  />
                  <span className="text-[11px] text-slate-500">to</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="h-7 rounded-md border border-white/10 bg-black/40 px-2 text-[11px] text-slate-200 outline-none focus:border-cyan-400"
                  />
                </div>
              )}
              <span className="text-[11px] text-slate-500">
                {filteredIncomingCallLeads.length} call{filteredIncomingCallLeads.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            {filteredIncomingCallLeads.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">
                {dateMode === "custom" && !customFrom && !customTo
                  ? "Pick a date range above to filter calls."
                  : "No incoming calls for this period."}
              </p>
            ) : (
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    <th className="border-b border-white/10 py-2">Caller</th>
                    <th className="border-b border-white/10 py-2">Date</th>
                    <th className="border-b border-white/10 py-2 text-center">Queue #</th>
                    <th className="border-b border-white/10 py-2 text-center">Est. time</th>
                    <th className="border-b border-white/10 py-2 text-right">WA status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {filteredIncomingCallLeads.map((call) => {
                    return (
                      <tr key={call.id}>
                        <td className="py-2.5">
                          <p className="font-medium text-slate-200 text-xs">{call.displayName}</p>
                          <p className="text-[11px] text-slate-500">{call.phone}</p>
                        </td>
                        <td className="py-2.5 text-[11px] text-slate-500">
                          {formatDate(call.createdAt)}
                        </td>
                        <td className="py-2.5 text-center">
                          {call.queuePosition ? (
                            <span className="text-xs font-bold text-cyan-200">#{call.queuePosition}</span>
                          ) : call.waStatus === "SENT" || call.waStatus === "REPLIED" ? (
                            <span className="text-[11px] text-slate-500">—</span>
                          ) : (
                            <span className="text-[11px] text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-2.5 text-center">
                           {call.queuePosition && call.targetTime ? (
                            <span className="text-xs font-semibold text-cyan-200">
                               <LiveCountdown
                                targetTime={call.targetTime}
                                serverTime={serverTime}
                                accountStatus={accountStatus}
                                autoReplyEnabled={autoReplyEnabled}
                              />
                            </span>
                          ) : call.waStatus === "SENT" || call.waStatus === "REPLIED" ? (
                            <span className="text-[11px] text-emerald-400">✓ Done</span>
                          ) : (
                            <span className="text-[11px] text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-2.5 text-right">
                          {call.waStatus ? (
                            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${statusTone(call.waStatus)}`}>
                              {call.waStatus.replace("_", " ")}
                            </span>
                          ) : loadingCallIds[call.id] ? (
                            <button disabled className="inline-flex items-center gap-1 rounded border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-bold text-cyan-200">
                              <svg className="animate-spin h-3 w-3 text-cyan-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              QUEUEING...
                            </button>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleManualQueue(call.id)}
                                className="rounded border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-[10px] font-bold text-amber-200 transition hover:bg-amber-300/20 cursor-pointer"
                              >
                                + SEND WA
                              </button>
                              <form action={deleteCallLeadDirectAction} className="inline-flex">
                                <input name="callLeadId" type="hidden" value={call.id} />
                                <button
                                  className="rounded border border-rose-300/20 bg-rose-300/10 px-2 py-1 text-[10px] font-bold text-rose-300 transition hover:bg-rose-300/20 cursor-pointer"
                                  type="submit"
                                >
                                  Delete
                                </button>
                              </form>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        </div>{/* end left column */}

        {/* Lead list */}
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-white">
              WhatsApp auto-send queue <span className="ml-1 text-sm font-normal text-slate-500">({total})</span>
            </h2>
            <div className="flex gap-2">
              {failedCount > 0 && (
                <form action={retryFailedLeadsAction}>
                  <button
                    className="h-9 rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 text-xs font-bold text-rose-100 transition hover:bg-rose-300/15"
                    type="submit"
                  >
                    Retry {failedCount} failed
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Search box */}
          <div className="mt-4">
            <input
              className="h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or phone number…"
              type="search"
              value={search}
            />
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="border-b border-white/10 py-3">Lead</th>
                  <th className="border-b border-white/10 py-3">Status</th>
                  <th className="border-b border-white/10 py-3">Form Data</th>
                  <th className="border-b border-white/10 py-3">Last contact</th>
                  <th className="border-b border-white/10 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filtered.map((lead) => (
                  <tr key={lead.id}>
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-white">{lead.displayName}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{lead.phone}</p>
                      {lead.lastReplySnippet && (
                        <p className="mt-1 line-clamp-2 max-w-xs text-xs text-violet-300">
                          💬 {lead.lastReplySnippet}
                        </p>
                      )}
                      {lead.message && !lead.lastReplySnippet && (
                        <p className="mt-1 line-clamp-1 max-w-xs text-xs text-slate-400">{lead.message}</p>
                      )}
                      {lead.lastError && (
                        <p className="mt-1 text-xs text-rose-300">⚠ {lead.lastError}</p>
                      )}
                    </td>
                    <td className="py-3">
                      <div>
                        <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${statusTone(lead.status)}`}>
                          {lead.status.replace("_", " ")}
                        </span>
                      </div>
                      {lead.status === "QUEUED" && (() => {
                        const pos = getQueuePosition(lead.id);
                        if (!pos) return null;
                        return (
                          <div className="mt-2 text-[11px] font-medium text-cyan-200/70">
                            <span className="block text-cyan-300">Pos #{pos} in queue</span>
                            <span className="block mt-0.5 text-cyan-200">
                              Est. <LiveCountdown
                                targetTime={lead.targetTime ?? null}
                                serverTime={serverTime}
                                accountStatus={accountStatus}
                                autoReplyEnabled={autoReplyEnabled}
                              />
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-3">
                      {lead.formSubmittedAt ? (
                        <div className="flex flex-col gap-1 text-xs">
                          <span className="flex items-center gap-1 font-semibold text-emerald-300">
                            ✓ Submitted
                          </span>
                          <span className="text-slate-300"><span className="text-slate-500">Name:</span> {lead.formName}</span>
                          <span className="text-slate-300"><span className="text-slate-500">City:</span> {lead.formCity}</span>
                          <span className="text-slate-300"><span className="text-slate-500">Property:</span> {lead.formPropertyType === "OWN" ? "🏠 Own" : lead.formPropertyType === "RENTAL" ? "🔑 Rental" : lead.formPropertyType}</span>
                           <a
                            href={lead.formMapsLocation || "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-400 hover:text-emerald-300 underline truncate max-w-[150px]"
                            title={lead.formMapsLocation || ""}
                          >
                            📍 Open Map
                          </a>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 text-xs text-slate-500">
                          {lead.formToken ? "⏳ Pending form" : "—"}
                          {lead.formToken && (
                             <a
                              className="text-emerald-400 hover:text-emerald-300 underline font-mono text-[11px] break-all"
                              href={`${origin}/atm-franchise/${lead.formToken}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {origin}/atm-franchise/{lead.formToken}
                            </a>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 text-xs text-slate-400">
                      {lead.lastReplyAt ? (
                        <span>
                          <span className="block text-violet-300">Replied {formatDate(lead.lastReplyAt)}</span>
                          {lead.lastSentAt && <span className="block mt-0.5">Sent {formatDate(lead.lastSentAt)}</span>}
                        </span>
                      ) : lead.lastSentAt ? (
                        formatDate(lead.lastSentAt)
                      ) : (
                        formatDate(lead.createdAt)
                      )}
                    </td>
                    <td className="py-3 text-right space-x-2">
                      {lead.status === "FAILED" && (
                        <form action={retryWhatsAppLeadAction} className="inline-flex">
                          <input name="leadId" type="hidden" value={lead.id} />
                          <button
                            className="h-9 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 text-xs font-bold text-emerald-100 transition hover:bg-emerald-300/15"
                            type="submit"
                          >
                            Resend
                          </button>
                        </form>
                      )}
                      <form action={deleteWhatsAppLeadAction} className="inline-flex">
                        <input name="leadId" type="hidden" value={lead.id} />
                        <button className="h-9 rounded-lg border border-rose-300/20 px-3 text-xs font-bold text-rose-300/80 transition hover:bg-rose-300/10 hover:text-rose-300" type="submit">
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td className="py-8 text-slate-500" colSpan={4}>
                      {search ? `No leads matching "${search}".` : "No WhatsApp leads yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && !search && (
            <div className="mt-4 flex items-center justify-between gap-4 border-t border-white/10 pt-4">
              <p className="text-sm text-slate-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <a
                    href={`/admin/whatsapp/leads?page=${page - 1}`}
                    className="h-9 rounded-lg border border-white/10 px-4 text-xs font-semibold leading-9 text-slate-200 transition hover:bg-white/10"
                  >
                    ← Previous
                  </a>
                )}
                {page < totalPages && (
                  <a
                    href={`/admin/whatsapp/leads?page=${page + 1}`}
                    className="h-9 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-4 text-xs font-semibold leading-9 text-cyan-100 transition hover:bg-cyan-300/15"
                  >
                    Next →
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
