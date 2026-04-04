import { pgTable, text, timestamp, pgEnum, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from '@/lib/auth/schema';
import { organizations } from '@/lib/organizations/schema';

export const taskStatusEnum = pgEnum('task_status', [
  'todo',
  'in_progress',
  'done'
]);

export const tasks = pgTable('tasks', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  status: taskStatusEnum('status').notNull().default('todo'),
  dueDate: timestamp('due_date', { withTimezone: true }),
  startAt: timestamp('start_at', { withTimezone: true }),
  endAt: timestamp('end_at', { withTimezone: true }),
  organizationId: text('organization_id').references(() => organizations.id, {
    onDelete: 'set null'
  }),
  assignedToUserId: text('assigned_to_user_id').references(() => users.id, {
    onDelete: 'set null'
  }),
  assignedByUserId: text('assigned_by_user_id').references(() => users.id, {
    onDelete: 'set null'
  }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
});
