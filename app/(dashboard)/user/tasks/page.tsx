import { db } from "@/app/lib/db";
import { TASK_LIST_LIMIT } from "@/app/lib/query-limits";
import { TaskStatus } from "@/app/lib/prisma-enums";
import { requireRole } from "@/app/lib/session";
import {
  addTaskCommentAction,
  changeTaskStatusAction,
} from "@/app/lib/task-actions";

type UserTasksPageProps = {
  searchParams: Promise<{
    commented?: string;
    error?: string;
    status?: string;
    statusUpdated?: string;
  }>;
};

const statusOptions = Object.values(TaskStatus);

function label(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function isOverdue(status: TaskStatus, dueDate: Date | null) {
  return (
    Boolean(dueDate) &&
    dueDate! < new Date() &&
    status !== "COMPLETED" &&
    status !== "CANCELLED"
  );
}

function statusStyle(status: TaskStatus) {
  const styles: Record<TaskStatus, string> = {
    PENDING: "border-sky-300/20 bg-sky-300/10 text-sky-100",
    IN_PROGRESS: "border-fuchsia-300/20 bg-fuchsia-300/10 text-fuchsia-100",
    COMPLETED: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
    CANCELLED: "border-zinc-300/20 bg-zinc-300/10 text-zinc-200",
  };

  return styles[status];
}

async function getAssignedTasks(userId: string, status?: string) {
  try {
    const tasks = await db.task.findMany({
      where: {
        assignedToId: userId,
        ...(statusOptions.includes(status as TaskStatus)
          ? { status: status as TaskStatus }
          : {}),
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      take: TASK_LIST_LIMIT,
      include: {
        assignedBy: { select: { username: true } },
        comments: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { author: { select: { username: true } } },
        },
      },
    });

    return { tasks, error: null };
  } catch {
    return {
      tasks: [],
      error: "Database is unreachable. Your assigned tasks cannot be loaded.",
    };
  }
}

export default async function UserTasksPage({ searchParams }: UserTasksPageProps) {
  const user = await requireRole("USER");
  const params = await searchParams;
  const { tasks, error } = await getAssignedTasks(user.id, params.status);
  const overdueCount = tasks.filter((task) =>
    isOverdue(task.status, task.dueDate),
  ).length;
  const notice =
    params.statusUpdated === "1"
      ? "Task status updated."
      : params.commented === "1"
        ? "Progress note added."
        : null;

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-200">
            Task Desk
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
            My Tasks
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Update assigned work, add progress notes, and close completed items.
          </p>
        </div>
        <div className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
          {overdueCount} overdue
        </div>
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

      <form className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
        <label className="block max-w-sm">
          <span className="mb-2 block text-sm text-zinc-400">
            Filter by status
          </span>
          <div className="flex gap-2">
            <select
              className="h-11 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-amber-300"
              defaultValue={params.status ?? ""}
              name="status"
            >
              <option value="">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {label(status)}
                </option>
              ))}
            </select>
            <button
              className="h-11 rounded-lg bg-amber-300 px-4 text-sm font-bold text-zinc-950 hover:bg-amber-200"
              type="submit"
            >
              Apply
            </button>
          </div>
        </label>
      </form>

      <div className="space-y-4">
        {tasks.length ? (
          tasks.map((task) => {
            const overdue = isOverdue(task.status, task.dueDate);

            return (
              <article
                className="rounded-lg border border-white/10 bg-white/[0.03] p-5"
                key={task.id}
              >
                <div className="flex flex-col justify-between gap-4 md:flex-row">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">{task.title}</h2>
                      <span
                        className={`rounded-lg border px-2 py-1 text-xs font-semibold ${statusStyle(task.status)}`}
                      >
                        {label(task.status)}
                      </span>
                      <span className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-xs font-semibold text-amber-100">
                        {label(task.priority)}
                      </span>
                      {overdue ? (
                        <span className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-2 py-1 text-xs font-semibold text-rose-100">
                          Overdue
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-zinc-400">
                      Assigned by {task.assignedBy.username}
                      {task.dueDate
                        ? ` | Due ${task.dueDate.toLocaleDateString("en-IN")}`
                        : " | No due date"}
                    </p>
                    {task.description ? (
                      <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">
                        {task.description}
                      </p>
                    ) : null}
                  </div>

                  <form action={changeTaskStatusAction} className="flex gap-2">
                    <input name="taskId" type="hidden" value={task.id} />
                    <select
                      className="h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-amber-300"
                      defaultValue={task.status}
                      name="status"
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {label(status)}
                        </option>
                      ))}
                    </select>
                    <button
                      className="h-10 rounded-lg bg-amber-300 px-3 text-sm font-bold text-zinc-950"
                      type="submit"
                    >
                      Update
                    </button>
                  </form>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-300">
                      Progress notes
                    </h3>
                    <div className="mt-3 space-y-2">
                      {task.comments.length ? (
                        task.comments.map((comment) => (
                          <div
                            className="rounded-lg border border-white/10 bg-black/20 p-3"
                            key={comment.id}
                          >
                            <p className="text-sm text-zinc-200">
                              {comment.body}
                            </p>
                            <p className="mt-2 text-xs text-zinc-500">
                              {comment.author.username} |{" "}
                              {comment.createdAt.toLocaleString("en-IN")}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-zinc-500">
                          No progress notes yet.
                        </p>
                      )}
                    </div>
                  </div>

                  <form action={addTaskCommentAction}>
                    <input name="taskId" type="hidden" value={task.id} />
                    <label className="block">
                      <span className="mb-2 block text-sm text-zinc-400">
                        Add progress note
                      </span>
                      <textarea
                        className="min-h-24 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-3 text-sm outline-none focus:border-amber-300"
                        name="body"
                        placeholder="What changed?"
                        required
                      />
                    </label>
                    <button
                      className="mt-3 h-10 rounded-lg border border-amber-300/20 px-4 text-sm font-semibold text-amber-100 hover:bg-amber-300/10"
                      type="submit"
                    >
                      Add note
                    </button>
                  </form>
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 p-10 text-center text-zinc-500">
            No assigned tasks found.
          </div>
        )}
      </div>
    </div>
  );
}
