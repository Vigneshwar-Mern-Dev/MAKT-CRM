import Link from "next/link";
import { requireRole } from "@/app/lib/session";
import { getUserWorkloadSummary } from "@/app/lib/user-workload";

export default async function UserDashboard() {
  const user = await requireRole("USER");
  const { data, error } = await getUserWorkloadSummary(user.id);
  const stats = [
    ["Total tasks", data.totalTasks, "All assigned work"],
    ["Pending", data.pendingTasks, "Waiting to start"],
    ["In progress", data.inProgressTasks, "Currently moving"],
    ["Completed", data.completedTasks, "Closed tasks"],
    ["Overdue", data.overdueTasks, "Needs attention"],
  ] as const;
  const focusItems = [
    ["Lead follow-ups", String(data.totalFollowups), "Next customer touches"],
    ["Campaign replies", "0", "New responses"],
    ["Customer tasks", String(data.totalTasks), "Assigned task load"],
  ] as const;

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-lg border border-[color:var(--user-accent-border)] bg-[radial-gradient(circle_at_top_left,var(--user-accent-glow),transparent_34%),linear-gradient(135deg,#15130d,#090908_72%)] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.28)] md:p-8">
        <div className="flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--user-accent-border)] bg-[var(--user-accent-muted)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--user-accent-text)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--user-accent)]" />
              My Dashboard
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-5xl">
              Welcome back, {user.username}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300 md:text-base">
              Your workspace focuses on assigned work, progress, and quick
              follow-up visibility.
            </p>
          </div>
          <Link
            className="inline-flex h-11 w-fit items-center justify-center gap-2 rounded-lg bg-[var(--user-accent)] px-4 text-sm font-bold text-[var(--user-active-text)] transition hover:bg-[var(--user-accent-hover)]"
            href="/user/tasks"
          >
            View tasks
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
              <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </Link>
        </div>
      </section>

      {error ? (
        <div className="rounded-lg border border-[color:var(--user-accent-border)] bg-[var(--user-accent-muted)] px-4 py-3 text-sm text-[var(--user-accent-text)]">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {stats.map(([label, value, helper]) => (
          <div
            className="group rounded-lg border border-white/10 bg-[#10100f] p-5 transition hover:border-[color:var(--user-accent-border)] hover:bg-[#14130f]"
            key={label}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-zinc-400">{label}</p>
              <span className="h-2 w-2 rounded-full bg-[var(--user-accent)] opacity-0 transition group-hover:opacity-70" />
            </div>
            <p className="mt-4 text-3xl font-bold text-white">{value}</p>
            <p className="mt-2 text-xs text-zinc-500">{helper}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-lg border border-white/10 bg-[#0f0f0e] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Work focus</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Current activity mix across your assigned workflow.
              </p>
            </div>
            <span className="rounded-full border border-[color:var(--user-accent-border)] bg-[var(--user-accent-muted)] px-3 py-1 text-xs font-semibold text-[var(--user-accent-text)]">
              Active
            </span>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {focusItems.map(([label, value, helper]) => (
              <div
                className="rounded-lg border border-white/10 bg-black/20 p-4 transition hover:border-[color:var(--user-accent-border)]"
                key={label}
              >
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                  {label}
                </p>
                <p className="mt-3 text-2xl font-bold text-white">{value}</p>
                <p className="mt-1 text-xs text-zinc-500">{helper}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-[#0f0f0e] p-5">
          <h2 className="text-lg font-semibold text-white">Quick actions</h2>
          <div className="mt-5 grid gap-3">
            <Link
              className="flex items-center justify-between rounded-lg bg-[var(--user-accent)] px-4 py-3 text-sm font-bold text-[var(--user-active-text)] transition hover:bg-[var(--user-accent-hover)]"
              href="/user/tasks"
            >
              <span>Update assigned tasks</span>
              <span aria-hidden="true">-&gt;</span>
            </Link>
            <Link
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-[color:var(--user-accent-border)] hover:bg-white/[0.06]"
              href="/user/leads"
            >
              <span>Review lead queue</span>
              <span aria-hidden="true" className="text-[var(--user-accent-text)]">-&gt;</span>
            </Link>
            <Link
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-[color:var(--user-accent-border)] hover:bg-white/[0.06]"
              href="/user/leads/follow-ups"
            >
              <span>Check follow-ups</span>
              <span aria-hidden="true" className="text-[var(--user-accent-text)]">-&gt;</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
