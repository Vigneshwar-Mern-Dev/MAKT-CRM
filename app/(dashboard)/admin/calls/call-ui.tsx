import Link from "next/link";
import type { ReactNode } from "react";

export function formatDateTime(value: Date | null) {
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

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <section className="flex flex-col justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.03] p-5 md:flex-row md:items-center">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
          Call Center
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          {description}
        </p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </section>
  );
}

export function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-4xl font-bold text-cyan-100">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-slate-400">
      {children}
    </div>
  );
}

export function CallStatusBadge({ status }: { status: string }) {
  const labelMap: Record<string, string> = {
    RINGING: "Ringing",
    ANSWERED: "On Call",
    COMPLETED: "Call Ended",
    MISSED: "Missed",
  };
  const tone =
    status === "MISSED"
      ? "border-rose-300/20 bg-rose-300/10 text-rose-100"
      : status === "ANSWERED" || status === "COMPLETED"
        ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
        : "border-cyan-300/20 bg-cyan-300/10 text-cyan-100";

  return (
    <span className={`inline-flex h-7 items-center rounded border px-2 text-xs font-bold ${tone}`}>
      {labelMap[status] || status.replace("_", " ")}
    </span>
  );
}

export function TopLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      className="h-10 rounded-lg border border-white/10 px-4 text-sm font-semibold leading-10 text-slate-200 transition hover:bg-white/10"
      href={href}
    >
      {children}
    </Link>
  );
}
