import { describe, it, expect } from 'vitest';
import {
  CreateOrgSchema,
  InviteMemberSchema,
  RemoveMemberSchema,
  InvitationActionSchema
} from '@/lib/organizations/validation';

// ─── CreateOrgSchema ──────────────────────────────────────────────────────────

describe('CreateOrgSchema', () => {
  it('accepte un nom valide sans description', () => {
    const result = CreateOrgSchema.safeParse({ name: 'Acme Corp' });
    expect(result.success).toBe(true);
  });

  it('accepte un nom avec une description optionnelle', () => {
    const result = CreateOrgSchema.safeParse({ name: 'Acme', description: 'A company' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBe('A company');
  });

  it('rejette un nom vide', () => {
    // Le nom est obligatoire (min(1))
    const result = CreateOrgSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('rejette un nom trop long (> 100 caractères)', () => {
    const result = CreateOrgSchema.safeParse({ name: 'a'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('accepte un nom à la limite exacte de 100 caractères', () => {
    const result = CreateOrgSchema.safeParse({ name: 'a'.repeat(100) });
    expect(result.success).toBe(true);
  });

  it('rejette une description trop longue (> 500 caractères)', () => {
    const result = CreateOrgSchema.safeParse({
      name: 'Acme',
      description: 'a'.repeat(501)
    });
    expect(result.success).toBe(false);
  });

  it('rejette si le nom est absent', () => {
    const result = CreateOrgSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── InviteMemberSchema ───────────────────────────────────────────────────────

describe('InviteMemberSchema', () => {
  it('accepte des IDs valides', () => {
    const result = InviteMemberSchema.safeParse({
      organizationId: 'org-1',
      receiverId: 'user-2'
    });
    expect(result.success).toBe(true);
  });

  it('rejette si organizationId est absent', () => {
    const result = InviteMemberSchema.safeParse({ receiverId: 'user-2' });
    expect(result.success).toBe(false);
  });

  it('rejette si receiverId est absent', () => {
    const result = InviteMemberSchema.safeParse({ organizationId: 'org-1' });
    expect(result.success).toBe(false);
  });

  it('rejette un organizationId vide', () => {
    const result = InviteMemberSchema.safeParse({ organizationId: '', receiverId: 'user-2' });
    expect(result.success).toBe(false);
  });
});

// ─── RemoveMemberSchema ───────────────────────────────────────────────────────

describe('RemoveMemberSchema', () => {
  it('accepte des IDs valides', () => {
    const result = RemoveMemberSchema.safeParse({
      organizationId: 'org-1',
      userId: 'user-2'
    });
    expect(result.success).toBe(true);
  });

  it('rejette si organizationId est absent', () => {
    const result = RemoveMemberSchema.safeParse({ userId: 'user-2' });
    expect(result.success).toBe(false);
  });

  it('rejette si userId est absent', () => {
    const result = RemoveMemberSchema.safeParse({ organizationId: 'org-1' });
    expect(result.success).toBe(false);
  });
});

// ─── InvitationActionSchema ───────────────────────────────────────────────────

describe('InvitationActionSchema', () => {
  it('accepte un invitationId valide', () => {
    const result = InvitationActionSchema.safeParse({ invitationId: 'inv-1' });
    expect(result.success).toBe(true);
  });

  it('rejette un invitationId vide', () => {
    const result = InvitationActionSchema.safeParse({ invitationId: '' });
    expect(result.success).toBe(false);
  });

  it('rejette si invitationId est absent', () => {
    const result = InvitationActionSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
