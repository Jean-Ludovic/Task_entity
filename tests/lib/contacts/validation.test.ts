import { describe, it, expect } from 'vitest';
import {
  SendRequestSchema,
  RequestActionSchema,
  DeleteContactSchema,
  UserSearchSchema
} from '@/lib/contacts/validation';

// ─── SendRequestSchema ────────────────────────────────────────────────────────

describe('SendRequestSchema', () => {
  it('accepte un receiverId valide', () => {
    // Un UUID ou identifiant non vide doit passer
    const result = SendRequestSchema.safeParse({ receiverId: 'user-abc' });
    expect(result.success).toBe(true);
  });

  it('rejette un receiverId vide', () => {
    // Un receiverId vide ne doit pas être accepté (min(1))
    const result = SendRequestSchema.safeParse({ receiverId: '' });
    expect(result.success).toBe(false);
  });

  it('rejette si receiverId est absent', () => {
    const result = SendRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejette si receiverId n\'est pas une chaîne', () => {
    const result = SendRequestSchema.safeParse({ receiverId: 123 });
    expect(result.success).toBe(false);
  });
});

// ─── RequestActionSchema ──────────────────────────────────────────────────────

describe('RequestActionSchema', () => {
  it('accepte un requestId valide', () => {
    const result = RequestActionSchema.safeParse({ requestId: 'req-1' });
    expect(result.success).toBe(true);
  });

  it('rejette un requestId vide', () => {
    const result = RequestActionSchema.safeParse({ requestId: '' });
    expect(result.success).toBe(false);
  });

  it('rejette si requestId est absent', () => {
    const result = RequestActionSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── DeleteContactSchema ──────────────────────────────────────────────────────

describe('DeleteContactSchema', () => {
  it('accepte un contactId valide', () => {
    const result = DeleteContactSchema.safeParse({ contactId: 'contact-1' });
    expect(result.success).toBe(true);
  });

  it('rejette un contactId vide', () => {
    const result = DeleteContactSchema.safeParse({ contactId: '' });
    expect(result.success).toBe(false);
  });

  it('rejette si contactId est absent', () => {
    const result = DeleteContactSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── UserSearchSchema ─────────────────────────────────────────────────────────

describe('UserSearchSchema', () => {
  it('accepte une requête valide', () => {
    const result = UserSearchSchema.safeParse({ q: 'Alice' });
    expect(result.success).toBe(true);
  });

  it('rejette une requête vide', () => {
    // Un terme de recherche vide ne doit pas être autorisé
    const result = UserSearchSchema.safeParse({ q: '' });
    expect(result.success).toBe(false);
  });

  it('rejette une requête trop longue (> 100 caractères)', () => {
    // Limite de 100 caractères pour éviter les requêtes abusives
    const result = UserSearchSchema.safeParse({ q: 'a'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('accepte une requête à la limite exacte de 100 caractères', () => {
    const result = UserSearchSchema.safeParse({ q: 'a'.repeat(100) });
    expect(result.success).toBe(true);
  });

  it('rejette si q est absent', () => {
    const result = UserSearchSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
