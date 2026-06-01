import { db } from "@/app/lib/db";
import { CallStatusBadge, EmptyState, PageHeader, formatDateTime } from "../call-ui";

export default async function AdminMissedCallsPage() {
  const calls = await db.callSession.findMany({
    where: { status: "MISSED" },
    include: {
      companyPhone: { select: { label: true, phoneNumber: true } },
      lead: { select: { displayName: true, phone: true, status: true, nextFollowUpAt: true } },
      assignedTo: { select: { username: true } },
    },
    orderBy: { firstRingAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        description="Calls that ended without being answered. These should be treated as callback tasks."
        title="Missed Calls"
      />

      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
        <div className="divide-y divide-white/10">
          {calls.map((call) => (
            <div className="grid gap-4 py-4 text-sm xl:grid-cols-[1fr_1fr_auto_1fr]" key={call.id}>
              <div>
                <p className="font-semibold text-white">{call.lead.displayName}</p>
                <p className="mt-1 text-slate-400">{call.lead.phone}</p>
              </div>
              <div>
                <p className="font-semibold text-white">{call.companyPhone.label}</p>
                <p className="mt-1 text-slate-400">{call.companyPhone.phoneNumber}</p>
              </div>
              <CallStatusBadge status={call.status} />
              <div className="text-slate-500 xl:text-right">
                <p>Missed {formatDateTime(call.firstRingAt)}</p>
                <p className="mt-1">Assigned: {call.assignedTo?.username || "Unassigned"}</p>
                <p className="mt-1">Follow-up: {formatDateTime(call.lead.nextFollowUpAt)}</p>
              </div>
            </div>
          ))}
          {!calls.length ? <EmptyState>No missed calls in queue.</EmptyState> : null}
        </div>
      </div>
    </div>
  );
}
