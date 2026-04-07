import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/organizations/service', () => ({ acceptOrgInvitation: vi.fn() }));

import { POST } from '@/app/api/organizations/accept/route';
import { acceptOrgInvitation } from '@/lib/organizations/service';
import { auth } from '@/lib/auth';
import { Errors } from '@/lib/errors';

const mockAuth = vi.mocked(auth);
const mockAccept = vi.mocked(acceptOrgInvitation);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
});

// ─── POST /api/organizations/accept ──────────────────────────────────────────

describe('POST /api/organizations/accept', () => {
  function makeRequest(body: unknown) {
    return new Request('http://localhost/api/organizations/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  it('retourne 204 après acceptation de l\'invitation', async () => {
    // Vérifie que l'acceptation d'une invitation retourne 204 No Content
    mockAccept.mockResolvedValue(undefined as never);
    const res = await POST(makeRequest({ invitationId: 'inv-1' }));
    expect(res.status).toBe(204);
    expect(mockAccept).toHaveBeenCalledWith('inv-1', 'user-1');
  });

  it('retourne 400 si invitationId est absent', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect(mockAccept).not.toHaveBeenCalled();
  });

  it('retourne 404 si l\'invitation n\'existe pas', async () => {
    // Vérifie que le NOT_FOUND est bien propagé
    mockAccept.mockRejectedValue(Errors.notFound('Invitation'));
    const res = await POST(makeRequest({ invitationId: 'bad-inv' }));
    expect(res.status).toBe(404);
  });

  it('retourne 401 si non authentifié', async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await POST(makeRequest({ invitationId: 'inv-1' }));
    expect(res.status).toBe(401);
  });
});
