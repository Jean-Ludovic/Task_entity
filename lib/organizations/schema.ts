import {
  pgTable,
  text,
  timestamp,
  pgEnum,
  unique,
  primaryKey
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from '@/lib/auth/schema';

export const orgRoleEnum = pgEnum('org_role', ['admin', 'member']);

export const orgInvitationStatusEnum = pgEnum('org_invitation_status', [
  'pending',
  'accepted',
  'rejected'
]);

export const organizations = pgTable('organizations', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`)
});

export const organizationMembers = pgTable(
  'organization_members',
  {
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: orgRoleEnum('role').notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`)
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.userId] })]
);

export const organizationInvitations = pgTable(
  'organization_invitations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    senderId: text('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    receiverId: text('receiver_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: orgInvitationStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`)
  },
  (t) => [unique().on(t.organizationId, t.receiverId)]
);
