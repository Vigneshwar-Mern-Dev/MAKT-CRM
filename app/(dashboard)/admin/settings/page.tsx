import { requireRole } from "@/app/lib/session";
import { db } from "@/app/lib/db";
import { ChangePasswordForm } from "./change-password-form";

export default async function AdminSettingsPage() {
  const currentUser = await requireRole("ADMIN");

  const [totalUsers, adminCount, agentCount] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { role: "ADMIN" } }),
    db.user.count({ where: { role: "USER" } }),
  ]);

  return (
    <div className="space-y-6 pb-8">
      <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
          Admin
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
          Settings
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Platform security, workspace info, and account management.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Security overview */}
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-white">Security</h2>
          <div className="mt-5 space-y-3">
            {[
              ["Session duration", "7 days (cookie-based)"],
              ["Admin access", "Role-protected routes"],
              ["Password hashing", "scrypt (Node.js built-in)"],
              ["Login rate limit", "5 attempts → 10 min lockout"],
              ["Auth method", "Username or email + password"],
            ].map(([key, value]) => (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-white/5 bg-black/30 px-4 py-3" key={key}>
                <span className="text-sm text-slate-400">{key}</span>
                <span className="rounded-lg bg-white/5 px-3 py-1 text-sm text-slate-200">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Workspace info */}
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-white">Workspace</h2>
          <div className="mt-5 space-y-3">
            {[
              ["Platform", "MAKT CRM"],
              ["Region", "India (Asia South)"],
              ["Database", "Neon PostgreSQL (serverless)"],
              ["Total accounts", String(totalUsers)],
              ["Admins", String(adminCount)],
              ["Agents", String(agentCount)],
            ].map(([key, value]) => (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-white/5 bg-black/30 px-4 py-3" key={key}>
                <span className="text-sm text-slate-400">{key}</span>
                <span className="text-sm font-semibold text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Current account */}
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold text-white">Your account</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-white/5 bg-black/30 px-4 py-3">
            <p className="text-xs text-slate-500">Username</p>
            <p className="mt-1 font-semibold text-white">{currentUser.username}</p>
          </div>
          <div className="rounded-lg border border-white/5 bg-black/30 px-4 py-3">
            <p className="text-xs text-slate-500">Email</p>
            <p className="mt-1 font-semibold text-white">{currentUser.email}</p>
          </div>
        </div>
        <p className="mt-4 text-sm font-semibold text-slate-300">
          To update username or email, use the{" "}
          <a className="text-cyan-300 underline hover:text-cyan-200" href="/admin/users">
            Users page
          </a>
          .
        </p>
      </div>

      {/* Change password */}
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold text-white">Change password</h2>
        <p className="mt-1 text-sm text-slate-400">
          Update your admin account password. Minimum 8 characters.
        </p>
        <ChangePasswordForm />
      </div>

      <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
        WhatsApp settings are managed separately on the{" "}
        <a className="font-semibold underline hover:text-amber-50" href="/admin/whatsapp/settings">
          WhatsApp settings page
        </a>
        .
      </div>
    </div>
  );
}
