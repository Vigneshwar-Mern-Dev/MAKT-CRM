import Link from "next/link";
import { db } from "@/app/lib/db";
import { requireRole } from "@/app/lib/session";

function formatDate(value: Date | string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}

function StatCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-3 text-3xl font-black text-white">{value}</p>
      <p className="mt-2 text-xs text-zinc-500">{detail}</p>
    </div>
  );
}

export default async function UserCallCenterOverviewPage() {
  const user = await requireRole("USER");
  const actionableStatuses = ["NEW", "CONTACTED", "FOLLOW_UP", "INTERESTED", "NO_RESPONSE"] as const;

  const [assignedCount, openLeadCount, followUpCount, recentLeads] = await Promise.all([
    db.callLead.count({
      where: {
        assignedToId: user.id,
        status: { in: [...actionableStatuses] },
      },
    }),
    db.callSession.count({
      where: {
        status: "MISSED",
        lead: { assignedToId: user.id, status: { in: [...actionableStatuses] } },
      },
    }),
    db.callLead.count({
      where: {
        assignedToId: user.id,
        OR: [{ status: "FOLLOW_UP" }, { nextFollowUpAt: { not: null } }],
      },
    }),
    db.callLead.findMany({
      where: { assignedToId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: {
        id: true,
        displayName: true,
        phone: true,
        status: true,
        nextFollowUpAt: true,
        updatedAt: true,
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-white/10 bg-white/[0.03] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--user-accent-text)]">Call Center</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-white">My call overview</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          Assigned phone leads, open call leads, and follow-up work from the call queue.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <StatCard detail="Open call leads assigned to you" label="Assigned" value={assignedCount} />
        <StatCard detail="Open missed-call leads waiting for action" label="Open Leads" value={openLeadCount} />
        <StatCard detail="Scheduled or marked follow-up" label="Follow-ups" value={followUpCount} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Link className="rounded-lg border border-white/10 bg-[var(--user-accent)] px-5 py-4 text-sm font-bold text-[var(--user-active-text)] transition hover:brightness-110" href="/user/calls/assigned">
          View assigned call leads
        </Link>
        <Link className="rounded-lg border border-white/10 bg-white/[0.03] px-5 py-4 text-sm font-bold text-white transition hover:bg-white/[0.06]" href="/user/calls/callbacks">
          Review open leads
        </Link>
        <Link className="rounded-lg border border-white/10 bg-white/[0.03] px-5 py-4 text-sm font-bold text-white transition hover:bg-white/[0.06]" href="/user/calls/callbacks">
          Check call follow-ups
        </Link>
      </section>

      <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="font-bold text-white">Recent assigned call leads</h2>
        </div>
        <div className="divide-y divide-white/10">
          {recentLeads.map((lead) => (
            <div className="grid gap-3 px-5 py-4 text-sm md:grid-cols-[1fr_0.8fr_0.8fr_0.8fr]" key={lead.id}>
              <div>
                <p className="font-bold text-white">{lead.displayName}</p>
                <p className="mt-1 text-xs text-zinc-500">{lead.phone}</p>
              </div>
              <p className="text-zinc-300">{lead.status.replaceAll("_", " ")}</p>
              <p className="text-zinc-400">{formatDate(lead.nextFollowUpAt)}</p>
              <p className="text-zinc-500">{formatDate(lead.updatedAt)}</p>
            </div>
          ))}
          {!recentLeads.length ? <p className="px-5 py-8 text-sm text-zinc-500">No assigned call leads yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
