import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/organizations/service', () => ({ removeMember: vi.fn() }));

import { DELETE } from '@/app/api/organizations/member/route';
import { removeMember } from '@/lib/organizations/service';
import { auth } from '@/lib/auth';
import { Errors } from '@/lib/errors';

const mockAuth = vi.mocked(auth);
const mockRemove = vi.mocked(removeMember);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
});

// ─── DELETE /api/organizations/member ────────────────────────────────────────

describe('DELETE /api/organizations/member', () => {
  function makeRequest(body: unknown) {
    return new Request('http://localhost/api/organizations/member', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  it('retourne 204 après suppression du membre', async () => {
    // Vérifie que la suppression d'un membre retourne 204 No Content
    mockRemove.mockResolvedValue(undefined as never);
    const res = await DELETE(makeRequest({ organizationId: 'org-1', userId: 'user-2' }));
    expect(res.status).toBe(204);
    expect(mockRemove).toHaveBeenCalledWith('org-1', 'user-2', 'user-1');
  });

  it('retourne 400 si organizationId est absent', async () => {
    const res = await DELETE(makeRequest({ userId: 'user-2' }));
    expect(res.status).toBe(400);
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('retourne 400 si userId est absent', async () => {
    const res = await DELETE(makeRequest({ organizationId: 'org-1' }));
    expect(res.status).toBe(400);
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('retourne 403 si l\'utilisateur n\'est pas owner', async () => {
    // Seul le propriétaire peut retirer des membres
    mockRemove.mockRejectedValue(Errors.forbidden());
    const res = await DELETE(makeRequest({ organizationId: 'org-1', userId: 'user-2' }));
    expect(res.status).toBe(403);
  });

  it('retourne 401 si non authentifié', async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await DELETE(makeRequest({ organizationId: 'org-1', userId: 'user-2' }));
    expect(res.status).toBe(401);
  });
});
