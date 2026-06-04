"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveCallLeadToSheetAction,
  updateCallLeadDetailsAction,
  updateCallLeadWorkflowAction,
} from "@/app/lib/call-lead-actions";
import { CallLeadStatus } from "@/app/lib/prisma-enums";

type CallbackLead = {
  id: string;
  displayName: string;
  phone: string;
  email: string | null;
  city: string | null;
  address: string | null;
  ownershipType: string | null;
  locationSent: boolean;
  language: string | null;
  message: string | null;
  status: CallLeadStatus;
  assignedToId: string | null;
  nextFollowUpAt: Date | string | null;
  notes: string | null;
};

type CallbackCall = {
  id: string;
  firstRingAt: Date | string;
  status: string;
  durationSeconds: number | null;
  companyPhone: { label: string; phoneNumber: string };
  lead: CallbackLead;
};

const statusOptions = Object.keys(CallLeadStatus) as CallLeadStatus[];

function formatDate(value: Date | string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("en-IN", { day: "2-digit", hour: "2-digit", minute: "2-digit", month: "short" });
}

function toDateTimeLocal(value: Date | string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatDuration(value: number | null) {
  if (!value) return "No duration";
  if (value < 60) return `${value}s`;
  return `${Math.floor(value / 60)}m ${value % 60}s`;
}

function waitingMinutes(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return `${Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000))} min`;
}

function StatusPill({ children }: { children: string }) {
  return (
    <span className="w-fit rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-200">
      {children}
    </span>
  );
}

export function UserCallbacksPageClient({
  activeCalls,
  calls,
  currentUserId,
  openLeads,
}: {
  activeCalls: CallbackCall[];
  calls: CallbackCall[];
  currentUserId: string;
  openLeads: CallbackLead[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSavingPanel, setIsSavingPanel] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeLead, setActiveLead] = useState<CallbackLead | null>(null);
  const [activeCall, setActiveCall] = useState<CallbackCall | null>(null);
  const [detailName, setDetailName] = useState("");
  const [detailPhone, setDetailPhone] = useState("");
  const [detailEmail, setDetailEmail] = useState("");
  const [detailCity, setDetailCity] = useState("");
  const [detailLanguage, setDetailLanguage] = useState("");
  const [detailAddress, setDetailAddress] = useState("");
  const [detailOwnership, setDetailOwnership] = useState("");
  const [detailLocationSent, setDetailLocationSent] = useState(false);
  const [detailMessage, setDetailMessage] = useState("");
  const [workflowStatus, setWorkflowStatus] = useState<CallLeadStatus>("NEW");
  const [workflowNotes, setWorkflowNotes] = useState("");
  const [workflowFollowUp, setWorkflowFollowUp] = useState("");

  const openEditor = (call: CallbackCall) => {
    const lead = call.lead;
    setActiveCall(call);
    setActiveLead(lead);
    setMessage(null);
    setError(null);
    setDetailName(lead.displayName || "");
    setDetailPhone(lead.phone || "");
    setDetailEmail(lead.email || "");
    setDetailCity(lead.city || "");
    setDetailLanguage(lead.language || "");
    setDetailAddress(lead.address || "");
    setDetailOwnership(lead.ownershipType || "");
    setDetailLocationSent(lead.locationSent);
    setDetailMessage(lead.message || "");
    setWorkflowStatus(lead.status);
    setWorkflowNotes(lead.notes || "");
    setWorkflowFollowUp(toDateTimeLocal(lead.nextFollowUpAt));
  };

  const openLeadEditor = (lead: CallbackLead) => {
    setActiveCall(null);
    setActiveLead(lead);
    setMessage(null);
    setError(null);
    setDetailName(lead.displayName || "");
    setDetailPhone(lead.phone || "");
    setDetailEmail(lead.email || "");
    setDetailCity(lead.city || "");
    setDetailLanguage(lead.language || "");
    setDetailAddress(lead.address || "");
    setDetailOwnership(lead.ownershipType || "");
    setDetailLocationSent(lead.locationSent);
    setDetailMessage(lead.message || "");
    setWorkflowStatus(lead.status);
    setWorkflowNotes(lead.notes || "");
    setWorkflowFollowUp(toDateTimeLocal(lead.nextFollowUpAt));
  };

  const saveLeadWorkflowAndSheet = () => {
    if (!activeLead) return;
    setMessage(null);
    setError(null);
    setIsSavingPanel(true);

    startTransition(async () => {
      try {
        const leadId = activeLead.id;
        const detailResult = await updateCallLeadDetailsAction(leadId, {
          displayName: detailName,
          phone: detailPhone,
          email: detailEmail,
          city: detailCity,
          language: detailLanguage,
          address: detailAddress,
          ownershipType: detailOwnership,
          locationSent: detailLocationSent,
          message: detailMessage,
        });

        if (detailResult.error) {
          setError(detailResult.error);
          return;
        }

        const workflowResult = await updateCallLeadWorkflowAction(leadId, {
          status: workflowStatus,
          notes: workflowNotes,
          nextFollowUpAt: workflowFollowUp || undefined,
          assignedToId: currentUserId,
        });

        if (workflowResult.error) {
          setError(workflowResult.error);
          return;
        }

        const sheetResult = await saveCallLeadToSheetAction(leadId);

        if (sheetResult.error) {
          setError(sheetResult.error);
          return;
        }

        setMessage(sheetResult.warning || "Saved to sheet.");
        setActiveLead(null);
        setActiveCall(null);
        router.refresh();
      } finally {
        setIsSavingPanel(false);
      }
    });
  };

  const missedCallByLeadId = new Map<string, CallbackCall>();
  for (const call of calls) {
    if (!missedCallByLeadId.has(call.lead.id)) {
      missedCallByLeadId.set(call.lead.id, call);
    }
  }
  const liveCallByLeadId = new Map<string, CallbackCall>();
  for (const call of activeCalls) {
    if (!liveCallByLeadId.has(call.lead.id)) {
      liveCallByLeadId.set(call.lead.id, call);
    }
  }
  const combinedLeadById = new Map<string, CallbackLead>();
  for (const lead of openLeads) {
    combinedLeadById.set(lead.id, lead);
  }
  for (const call of activeCalls) {
    if (!call.lead.assignedToId) {
      combinedLeadById.set(call.lead.id, call.lead);
    }
  }
  for (const call of calls) {
    if (!call.lead.assignedToId) {
      combinedLeadById.set(call.lead.id, call.lead);
    }
  }
  const visibleOpenLeads = Array.from(combinedLeadById.values());

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-white/10 bg-white/[0.03] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--user-accent-text)]">Call Center</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-white">My open leads</h1>
        <p className="mt-2 text-sm text-zinc-400">Live assigned calls and missed call sessions that need lead follow-up.</p>
      </section>

      {error ? <div className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-4 py-2 text-xs text-rose-200">{error}</div> : null}
      {message ? <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs text-emerald-200">{message}</div> : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Live alerts</p>
          <p className="mt-3 text-3xl font-black text-white">{activeCalls.length}</p>
          <p className="mt-2 text-xs text-zinc-500">Ringing or connected now</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Open leads</p>
          <p className="mt-3 text-3xl font-black text-white">{visibleOpenLeads.length}</p>
          <p className="mt-2 text-xs text-zinc-500">Unassigned leads waiting</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Unique callers</p>
          <p className="mt-3 text-3xl font-black text-white">{visibleOpenLeads.length}</p>
          <p className="mt-2 text-xs text-zinc-500">People waiting</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="font-bold text-white">Open leads</h2>
          <p className="mt-1 text-xs text-zinc-500">Unassigned leads are claimed by your account when you save.</p>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[1080px]">
            <div className="grid grid-cols-[1.1fr_1fr_0.8fr_0.8fr_0.9fr_1fr_auto] gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold text-zinc-400">
              <span>Customer</span>
              <span>Address / State</span>
              <span>Property</span>
              <span>Status</span>
              <span>Last call</span>
              <span>Follow-up</span>
              <span />
            </div>
            <div className="divide-y divide-white/10">
              {visibleOpenLeads.map((lead) => {
                const missedCall = missedCallByLeadId.get(lead.id);
                const liveCall = liveCallByLeadId.get(lead.id);
                const actionCall = liveCall || missedCall;
                return (
                  <div className="grid grid-cols-[1.1fr_1fr_0.8fr_0.8fr_0.9fr_1fr_auto] items-center gap-3 px-4 py-4 text-sm" key={lead.id}>
                    <div>
                      <p className="font-bold text-white">{lead.displayName}</p>
                      <a className="mt-1 block text-xs font-bold text-[var(--user-accent-text)] hover:underline" href={`tel:${lead.phone}`}>{lead.phone}</a>
                      <p className="mt-1 text-[11px] text-zinc-500">{lead.assignedToId ? "Assigned to you" : "Unassigned"}</p>
                    </div>
                    <div>
                      <p className="truncate text-zinc-300">{lead.address || "--"}</p>
                      <p className="mt-1 text-xs text-zinc-500">{lead.city || "--"}</p>
                    </div>
                    <div>
                      <p className="text-zinc-300">{lead.ownershipType || "Not confirmed"}</p>
                      <p className="mt-1 text-xs text-zinc-500">{lead.locationSent ? "Location sent" : "Location not sent"}</p>
                    </div>
                    <div>
                      <p className="text-zinc-300">{lead.status.replaceAll("_", " ")}</p>
                      <p className="mt-1 text-xs text-zinc-500">{liveCall ? liveCall.status.replaceAll("_", " ") : missedCall ? "MISSED" : "Open lead"}</p>
                    </div>
                    <div>
                      <p className="text-zinc-300">{actionCall ? formatDate(actionCall.firstRingAt) : "--"}</p>
                      <p className="mt-1 text-xs text-zinc-500">{liveCall ? "Live now" : missedCall ? waitingMinutes(missedCall.firstRingAt) : "No call session"}</p>
                    </div>
                    <div>
                      <p className="text-zinc-300">{formatDate(lead.nextFollowUpAt)}</p>
                      <p className="mt-1 truncate text-xs text-zinc-500">{lead.notes || "--"}</p>
                    </div>
                    <button className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-zinc-200 transition hover:bg-white/10" onClick={() => actionCall ? openEditor(actionCall) : openLeadEditor(lead)} type="button">
                      View & Call
                    </button>
                  </div>
                );
              })}
              {!visibleOpenLeads.length ? <p className="px-4 py-8 text-sm text-zinc-500">No open leads available.</p> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="font-bold text-white">Live call alerts</h2>
          <p className="mt-1 text-xs text-zinc-500">These are active calls assigned to you.</p>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[920px]">
            <div className="grid grid-cols-[1.1fr_1fr_0.85fr_0.75fr_auto] gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold text-zinc-400">
              <span>Customer</span>
              <span>Company phone</span>
              <span>Started</span>
              <span>Status</span>
              <span />
            </div>
            <div className="divide-y divide-white/10">
              {activeCalls.map((call) => (
                <div className="grid grid-cols-[1.1fr_1fr_0.85fr_0.75fr_auto] items-center gap-3 px-4 py-4 text-sm" key={call.id}>
                  <div>
                    <p className="font-bold text-white">{call.lead.displayName}</p>
                    <a className="mt-1 block text-xs font-bold text-[var(--user-accent-text)] hover:underline" href={`tel:${call.lead.phone}`}>{call.lead.phone}</a>
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-300">{call.companyPhone.label}</p>
                    <p className="mt-1 text-xs text-zinc-500">{call.companyPhone.phoneNumber}</p>
                  </div>
                  <p className="text-zinc-400">{formatDate(call.firstRingAt)}</p>
                  <StatusPill>{call.status}</StatusPill>
                  <button className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-zinc-200 transition hover:bg-white/10" onClick={() => openEditor(call)} type="button">
                    View & Call
                  </button>
                </div>
              ))}
              {!activeCalls.length ? <p className="px-4 py-8 text-sm text-zinc-500">No live call alerts right now.</p> : null}
            </div>
          </div>
        </div>
      </section>

      {activeLead ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => { setActiveLead(null); setActiveCall(null); }} />
          <div className="relative z-10 flex h-full w-full flex-col border-l border-white/10 bg-[#0e0f14] shadow-2xl sm:max-w-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--user-accent-text)]">Call Lead Action Panel</p>
                <h2 className="mt-1 text-xl font-bold text-white">{activeLead.displayName}</h2>
                <a className="mt-1 block text-sm font-semibold text-[var(--user-accent-text)] hover:underline" href={`tel:${activeLead.phone}`}>{activeLead.phone}</a>
              </div>
              <button className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition hover:text-white" onClick={() => { setActiveLead(null); setActiveCall(null); }} type="button">
                x
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {error ? <div className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-4 py-2 text-xs text-rose-200">{error}</div> : null}
              {message ? <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs text-emerald-200">{message}</div> : null}

              {activeCall ? (
                <section className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                  <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">Call Details</h3>
                  <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                    <div><p className="text-zinc-500">Duration</p><p className="mt-1 font-bold text-white">{formatDuration(activeCall.durationSeconds)}</p></div>
                    <div><p className="text-zinc-500">Started</p><p className="mt-1 font-bold text-white">{formatDate(activeCall.firstRingAt)}</p></div>
                    <div><p className="text-zinc-500">Company phone</p><p className="mt-1 font-bold text-white">{activeCall.companyPhone.label}</p><p className="mt-1 text-zinc-500">{activeCall.companyPhone.phoneNumber}</p></div>
                    <div><p className="text-zinc-500">Status</p><p className="mt-1 font-bold text-white">{activeCall.status.replaceAll("_", " ")}</p></div>
                  </div>
                </section>
              ) : null}

              <section className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">Customer Data</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {[
                    ["Name", detailName, setDetailName],
                    ["Phone", detailPhone, setDetailPhone],
                    ["Email", detailEmail, setDetailEmail],
                    ["State", detailCity, setDetailCity],
                    ["Language", detailLanguage, setDetailLanguage],
                  ].map(([label, value, setter]) => (
                    <label className="block" key={label as string}>
                      <span className="mb-2 block text-[11px] text-zinc-400">{label as string}</span>
                      <input className="h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-xs text-zinc-200 outline-none focus:border-[var(--user-accent)]" onChange={(event) => (setter as (value: string) => void)(event.target.value)} value={value as string} />
                    </label>
                  ))}
                  <label className="block">
                    <span className="mb-2 block text-[11px] text-zinc-400">Own / Rental</span>
                    <select className="h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-xs text-zinc-200 outline-none focus:border-[var(--user-accent)]" onChange={(event) => setDetailOwnership(event.target.value)} value={detailOwnership}>
                      <option value="">Not confirmed</option>
                      <option value="OWN">Own</option>
                      <option value="RENTAL">Rental</option>
                    </select>
                  </label>
                  <label className="flex h-10 items-center gap-3 self-end rounded-lg border border-white/10 bg-black/30 px-3 text-xs text-zinc-200">
                    <input checked={detailLocationSent} className="rounded border-white/10 bg-black/40" onChange={(event) => setDetailLocationSent(event.target.checked)} type="checkbox" />
                    Location sent
                  </label>
                </div>
                <label className="mt-4 block">
                  <span className="mb-2 block text-[11px] text-zinc-400">Address</span>
                  <textarea className="w-full rounded-lg border border-white/10 bg-black/40 p-3 text-xs text-zinc-200 outline-none focus:border-[var(--user-accent)]" onChange={(event) => setDetailAddress(event.target.value)} rows={3} value={detailAddress} />
                </label>
                <label className="mt-4 block">
                  <span className="mb-2 block text-[11px] text-zinc-400">Lead Message / Requirement</span>
                  <textarea className="w-full rounded-lg border border-white/10 bg-black/40 p-3 text-xs text-zinc-200 outline-none focus:border-[var(--user-accent)]" onChange={(event) => setDetailMessage(event.target.value)} rows={3} value={detailMessage} />
                </label>
              </section>

              <section className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">Follow-up Workflow</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-[11px] text-zinc-400">Status</span>
                    <select className="h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-xs text-zinc-200 outline-none focus:border-[var(--user-accent)]" onChange={(event) => setWorkflowStatus(event.target.value as CallLeadStatus)} value={workflowStatus}>
                      {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[11px] text-zinc-400">Next Follow-up Date</span>
                    <input className="h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-xs text-zinc-200 outline-none focus:border-[var(--user-accent)]" onChange={(event) => setWorkflowFollowUp(event.target.value)} type="datetime-local" value={workflowFollowUp} />
                  </label>
                </div>
                <label className="mt-4 block">
                  <span className="mb-2 block text-[11px] text-zinc-400">Notes</span>
                  <textarea className="w-full rounded-lg border border-white/10 bg-black/40 p-3 text-xs text-zinc-200 outline-none focus:border-[var(--user-accent)]" onChange={(event) => setWorkflowNotes(event.target.value)} rows={3} value={workflowNotes} />
                </label>
              </section>

              <button className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--user-accent)] text-xs font-bold text-[var(--user-active-text)] transition hover:brightness-110 disabled:opacity-50" disabled={isPending || isSavingPanel} onClick={saveLeadWorkflowAndSheet} type="button">
                {isSavingPanel ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
                {isSavingPanel ? "Saving..." : "Save Lead, Workflow & Sheet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
