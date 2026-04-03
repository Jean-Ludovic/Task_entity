import 'server-only';

import { and, asc, desc, eq, ilike, isNull, lt, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tasks } from './schema';
import { Errors } from '@/lib/errors';
import type {
  Task,
  NewTask,
  PaginatedTasks
} from './types';
import type {
  CreateTaskInput,
  UpdateTaskInput,
  ListTasksQuery
} from './validation';

type Cursor = { createdAt: string; id: string };

function encodeCursor(task: Task): string {
  const cursor: Cursor = {
    createdAt: task.createdAt.toISOString(),
    id: task.id
  };
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodeCursor(raw: string): Cursor {
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf-8')) as Cursor;
  } catch {
    throw Errors.badRequest('Invalid pagination cursor');
  }
}

export async function listTasks(
  query: ListTasksQuery
): Promise<PaginatedTasks> {
  const { q, status, sort, order, cursor: rawCursor, limit } = query;

  const conditions = [];

  if (q) {
    conditions.push(
      or(ilike(tasks.title, `%${q}%`), ilike(tasks.description, `%${q}%`))
    );
  }

  if (status) {
    conditions.push(eq(tasks.status, status));
  }

  if (rawCursor) {
    const cursor = decodeCursor(rawCursor);
    const cursorDate = new Date(cursor.createdAt);
    conditions.push(
      or(
        lt(tasks.createdAt, cursorDate),
        and(eq(tasks.createdAt, cursorDate), lt(tasks.id, cursor.id))
      )
    );
  }

  const sortColumn = sort === 'dueDate' ? tasks.dueDate : tasks.createdAt;
  const direction = order === 'asc' ? asc : desc;

  const rows = await db
    .select()
    .from(tasks)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(direction(sortColumn), desc(tasks.id))
    .limit(limit + 1);

  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const nextCursor =
    hasNextPage && items.length > 0
      ? encodeCursor(items[items.length - 1])
      : null;

  return { tasks: items, nextCursor };
}

export async function getTaskById(id: string): Promise<Task> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!task) throw Errors.notFound('Task');
  return task;
}

export async function createTask(data: CreateTaskInput): Promise<Task> {
  const insert: NewTask = {
    title: data.title,
    description: data.description ?? null,
    status: data.status ?? 'todo',
    dueDate: data.dueDate ? new Date(data.dueDate) : null
  };

  const [task] = await db.insert(tasks).values(insert).returning();
  return task;
}

export async function updateTask(
  id: string,
  data: UpdateTaskInput
): Promise<Task> {
  await getTaskById(id);
  const patch: Partial<NewTask> = {
    ...(data.title !== undefined && { title: data.title }),
    ...(data.description !== undefined && { description: data.description }),
    ...(data.status !== undefined && { status: data.status }),
    ...(data.dueDate !== undefined && {
      dueDate: data.dueDate ? new Date(data.dueDate) : null
    }),
    updatedAt: new Date()
  };

  const [updated] = await db
    .update(tasks)
    .set(patch)
    .where(eq(tasks.id, id))
    .returning();

  return updated;
}

export async function deleteTask(id: string): Promise<void> {
  await getTaskById(id);  await db.delete(tasks).where(eq(tasks.id, id));
}
