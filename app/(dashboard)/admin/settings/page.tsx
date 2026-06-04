import { db } from "@/app/lib/db";
import { LeadSource, SheetConnectionStatus } from "@/app/lib/prisma-enums";
import {
  saveAndDiagnoseLeadIntegrationAction,
} from "@/app/lib/lead-integration-actions";

type AdminSettingsPageProps = {
  searchParams: Promise<{
    error?: string;
    analyzed?: string;
    result?: string;
    saved?: string;
    synced?: string;
    tested?: string;
  }>;
};

const leadSources = [
  {
    title: "Website Leads",
    source: LeadSource.WEBSITE,
    tone: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
    tab: "Leads",
    badge: "WEBSITE",
  },
  {
    title: "Call Leads",
    source: LeadSource.INSTAGRAM,
    tone: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    tab: "calls",
    badge: "CALL",
  },
];

function statusLabel(status: SheetConnectionStatus) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function statusClass(status: SheetConnectionStatus) {
  const classes: Record<SheetConnectionStatus, string> = {
    NOT_CONNECTED: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    CONNECTED: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
    ERROR: "border-rose-300/20 bg-rose-300/10 text-rose-100",
  };

  return classes[status];
}

function sourceNoticeLabel(source: string) {
  if (source === LeadSource.INSTAGRAM) {
    return "Call Leads";
  }

  if (source === LeadSource.WEBSITE) {
    return "Website Leads";
  }

  return source;
}

async function getLeadIntegrations() {
  try {
    const integrations = await db.leadIntegration.findMany();
    return { integrations, error: null };
  } catch {
    return {
      integrations: [],
      error: "Database is unreachable. Sheet settings cannot be loaded.",
    };
  }
}

export default async function AdminSettingsPage({
  searchParams,
}: AdminSettingsPageProps) {
  const params = await searchParams;
  const { integrations, error } = await getLeadIntegrations();
  const notice = params.saved
    ? `${sourceNoticeLabel(params.saved)} sheet settings saved.`
    : params.analyzed
      ? `${sourceNoticeLabel(params.analyzed)} sheet settings analyzed.`
      : params.tested
        ? `${sourceNoticeLabel(params.tested)} sheet test ${params.result === "ok" ? "passed" : "failed"
        }.`
        : params.synced
          ? `${sourceNoticeLabel(params.synced)} sheet sync ${params.result === "ok" ? "completed" : "failed"
          }.`
          : null;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          Settings
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Platform controls, security posture, and lead sheet integrations.
        </p>
      </section>

      {params.error || error ? (
        <div className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          {params.error ?? error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {notice}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold">Security</h2>
          <div className="mt-5 space-y-4">
            {[
              ["Session duration", "7 days"],
              ["Admin access", "Role protected"],
              ["Password hashing", "scrypt enabled"],
            ].map(([label, value]) => (
              <div className="flex items-center justify-between gap-4" key={label}>
                <span className="text-sm text-slate-400">{label}</span>
                <span className="rounded-lg bg-white/5 px-3 py-1 text-sm text-slate-200">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold">Workspace</h2>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm text-slate-400">
                Workspace name
              </span>
              <input
                className="h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-slate-300 outline-none"
                readOnly
                value="AutomationCRM"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-400">
                Default region
              </span>
              <input
                className="h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-slate-300 outline-none"
                readOnly
                value="India"
              />
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
        <div>
          <h2 className="text-lg font-semibold">Lead source sheets</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
            Configure Google Apps Script connections for Website Leads and
            Call Leads. These values are now stored in the database.
          </p>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {leadSources.map((source) => {
            const integration = integrations.find(
              (item) => item.source === source.source,
            );
            const status =
              integration?.status ?? SheetConnectionStatus.NOT_CONNECTED;

            return (
              <form
                action={saveAndDiagnoseLeadIntegrationAction}
                className="rounded-lg border border-white/10 bg-black/20 p-5"
                key={source.source}
              >
                <input name="source" type="hidden" value={source.source} />

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">{source.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      Apps Script sheet connection settings.
                    </p>
                  </div>
                  <span
                    className={`rounded-lg border px-2 py-1 text-xs font-semibold ${source.tone}`}
                  >
                    {source.badge}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-lg border px-2 py-1 text-xs font-semibold ${statusClass(status)}`}
                  >
                    {statusLabel(status)}
                  </span>
                  {integration?.lastTestedAt ? (
                    <span className="text-xs text-slate-500">
                      Tested {integration.lastTestedAt.toLocaleString("en-IN")}
                    </span>
                  ) : null}
                  {integration?.lastSyncedAt ? (
                    <span className="text-xs text-slate-500">
                      Synced {integration.lastSyncedAt.toLocaleString("en-IN")}
                    </span>
                  ) : null}
                </div>

                <div className="mt-5 grid gap-4">
                  <label className="block">
                    <span className="mb-2 block text-sm text-slate-400">
                      Apps Script Web App URL
                    </span>
                    <input
                      className="h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-slate-300 outline-none focus:border-cyan-300"
                      defaultValue={integration?.appScriptUrl ?? ""}
                      name="appScriptUrl"
                      placeholder="https://script.google.com/macros/s/.../exec"
                      type="url"
                    />
                  </label>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="block">
                      <div className="flex items-center justify-between mb-2">
                        <span className="block text-sm text-slate-400">
                          Google Sheet ID
                        </span>
                        {integration?.spreadsheetId && (
                          <a
                            href={`https://docs.google.com/spreadsheets/d/${integration.spreadsheetId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-semibold text-cyan-300 hover:text-cyan-200 transition hover:underline flex items-center gap-1"
                          >
                            <span>Open Sheet</span>
                          </a>
                        )}
                      </div>
                      <input
                        className="h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-slate-300 outline-none focus:border-cyan-300"
                        defaultValue={integration?.spreadsheetId ?? ""}
                        name="spreadsheetId"
                        placeholder="1AbC..."
                      />
                    </div>
                    <label className="block">
                      <span className="mb-2 block text-sm text-slate-400">
                        Sheet tab name
                      </span>
                      <input
                        className="h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-slate-300 outline-none focus:border-cyan-300"
                        defaultValue={integration?.sheetName ?? source.tab}
                        name="sheetName"
                        placeholder={source.tab}
                      />
                    </label>
                  </div>                  <label className="block">
                    <span className="mb-1 block text-sm text-slate-400">
                      Shared secret token
                    </span>
                    <span className="mb-2 block text-[11px] text-slate-500">
                      Must match the <code className="rounded bg-black/40 px-1 text-amber-300">API_KEY</code> value in your Apps Script, Project Settings, Script Properties
                    </span>
                    <input
                      className="h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-slate-300 outline-none focus:border-cyan-300"
                      defaultValue={integration?.secretToken ?? ""}
                      name="secretToken"
                      placeholder="Paste the same value as API_KEY in Script Properties"
                      type="password"
                    />
                  </label>

                  {status === SheetConnectionStatus.ERROR && integration?.lastError ? (
                    <div className="rounded-lg border border-rose-300/20 bg-rose-300/10 p-4 text-sm leading-6 text-rose-100 space-y-2">
                      <div className="flex items-center gap-2 font-semibold text-rose-200">
                        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Connection Error Detected
                      </div>
                      <p className="text-xs text-rose-200/80 font-mono break-all">{integration.lastError}</p>
                      {integration.lastError.includes("404") ? (
                        <div className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100 space-y-1">
                          <p className="font-bold text-amber-200">How to fix HTTP 404:</p>
                          <p>1. Open your Apps Script, click <strong>Deploy, New deployment</strong></p>
                          <p>2. Set type = <strong>Web app</strong>, Execute as = <strong>Me</strong>, Access = <strong>Anyone</strong></p>
                          <p>3. Copy the new <code className="bg-black/30 px-1 rounded">/exec</code> URL and paste it above, then Save and Test</p>
                          <p className="text-amber-300">Never reuse old deployment URLs - always create a New Deployment after edits.</p>
                        </div>
                      ) : integration.lastError.includes("401") || integration.lastError.includes("Unauthorized") ? (
                        <div className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100 space-y-1">
                          <p className="font-bold text-amber-200">How to fix Unauthorized (401):</p>
                          <p>The shared secret token in CRM Settings does not match the <code className="bg-black/30 px-1 rounded">SECRET</code> variable or <code className="bg-black/30 px-1 rounded">API_KEY</code> property in your Apps Script code.</p>
                          <p>Make sure both match exactly - copy-paste to avoid typos. Surrounding single/double quotes are automatically cleaned in CRM.</p>
                        </div>
                      ) : integration.lastError.includes("Sheet tab") ? (
                        <div className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100 space-y-1">
                          <p className="font-bold text-amber-200">How to fix Sheet Tab Not Found:</p>
                          <p>The <strong>Sheet tab name</strong> field above must match the exact tab name at the bottom of your Google Sheet.</p>
                          <p>Check for uppercase/lowercase differences. Example: <code className="bg-black/30 px-1 rounded">Sheet1</code> vs <code className="bg-black/30 px-1 rounded">sheet1</code></p>
                        </div>
                      ) : integration.lastError.startsWith("Checks:") ? (
                        <div className="mt-2 rounded-lg border border-sky-400/20 bg-sky-400/10 p-3 text-xs text-sky-100">
                          <p className="font-bold text-sky-200 mb-1">Configuration Analysis:</p>
                          <pre className="whitespace-pre-wrap text-[11px]">{integration.lastError}</pre>
                        </div>
                      ) : (
                        <div className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100">
                          <p className="font-bold text-amber-200">General Troubleshooting:</p>
                          <p>1. Verify Apps Script URL ends in <code className="bg-black/30 px-1 rounded">/exec</code> (not /dev)</p>
                          <p>2. Make sure the Sheet ID and tab name are correct</p>
                          <p>3. Try re-deploying as a new Web App deployment</p>
                        </div>
                      )}
                    </div>
                  ) : null}

                  <div className="flex justify-start">
                    <button
                      className="h-10 w-full sm:w-auto rounded-lg bg-emerald-400 px-6 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 hover:shadow-[0_0_15px_rgba(52,211,153,0.4)] active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                      type="submit"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Diagnose & Sync Leads</span>
                    </button>
                  </div>
                </div>
              </form>
            );
          })}
        </div>      </section>
    </div>
  );
}
