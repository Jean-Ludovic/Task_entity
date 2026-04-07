import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/organizations/service', () => ({
  createOrganization: vi.fn(),
  listOrganizations: vi.fn()
}));

import { GET, POST } from '@/app/api/organizations/route';
import { createOrganization, listOrganizations } from '@/lib/organizations/service';
import { auth } from '@/lib/auth';

const mockAuth = vi.mocked(auth);
const mockCreate = vi.mocked(createOrganization);
const mockList = vi.mocked(listOrganizations);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
});

const mockOrg = {
  id: 'org-1',
  name: 'Acme',
  description: null,
  ownerId: 'user-1',
  createdAt: new Date()
};

// ─── GET /api/organizations ───────────────────────────────────────────────────

describe('GET /api/organizations', () => {
  it('retourne 200 avec la liste des organisations', async () => {
    // Vérifie que la route retourne les organisations de l'utilisateur
    mockList.mockResolvedValue([mockOrg] as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(mockList).toHaveBeenCalledWith('user-1');
  });

  it('retourne 200 avec liste vide si aucune organisation', async () => {
    mockList.mockResolvedValue([] as never);
    const res = await GET();
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('retourne 401 si non authentifié', async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/organizations ──────────────────────────────────────────────────

describe('POST /api/organizations', () => {
  function makeRequest(body: unknown) {
    return new Request('http://localhost/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  it('retourne 201 avec l\'organisation créée', async () => {
    // Vérifie que la création d'une organisation retourne les données et le statut 201
    mockCreate.mockResolvedValue(mockOrg as never);
    const res = await POST(makeRequest({ name: 'Acme' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('Acme');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Acme' }),
      'user-1'
    );
  });

  it('retourne 400 si le nom est absent', async () => {
    // Vérifie que la validation Zod bloque un body sans champ name
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('retourne 400 si le nom est une chaîne vide', async () => {
    const res = await POST(makeRequest({ name: '' }));
    expect(res.status).toBe(400);
  });

  it('retourne 401 si non authentifié', async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await POST(makeRequest({ name: 'Acme' }));
    expect(res.status).toBe(401);
  });

  it('accepte une description optionnelle', async () => {
    // Vérifie que le champ description facultatif est correctement transmis au service
    mockCreate.mockResolvedValue({ ...mockOrg, description: 'A company' } as never);
    const res = await POST(makeRequest({ name: 'Acme', description: 'A company' }));
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'A company' }),
      'user-1'
    );
  });
});
