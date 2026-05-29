import { cache } from "react";
import type { TaskStatus as TaskStatusType } from "@/app/lib/prisma-enums";
import { db } from "@/app/lib/db";
import { LeadStage, TaskStatus } from "@/app/lib/prisma-enums";

export type UserWorkloadSummary = {
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  openTasks: number;
  overdueTasks: number;
  totalFollowups: number;
};

const emptyWorkload: UserWorkloadSummary = {
  totalTasks: 0,
  pendingTasks: 0,
  inProgressTasks: 0,
  completedTasks: 0,
  openTasks: 0,
  overdueTasks: 0,
  totalFollowups: 0,
};

export const getUserWorkloadSummary = cache(async (userId: string) => {
  try {
    const [
      taskStatusCounts,
      overdueTasks,
      websiteFollowups,
      instagramFollowups,
    ] = await Promise.all([
      db.task.groupBy({
        by: ["status"],
        where: { assignedToId: userId },
        _count: { _all: true },
      }),
      db.task.count({
        where: {
          assignedToId: userId,
          dueDate: { lt: new Date() },
          status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
        },
      }),
      db.websiteLead.count({
        where: { assignedToId: userId, stage: LeadStage.FOLLOW_UP },
      }),
      db.instagramLead.count({
        where: { assignedToId: userId, stage: LeadStage.FOLLOW_UP },
      }),
    ]);

    const taskCounts: Record<TaskStatusType, number> = {
      [TaskStatus.PENDING]: 0,
      [TaskStatus.IN_PROGRESS]: 0,
      [TaskStatus.COMPLETED]: 0,
      [TaskStatus.CANCELLED]: 0,
    };

    for (const row of taskStatusCounts) {
      taskCounts[row.status] = row._count._all;
    }

    const openTasks =
      taskCounts.PENDING + taskCounts.IN_PROGRESS;

    return {
      data: {
        totalTasks:
          taskCounts.PENDING +
          taskCounts.IN_PROGRESS +
          taskCounts.COMPLETED +
          taskCounts.CANCELLED,
        pendingTasks: taskCounts.PENDING,
        inProgressTasks: taskCounts.IN_PROGRESS,
        completedTasks: taskCounts.COMPLETED,
        openTasks,
        overdueTasks,
        totalFollowups: websiteFollowups + instagramFollowups,
      },
      error: null,
    };
  } catch {
    return {
      data: emptyWorkload,
      error: "Database is unreachable. Dashboard numbers are temporarily unavailable.",
    };
  }
});
