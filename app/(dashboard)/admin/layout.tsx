import type { ReactNode } from "react";
import { requireRole } from "@/app/lib/session";
import { AdminShell } from "./components/admin-shell";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const user = await requireRole("ADMIN");

  return <AdminShell user={user}>{children}</AdminShell>;
}
