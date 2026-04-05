import 'server-only';
import { db } from '@/lib/db';
import { notifications } from './schema';
import { eq, and, desc } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';

export type Notification = InferSelectModel<typeof notifications>;

type CreateNotificationInput = {
  userId: string;
  type: Notification['type'];
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
};

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  await db.insert(notifications).values({
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    relatedEntityType: input.relatedEntityType ?? null,
    relatedEntityId: input.relatedEntityId ?? null
  });
}

export async function listNotifications(userId: string): Promise<Notification[]> {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
}

export async function markAsRead(notificationId: string, userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}

export async function markAllAsRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
}
