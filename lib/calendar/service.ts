import 'server-only';

import { and, eq, isNull, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tasks } from '@/lib/tasks/schema';
import { enrichTasks } from '@/lib/tasks/service';
import type { TaskWithContext } from '@/lib/tasks/types';

const SLOT_HOURS = 1;
const WORK_START = 9;  // 9 AM
const WORK_END = 18;   // 6 PM

type Slot = { start: Date; end: Date };

function slotsOverlap(a: Slot, b: Slot): boolean {
  return a.start < b.end && a.end > b.start;
}

function findNextFreeSlot(
  from: Date,
  occupied: Slot[],
  preferredDate?: Date
): Slot {
  // If preferred date, start from that day at WORK_START
  let cursor = preferredDate
    ? new Date(preferredDate.getFullYear(), preferredDate.getMonth(), preferredDate.getDate(), WORK_START, 0, 0, 0)
    : new Date(from);

  // Snap to next work hour
  if (cursor.getHours() >= WORK_END) {
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(WORK_START, 0, 0, 0);
  } else if (cursor.getHours() < WORK_START) {
    cursor.setHours(WORK_START, 0, 0, 0);
  }

  // Try up to 60 days ahead
  for (let attempt = 0; attempt < 60 * (WORK_END - WORK_START); attempt++) {
    const slotEnd = new Date(cursor.getTime() + SLOT_HOURS * 60 * 60 * 1000);
    const candidate: Slot = { start: new Date(cursor), end: slotEnd };

    const hasOverlap = occupied.some((s) => slotsOverlap(candidate, s));

    if (!hasOverlap) {
      return candidate;
    }

    // Advance by 1 hour
    cursor.setHours(cursor.getHours() + 1);

    // If past work end, move to next day
    if (cursor.getHours() >= WORK_END) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(WORK_START, 0, 0, 0);

      // If preferred date and we've moved past it, give up on preference
      if (preferredDate && cursor.getDate() !== preferredDate.getDate()) {
        // Try to stay on preferred date — if we exhausted the day, continue to next day
      }
    }
  }

  // Fallback: return cursor as-is
  return { start: cursor, end: new Date(cursor.getTime() + SLOT_HOURS * 60 * 60 * 1000) };
}

export async function autoArrangeTasks(userId: string): Promise<TaskWithContext[]> {
  // Fetch all tasks for the user
  const allTasks = await db
    .select()
    .from(tasks)
    .where(or(eq(tasks.userId, userId), eq(tasks.assignedToUserId, userId))!);

  // Separate already-scheduled from needing scheduling
  const alreadyScheduled = allTasks.filter((t) => t.startAt !== null);
  const needsScheduling = allTasks.filter((t) => t.startAt === null);

  if (needsScheduling.length === 0) {
    return enrichTasks(allTasks);
  }

  // Build occupied slots from already-scheduled tasks
  const occupied: Slot[] = alreadyScheduled
    .filter((t) => t.startAt && t.endAt)
    .map((t) => ({
      start: new Date(t.startAt!),
      end: new Date(t.endAt!)
    }));

  const now = new Date();

  // Sort: tasks with dueDate first (sorted by dueDate ASC), then tasks without
  const withDue = needsScheduling
    .filter((t) => t.dueDate !== null)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
  const withoutDue = needsScheduling.filter((t) => t.dueDate === null);

  const toArrange = [...withDue, ...withoutDue];

  // Assign slots
  const updates: { id: string; startAt: Date; endAt: Date }[] = [];

  for (const task of toArrange) {
    const preferredDate = task.dueDate ? new Date(task.dueDate) : undefined;
    const slot = findNextFreeSlot(now, occupied, preferredDate);

    updates.push({ id: task.id, startAt: slot.start, endAt: slot.end });
    // Add the newly assigned slot to occupied so subsequent tasks don't overlap
    occupied.push(slot);
  }

  // Persist updates
  await Promise.all(
    updates.map(({ id, startAt, endAt }) =>
      db
        .update(tasks)
        .set({ startAt, endAt, updatedAt: new Date() })
        .where(eq(tasks.id, id))
    )
  );

  // Return fresh data
  const refreshed = await db
    .select()
    .from(tasks)
    .where(or(eq(tasks.userId, userId), eq(tasks.assignedToUserId, userId))!);

  return enrichTasks(refreshed);
}
