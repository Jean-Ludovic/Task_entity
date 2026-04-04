import 'server-only';

import { and, eq, ilike, ne, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { contactRequests } from './schema';
import { users } from '@/lib/auth/schema';
import { Errors } from '@/lib/errors';
import type { ContactWithUser } from './types';

// ── Send invitation ───────────────────────────────────────────────────────────

export async function sendContactRequest(
  senderId: string,
  receiverId: string
): Promise<typeof contactRequests.$inferSelect> {
  if (senderId === receiverId) {
    throw Errors.badRequest('Cannot send a contact request to yourself');
  }

  const [receiver] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, receiverId));
  if (!receiver) throw Errors.notFound('User');

  const [existing] = await db
    .select()
    .from(contactRequests)
    .where(
      or(
        and(eq(contactRequests.senderId, senderId), eq(contactRequests.receiverId, receiverId)),
        and(eq(contactRequests.senderId, receiverId), eq(contactRequests.receiverId, senderId))
      )
    );

  if (existing) {
    if (existing.status === 'accepted') throw Errors.badRequest('You are already contacts');
    if (existing.status === 'pending') throw Errors.badRequest('A contact request already exists');
    // rejected → re-send
    const [updated] = await db
      .update(contactRequests)
      .set({ status: 'pending', senderId, receiverId, updatedAt: new Date() })
      .where(eq(contactRequests.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(contactRequests)
    .values({ senderId, receiverId })
    .returning();
  return created;
}

// ── Accept invitation ─────────────────────────────────────────────────────────

export async function acceptContactRequest(
  requestId: string,
  currentUserId: string
): Promise<typeof contactRequests.$inferSelect> {
  const [request] = await db
    .select()
    .from(contactRequests)
    .where(eq(contactRequests.id, requestId));

  if (!request) throw Errors.notFound('Contact request');
  if (request.receiverId !== currentUserId) throw Errors.forbidden();
  if (request.status !== 'pending') throw Errors.badRequest(`Request is already ${request.status}`);

  const [updated] = await db
    .update(contactRequests)
    .set({ status: 'accepted', updatedAt: new Date() })
    .where(eq(contactRequests.id, requestId))
    .returning();
  return updated;
}

// ── Reject invitation ─────────────────────────────────────────────────────────

export async function rejectContactRequest(
  requestId: string,
  currentUserId: string
): Promise<typeof contactRequests.$inferSelect> {
  const [request] = await db
    .select()
    .from(contactRequests)
    .where(eq(contactRequests.id, requestId));

  if (!request) throw Errors.notFound('Contact request');
  if (request.receiverId !== currentUserId) throw Errors.forbidden();
  if (request.status !== 'pending') throw Errors.badRequest(`Request is already ${request.status}`);

  const [updated] = await db
    .update(contactRequests)
    .set({ status: 'rejected', updatedAt: new Date() })
    .where(eq(contactRequests.id, requestId))
    .returning();
  return updated;
}

// ── Delete contact ────────────────────────────────────────────────────────────

export async function deleteContact(
  requestId: string,
  currentUserId: string
): Promise<void> {
  const [request] = await db
    .select()
    .from(contactRequests)
    .where(eq(contactRequests.id, requestId));

  if (!request) throw Errors.notFound('Contact');
  if (request.senderId !== currentUserId && request.receiverId !== currentUserId) {
    throw Errors.forbidden();
  }
  if (request.status !== 'accepted') throw Errors.badRequest('This is not an accepted contact');

  await db.delete(contactRequests).where(eq(contactRequests.id, requestId));
}

// ── Shared helper: enrich requests with user profiles ────────────────────────

async function enrichWithUsers(
  requests: (typeof contactRequests.$inferSelect)[],
  getOtherUserId: (r: typeof contactRequests.$inferSelect) => string,
  isSender: boolean
): Promise<ContactWithUser[]> {
  if (requests.length === 0) return [];

  const otherIds = requests.map(getOtherUserId);
  const userRows = await db
    .select({ id: users.id, name: users.name, email: users.email, image: users.image })
    .from(users)
    .where(or(...otherIds.map((id) => eq(users.id, id))));

  const userMap = new Map(userRows.map((u) => [u.id, u]));

  return requests.map((r) => {
    const otherId = getOtherUserId(r);
    return {
      requestId: r.id,
      status: r.status,
      createdAt: r.createdAt,
      isSender,
      user: userMap.get(otherId) ?? { id: otherId, name: null, email: null, image: null }
    };
  });
}

// ── List accepted contacts ────────────────────────────────────────────────────

export async function listContacts(currentUserId: string): Promise<ContactWithUser[]> {
  const requests = await db
    .select()
    .from(contactRequests)
    .where(
      and(
        eq(contactRequests.status, 'accepted'),
        or(
          eq(contactRequests.senderId, currentUserId),
          eq(contactRequests.receiverId, currentUserId)
        )
      )
    );

  if (requests.length === 0) return [];

  const allOtherIds = requests.map((r) =>
    r.senderId === currentUserId ? r.receiverId : r.senderId
  );

  const userRows = await db
    .select({ id: users.id, name: users.name, email: users.email, image: users.image })
    .from(users)
    .where(or(...allOtherIds.map((id) => eq(users.id, id))));

  const userMap = new Map(userRows.map((u) => [u.id, u]));

  return requests.map((r) => {
    const isSender = r.senderId === currentUserId;
    const otherId = isSender ? r.receiverId : r.senderId;
    return {
      requestId: r.id,
      status: r.status,
      createdAt: r.createdAt,
      isSender,
      user: userMap.get(otherId) ?? { id: otherId, name: null, email: null, image: null }
    };
  });
}

// ── Pending received ──────────────────────────────────────────────────────────

export async function listReceivedRequests(currentUserId: string): Promise<ContactWithUser[]> {
  const requests = await db
    .select()
    .from(contactRequests)
    .where(
      and(
        eq(contactRequests.receiverId, currentUserId),
        eq(contactRequests.status, 'pending')
      )
    );

  return enrichWithUsers(requests, (r) => r.senderId, false);
}

// ── Pending sent ──────────────────────────────────────────────────────────────

export async function listSentRequests(currentUserId: string): Promise<ContactWithUser[]> {
  const requests = await db
    .select()
    .from(contactRequests)
    .where(
      and(
        eq(contactRequests.senderId, currentUserId),
        eq(contactRequests.status, 'pending')
      )
    );

  return enrichWithUsers(requests, (r) => r.receiverId, true);
}

// ── Search users ──────────────────────────────────────────────────────────────

export async function searchUsers(
  q: string,
  currentUserId: string
): Promise<{ id: string; name: string | null; email: string | null; image: string | null }[]> {
  return db
    .select({ id: users.id, name: users.name, email: users.email, image: users.image })
    .from(users)
    .where(
      and(
        ne(users.id, currentUserId),
        or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`))
      )
    )
    .limit(20);
}
