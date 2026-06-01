import { db } from "@/app/lib/db";
import { CallStatusBadge, EmptyState, PageHeader, formatDateTime } from "../call-ui";

export default async function AdminLiveCallsPage() {
  const calls = await db.callSession.findMany({
    where: {
      status: { in: ["RINGING", "ANSWERED"] },
      endedAt: null,
    },
    include: {
      companyPhone: { select: { label: true, phoneNumber: true } },
      lead: { select: { displayName: true, phone: true, status: true } },
      assignedTo: { select: { username: true } },
    },
    orderBy: { firstRingAt: "desc" },
  });

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        description="Ringing and answered calls that have not ended yet."
        title="Live Calls"
      />

      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
        <div className="divide-y divide-white/10">
          {calls.map((call) => (
            <div className="grid gap-4 py-4 text-sm lg:grid-cols-[1fr_1fr_auto_auto]" key={call.id}>
              <div>
                <p className="font-semibold text-white">{call.lead.displayName}</p>
                <p className="mt-1 text-slate-400">{call.lead.phone}</p>
              </div>
              <div>
                <p className="font-semibold text-white">{call.companyPhone.label}</p>
                <p className="mt-1 text-slate-400">{call.companyPhone.phoneNumber}</p>
              </div>
              <CallStatusBadge status={call.status} />
              <div className="text-slate-500 lg:text-right">
                <p>{formatDateTime(call.firstRingAt)}</p>
                <p className="mt-1">{call.assignedTo?.username || "Unassigned"}</p>
              </div>
            </div>
          ))}
          {!calls.length ? <EmptyState>No live calls right now.</EmptyState> : null}
        </div>
      </div>
    </div>
  );
}
