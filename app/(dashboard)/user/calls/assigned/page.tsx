import { db } from "@/app/lib/db";
import { requireRole } from "@/app/lib/session";
import { AssignedCallLeadsPage } from "./assigned-call-leads-page";

export default async function UserAssignedCallLeadsPage() {
  const user = await requireRole("USER");
  const leads = await db.callLead.findMany({
    where: { assignedToId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      _count: { select: { sessions: true, followUps: true } },
      sessions: {
        where: { durationSeconds: { not: null } },
        orderBy: { firstRingAt: "desc" },
        take: 1,
        include: {
          companyPhone: {
            select: {
              label: true,
              phoneNumber: true,
            },
          },
        },
      },
    },
  });

  return <AssignedCallLeadsPage currentUserId={user.id} leads={leads} />;
}
