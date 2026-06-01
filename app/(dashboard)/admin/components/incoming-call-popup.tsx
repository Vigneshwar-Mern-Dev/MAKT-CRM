"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type LiveCall = {
  id: string;
  callerNumber: string;
  status: string;
  firstRingAt: string;
  companyPhone: {
    phoneNumber: string;
    label: string;
  };
  lead: {
    id: string;
    phone: string;
    displayName: string;
    status: string;
    assignedToId: string | null;
  };
};

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Now";
  }

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function IncomingCallPopup() {
  const [calls, setCalls] = useState<LiveCall[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let isMounted = true;

    async function loadLiveCalls() {
      try {
        const response = await fetch("/api/calls/live", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { calls?: LiveCall[] };

        if (isMounted) {
          setCalls(payload.calls || []);
        }
      } catch {
        // Polling should fail quietly; the page itself should not break.
      }
    }

    loadLiveCalls();
    const intervalId = window.setInterval(loadLiveCalls, 4000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const visibleCall = useMemo(
    () => calls.find((call) => !dismissedIds.has(call.id)),
    [calls, dismissedIds],
  );

  if (!visibleCall) {
    return null;
  }

  const isRinging = visibleCall.status === "RINGING";

  return (
    <div className="fixed bottom-5 right-5 z-[60] w-[min(calc(100vw-2.5rem),380px)] rounded-lg border border-cyan-300/30 bg-[#0d1118] p-4 shadow-2xl shadow-cyan-950/40">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">
            {isRinging ? "Incoming Call" : "Active Call"}
          </p>
          <h2 className="mt-2 text-xl font-bold text-white">
            {visibleCall.lead.displayName}
          </h2>
          <a
            className="mt-1 block text-sm font-semibold text-cyan-200 hover:underline"
            href={`tel:${visibleCall.lead.phone || visibleCall.callerNumber}`}
          >
            {visibleCall.lead.phone || visibleCall.callerNumber}
          </a>
        </div>
        <button
          aria-label="Dismiss incoming call popup"
          className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition hover:text-white"
          onClick={() =>
            setDismissedIds((current) => {
              const next = new Set(current);
              next.add(visibleCall.id);
              return next;
            })
          }
          type="button"
        >
          x
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-white/10 bg-black/30 p-3 text-xs">
        <div>
          <p className="text-slate-500">Company Phone</p>
          <p className="mt-1 font-semibold text-slate-200">{visibleCall.companyPhone.label}</p>
          <p className="mt-1 text-slate-500">{visibleCall.companyPhone.phoneNumber}</p>
        </div>
        <div>
          <p className="text-slate-500">Started</p>
          <p className="mt-1 font-semibold text-slate-200">{formatTime(visibleCall.firstRingAt)}</p>
          <p className="mt-1 text-slate-500">{visibleCall.status === "RINGING" ? "Ringing" : "On call"}</p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Link
          className="h-10 flex-1 rounded-lg bg-cyan-300 text-center text-sm font-bold leading-10 text-slate-950 transition hover:bg-cyan-200"
          href="/admin/calls/live"
        >
          View Live
        </Link>
        <Link
          className="h-10 flex-1 rounded-lg border border-white/10 text-center text-sm font-bold leading-10 text-slate-200 transition hover:bg-white/10"
          href="/admin/calls/leads"
        >
          Open Lead
        </Link>
      </div>
    </div>
  );
}
