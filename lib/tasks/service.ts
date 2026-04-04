import 'server-only';

import { and, asc, desc, eq, ilike, lt, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tasks } from './schema';
import { users } from '@/lib/auth/schema';
import { organizations, organizationMembers } from '@/lib/organizations/schema';
import { Errors } from '@/lib/errors';
import type { Task, NewTask, PaginatedTasks, TaskWithContext } from './types';
import type { CreateTaskInput, UpdateTaskInput, ListTasksQuery } from './validation';

// ── Cursor pagination helpers ─────────────────────────────────────────────────

type Cursor = { createdAt: string; id: string };

function encodeCursor(task: Task): string {
  return Buffer.from(JSON.stringify({ createdAt: task.createdAt.toISOString(), id: task.id })).toString('base64url');
}

function decodeCursor(raw: string): Cursor {
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf-8')) as Cursor;
  } catch {
    throw Errors.badRequest('Invalid pagination cursor');
  }
}

// ── Enrich tasks with user/org context ───────────────────────────────────────

async function enrichTasks(rows: Task[]): Promise<TaskWithContext[]> {
  if (rows.length === 0) return [];

  const userIds = new Set<string>();
  const orgIds = new Set<string>();

  rows.forEach((t) => {
    if (t.assignedByUserId) userIds.add(t.assignedByUserId);
    if (t.assignedToUserId) userIds.add(t.assignedToUserId);
    if (t.organizationId) orgIds.add(t.organizationId);
  });

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

// ── List personal + assigned tasks ───────────────────────────────────────────

export async function listTasks(
  query: ListTasksQuery,
  userId: string
): Promise<PaginatedTasks> {
  const { q, status, sort, order, cursor: rawCursor, limit } = query;

  // show tasks owned by user OR assigned to user
  const ownershipCond = or(eq(tasks.userId, userId), eq(tasks.assignedToUserId, userId))!;
  const conditions = [ownershipCond];

  if (q) {
    conditions.push(or(ilike(tasks.title, `%${q}%`), ilike(tasks.description, `%${q}%`))!);
  }
  if (status) conditions.push(eq(tasks.status, status));

  if (rawCursor) {
    const cursor = decodeCursor(rawCursor);
    const cursorDate = new Date(cursor.createdAt);
    conditions.push(
      or(lt(tasks.createdAt, cursorDate), and(eq(tasks.createdAt, cursorDate), lt(tasks.id, cursor.id)))!
    );
  }

  const sortColumn =
    sort === 'dueDate' ? tasks.dueDate :
    sort === 'startAt' ? tasks.startAt :
    tasks.createdAt;
  const direction = order === 'asc' ? asc : desc;

  const rows = await db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(direction(sortColumn), desc(tasks.id))
    .limit(limit + 1);

  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const nextCursor = hasNextPage && items.length > 0 ? encodeCursor(items[items.length - 1]) : null;

  return { tasks: items, nextCursor };
}

// ── Get task by id ────────────────────────────────────────────────────────────

export async function getTaskById(id: string, userId: string): Promise<Task> {
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

// ── Create task ───────────────────────────────────────────────────────────────

export async function createTask(data: CreateTaskInput, userId: string): Promise<Task> {
  const insert: NewTask = {
    userId,
    title: data.title,
    description: data.description ?? null,
    status: data.status ?? 'todo',
    dueDate: data.dueDate ? new Date(data.dueDate) : null,
    startAt: data.startAt ? new Date(data.startAt) : null,
    endAt: data.endAt ? new Date(data.endAt) : null,
    organizationId: data.organizationId ?? null,
    assignedToUserId: data.assignedToUserId ?? null,
    assignedByUserId: data.assignedToUserId ? userId : null
  };

  const [task] = await db.insert(tasks).values(insert).returning();
  return task;
}

// ── Update task ───────────────────────────────────────────────────────────────

export async function updateTask(id: string, data: UpdateTaskInput, userId: string): Promise<Task> {
  await getTaskById(id, userId);

  const patch: Partial<NewTask> = {
    ...(data.title !== undefined && { title: data.title }),
    ...(data.description !== undefined && { description: data.description }),
    ...(data.status !== undefined && { status: data.status }),
    ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
    ...(data.startAt !== undefined && { startAt: data.startAt ? new Date(data.startAt) : null }),
    ...(data.endAt !== undefined && { endAt: data.endAt ? new Date(data.endAt) : null }),
    ...(data.assignedToUserId !== undefined && {
      assignedToUserId: data.assignedToUserId ?? null,
      assignedByUserId: data.assignedToUserId ? userId : null
    }),
    updatedAt: new Date()
  };

  const [updated] = await db
    .update(tasks)
    .set(patch)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .returning();

  return updated;
}

// ── Delete task ───────────────────────────────────────────────────────────────

export async function deleteTask(id: string, userId: string): Promise<void> {
  await getTaskById(id, userId);
  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
}

// ── Org tasks ─────────────────────────────────────────────────────────────────

export async function listOrgTasks(
  organizationId: string,
  userId: string
): Promise<TaskWithContext[]> {
  // must be a member
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
): Promise<Task> {
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
    dueDate: data.dueDate ? new Date(data.dueDate) : null,
    startAt: data.startAt ? new Date(data.startAt) : null,
    endAt: data.endAt ? new Date(data.endAt) : null,
    organizationId,
    assignedToUserId: data.assignedToUserId ?? null,
    assignedByUserId: data.assignedToUserId ? userId : null
  };

  const [task] = await db.insert(tasks).values(insert).returning();
  return task;
}

// ── Calendar tasks ────────────────────────────────────────────────────────────

export async function listCalendarTasks(
  userId: string,
  from: Date,
  to: Date
): Promise<TaskWithContext[]> {
  const rows = await db
    .select()
    .from(tasks)
    .where(
      and(
        or(eq(tasks.userId, userId), eq(tasks.assignedToUserId, userId))!
      )
    );

  // filter in-memory for tasks that overlap [from, to]
  const filtered = rows.filter((t) => {
    const start = t.startAt ?? t.dueDate;
    const end = t.endAt ?? t.dueDate;
    if (!start) return false;
    return start <= to && (end ?? start) >= from;
  });

  return enrichTasks(filtered);
}
