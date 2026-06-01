import { db } from "@/app/lib/db";
import { EmptyState, PageHeader, formatDateTime } from "../call-ui";

export default async function AdminCompanyPhonesPage() {
  const phones = await db.companyPhone.findMany({
    include: {
      _count: { select: { events: true, sessions: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        description="Registered Android phones allowed to send call events into the CRM."
        title="Company Phones"
      />

      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
        <div className="divide-y divide-white/10">
          {phones.map((phone) => (
            <div className="grid gap-4 py-4 text-sm xl:grid-cols-[1fr_1fr_auto_auto]" key={phone.id}>
              <div>
                <p className="font-semibold text-white">{phone.label}</p>
                <p className="mt-1 text-slate-400">{phone.phoneNumber}</p>
              </div>
              <div>
                <p className="font-mono text-xs text-slate-300">{phone.deviceId}</p>
                <p className="mt-1 text-slate-500">Last seen {formatDateTime(phone.lastSeenAt)}</p>
              </div>
              <span className={[
                "inline-flex h-7 items-center rounded border px-2 text-xs font-bold",
                phone.isActive
                  ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
                  : "border-rose-300/20 bg-rose-300/10 text-rose-100",
              ].join(" ")}>
                {phone.isActive ? "ACTIVE" : "INACTIVE"}
              </span>
              <div className="text-slate-500 xl:text-right">
                <p>{phone._count.sessions} sessions</p>
                <p className="mt-1">{phone._count.events} events</p>
              </div>
            </div>
          ))}
          {!phones.length ? <EmptyState>No company phones registered yet.</EmptyState> : null}
        </div>
      </div>
    </div>
  );
}
