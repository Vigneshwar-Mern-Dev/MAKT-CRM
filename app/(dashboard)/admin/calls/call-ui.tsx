import Link from "next/link";
import type { ReactNode } from "react";

export function formatDateTime(value: Date | string | null) {
  if (!value) return "Never";

  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}

export function formatDuration(seconds: number | null) {
  if (!seconds) return "No duration";

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
}

export function CallCenterTabs() {
  const links = [
    ["/admin/calls", "Overview"],
    ["/admin/calls/leads", "Leads"],
    ["/admin/calls/missed", "Callbacks"],
    ["/admin/calls/phones", "Phones"],
  ];

  return (
    <nav className="flex gap-2 overflow-x-auto pb-1">
      {links.map(([href, label]) => (
        <Link
          className="shrink-0 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs font-bold text-slate-300 transition hover:border-cyan-300/40 hover:bg-cyan-300/10 hover:text-cyan-100"
          href={href}
          key={href}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow = "Call operations",
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-cyan-300/15 bg-[linear-gradient(135deg,rgba(13,148,136,0.16),rgba(15,23,42,0.7)_48%,rgba(2,6,23,0.82))] p-5 shadow-xl shadow-black/10 md:p-7">
      <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-cyan-300/10 blur-3xl" />
      <div className="relative flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-200">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-4xl">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  detail,
  tone = "cyan",
}: {
  label: string;
  value: number | string;
  detail: string;
  tone?: "cyan" | "emerald" | "amber" | "rose";
}) {
  const colors = {
    cyan: "border-cyan-300/15 bg-cyan-300/[0.06] text-cyan-100",
    emerald: "border-emerald-300/15 bg-emerald-300/[0.06] text-emerald-100",
    amber: "border-amber-300/15 bg-amber-300/[0.06] text-amber-100",
    rose: "border-rose-300/15 bg-rose-300/[0.06] text-rose-100",
  };

  return (
    <div className={`rounded-2xl border p-5 ${colors[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-[0.14em] opacity-70">{label}</p>
      <p className="mt-3 text-4xl font-black tracking-tight">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-white/[0.035] ${className}`}>
      {children}
    </section>
  );
}

export function PanelTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center">
      <div>
        <h2 className="font-bold text-white">{title}</h2>
        {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="m-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-sm text-slate-400">
      {children}
    </div>
  );
}

export function StatusBadge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "cyan" | "emerald" | "amber" | "rose";
}) {
  const colors = {
    slate: "border-white/10 bg-white/5 text-slate-300",
    cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
    emerald: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
    amber: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    rose: "border-rose-300/20 bg-rose-300/10 text-rose-100",
  };

  return (
    <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${colors[tone]}`}>
      {children}
    </span>
  );
}

export function CallStatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    RINGING: "Ringing",
    ANSWERED: "On call",
    COMPLETED: "Completed",
    MISSED: "Missed",
  };
  const tone = status === "MISSED"
    ? "rose"
    : status === "ANSWERED"
      ? "emerald"
      : status === "COMPLETED"
        ? "slate"
        : "cyan";

  return <StatusBadge tone={tone}>{labels[status] || status.replaceAll("_", " ")}</StatusBadge>;
}

export function TopLink({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      className={primary
        ? "h-10 rounded-lg bg-cyan-300 px-4 text-sm font-bold leading-10 text-slate-950 transition hover:bg-cyan-200"
        : "h-10 rounded-lg border border-white/10 bg-black/20 px-4 text-sm font-bold leading-10 text-slate-200 transition hover:bg-white/10"}
      href={href}
    >
      {children}
    </Link>
  );
}
