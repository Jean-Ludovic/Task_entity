import 'server-only';

import { and, eq, or, count } from 'drizzle-orm';
import { db } from '@/lib/db';
import { organizations, organizationMembers, organizationInvitations } from './schema';
import { users } from '@/lib/auth/schema';
import { contactRequests } from '@/lib/contacts/schema';
import { Errors } from '@/lib/errors';
import { createNotification } from '@/lib/notifications/service';
import type {
  OrganizationWithRole,
  OrgMemberWithUser,
  OrgInvitationWithDetails
} from './types';
import type { CreateOrgInput } from './validation';

// ── Guards ────────────────────────────────────────────────────────────────────

async function requireMember(organizationId: string, userId: string) {
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
  return member;
}

async function requireAdmin(organizationId: string, userId: string) {
  const member = await requireMember(organizationId, userId);
  if (member.role !== 'admin') throw Errors.forbidden();
  return member;
}

async function areContacts(userA: string, userB: string): Promise<boolean> {
  const [rel] = await db
    .select()
    .from(contactRequests)
    .where(
      and(
        eq(contactRequests.status, 'accepted'),
        or(
          and(eq(contactRequests.senderId, userA), eq(contactRequests.receiverId, userB)),
          and(eq(contactRequests.senderId, userB), eq(contactRequests.receiverId, userA))
        )
      )
    );
  return !!rel;
}

// ── Create organization ───────────────────────────────────────────────────────

export async function createOrganization(
  data: CreateOrgInput,
  createdBy: string
): Promise<typeof organizations.$inferSelect> {
  const [org] = await db
    .insert(organizations)
    .values({ name: data.name, description: data.description ?? null, createdBy })
    .returning();

  // creator becomes admin automatically
  await db.insert(organizationMembers).values({
    organizationId: org.id,
    userId: createdBy,
    role: 'admin'
  });

  return org;
}

// ── List organizations for user ───────────────────────────────────────────────

export async function listOrganizations(userId: string): Promise<OrganizationWithRole[]> {
  const memberships = await db
    .select({
      organizationId: organizationMembers.organizationId,
      role: organizationMembers.role
    })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId));

  if (memberships.length === 0) return [];

  const orgIds = memberships.map((m) => m.organizationId);
  const roleMap = new Map(memberships.map((m) => [m.organizationId, m.role]));

  const orgs = await db
    .select()
    .from(organizations)
    .where(or(...orgIds.map((id) => eq(organizations.id, id))));

  // count members per org
  const counts = await db
    .select({
      organizationId: organizationMembers.organizationId,
      count: count()
    })
    .from(organizationMembers)
    .where(or(...orgIds.map((id) => eq(organizationMembers.organizationId, id))))
    .groupBy(organizationMembers.organizationId);

  const countMap = new Map(counts.map((c) => [c.organizationId, Number(c.count)]));

  return orgs.map((org) => ({
    ...org,
    role: roleMap.get(org.id) ?? 'member',
    memberCount: countMap.get(org.id) ?? 1
  }));
}

// ── Get single organization ───────────────────────────────────────────────────

export async function getOrganization(
  organizationId: string,
  userId: string
): Promise<typeof organizations.$inferSelect> {
  await requireMember(organizationId, userId);
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId));
  if (!org) throw Errors.notFound('Organization');
  return org;
}

// ── List members ──────────────────────────────────────────────────────────────

export async function listMembers(
  organizationId: string,
  userId: string
): Promise<OrgMemberWithUser[]> {
  await requireMember(organizationId, userId);

  const members = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, organizationId));

  if (members.length === 0) return [];

  const userRows = await db
    .select({ id: users.id, name: users.name, email: users.email, image: users.image })
    .from(users)
    .where(or(...members.map((m) => eq(users.id, m.userId))));

  const userMap = new Map(userRows.map((u) => [u.id, u]));

  return members.map((m) => ({
    userId: m.userId,
    name: userMap.get(m.userId)?.name ?? null,
    email: userMap.get(m.userId)?.email ?? null,
    image: userMap.get(m.userId)?.image ?? null,
    role: m.role,
    joinedAt: m.joinedAt
  }));
}

// ── Invite member ─────────────────────────────────────────────────────────────

export async function inviteMember(
  organizationId: string,
  senderId: string,
  receiverId: string
): Promise<typeof organizationInvitations.$inferSelect> {
  await requireAdmin(organizationId, senderId);

  if (senderId === receiverId) throw Errors.badRequest('Cannot invite yourself');

  // must be contacts
  const isContact = await areContacts(senderId, receiverId);
  if (!isContact) throw Errors.badRequest('You can only invite your contacts');

  // not already a member
  const [existingMember] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, receiverId)
      )
    );
  if (existingMember) throw Errors.badRequest('User is already a member');

  // upsert invitation
  const [existing] = await db
    .select()
    .from(organizationInvitations)
    .where(
      and(
        eq(organizationInvitations.organizationId, organizationId),
        eq(organizationInvitations.receiverId, receiverId)
      )
    );

  if (existing) {
    if (existing.status === 'pending') throw Errors.badRequest('Invitation already sent');
    const [updated] = await db
      .update(organizationInvitations)
      .set({ status: 'pending', senderId })
      .where(eq(organizationInvitations.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(organizationInvitations)
    .values({ organizationId, senderId, receiverId })
    .returning();

  const [[org], [sender]] = await Promise.all([
    db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, organizationId)),
    db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, senderId))
  ]);
  void createNotification({
    userId: receiverId,
    type: 'org_invitation_received',
    title: 'Organization invitation',
    message: `${sender?.name ?? sender?.email ?? 'Someone'} invited you to join ${org?.name ?? 'an organization'}.`,
    relatedEntityType: 'org_invitation',
    relatedEntityId: created.id
  });

  return created;
}

// ── Accept org invitation ─────────────────────────────────────────────────────

export async function acceptOrgInvitation(
  invitationId: string,
  userId: string
): Promise<void> {
  const [inv] = await db
    .select()
    .from(organizationInvitations)
    .where(eq(organizationInvitations.id, invitationId));

  if (!inv) throw Errors.notFound('Invitation');
  if (inv.receiverId !== userId) throw Errors.forbidden();
  if (inv.status !== 'pending') throw Errors.badRequest(`Invitation is already ${inv.status}`);

  await db
    .update(organizationInvitations)
    .set({ status: 'accepted' })
    .where(eq(organizationInvitations.id, invitationId));

  await db
    .insert(organizationMembers)
    .values({ organizationId: inv.organizationId, userId, role: 'member' })
    .onConflictDoNothing();

  const [[acceptor], [org]] = await Promise.all([
    db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, userId)),
    db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, inv.organizationId))
  ]);
  void createNotification({
    userId: inv.senderId,
    type: 'org_invitation_accepted',
    title: 'Invitation accepted',
    message: `${acceptor?.name ?? acceptor?.email ?? 'Someone'} accepted your invitation to ${org?.name ?? 'your organization'}.`,
    relatedEntityType: 'org_invitation',
    relatedEntityId: invitationId
  });
}

// ── Reject org invitation ─────────────────────────────────────────────────────

export async function rejectOrgInvitation(
  invitationId: string,
  userId: string
): Promise<void> {
  const [inv] = await db
    .select()
    .from(organizationInvitations)
    .where(eq(organizationInvitations.id, invitationId));

  if (!inv) throw Errors.notFound('Invitation');
  if (inv.receiverId !== userId) throw Errors.forbidden();
  if (inv.status !== 'pending') throw Errors.badRequest(`Invitation is already ${inv.status}`);

  await db
    .update(organizationInvitations)
    .set({ status: 'rejected' })
    .where(eq(organizationInvitations.id, invitationId));
}

// ── Remove member ─────────────────────────────────────────────────────────────

export async function removeMember(
  organizationId: string,
  targetUserId: string,
  currentUserId: string
): Promise<void> {
  const currentMember = await requireMember(organizationId, currentUserId);

  // admin can remove anyone, member can only leave (remove themselves)
  if (currentMember.role !== 'admin' && targetUserId !== currentUserId) {
    throw Errors.forbidden();
  }

  // can't remove the last admin
  if (targetUserId !== currentUserId) {
    const [target] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, targetUserId)
        )
      );
    if (!target) throw Errors.notFound('Member');
  }

  await db
    .delete(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, targetUserId)
      )
    );
}

// ── List received org invitations ─────────────────────────────────────────────

export async function listReceivedOrgInvitations(
  userId: string
): Promise<OrgInvitationWithDetails[]> {
  const invitations = await db
    .select()
    .from(organizationInvitations)
    .where(
      and(
        eq(organizationInvitations.receiverId, userId),
        eq(organizationInvitations.status, 'pending')
      )
    );

  if (invitations.length === 0) return [];

  const orgIds = [...new Set(invitations.map((i) => i.organizationId))];
  const senderIds = [...new Set(invitations.map((i) => i.senderId))];

  const [orgRows, senderRows] = await Promise.all([
    db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(or(...orgIds.map((id) => eq(organizations.id, id)))),
    db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(or(...senderIds.map((id) => eq(users.id, id))))
  ]);

  const orgMap = new Map(orgRows.map((o) => [o.id, o]));
  const senderMap = new Map(senderRows.map((u) => [u.id, u]));

  return invitations.map((inv) => ({
    id: inv.id,
    organization: orgMap.get(inv.organizationId) ?? { id: inv.organizationId, name: 'Unknown' },
    sender: senderMap.get(inv.senderId) ?? { id: inv.senderId, name: null, email: null },
    status: inv.status,
    createdAt: inv.createdAt
  }));
}
