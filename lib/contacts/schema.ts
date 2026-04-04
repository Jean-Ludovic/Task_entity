import { pgTable, text, timestamp, pgEnum, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from '@/lib/auth/schema';

export const contactStatusEnum = pgEnum('contact_status', [
  'pending',
  'accepted',
  'rejected'
]);

export const contactRequests = pgTable(
  'contact_requests',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    senderId: text('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    receiverId: text('receiver_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: contactStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`)
  },
  (t) => [unique().on(t.senderId, t.receiverId)]
);
