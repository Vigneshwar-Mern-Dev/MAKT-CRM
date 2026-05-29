import Link from "next/link";
import { db } from "@/app/lib/db";
import { LeadStage, SheetConnectionStatus, TaskStatus } from "@/app/lib/prisma-enums";

function formatDate(value: Date | null) {
  if (!value) {
    return "Never";
  }

  return value.toLocaleString("en-IN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}

function pct(value: number, total: number) {
  if (!total) {
    return "0%";
  }

  return `${Math.round((value / total) * 100)}%`;
}

async function getOverviewData() {
  try {
    const [
      totalUsers,
      adminUsers,
      standardUsers,
      websiteLeads,
      instagramLeads,
      newWebsiteLeads,
      newInstagramLeads,
      websiteFollowUps,
      instagramFollowUps,
      websiteConverted,
      instagramConverted,
      unassignedWebsiteLeads,
      unassignedInstagramLeads,
      openTasks,
      overdueTasks,
      integrations,
      recentWebsiteLeads,
      recentInstagramLeads,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { role: "ADMIN" } }),
      db.user.count({ where: { role: "USER" } }),
      db.websiteLead.count(),
      db.instagramLead.count(),
      db.websiteLead.count({ where: { stage: LeadStage.NEW } }),
      db.instagramLead.count({ where: { stage: LeadStage.NEW } }),
      db.websiteLead.count({ where: { stage: LeadStage.FOLLOW_UP } }),
      db.instagramLead.count({ where: { stage: LeadStage.FOLLOW_UP } }),
      db.websiteLead.count({ where: { stage: LeadStage.CONVERTED } }),
      db.instagramLead.count({ where: { stage: LeadStage.CONVERTED } }),
      db.websiteLead.count({ where: { assignedToId: null } }),
      db.instagramLead.count({ where: { assignedToId: null } }),
      db.task.count({
        where: { status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] } },
      }),
      db.task.count({
        where: {
          dueDate: { lt: new Date() },
          status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
        },
      }),
      db.leadIntegration.findMany({
        orderBy: { source: "asc" },
        select: {
          source: true,
          status: true,
          importedCount: true,
          failedCount: true,
          lastSyncedAt: true,
        },
      }),
      db.websiteLead.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, name: true, stage: true, createdAt: true, city: true },
      }),
      db.instagramLead.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, name: true, stage: true, createdAt: true, city: true },
      }),
    ]);

    const recentLeads = [
      ...recentWebsiteLeads.map((lead) => ({ ...lead, source: "Website" })),
      ...recentInstagramLeads.map((lead) => ({ ...lead, source: "Instagram" })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 6);

    return {
      data: {
        totalUsers,
        adminUsers,
        standardUsers,
        websiteLeads,
        instagramLeads,
        totalLeads: websiteLeads + instagramLeads,
        newLeads: newWebsiteLeads + newInstagramLeads,
        followUps: websiteFollowUps + instagramFollowUps,
        convertedLeads: websiteConverted + instagramConverted,
        unassignedLeads: unassignedWebsiteLeads + unassignedInstagramLeads,
        openTasks,
        overdueTasks,
        integrations,
        recentLeads,
      },
      error: null,
    };
  } catch {
    return {
      data: {
        totalUsers: 0,
        adminUsers: 0,
        standardUsers: 0,
        websiteLeads: 0,
        instagramLeads: 0,
        totalLeads: 0,
        newLeads: 0,
        followUps: 0,
        convertedLeads: 0,
        unassignedLeads: 0,
        openTasks: 0,
        overdueTasks: 0,
        integrations: [],
        recentLeads: [],
      },
      error: "Database is unreachable. Dashboard numbers are temporarily unavailable.",
    };
  }
}

export default async function AdminDashboard() {
  const { data, error } = await getOverviewData();
  const connectedSources = data.integrations.filter(
    (integration) => integration.status === SheetConnectionStatus.CONNECTED,
  ).length;
  const conversionRate = pct(data.convertedLeads, data.totalLeads);

  return (
    <div className="space-y-6 pb-8">
      <section className="flex flex-col justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.03] p-5 md:flex-row md:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
            Admin overview
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
            Dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Live CRM activity, lead pressure, user access, and task risk in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="h-10 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-4 text-sm font-semibold leading-10 text-cyan-100 transition hover:bg-cyan-300/15"
            href="/admin/leads/new"
          >
            New leads
          </Link>
          <Link
            className="h-10 rounded-lg border border-white/10 px-4 text-sm font-semibold leading-10 text-slate-200 transition hover:bg-white/10"
            href="/admin/tasks"
          >
            Tasks
          </Link>
        </div>
      </section>

      {error ? (
        <div className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total leads", data.totalLeads, "text-cyan-100", "All captured prospects"],
          ["New leads", data.newLeads, "text-sky-100", "Waiting for first action"],
          ["Follow-ups", data.followUps, "text-amber-100", "Scheduled callback queue"],
          ["Open tasks", data.openTasks, "text-rose-100", `${data.overdueTasks} overdue`],
        ].map(([label, value, tone, detail]) => (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5" key={label}>
            <p className="text-sm text-slate-400">{label}</p>
            <p className={`mt-3 text-4xl font-bold ${tone}`}>{value}</p>
            <p className="mt-2 text-xs text-slate-500">{detail}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Pipeline health</h2>
              <p className="mt-1 text-sm text-slate-400">
                Actual lead distribution by source and current operating risk.
              </p>
            </div>
            <span className="rounded-lg bg-cyan-300 px-3 py-1 text-xs font-bold text-slate-950">
              {conversionRate}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["Website leads", data.websiteLeads],
              ["Instagram leads", data.instagramLeads],
              ["Unassigned", data.unassignedLeads],
              ["Converted", data.convertedLeads],
            ].map(([label, value]) => (
              <div className="rounded-lg border border-white/5 bg-black/30 p-4" key={label}>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  {label}
                </p>
                <p className="mt-3 text-2xl font-bold text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Sync status</h2>
              <p className="mt-1 text-sm text-slate-400">
                Google Sheet source health and latest import counters.
              </p>
            </div>
            <span className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100">
              {connectedSources}/{data.integrations.length || 2} connected
            </span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {data.integrations.map((integration) => (
              <div className="rounded-lg border border-white/5 bg-black/30 p-4" key={integration.source}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-white">{integration.source}</p>
                  <span className="rounded border border-white/10 px-2 py-0.5 text-[11px] font-bold text-slate-300">
                    {integration.status.replace("_", " ")}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-slate-500">Imported</p>
                    <p className="mt-1 font-bold text-slate-100">{integration.importedCount}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Failed</p>
                    <p className="mt-1 font-bold text-slate-100">{integration.failedCount}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Synced</p>
                    <p className="mt-1 font-bold text-slate-100">{formatDate(integration.lastSyncedAt)}</p>
                  </div>
                </div>
              </div>
            ))}
            {!data.integrations.length ? (
              <div className="rounded-lg border border-dashed border-white/10 bg-black/20 p-4 text-sm text-slate-400 md:col-span-2">
                No sheet integrations configured yet.
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-white">Recent leads</h2>
          <div className="mt-4 divide-y divide-white/10">
            {data.recentLeads.map((lead) => (
              <div className="grid gap-3 py-3 text-sm sm:grid-cols-[1fr_auto_auto]" key={`${lead.source}-${lead.id}`}>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{lead.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{lead.city || "No city"} · {lead.source}</p>
                </div>
                <span className="h-7 w-fit rounded border border-cyan-300/20 bg-cyan-300/10 px-2 text-xs font-bold leading-7 text-cyan-100">
                  {lead.stage.replace("_", " ")}
                </span>
                <p className="text-xs text-slate-500 sm:text-right">{formatDate(lead.createdAt)}</p>
              </div>
            ))}
            {!data.recentLeads.length ? (
              <p className="py-4 text-sm text-slate-500">No leads imported yet.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-white">Access summary</h2>
          <div className="mt-4 grid gap-3">
            {[
              ["Total users", data.totalUsers],
              ["Admins", data.adminUsers],
              ["Agents", data.standardUsers],
            ].map(([label, value]) => (
              <div className="flex items-center justify-between rounded-lg border border-white/5 bg-black/30 px-4 py-3" key={label}>
                <p className="text-sm text-slate-400">{label}</p>
                <p className="text-xl font-bold text-white">{value}</p>
              </div>
            ))}
          </div>
          <Link
            className="mt-4 block h-10 rounded-lg border border-white/10 text-center text-sm font-semibold leading-10 text-slate-200 transition hover:bg-white/10"
            href="/admin/users"
          >
            Manage users
          </Link>
        </div>
      </section>
    </div>
  );
}
