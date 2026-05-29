import Link from "next/link";
import { loginAction } from "@/app/lib/auth-actions";
import { AuthSubmitButton } from "../components/auth-submit-button";
import { PasswordField } from "../components/password-field";

type LoginPageProps = {
  searchParams: Promise<{
    created?: string;
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { created, error } = await searchParams;
  const wasCreated = created === "1";

  return (
    <main className="min-h-screen bg-[#03090e] font-sans text-neutral-100 antialiased selection:bg-cyan-500 selection:text-black">
      <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
        
        {/* Left Side: Brand Showcase & Cyber Grid Mesh */}
        <section className="relative hidden lg:flex flex-col justify-between overflow-hidden border-r border-white/[0.04] p-16">
          {/* Animated Glow Elements */}
          <div className="absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full bg-cyan-500/10 blur-[130px]" />
          <div className="absolute bottom-[-10%] right-[10%] h-[500px] w-[500px] rounded-full bg-rose-500/5 blur-[120px]" />
          
          {/* Subtle Grid Backdrop Layer */}
          <div 
            className="absolute inset-0 opacity-[0.25] bg-[linear-gradient(to_right,#0e222b_1px,transparent_1px),linear-gradient(to_bottom,#0e222b_1px,transparent_1px)] bg-[size:40px_40px]" 
            style={{ maskImage: 'radial-gradient(ellipse at center, black 60%, transparent 100%)' }}
          />

      <Link href="/" className="relative z-10 flex items-center gap-2">
  <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />

  <span className="bg-gradient-to-r from-neutral-200 to-neutral-400 bg-clip-text text-xs font-black uppercase tracking-[0.3em] text-transparent">
    MAKT
  </span>
</Link>

          {/* Main Visual Statement */}
          <div className="relative z-10 max-w-xl my-auto">
            <h1 className="text-5xl font-black tracking-tight leading-[1.1] text-white xl:text-6xl">
              Command your <br />
              <span className="bg-gradient-to-r from-cyan-400 via-teal-200 to-white bg-clip-text text-transparent">
                workflows & clients.
              </span>
            </h1>
            <p className="mt-6 text-base text-neutral-400 leading-relaxed font-light">
              A unified control layer engineered to map customer footprints, coordinate omni-channel campaigns, and secure automated pipelines instantly.
            </p>

            {/* Unique Node Feature List */}
            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {[
                { title: "Leads Node", label: "Active Tracking", glow: "bg-cyan-500" },
                { title: "Campaigns", label: "Automated Live", glow: "bg-emerald-500" },
                { title: "Analytics", label: "Real-time Sync", glow: "bg-purple-500" },
              ].map((node, i) => (
                <div key={i} className="group relative rounded-xl border border-white/[0.05] bg-white/[0.02] p-5 backdrop-blur-md transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${node.glow}`} />
                    <span className="text-xs font-bold text-neutral-200 tracking-wide">{node.title}</span>
                  </div>
                  <p className="mt-2 text-[11px] text-neutral-500 tracking-wider uppercase font-mono">{node.label}</p>
                </div>
              ))}
            </div>
          </div>

        
         
        </section>

        {/* Right Side: Auth Panel */}
        <section className="relative flex items-center justify-center px-6 py-12 sm:px-12 lg:px-16 bg-[#040b10]">
          
          <div className="absolute inset-0 block lg:hidden opacity-30 bg-[radial-gradient(circle_at_center,rgba(20,184,166,0.08),transparent_70%)]" />

          <div className="relative w-full max-w-md">
            
            {/* Context Notice / Welcome Text */}
            <div className="mb-8">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900/50 px-3 py-1 text-xs font-medium text-neutral-400">
                Welcome Back
              </div>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white">
                Sign In
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                To request credentials or gain platform access, please contact your CRM administrator.
              </p>
            </div>

            {/* System Error Message Banner */}
            {error ? (
              <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300 animate-in fade-in slide-in-from-top-1 duration-200">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                <p>{error}</p>
              </div>
            ) : null}

            {/* Form Section */}
            <form action={loginAction} className="space-y-5">
              <div>
                <label
                  className="mb-2 block text-xs font-semibold tracking-wider uppercase text-neutral-400"
                  htmlFor="identifier"
                >
                  Username or Email
                </label>
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  placeholder="name@example.com"
                  autoComplete="username"
                  required
                  className="h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-sm text-white outline-none transition-all duration-200 placeholder:text-neutral-600 focus:border-cyan-500/50 focus:bg-white/[0.06] focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold tracking-wider uppercase text-neutral-400">
                    Password
                  </label>
                </div>
                {/* NOTE: Ensure that your custom <PasswordField /> component uses 
                  text-white, transparent background (`bg-white/[0.03]`), and appropriate borders 
                  to match the Username input above instead of rendering a default white input.
                */}
                <PasswordField autoComplete="current-password" />
              </div>

              <div className="pt-2">
                <AuthSubmitButton idleText="Sign In to Dashboard" pendingText="Signing in..." />
              </div>
            </form>

            {/* Account Creation Success Banner */}
            {wasCreated ? (
              <div className="mt-6 flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-300 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0 animate-ping" />
                <p>Account created successfully. Please sign in above.</p>
              </div>
            ) : null}

          </div>
        </section>

      </div>
    </main>
  );
}