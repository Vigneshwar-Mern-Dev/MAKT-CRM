import Link from "next/link";
import { db } from "@/app/lib/db";
import { CallStatusBadge, EmptyState, PageHeader, StatCard, TopLink, formatDateTime } from "./call-ui";

export default async function AdminCallCenterPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalSessions,
    todaySessions,
    missedSessions,
    liveSessions,
    callLeads,
    phones,
    recentSessions,
  ] = await Promise.all([
    db.callSession.count(),
    db.callSession.count({ where: { firstRingAt: { gte: today } } }),
    db.callSession.count({ where: { status: "MISSED" } }),
    db.callSession.count({ where: { status: { in: ["RINGING", "ANSWERED"] }, endedAt: null } }),
    db.callLead.count(),
    db.companyPhone.count({ where: { isActive: true } }),
    db.callSession.findMany({
      include: {
        companyPhone: { select: { phoneNumber: true, label: true } },
        lead: { select: { id: true, phone: true, displayName: true } },
      },
      orderBy: { firstRingAt: "desc" },
      take: 8,
    }),
  ]);

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        actions={
          <>
            <TopLink href="/admin/calls/live">Live calls</TopLink>
            <TopLink href="/admin/calls/missed">Missed calls</TopLink>
          </>
        }
        description="Call tracker data from company Android phones, kept separate from website and Instagram lead queues."
        title="Call Center"
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="All tracked call sessions" label="Total calls" value={totalSessions} />
        <StatCard detail="Since midnight" label="Calls today" value={todaySessions} />
        <StatCard detail="Callback required" label="Missed calls" value={missedSessions} />
        <StatCard detail="Registered active phones" label="Company phones" value={phones} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Recent call sessions</h2>
              <p className="mt-1 text-sm text-slate-400">
                Latest incoming phone activity across registered company phones.
              </p>
            </div>
            <CallStatusBadge status={`${liveSessions} LIVE`} />
          </div>

          <div className="mt-4 divide-y divide-white/10">
            {recentSessions.map((session) => (
              <div className="grid gap-3 py-3 text-sm md:grid-cols-[1fr_auto_auto]" key={session.id}>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">
                    {session.lead.displayName} · {session.lead.phone}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {session.companyPhone.label} · {session.companyPhone.phoneNumber}
                  </p>
                </div>
                <CallStatusBadge status={session.status} />
                <p className="text-xs text-slate-500 md:text-right">
                  {formatDateTime(session.firstRingAt)}
                </p>
              </div>
            ))}
            {!recentSessions.length ? <EmptyState>No call sessions received yet.</EmptyState> : null}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-white">Call workflow</h2>
          <div className="mt-4 grid gap-3">
            {[
              ["/admin/calls/live", "Live Calls", "Ringing and active calls"],
              ["/admin/calls/missed", "Missed Calls", "Callback queue"],
              ["/admin/calls/leads", "Call Leads", `${callLeads} phone leads`],
              ["/admin/calls/phones", "Company Phones", `${phones} active devices`],
            ].map(([href, label, detail]) => (
              <Link
                className="rounded-lg border border-white/5 bg-black/30 px-4 py-3 transition hover:bg-white/5"
                href={href}
                key={href}
              >
                <p className="font-semibold text-white">{label}</p>
                <p className="mt-1 text-xs text-slate-500">{detail}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
