"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/lib/auth-actions";

type AdminShellProps = {
  children: ReactNode;
  user: {
    username: string;
    email: string;
  };
};

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  children?: Array<{
    href: string;
    label: string;
  }>;
};

const navItems: NavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
        <path d="M4 13h7V4H4v9Zm9 7h7V4h-7v16ZM4 20h7v-5H4v5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
        <path d="M16 19c0-2.2-1.8-4-4-4H7c-2.2 0-4 1.8-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M21 19c0-1.9-1.3-3.4-3-3.9M16.5 4.3a3.5 3.5 0 0 1 0 6.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    icon: (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
        <path d="M4 19V5M4 19h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8 16v-5M12 16V8M16 16v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/admin/tasks",
    label: "Task Manager",
    icon: (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
        <path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="m4 6 1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/admin/leads",
    label: "Lead Center",
    icon: (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
        <path d="M4 5h16M4 12h10M4 19h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="m17 14 3 3-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    children: [
      { href: "/admin/leads", label: "All Leads" },
      { href: "/admin/leads/new", label: "New Leads" },
      { href: "/admin/leads/assigned", label: "Assigned Leads" },
      { href: "/admin/leads/follow-ups", label: "Follow-ups" },
    ],
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
        <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 0 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L4.2 7A2 2 0 0 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 .9-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 0 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export function AdminShell({ children, user }: AdminShellProps) {
  const pathname = usePathname();
  const initials = user.username.slice(0, 2).toUpperCase() || "AD";
  const leadCenter = navItems.find((item) => item.href === "/admin/leads");

  return (
    <main className="h-screen overflow-hidden bg-[#07090d] text-white">
      <div className="flex h-full min-h-0">
        <aside className="hidden h-full w-72 shrink-0 overflow-y-auto border-r border-white/10 bg-[#0a0d13] p-5 lg:flex lg:flex-col">
          <Link className="mb-8 flex items-center gap-3" href="/admin">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-cyan-300 text-sm font-black text-slate-950">
              MA
            </span>
            <span>
              <span className="block text-base font-bold">MAKT</span>
              <span className="text-xs text-slate-500">Admin console</span>
            </span>
          </Link>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(item.href));

              return (
                <div key={item.href}>
                  <Link
                    className={[
                      "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition",
                      isActive
                        ? "bg-cyan-300 text-slate-950"
                        : "text-slate-400 hover:bg-white/5 hover:text-white",
                    ].join(" ")}
                    href={item.href}
                  >
                    {item.icon}
                    <span className="flex-1">{item.label}</span>
                    {item.children ? (
                      <svg
                        aria-hidden="true"
                        className={[
                          "h-4 w-4 transition-transform",
                          isActive ? "rotate-90" : "",
                        ].join(" ")}
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="m9 18 6-6-6-6"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.8"
                        />
                      </svg>
                    ) : null}
                  </Link>

                  {item.children && isActive ? (
                    <div className="ml-5 mt-1 space-y-1 border-l border-white/10 pl-3">
                      {item.children.map((child) => {
                        const isChildActive = pathname === child.href;

                        return (
                          <Link
                            className={[
                              "block rounded-lg px-3 py-2 text-sm transition",
                              isChildActive
                                ? "bg-white/10 text-white"
                                : "text-slate-500 hover:bg-white/5 hover:text-slate-200",
                            ].join(" ")}
                            href={child.href}
                            key={child.href}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>

          <div className="mt-auto rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/10 text-sm font-bold">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user.username}</p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
              </div>
            </div>
            <form action={logoutAction} className="mt-4">
              <button
                className="h-10 w-full rounded-lg border border-white/10 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
                type="submit"
              >
                Logout
              </button>
            </form>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="z-20 shrink-0 border-b border-white/10 bg-[#07090d]/85 px-5 py-4 backdrop-blur md:px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                  Admin
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Control users, activity, and platform settings.
                </p>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/10 text-sm font-bold lg:hidden">
                {initials}
              </div>
            </div>

            <nav className="mt-4 flex gap-2 overflow-x-auto lg:hidden">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/admin" && pathname.startsWith(item.href));

                return (
                  <Link
                    className={[
                      "flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium",
                      isActive
                        ? "bg-cyan-300 text-slate-950"
                        : "border border-white/10 text-slate-300",
                    ].join(" ")}
                    href={item.href}
                    key={item.href}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {pathname.startsWith("/admin/leads") ? (
              <nav className="mt-3 flex gap-2 overflow-x-auto lg:hidden">
                {leadCenter?.children?.map((child) => (
                    <Link
                      className={[
                        "h-9 shrink-0 rounded-lg px-3 text-sm font-medium leading-9",
                        pathname === child.href
                          ? "bg-white/10 text-white"
                          : "border border-white/10 text-slate-400",
                      ].join(" ")}
                      href={child.href}
                      key={child.href}
                    >
                      {child.label}
                    </Link>
                  ))}
              </nav>
            ) : null}
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-6 md:px-8 md:py-8">{children}</div>
        </div>
      </div>
    </main>
  );
}
