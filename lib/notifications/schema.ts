import { pgTable, text, timestamp, boolean, pgEnum, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from '@/lib/auth/schema';

export const notificationTypeEnum = pgEnum('notification_type', [
  'contact_invitation_received',
  'contact_invitation_accepted',
  'org_invitation_received',
  'org_invitation_accepted',
  'task_assigned',
  'task_status_updated'
]);

export const notifications = pgTable('notifications', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: notificationTypeEnum('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  relatedEntityType: text('related_entity_type'),
  relatedEntityId: text('related_entity_id'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow()
});
