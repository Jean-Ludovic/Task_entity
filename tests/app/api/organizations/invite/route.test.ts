import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/organizations/service', () => ({ inviteMember: vi.fn() }));

import { POST } from '@/app/api/organizations/invite/route';
import { inviteMember } from '@/lib/organizations/service';
import { auth } from '@/lib/auth';
import { Errors } from '@/lib/errors';

const mockAuth = vi.mocked(auth);
const mockInvite = vi.mocked(inviteMember);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
});

// ─── POST /api/organizations/invite ──────────────────────────────────────────

describe('POST /api/organizations/invite', () => {
  function makeRequest(body: unknown) {
    return new Request('http://localhost/api/organizations/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  it('retourne 201 après invitation réussie', async () => {
    // Vérifie que l'invitation d'un membre retourne 201
    mockInvite.mockResolvedValue({ id: 'inv-1' } as never);
    const res = await POST(makeRequest({ organizationId: 'org-1', receiverId: 'user-2' }));
    expect(res.status).toBe(201);
    expect(mockInvite).toHaveBeenCalledWith('org-1', 'user-1', 'user-2');
  });

  it('retourne 400 si organizationId est absent', async () => {
    const res = await POST(makeRequest({ receiverId: 'user-2' }));
    expect(res.status).toBe(400);
    expect(mockInvite).not.toHaveBeenCalled();
  });

  it('retourne 400 si receiverId est absent', async () => {
    const res = await POST(makeRequest({ organizationId: 'org-1' }));
    expect(res.status).toBe(400);
    expect(mockInvite).not.toHaveBeenCalled();
  });

  it('retourne 403 si l\'utilisateur n\'est pas owner de l\'org', async () => {
    // Vérifie que seul le propriétaire peut inviter des membres
    mockInvite.mockRejectedValue(Errors.forbidden());
    const res = await POST(makeRequest({ organizationId: 'org-1', receiverId: 'user-2' }));
    expect(res.status).toBe(403);
  });

  it('retourne 401 si non authentifié', async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await POST(makeRequest({ organizationId: 'org-1', receiverId: 'user-2' }));
    expect(res.status).toBe(401);
  });
});
