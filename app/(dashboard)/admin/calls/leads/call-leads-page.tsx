"use client";

import { useState, useTransition } from "react";
import {
  saveCallLeadToInstagramAction,
  updateCallLeadDetailsAction,
  updateCallLeadWorkflowAction,
} from "@/app/lib/call-lead-actions";
import { CallLeadStatus } from "@/app/lib/prisma-enums";

export type CallLeadRow = {
  id: string;
  phone: string;
  displayName: string;
  email: string | null;
  city: string | null;
  address: string | null;
  ownershipType: string | null;
  provider: string | null;
  language: string | null;
  message: string | null;
  status: CallLeadStatus;
  assignedToId: string | null;
  lastCompanyPhone: string | null;
  lastContactedAt: Date | string | null;
  nextFollowUpAt: Date | string | null;
  notes: string | null;
  instagramLeadId: string | null;
  sheetSyncedAt: Date | string | null;
  sheetSyncWarning: string | null;
  updatedAt: Date | string;
  assignedTo?: { id: string; username: string; email: string; department?: string } | null;
  sessions?: Array<{
    id: string;
    firstRingAt: Date | string;
    status: string;
    durationSeconds: number | null;
    companyPhone: { label: string; phoneNumber: string };
  }>;
  activities?: Array<{
    id: string;
    actionType: string;
    description: string;
    createdAt: Date | string;
    user?: { username: string } | null;
  }>;
  _count: { sessions: number; followUps: number };
};

type Agent = { id: string; username: string; email: string; department?: string };

const statusOptions = Object.keys(CallLeadStatus) as CallLeadStatus[];

function formatDate(value: Date | string | null) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}

function toDateTimeLocal(value: Date | string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function statusTone(status: string) {
  if (status === "CONVERTED") {
    return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  }

  if (status === "FOLLOW_UP" || status === "INTERESTED") {
    return "border-amber-300/20 bg-amber-300/10 text-amber-100";
  }

  if (status === "NOT_INTERESTED" || status === "CLOSED") {
    return "border-rose-300/20 bg-rose-300/10 text-rose-100";
  }

  return "border-cyan-300/20 bg-cyan-300/10 text-cyan-100";
}

export function CallLeadsPage({
  leads,
  agents,
}: {
  leads: CallLeadRow[];
  agents: Agent[];
}) {
  const [activeLead, setActiveLead] = useState<CallLeadRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailName, setDetailName] = useState("");
  const [detailPhone, setDetailPhone] = useState("");
  const [detailEmail, setDetailEmail] = useState("");
  const [detailCity, setDetailCity] = useState("");
  const [detailLanguage, setDetailLanguage] = useState("");
  const [detailAddress, setDetailAddress] = useState("");
  const [detailOwnership, setDetailOwnership] = useState("");
  const [detailProvider, setDetailProvider] = useState("");
  const [detailMessage, setDetailMessage] = useState("");
  const [workflowStatus, setWorkflowStatus] = useState<CallLeadStatus>("NEW");
  const [workflowNotes, setWorkflowNotes] = useState("");
  const [workflowFollowUp, setWorkflowFollowUp] = useState("");
  const [workflowAssignee, setWorkflowAssignee] = useState("");

  const openPanel = (lead: CallLeadRow) => {
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
    setDetailProvider(lead.provider || "");
    setDetailMessage(lead.message || "");
    setWorkflowStatus(lead.status);
    setWorkflowNotes(lead.notes || "");
    setWorkflowFollowUp(toDateTimeLocal(lead.nextFollowUpAt));
    setWorkflowAssignee(lead.assignedToId || "");
  };

  const saveDetails = () => {
    if (!activeLead) return;
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const result = await updateCallLeadDetailsAction(activeLead.id, {
        displayName: detailName,
        phone: detailPhone,
        email: detailEmail,
        city: detailCity,
        language: detailLanguage,
        address: detailAddress,
        ownershipType: detailOwnership,
        provider: detailProvider,
        message: detailMessage,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setMessage("Call lead details saved.");
    });
  };

  const saveWorkflow = () => {
    if (!activeLead) return;
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const result = await updateCallLeadWorkflowAction(activeLead.id, {
        status: workflowStatus,
        notes: workflowNotes,
        nextFollowUpAt: workflowFollowUp || undefined,
        assignedToId: workflowAssignee || undefined,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setMessage("Call workflow saved.");
    });
  };

  const saveToSheet = () => {
    if (!activeLead) return;
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const result = await saveCallLeadToInstagramAction(activeLead.id);

      if (result.error) {
        setError(result.error);
        return;
      }

      setMessage(result.warning || "Saved to Instagram lead flow and sheet sync completed.");
    });
  };

  return (
    <div className="space-y-6 pb-8">
      <section className="flex flex-col justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.03] p-5 md:flex-row md:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
            Call Center
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
            Call Leads
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            App phone numbers become call leads here. Call, fill customer data, set follow-up, then save to sheet.
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
        <div className="grid grid-cols-[1.1fr_1fr_1fr_0.8fr_0.8fr_0.8fr] gap-3 border-b border-white/10 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          <span>Date</span>
          <span>Customer</span>
          <span>Company Phone</span>
          <span>Status</span>
          <span>Call</span>
          <span>View</span>
        </div>

        <div className="divide-y divide-white/10">
          {leads.map((lead) => {
            const latestSession = lead.sessions?.[0];

            return (
              <div
                className="grid grid-cols-[1.1fr_1fr_1fr_0.8fr_0.8fr_0.8fr] items-center gap-3 px-4 py-4 text-sm"
                key={lead.id}
              >
                <div>
                  <p className="font-medium text-slate-200">
                    {formatDate(latestSession?.firstRingAt || lead.updatedAt)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {lead._count.sessions} calls · {lead._count.followUps} follow-ups
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{lead.displayName}</p>
                  <p className="mt-1 truncate text-xs text-slate-400">{lead.phone}</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">
                    {latestSession?.companyPhone.label || "Unknown"}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-400">
                    {latestSession?.companyPhone.phoneNumber || lead.lastCompanyPhone || "N/A"}
                  </p>
                </div>
                <span className={`w-fit rounded border px-2 py-1 text-xs font-bold ${statusTone(lead.status)}`}>
                  {lead.status.replace("_", " ")}
                </span>
                <a
                  className="h-9 w-fit rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 text-xs font-bold leading-9 text-emerald-100 transition hover:bg-emerald-300 hover:text-slate-950"
                  href={`tel:${lead.phone}`}
                >
                  Call
                </a>
                <button
                  className="h-9 w-fit rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 text-xs font-bold text-cyan-100 transition hover:bg-cyan-300 hover:text-slate-950"
                  onClick={() => openPanel(lead)}
                  type="button"
                >
                  View
                </button>
              </div>
            );
          })}
          {!leads.length ? (
            <div className="px-4 py-8 text-sm text-slate-400">
              No app call leads yet. Register a phone and send call events first.
            </div>
          ) : null}
        </div>
      </section>

      {activeLead ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setActiveLead(null)} />
          <div className="relative z-10 flex h-full w-full flex-col border-l border-white/10 bg-[#0e0f14] shadow-2xl sm:max-w-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-200">
                  Call Lead Action Panel
                </p>
                <h2 className="mt-1 text-xl font-bold text-white">{activeLead.displayName}</h2>
              </div>
              <button
                className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition hover:text-white"
                onClick={() => setActiveLead(null)}
                type="button"
              >
                x
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {error ? (
                <div className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-4 py-2 text-xs text-rose-200">
                  {error}
                </div>
              ) : null}
              {message ? (
                <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs text-emerald-200">
                  {message}
                </div>
              ) : null}

              <section className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  Customer Data
                </h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {[
                    ["Name", detailName, setDetailName],
                    ["Phone", detailPhone, setDetailPhone],
                    ["Email", detailEmail, setDetailEmail],
                    ["City / State", detailCity, setDetailCity],
                    ["Language", detailLanguage, setDetailLanguage],
                    ["Provider", detailProvider, setDetailProvider],
                  ].map(([label, value, setter]) => (
                    <label className="block" key={label as string}>
                      <span className="mb-2 block text-[11px] text-slate-400">{label as string}</span>
                      <input
                        className="h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-xs text-slate-200 outline-none focus:border-cyan-300"
                        onChange={(event) => (setter as (value: string) => void)(event.target.value)}
                        value={value as string}
                      />
                    </label>
                  ))}
                  <label className="block">
                    <span className="mb-2 block text-[11px] text-slate-400">Own / Rental</span>
                    <select
                      className="h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-xs text-slate-200 outline-none focus:border-cyan-300"
                      onChange={(event) => setDetailOwnership(event.target.value)}
                      value={detailOwnership}
                    >
                      <option value="">Not confirmed</option>
                      <option value="OWN">Own</option>
                      <option value="RENTAL">Rental</option>
                    </select>
                  </label>
                </div>
                <label className="mt-4 block">
                  <span className="mb-2 block text-[11px] text-slate-400">Address</span>
                  <textarea
                    className="w-full rounded-lg border border-white/10 bg-black/40 p-3 text-xs text-slate-200 outline-none focus:border-cyan-300"
                    onChange={(event) => setDetailAddress(event.target.value)}
                    rows={3}
                    value={detailAddress}
                  />
                </label>
                <label className="mt-4 block">
                  <span className="mb-2 block text-[11px] text-slate-400">Lead Message / Requirement</span>
                  <textarea
                    className="w-full rounded-lg border border-white/10 bg-black/40 p-3 text-xs text-slate-200 outline-none focus:border-cyan-300"
                    onChange={(event) => setDetailMessage(event.target.value)}
                    rows={3}
                    value={detailMessage}
                  />
                </label>
                <button
                  className="mt-4 h-10 w-full rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-xs font-bold text-emerald-200 transition hover:bg-emerald-400 hover:text-slate-950 disabled:opacity-50"
                  disabled={isPending}
                  onClick={saveDetails}
                  type="button"
                >
                  Save Customer Data
                </button>
              </section>

              <section className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  Follow-up Workflow
                </h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-[11px] text-slate-400">Status</span>
                    <select
                      className="h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-xs text-slate-200 outline-none focus:border-cyan-300"
                      onChange={(event) => setWorkflowStatus(event.target.value as CallLeadStatus)}
                      value={workflowStatus}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[11px] text-slate-400">Assign To</span>
                    <select
                      className="h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-xs text-slate-200 outline-none focus:border-cyan-300"
                      onChange={(event) => setWorkflowAssignee(event.target.value)}
                      value={workflowAssignee}
                    >
                      <option value="">Unassigned</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.username}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-[11px] text-slate-400">Next Follow-up Date</span>
                    <input
                      className="h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-xs text-slate-200 outline-none focus:border-cyan-300"
                      onChange={(event) => setWorkflowFollowUp(event.target.value)}
                      type="datetime-local"
                      value={workflowFollowUp}
                    />
                  </label>
                </div>
                <label className="mt-4 block">
                  <span className="mb-2 block text-[11px] text-slate-400">Call Notes</span>
                  <textarea
                    className="w-full rounded-lg border border-white/10 bg-black/40 p-3 text-xs text-slate-200 outline-none focus:border-cyan-300"
                    onChange={(event) => setWorkflowNotes(event.target.value)}
                    rows={3}
                    value={workflowNotes}
                  />
                </label>
                <button
                  className="mt-4 h-10 w-full rounded-lg bg-cyan-400 text-xs font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
                  disabled={isPending}
                  onClick={saveWorkflow}
                  type="button"
                >
                  Save Follow-up
                </button>
              </section>

              <section className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  Sheet Save
                </h3>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Saves this app call lead into the Instagram-style CRM lead table and sends it through the configured Instagram sheet sync.
                </p>
                <button
                  className="mt-4 h-11 w-full rounded-lg bg-white text-xs font-bold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50"
                  disabled={isPending}
                  onClick={saveToSheet}
                  type="button"
                >
                  Save To Sheet
                </button>
                {activeLead.sheetSyncWarning ? (
                  <p className="mt-3 text-xs text-amber-200">{activeLead.sheetSyncWarning}</p>
                ) : null}
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
