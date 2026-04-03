import { pgTable, text, timestamp, pgEnum, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const taskStatusEnum = pgEnum('task_status', [
  'todo',
  'in_progress',
  'done'
]);

export const tasks = pgTable('tasks', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text('title').notNull(),
  description: text('description'),
  status: taskStatusEnum('status').notNull().default('todo'),
  dueDate: timestamp('due_date', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
});
