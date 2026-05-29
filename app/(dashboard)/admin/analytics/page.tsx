import { db } from "@/app/lib/db";
import { ANALYTICS_ROW_LIMIT } from "@/app/lib/query-limits";
import {
  LeadSource,
  LeadStage,
  SheetConnectionStatus,
  TaskPriority,
  TaskStatus,
} from "@/app/lib/prisma-enums";

type LeadAnalyticsRow = {
  id: string;
  source: LeadSource;
  stage: LeadStage;
  assignedToId: string | null;
  phone: string | null;
  city: string | null;
  notes: string | null;
  lastContactedAt: Date | null;
  nextFollowUpAt: Date | null;
  createdAt: Date;
  timestamp: Date;
};

type TaskAnalyticsRow = {
  status: TaskStatus;
  priority: TaskPriority;
  assignedToId: string;
  dueDate: Date | null;
};

const leadStages = [
  LeadStage.NEW,
  LeadStage.CONTACTED,
  LeadStage.FOLLOW_UP,
  LeadStage.INTERESTED,
  LeadStage.NOT_INTERESTED,
  LeadStage.NO_RESPONSE,
  LeadStage.CONVERTED,
  LeadStage.CLOSED,
];

const funnelStages = [
  LeadStage.NEW,
  LeadStage.CONTACTED,
  LeadStage.INTERESTED,
  LeadStage.CONVERTED,
];

const taskStatuses = [
  TaskStatus.PENDING,
  TaskStatus.IN_PROGRESS,
  TaskStatus.COMPLETED,
  TaskStatus.CANCELLED,
];

const inactiveLeadStages: LeadStage[] = [
  LeadStage.CONVERTED,
  LeadStage.CLOSED,
  LeadStage.NOT_INTERESTED,
];

const followUpRequiredStages: LeadStage[] = [
  LeadStage.CONTACTED,
  LeadStage.FOLLOW_UP,
  LeadStage.INTERESTED,
];

const closedTaskStatuses: TaskStatus[] = [
  TaskStatus.COMPLETED,
  TaskStatus.CANCELLED,
];

const urgentTaskPriorities: TaskPriority[] = [
  TaskPriority.URGENT,
  TaskPriority.HIGH,
];

const sourceLabels: Record<LeadSource, string> = {
  WEBSITE: "Website",
  INSTAGRAM: "Instagram",
};

const stageTones: Record<LeadStage, string> = {
  NEW: "border-sky-300/20 bg-sky-300/10 text-sky-100",
  CONTACTED: "border-indigo-300/20 bg-indigo-300/10 text-indigo-100",
  FOLLOW_UP: "border-amber-300/20 bg-amber-300/10 text-amber-100",
  INTERESTED: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
  NOT_INTERESTED: "border-rose-300/20 bg-rose-300/10 text-rose-100",
  NO_RESPONSE: "border-zinc-300/20 bg-zinc-300/10 text-zinc-200",
  CONVERTED: "border-teal-300/20 bg-teal-300/10 text-teal-100",
  CLOSED: "border-purple-300/20 bg-purple-300/10 text-purple-100",
};

const sourceTones: Record<LeadSource, string> = {
  WEBSITE: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
  INSTAGRAM: "border-fuchsia-300/20 bg-fuchsia-300/10 text-fuchsia-100",
};

function label(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function percent(value: number, total: number) {
  if (!total) {
    return "0%";
  }

  return `${Math.round((value / total) * 100)}%`;
}

function barWidth(value: number, max: number) {
  if (!max) {
    return "0%";
  }

  return `${Math.max(4, Math.round((value / max) * 100))}%`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function formatDateTime(value: Date | null | undefined) {
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

function normalizePhone(value: string | null) {
  if (!value) {
    return "";
  }

  return value.replace(/\D/g, "");
}

function isActiveLead(lead: LeadAnalyticsRow) {
  return !inactiveLeadStages.includes(lead.stage);
}

function isOpenTask(task: TaskAnalyticsRow) {
  return !closedTaskStatuses.includes(task.status);
}

function buildDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function getAnalyticsData() {
  try {
    const [websiteLeads, instagramLeads, tasks, users, integrations] =
      await Promise.all([
        db.websiteLead.findMany({
          take: ANALYTICS_ROW_LIMIT,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            stage: true,
            assignedToId: true,
            phone: true,
            city: true,
            notes: true,
            lastContactedAt: true,
            nextFollowUpAt: true,
            createdAt: true,
            timestamp: true,
          },
        }),
        db.instagramLead.findMany({
          take: ANALYTICS_ROW_LIMIT,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            stage: true,
            assignedToId: true,
            phone: true,
            city: true,
            notes: true,
            lastContactedAt: true,
            nextFollowUpAt: true,
            createdAt: true,
            timestamp: true,
          },
        }),
        db.task.findMany({
          take: ANALYTICS_ROW_LIMIT,
          orderBy: { createdAt: "desc" },
          select: {
            status: true,
            priority: true,
            assignedToId: true,
            dueDate: true,
          },
        }),
        db.user.findMany({
          orderBy: { username: "asc" },
          select: {
            id: true,
            username: true,
            email: true,
            department: true,
            role: true,
          },
        }),
        db.leadIntegration.findMany(),
      ]);

    return {
      data: {
        leads: [
          ...websiteLeads.map((lead) => ({
            ...lead,
            source: LeadSource.WEBSITE,
          })),
          ...instagramLeads.map((lead) => ({
            ...lead,
            source: LeadSource.INSTAGRAM,
          })),
        ],
        tasks,
        users,
        integrations,
      },
      error: null,
    };
  } catch {
    return {
      data: {
        leads: [] as LeadAnalyticsRow[],
        tasks: [] as TaskAnalyticsRow[],
        users: [] as Array<{
          id: string;
          username: string;
          email: string;
          department: string;
          role: string;
        }>,
        integrations: [] as Array<{
          source: LeadSource;
          status: SheetConnectionStatus;
          lastSyncedAt: Date | null;
          lastTestedAt: Date | null;
          importedCount: number;
          failedCount: number;
          lastError: string | null;
        }>,
      },
      error: "Database is unreachable. Analytics numbers are temporarily unavailable.",
    };
  }
}

export default async function AdminAnalyticsPage() {
  const { data, error } = await getAnalyticsData();
  const leads: LeadAnalyticsRow[] = data.leads;
  const tasks: TaskAnalyticsRow[] = data.tasks;
  const { users, integrations } = data;
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const staleCutoff = new Date(now);
  staleCutoff.setHours(staleCutoff.getHours() - 48);

  const totalLeads = leads.length;
  const convertedLeads = leads.filter(
    (lead) => lead.stage === LeadStage.CONVERTED,
  ).length;
  const conversionRate = percent(convertedLeads, totalLeads);
  const unassignedLeads = leads.filter(
    (lead) => isActiveLead(lead) && !lead.assignedToId,
  ).length;
  const overdueFollowUps = leads.filter(
    (lead) =>
      isActiveLead(lead) &&
      lead.nextFollowUpAt !== null &&
      lead.nextFollowUpAt < now,
  ).length;
  const syncFailures = integrations.reduce(
    (total, integration) => total + integration.failedCount,
    0,
  );

  const stageCounts = leadStages.map((stage) => ({
    stage,
    count: leads.filter((lead) => lead.stage === stage).length,
  }));
  const maxStageCount = Math.max(...stageCounts.map((item) => item.count), 0);

  const sourceStats = [LeadSource.WEBSITE, LeadSource.INSTAGRAM].map(
    (source) => {
      const sourceLeads = leads.filter((lead) => lead.source === source);
      const sourceConverted = sourceLeads.filter(
        (lead) => lead.stage === LeadStage.CONVERTED,
      ).length;
      const sourceFollowUps = sourceLeads.filter(
        (lead) => lead.stage === LeadStage.FOLLOW_UP,
      ).length;
      const sourceNoResponse = sourceLeads.filter(
        (lead) => lead.stage === LeadStage.NO_RESPONSE,
      ).length;

      return {
        source,
        total: sourceLeads.length,
        converted: sourceConverted,
        conversionRate: percent(sourceConverted, sourceLeads.length),
        followUps: sourceFollowUps,
        noResponse: sourceNoResponse,
      };
    },
  );
  const maxSourceTotal = Math.max(...sourceStats.map((item) => item.total), 0);

  const openTaskCountsByUser = tasks.reduce<Record<string, number>>(
    (acc, task) => {
      if (isOpenTask(task)) {
        acc[task.assignedToId] = (acc[task.assignedToId] || 0) + 1;
      }

      return acc;
    },
    {},
  );
  const agentRows = users
    .map((user) => {
      const assignedLeads = leads.filter((lead) => lead.assignedToId === user.id);
      const contacted = assignedLeads.filter(
        (lead) => lead.lastContactedAt || lead.stage !== LeadStage.NEW,
      ).length;
      const converted = assignedLeads.filter(
        (lead) => lead.stage === LeadStage.CONVERTED,
      ).length;
      const overdue = assignedLeads.filter(
        (lead) =>
          isActiveLead(lead) &&
          lead.nextFollowUpAt !== null &&
          lead.nextFollowUpAt < now,
      ).length;

      return {
        id: user.id,
        username: user.username,
        department: user.department,
        assigned: assignedLeads.length,
        contacted,
        converted,
        conversionRate: percent(converted, assignedLeads.length),
        overdue,
        openTasks: openTaskCountsByUser[user.id] || 0,
      };
    })
    .filter((agent) => agent.assigned > 0 || agent.openTasks > 0)
    .sort((a, b) => b.converted - a.converted || b.assigned - a.assigned);

  const dueToday = leads.filter(
    (lead) =>
      isActiveLead(lead) &&
      lead.nextFollowUpAt !== null &&
      lead.nextFollowUpAt >= startOfToday &&
      lead.nextFollowUpAt < startOfTomorrow,
  ).length;
  const missingFollowUpDate = leads.filter(
    (lead) =>
      followUpRequiredStages.includes(lead.stage) && !lead.nextFollowUpAt,
  ).length;
  const untouchedFor48Hours = leads.filter(
    (lead) =>
      isActiveLead(lead) &&
      !lead.lastContactedAt &&
      lead.createdAt < staleCutoff,
  ).length;

  const taskCounts = taskStatuses.map((status) => ({
    status,
    count: tasks.filter((task) => task.status === status).length,
  }));
  const overdueTasks = tasks.filter(
    (task) =>
      isOpenTask(task) && task.dueDate !== null && task.dueDate < startOfToday,
  ).length;
  const urgentOrHighTasks = tasks.filter(
    (task) =>
      isOpenTask(task) && urgentTaskPriorities.includes(task.priority),
  ).length;
  const openTasks = tasks.filter(isOpenTask).length;

  const duplicatePhoneMap = leads.reduce<Record<string, number>>((acc, lead) => {
    const phone = normalizePhone(lead.phone);
    if (phone.length >= 6) {
      acc[phone] = (acc[phone] || 0) + 1;
    }

    return acc;
  }, {});
  const duplicateNumbers = Object.values(duplicatePhoneMap).filter(
    (count) => count > 1,
  ).length;
  const duplicateLeadCount = Object.values(duplicatePhoneMap).reduce(
    (total, count) => total + (count > 1 ? count : 0),
    0,
  );
  const missingPhone = leads.filter((lead) => !normalizePhone(lead.phone)).length;
  const missingCity = leads.filter((lead) => !lead.city?.trim()).length;
  const contactedWithoutNotes = leads.filter(
    (lead) =>
      followUpRequiredStages.includes(lead.stage) && !lead.notes?.trim(),
  ).length;

  const trendStart = new Date(startOfToday);
  trendStart.setDate(trendStart.getDate() - 11);
  const trendDays = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(trendStart);
    date.setDate(trendStart.getDate() + index);
    const key = buildDayKey(date);
    const count = leads.filter(
      (lead) =>
        lead.createdAt >= date &&
        lead.createdAt <
          new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
    ).length;

    return {
      key,
      label: date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      }),
      count,
    };
  });
  const maxTrendCount = Math.max(...trendDays.map((day) => day.count), 0);

  const kpis = [
    {
      label: "Total leads",
      value: formatNumber(totalLeads),
      detail: `${formatNumber(convertedLeads)} converted`,
    },
    {
      label: "Conversion rate",
      value: conversionRate,
      detail: "Converted / all leads",
    },
    {
      label: "Overdue follow-ups",
      value: formatNumber(overdueFollowUps),
      detail: "Needs action now",
    },
    {
      label: "Unassigned leads",
      value: formatNumber(unassignedLeads),
      detail: "Active leads without owner",
    },
    {
      label: "Open tasks",
      value: formatNumber(openTasks),
      detail: `${formatNumber(overdueTasks)} overdue`,
    },
    {
      label: "Sync failures",
      value: formatNumber(syncFailures),
      detail: "Google Sheet imports",
    },
  ];

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Analytics
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Real CRM analytics from leads, assignments, follow-ups, tasks, agent
            activity, and Google Sheet sync status.
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-slate-400">
          Updated from live database records
        </div>
      </section>

      {error ? (
        <div className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {kpis.map((metric) => (
          <div
            className="rounded-lg border border-white/10 bg-white/[0.03] p-5"
            key={metric.label}
          >
            <p className="text-sm text-slate-400">{metric.label}</p>
            <p className="mt-3 text-3xl font-bold text-white">
              {metric.value}
            </p>
            <p className="mt-2 text-xs text-cyan-200">{metric.detail}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
              1. Lead Pipeline Overview
            </p>
            <h2 className="mt-2 text-lg font-semibold">Stage distribution</h2>
          </div>
          <div className="mt-5 space-y-3">
            {stageCounts.map((item) => (
              <div key={item.stage}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span
                    className={`rounded-lg border px-2 py-1 text-xs font-semibold ${stageTones[item.stage]}`}
                  >
                    {label(item.stage)}
                  </span>
                  <span className="text-sm font-semibold text-slate-200">
                    {formatNumber(item.count)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-black/40">
                  <div
                    className="h-2 rounded-full bg-cyan-300"
                    style={{ width: barWidth(item.count, maxStageCount) }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
              2. Conversion Funnel
            </p>
            <h2 className="mt-2 text-lg font-semibold">
              New to converted movement
            </h2>
          </div>
          <div className="mt-6 space-y-5">
            {funnelStages.map((stage, index) => {
              const count = leads.filter((lead) => lead.stage === stage).length;

              return (
                <div key={stage}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-200">
                      {index + 1}. {label(stage)}
                    </span>
                    <span className="text-slate-400">
                      {formatNumber(count)} - {percent(count, totalLeads)}
                    </span>
                  </div>
                  <div className="h-10 overflow-hidden rounded-lg border border-white/10 bg-black/30">
                    <div
                      className="grid h-full place-items-center bg-emerald-300/80 text-xs font-bold text-slate-950"
                      style={{ width: barWidth(count, totalLeads) }}
                    >
                      {count ? percent(count, totalLeads) : ""}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
              3. Source Performance
            </p>
            <h2 className="mt-2 text-lg font-semibold">
              Website vs Instagram
            </h2>
          </div>
          <div className="mt-5 grid gap-4">
            {sourceStats.map((item) => (
              <div
                className={`rounded-lg border p-4 ${sourceTones[item.source]}`}
                key={item.source}
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-semibold">{sourceLabels[item.source]}</h3>
                  <span className="text-sm font-bold">
                    {formatNumber(item.total)} leads
                  </span>
                </div>
                <div className="mt-4 h-2 rounded-full bg-black/40">
                  <div
                    className="h-2 rounded-full bg-white/80"
                    style={{ width: barWidth(item.total, maxSourceTotal) }}
                  />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-black/25 p-3">
                    <p className="text-slate-400">Conversion</p>
                    <p className="mt-1 font-bold text-white">
                      {item.conversionRate}
                    </p>
                  </div>
                  <div className="rounded-lg bg-black/25 p-3">
                    <p className="text-slate-400">Follow-up</p>
                    <p className="mt-1 font-bold text-white">
                      {formatNumber(item.followUps)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-black/25 p-3">
                    <p className="text-slate-400">No response</p>
                    <p className="mt-1 font-bold text-white">
                      {formatNumber(item.noResponse)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
              4. Agent Performance
            </p>
            <h2 className="mt-2 text-lg font-semibold">
              Ownership and outcomes
            </h2>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr className="border-b border-white/10">
                  <th className="py-3 pr-4">Agent</th>
                  <th className="py-3 pr-4">Assigned</th>
                  <th className="py-3 pr-4">Contacted</th>
                  <th className="py-3 pr-4">Converted</th>
                  <th className="py-3 pr-4">Rate</th>
                  <th className="py-3 pr-4">Overdue</th>
                  <th className="py-3">Open tasks</th>
                </tr>
              </thead>
              <tbody>
                {agentRows.length ? (
                  agentRows.map((agent) => (
                    <tr className="border-b border-white/5" key={agent.id}>
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-white">
                          {agent.username}
                        </p>
                        <p className="text-xs text-slate-500">
                          {agent.department}
                        </p>
                      </td>
                      <td className="py-3 pr-4">{agent.assigned}</td>
                      <td className="py-3 pr-4">{agent.contacted}</td>
                      <td className="py-3 pr-4">{agent.converted}</td>
                      <td className="py-3 pr-4 text-cyan-200">
                        {agent.conversionRate}
                      </td>
                      <td className="py-3 pr-4 text-amber-100">
                        {agent.overdue}
                      </td>
                      <td className="py-3">{agent.openTasks}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-6 text-center text-slate-500" colSpan={7}>
                      No assigned leads or open tasks yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
              5. Follow-up Health
            </p>
            <h2 className="mt-2 text-lg font-semibold">Lead response hygiene</h2>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["Due today", dueToday, "Follow-ups scheduled for today"],
              ["Overdue", overdueFollowUps, "Follow-ups already late"],
              [
                "Missing date",
                missingFollowUpDate,
                "Contacted/interested leads without next date",
              ],
              [
                "Untouched 48h",
                untouchedFor48Hours,
                "Active leads with no contact after 48 hours",
              ],
            ].map(([title, value, detail]) => (
              <div
                className="rounded-lg border border-white/10 bg-black/20 p-4"
                key={String(title)}
              >
                <p className="text-sm text-slate-400">{title}</p>
                <p className="mt-3 text-3xl font-bold text-white">{value}</p>
                <p className="mt-2 text-xs text-slate-500">{detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
              6. Task Analytics
            </p>
            <h2 className="mt-2 text-lg font-semibold">Workload status</h2>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {taskCounts.map((item) => (
              <div
                className="rounded-lg border border-white/10 bg-black/20 p-4"
                key={item.status}
              >
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  {label(item.status)}
                </p>
                <p className="mt-3 text-2xl font-bold text-white">
                  {formatNumber(item.count)}
                </p>
              </div>
            ))}
            <div className="rounded-lg border border-rose-300/20 bg-rose-300/10 p-4">
              <p className="text-sm text-rose-100">Overdue tasks</p>
              <p className="mt-3 text-2xl font-bold text-white">
                {formatNumber(overdueTasks)}
              </p>
            </div>
            <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-4">
              <p className="text-sm text-amber-100">High or urgent</p>
              <p className="mt-3 text-2xl font-bold text-white">
                {formatNumber(urgentOrHighTasks)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
              7. Google Sheet Sync Health
            </p>
            <h2 className="mt-2 text-lg font-semibold">
              Integration reliability
            </h2>
          </div>
          <div className="mt-5 grid gap-3">
            {integrations.length ? (
              integrations.map((integration) => {
                const isConnected =
                  integration.status === SheetConnectionStatus.CONNECTED;
                const isError =
                  integration.status === SheetConnectionStatus.ERROR;

                return (
                  <div
                    className="rounded-lg border border-white/10 bg-black/20 p-4"
                    key={integration.source}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="font-semibold text-white">
                        {sourceLabels[integration.source]}
                      </h3>
                      <span
                        className={`rounded-lg border px-2 py-1 text-xs font-bold ${
                          isConnected
                            ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
                            : isError
                              ? "border-rose-300/20 bg-rose-300/10 text-rose-100"
                              : "border-amber-300/20 bg-amber-300/10 text-amber-100"
                        }`}
                      >
                        {label(integration.status)}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                      <div>
                        <p className="text-slate-500">Imported</p>
                        <p className="font-bold text-emerald-100">
                          {formatNumber(integration.importedCount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Failed</p>
                        <p className="font-bold text-rose-100">
                          {formatNumber(integration.failedCount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Last sync</p>
                        <p className="font-mono text-xs text-slate-300">
                          {formatDateTime(integration.lastSyncedAt)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Last test</p>
                        <p className="font-mono text-xs text-slate-300">
                          {formatDateTime(integration.lastTestedAt)}
                        </p>
                      </div>
                    </div>
                    {integration.lastError ? (
                      <p className="mt-3 rounded-lg border border-rose-300/20 bg-rose-300/10 p-3 text-xs text-rose-100">
                        {integration.lastError}
                      </p>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">
                No Google Sheet integrations configured.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
              8. Data Quality Panel
            </p>
            <h2 className="mt-2 text-lg font-semibold">Fix dirty CRM data</h2>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["Missing phone", missingPhone, "Cannot call or WhatsApp"],
              ["Missing city", missingCity, "Weak routing and filtering"],
              ["Unassigned active", unassignedLeads, "No owner responsible"],
              [
                "Duplicate phones",
                duplicateLeadCount,
                `${duplicateNumbers} repeated phone numbers`,
              ],
              [
                "No notes after contact",
                contactedWithoutNotes,
                "Poor handoff context",
              ],
            ].map(([title, value, detail]) => (
              <div
                className="rounded-lg border border-white/10 bg-black/20 p-4"
                key={String(title)}
              >
                <p className="text-sm text-slate-400">{title}</p>
                <p className="mt-3 text-2xl font-bold text-white">{value}</p>
                <p className="mt-2 text-xs text-slate-500">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
            Lead Capture Trend
          </p>
          <h2 className="mt-2 text-lg font-semibold">Last 12 days</h2>
        </div>
        <div className="mt-8 flex h-64 items-end gap-3">
          {trendDays.map((day) => (
            <div className="flex flex-1 flex-col items-center gap-3" key={day.key}>
              <div
                className="grid w-full place-items-end rounded-t-lg bg-cyan-300/80 px-1 pb-2 text-[10px] font-bold text-slate-950"
                style={{ height: barWidth(day.count, maxTrendCount) }}
              >
                {day.count || ""}
              </div>
              <span className="text-center text-[10px] text-slate-500">
                {day.label}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
