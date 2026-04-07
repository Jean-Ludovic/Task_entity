import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/contacts/service', () => ({
  listContacts: vi.fn(),
  deleteContact: vi.fn()
}));

import { GET, DELETE } from '@/app/api/contacts/route';
import { listContacts, deleteContact } from '@/lib/contacts/service';
import { auth } from '@/lib/auth';

const mockAuth = vi.mocked(auth);
const mockListContacts = vi.mocked(listContacts);
const mockDeleteContact = vi.mocked(deleteContact);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
});

const mockContact = {
  id: 'contact-1',
  userId: 'user-1',
  contactId: 'user-2',
  createdAt: new Date()
};

// ─── GET /api/contacts ────────────────────────────────────────────────────────

describe('GET /api/contacts', () => {
  it('retourne 200 avec la liste des contacts', async () => {
    // Vérifie que le service est appelé avec le bon userId et que la réponse est correcte
    mockListContacts.mockResolvedValue([mockContact] as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(mockListContacts).toHaveBeenCalledWith('user-1');
  });

  it('retourne 401 si non authentifié', async () => {
    // Vérifie que les routes sont protégées par l'authentification
    mockAuth.mockResolvedValue(null as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('retourne 200 avec une liste vide si aucun contact', async () => {
    // Vérifie le cas où l'utilisateur n'a pas encore de contacts
    mockListContacts.mockResolvedValue([] as never);
    const res = await GET();
    const body = await res.json();
    expect(body).toEqual([]);
  });
});

// ─── DELETE /api/contacts ─────────────────────────────────────────────────────

describe('DELETE /api/contacts', () => {
  function makeRequest(body: unknown) {
    return new Request('http://localhost/api/contacts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  it('retourne 204 après suppression réussie', async () => {
    // Vérifie que la suppression d'un contact retourne un 204 No Content
    mockDeleteContact.mockResolvedValue(undefined as never);
    const res = await DELETE(makeRequest({ contactId: 'contact-1' }) as never);
    expect(res.status).toBe(204);
    expect(mockDeleteContact).toHaveBeenCalledWith('contact-1', 'user-1');
  });

  it('retourne 400 si contactId est absent', async () => {
    // Vérifie que la validation Zod rejette un body sans contactId
    const res = await DELETE(makeRequest({}) as never);
    expect(res.status).toBe(400);
    expect(mockDeleteContact).not.toHaveBeenCalled();
  });

  it('retourne 401 si non authentifié', async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await DELETE(makeRequest({ contactId: 'contact-1' }) as never);
    expect(res.status).toBe(401);
  });
});
