import { db } from "@/app/lib/db";
import {
  CallCenterTabs,
  EmptyState,
  PageHeader,
  Panel,
  PanelTitle,
  StatCard,
  StatusBadge,
  formatDateTime,
} from "../call-ui";

function getPhoneHealth(phone: {
  isActive: boolean;
  lastSeenAt: Date | null;
  batteryPercent: number | null;
  pendingSyncCount: number | null;
}, currentTime: Date) {
  const isStale = !phone.lastSeenAt || currentTime.getTime() - phone.lastSeenAt.getTime() > 15 * 60 * 1000;
  if (!phone.isActive) return { label: "Inactive", tone: "rose" as const, detail: "Device registration is disabled" };
  if (isStale) return { label: "Offline", tone: "rose" as const, detail: "No heartbeat in the last 15 minutes" };
  if ((phone.pendingSyncCount || 0) > 0) return { label: "Sync pending", tone: "amber" as const, detail: `${phone.pendingSyncCount} events waiting to sync` };
  if ((phone.batteryPercent || 100) < 20) return { label: "Low battery", tone: "amber" as const, detail: "Charge this phone soon" };
  return { label: "Healthy", tone: "emerald" as const, detail: "Ready to receive call events" };
}

export default async function AdminCompanyPhonesPage() {
  const phones = await db.companyPhone.findMany({
    include: { _count: { select: { events: true, sessions: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const currentTime = new Date();
  const phoneRows = phones.map((phone) => ({ ...phone, health: getPhoneHealth(phone, currentTime) }));
  const healthyCount = phoneRows.filter((phone) => phone.health.label === "Healthy").length;
  const pendingCount = phoneRows.reduce((total, phone) => total + (phone.pendingSyncCount || 0), 0);

  return (
    <div className="space-y-5 pb-8">
      <PageHeader description="Monitor the Android phones feeding call events into CRM. Offline devices and sync backlogs should be fixed before they create blind spots." title="Company phones" />
      <CallCenterTabs />
      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard detail="Registered Android phones" label="Devices" value={phones.length} />
        <StatCard detail="Online without warnings" label="Healthy" tone="emerald" value={`${healthyCount}/${phones.length}`} />
        <StatCard detail="Events waiting for upload" label="Pending sync" tone={pendingCount ? "amber" : "cyan"} value={pendingCount} />
      </section>
      <Panel>
        <PanelTitle description="A phone is offline after 15 minutes without a heartbeat." title="Device health" />
        <div className="grid gap-3 p-4 xl:grid-cols-2">
          {phoneRows.map((phone) => (
            <article className="rounded-xl border border-white/10 bg-black/20 p-4" key={phone.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-white">{phone.label}</p>
                  <p className="mt-1 text-sm font-bold text-cyan-200">{phone.phoneNumber}</p>
                </div>
                <StatusBadge tone={phone.health.tone}>{phone.health.label}</StatusBadge>
              </div>
              <p className="mt-3 text-xs text-slate-400">{phone.health.detail}</p>
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-white/5 bg-white/[0.025] p-3 text-xs sm:grid-cols-3">
                <div><p className="text-slate-500">Last seen</p><p className="mt-1 font-bold text-slate-200">{formatDateTime(phone.lastSeenAt)}</p></div>
                <div><p className="text-slate-500">Battery</p><p className="mt-1 font-bold text-slate-200">{phone.batteryPercent ?? "N/A"}{phone.batteryPercent === null ? "" : "%"}</p></div>
                <div><p className="text-slate-500">Network</p><p className="mt-1 font-bold text-slate-200">{phone.networkType || "N/A"}</p></div>
                <div><p className="text-slate-500">Sessions</p><p className="mt-1 font-bold text-slate-200">{phone._count.sessions}</p></div>
                <div><p className="text-slate-500">Events</p><p className="mt-1 font-bold text-slate-200">{phone._count.events}</p></div>
                <div><p className="text-slate-500">Pending</p><p className="mt-1 font-bold text-slate-200">{phone.pendingSyncCount || 0}</p></div>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                <span>{phone.deviceModel || "Unknown model"}</span>
                <span>Android {phone.androidVersion || "N/A"}</span>
                <span>App {phone.appVersion || "N/A"}</span>
              </div>
              <p className="mt-2 truncate font-mono text-[10px] text-slate-600">{phone.deviceId}</p>
            </article>
          ))}
          {!phones.length ? <EmptyState>No company phones registered yet.</EmptyState> : null}
        </div>
      </Panel>
    </div>
  );
}
