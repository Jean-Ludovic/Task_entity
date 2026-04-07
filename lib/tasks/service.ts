import 'server-only';

import { and, asc, desc, eq, ilike, lt, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tasks } from './schema';
import { users } from '@/lib/auth/schema';
import { organizations, organizationMembers } from '@/lib/organizations/schema';
import { Errors } from '@/lib/errors';
import { createNotification } from '@/lib/notifications/service';
import type { Task, NewTask, PaginatedTasks, TaskWithContext } from './types';
import type { CreateTaskInput, UpdateTaskInput, ListTasksQuery } from './validation';

// ── Cursor pagination ─────────────────────────────────────────────────────────

type Cursor = { createdAt: string; id: string };

function encodeCursor(task: Task): string {
  return Buffer.from(
    JSON.stringify({ createdAt: task.createdAt.toISOString(), id: task.id })
  ).toString('base64url');
}

function decodeCursor(raw: string): Cursor {
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf-8')) as Cursor;
  } catch {
    throw Errors.badRequest('Invalid pagination cursor');
  }
}

// ── Enrich tasks with user + org context ─────────────────────────────────────

export async function enrichTasks(rows: Task[]): Promise<TaskWithContext[]> {
  if (rows.length === 0) return [];

  const userIds = new Set<string>();
  const orgIds = new Set<string>();

  for (const t of rows) {
    if (t.assignedByUserId) userIds.add(t.assignedByUserId);
    if (t.assignedToUserId) userIds.add(t.assignedToUserId);
    if (t.organizationId) orgIds.add(t.organizationId);
  }

  const [userRows, orgRows] = await Promise.all([
    userIds.size > 0
      ? db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(or(...[...userIds].map((id) => eq(users.id, id))))
      : Promise.resolve([]),
    orgIds.size > 0
      ? db
          .select({ id: organizations.id, name: organizations.name })
          .from(organizations)
          .where(or(...[...orgIds].map((id) => eq(organizations.id, id))))
      : Promise.resolve([])
  ]);

  const userMap = new Map(userRows.map((u) => [u.id, u]));
  const orgMap = new Map(orgRows.map((o) => [o.id, o]));

  return rows.map((t) => ({
    ...t,
    assignedBy: t.assignedByUserId ? (userMap.get(t.assignedByUserId) ?? null) : null,
    assignedTo: t.assignedToUserId ? (userMap.get(t.assignedToUserId) ?? null) : null,
    organization: t.organizationId ? (orgMap.get(t.organizationId) ?? null) : null
  }));
}

// ── Resolve single task (owner OR assigned) ───────────────────────────────────

async function resolveTask(id: string, userId: string): Promise<Task> {
  const [task] = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.id, id),
        or(eq(tasks.userId, userId), eq(tasks.assignedToUserId, userId))!
      )
    );
  if (!task) throw Errors.notFound('Task');
  return task;
}

// ── Org admin check ───────────────────────────────────────────────────────────

async function isOrgAdmin(organizationId: string, userId: string): Promise<boolean> {
  const [m] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      )
    );
  return m?.role === 'admin';
}

// ── LIST personal + assigned ──────────────────────────────────────────────────

export async function listTasks(
  query: ListTasksQuery,
  userId: string
): Promise<{ tasks: TaskWithContext[]; nextCursor: string | null }> {
  const { q, status, priority, sort, order, cursor: rawCursor, limit } = query;

  const ownership = or(eq(tasks.userId, userId), eq(tasks.assignedToUserId, userId))!;
  const conditions = [ownership];

  if (q) {
    conditions.push(or(ilike(tasks.title, `%${q}%`), ilike(tasks.description, `%${q}%`))!);
  }
  if (status) conditions.push(eq(tasks.status, status));
  if (priority) conditions.push(eq(tasks.priority, priority));

  if (rawCursor) {
    const cur = decodeCursor(rawCursor);
    const curDate = new Date(cur.createdAt);
    conditions.push(
      or(lt(tasks.createdAt, curDate), and(eq(tasks.createdAt, curDate), lt(tasks.id, cur.id)))!
    );
  }

  const sortCol =
    sort === 'dueDate' ? tasks.dueDate :
    sort === 'startAt' ? tasks.startAt :
    tasks.createdAt;
  const dir = order === 'asc' ? asc : desc;

  const rows = await db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(dir(sortCol), desc(tasks.id))
    .limit(limit + 1);

  const hasNext = rows.length > limit;
  const items = hasNext ? rows.slice(0, limit) : rows;
  const nextCursor = hasNext && items.length > 0 ? encodeCursor(items[items.length - 1]) : null;
  const enriched = await enrichTasks(items);

  return { tasks: enriched, nextCursor };
}

// ── GET single ────────────────────────────────────────────────────────────────

export async function getTaskById(id: string, userId: string): Promise<TaskWithContext> {
  const task = await resolveTask(id, userId);
  const [enriched] = await enrichTasks([task]);
  return enriched;
}

// ── CREATE ────────────────────────────────────────────────────────────────────

export async function createTask(data: CreateTaskInput, userId: string): Promise<TaskWithContext> {
  const insert: NewTask = {
    userId,
    title: data.title,
    description: data.description ?? null,
    status: data.status ?? 'todo',
    priority: data.priority ?? 'medium',
    dueDate: data.dueDate ? new Date(data.dueDate) : null,
    startAt: data.startAt ? new Date(data.startAt) : null,
    endAt: data.endAt ? new Date(data.endAt) : null,
    organizationId: data.organizationId ?? null,
    assignedToUserId: data.assignedToUserId ?? null,
    assignedByUserId: data.assignedToUserId ? userId : null
  };

  const [task] = await db.insert(tasks).values(insert).returning();

  if (insert.assignedToUserId) {
    const [creator] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId));
    void createNotification({
      userId: insert.assignedToUserId,
      type: 'task_assigned',
      title: 'Task assigned to you',
      message: `${creator?.name ?? creator?.email ?? 'Someone'} assigned you the task "${insert.title}".`,
      relatedEntityType: 'task',
      relatedEntityId: task.id
    });
  }

  const [enriched] = await enrichTasks([task]);
  return enriched;
}

// ── UPDATE ────────────────────────────────────────────────────────────────────
// Owner → full update
// Assigned user → status only

export async function updateTask(
  id: string,
  data: UpdateTaskInput,
  userId: string
): Promise<TaskWithContext> {
  const task = await resolveTask(id, userId);

  const isOwner = task.userId === userId;

  let patch: Partial<NewTask> = { updatedAt: new Date() };

  if (isOwner) {
    // full update
    if (data.title !== undefined) patch.title = data.title;
    if (data.description !== undefined) patch.description = data.description;
    if (data.status !== undefined) patch.status = data.status;
    if (data.priority !== undefined) patch.priority = data.priority;
    if (data.dueDate !== undefined) patch.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.startAt !== undefined) patch.startAt = data.startAt ? new Date(data.startAt) : null;
    if (data.endAt !== undefined) patch.endAt = data.endAt ? new Date(data.endAt) : null;
    if (data.assignedToUserId !== undefined) {
      patch.assignedToUserId = data.assignedToUserId ?? null;
      patch.assignedByUserId = data.assignedToUserId ? userId : null;
    }
  } else {
    // assigned user — status update only
    if (data.status !== undefined) patch.status = data.status;
  }

  const [updated] = await db
    .update(tasks)
    .set(patch)
    .where(eq(tasks.id, id))
    .returning();

  // Notify task owner when assigned user updates status
  if (!isOwner && data.status !== undefined && task.userId !== userId) {
    const [updater] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId));
    void createNotification({
      userId: task.userId,
      type: 'task_status_updated',
      title: 'Task status updated',
      message: `${updater?.name ?? updater?.email ?? 'Someone'} updated the status of "${task.title}" to ${data.status}.`,
      relatedEntityType: 'task',
      relatedEntityId: id
    });
  }

  // Notify new assignee when owner assigns/reassigns
  if (isOwner && data.assignedToUserId && data.assignedToUserId !== task.assignedToUserId) {
    const [assigner] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId));
    void createNotification({
      userId: data.assignedToUserId,
      type: 'task_assigned',
      title: 'Task assigned to you',
      message: `${assigner?.name ?? assigner?.email ?? 'Someone'} assigned you the task "${task.title}".`,
      relatedEntityType: 'task',
      relatedEntityId: id
    });
  }

  const [enriched] = await enrichTasks([updated]);
  return enriched;
}

// ── DELETE ────────────────────────────────────────────────────────────────────
// Owner can always delete their task
// Org admin can delete any task in their org

export async function deleteTask(id: string, userId: string): Promise<void> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!task) throw Errors.notFound('Task');

  const isOwner = task.userId === userId;

  if (!isOwner) {
    // check org admin
    if (task.organizationId) {
      const admin = await isOrgAdmin(task.organizationId, userId);
      if (!admin) throw Errors.forbidden();
    } else {
      throw Errors.forbidden();
    }
  }

  await db.delete(tasks).where(eq(tasks.id, id));
}

// ── ORG TASKS ─────────────────────────────────────────────────────────────────

export async function listOrgTasks(
  organizationId: string,
  userId: string
): Promise<TaskWithContext[]> {
  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      )
    );
  if (!member) throw Errors.forbidden();

  const rows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.organizationId, organizationId))
    .orderBy(desc(tasks.createdAt));

  return enrichTasks(rows);
}

export async function createOrgTask(
  organizationId: string,
  data: CreateTaskInput,
  userId: string
): Promise<TaskWithContext> {
  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      )
    );
  if (!member) throw Errors.forbidden();

  const insert: NewTask = {
    userId,
    title: data.title,
    description: data.description ?? null,
    status: data.status ?? 'todo',
    priority: data.priority ?? 'medium',
    dueDate: data.dueDate ? new Date(data.dueDate) : null,
    startAt: data.startAt ? new Date(data.startAt) : null,
    endAt: data.endAt ? new Date(data.endAt) : null,
    organizationId,
    assignedToUserId: data.assignedToUserId ?? null,
    assignedByUserId: data.assignedToUserId ? userId : null
  };

  const [task] = await db.insert(tasks).values(insert).returning();

  if (insert.assignedToUserId) {
    const [creator] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId));
    void createNotification({
      userId: insert.assignedToUserId,
      type: 'task_assigned',
      title: 'Task assigned to you',
      message: `${creator?.name ?? creator?.email ?? 'Someone'} assigned you the task "${insert.title}".`,
      relatedEntityType: 'task',
      relatedEntityId: task.id
    });
  }

  const [enriched] = await enrichTasks([task]);
  return enriched;
}

// ── CALENDAR ──────────────────────────────────────────────────────────────────

export async function listCalendarTasks(
  userId: string,
  from: Date,
  to: Date
): Promise<TaskWithContext[]> {
  const rows = await db
    .select()
    .from(tasks)
    .where(or(eq(tasks.userId, userId), eq(tasks.assignedToUserId, userId))!);

  const filtered = rows.filter((t) => {
    const start = t.startAt ?? t.dueDate;
    const end = t.endAt ?? t.dueDate;
    if (!start) return false;
    return start <= to && (end ?? start) >= from;
  });

  return enrichTasks(filtered);
}
