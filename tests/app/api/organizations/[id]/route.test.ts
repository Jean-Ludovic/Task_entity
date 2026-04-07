import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/organizations/service', () => ({
  getOrganization: vi.fn(),
  listMembers: vi.fn()
}));

import { GET } from '@/app/api/organizations/[id]/route';
import { getOrganization, listMembers } from '@/lib/organizations/service';
import { auth } from '@/lib/auth';
import { Errors } from '@/lib/errors';

const mockAuth = vi.mocked(auth);
const mockGetOrg = vi.mocked(getOrganization);
const mockListMembers = vi.mocked(listMembers);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
});

const mockOrg = { id: 'org-1', name: 'Acme', ownerId: 'user-1' };
const mockMembers = [{ userId: 'user-1', role: 'owner' }];

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ─── GET /api/organizations/[id] ──────────────────────────────────────────────

describe('GET /api/organizations/[id]', () => {
  it('retourne 200 avec l\'organisation et ses membres', async () => {
    // Vérifie que la route combine les données de l'org et de ses membres en une seule réponse
    mockGetOrg.mockResolvedValue(mockOrg as never);
    mockListMembers.mockResolvedValue(mockMembers as never);

    const res = await GET(new Request('http://localhost') as never, makeContext('org-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('org-1');
    expect(body.members).toHaveLength(1);
  });

  it('retourne 404 si l\'organisation n\'existe pas', async () => {
    // Vérifie que le NOT_FOUND du service est correctement traduit en 404
    mockGetOrg.mockRejectedValue(Errors.notFound('Organization'));
    mockListMembers.mockResolvedValue([] as never);

    const res = await GET(new Request('http://localhost') as never, makeContext('bad-id'));
    expect(res.status).toBe(404);
  });

  it('retourne 401 si non authentifié', async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await GET(new Request('http://localhost') as never, makeContext('org-1'));
    expect(res.status).toBe(401);
  });

  it('appelle getOrganization et listMembers avec les bons arguments', async () => {
    // Vérifie que les deux services sont appelés en parallèle avec les bons paramètres
    mockGetOrg.mockResolvedValue(mockOrg as never);
    mockListMembers.mockResolvedValue(mockMembers as never);

    await GET(new Request('http://localhost') as never, makeContext('org-1'));
    expect(mockGetOrg).toHaveBeenCalledWith('org-1', 'user-1');
    expect(mockListMembers).toHaveBeenCalledWith('org-1', 'user-1');
  });
});
