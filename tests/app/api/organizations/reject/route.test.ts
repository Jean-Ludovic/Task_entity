import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/organizations/service', () => ({ rejectOrgInvitation: vi.fn() }));

import { POST } from '@/app/api/organizations/reject/route';
import { rejectOrgInvitation } from '@/lib/organizations/service';
import { auth } from '@/lib/auth';
import { Errors } from '@/lib/errors';

const mockAuth = vi.mocked(auth);
const mockReject = vi.mocked(rejectOrgInvitation);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
});

// ─── POST /api/organizations/reject ──────────────────────────────────────────

describe('POST /api/organizations/reject', () => {
  function makeRequest(body: unknown) {
    return new Request('http://localhost/api/organizations/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  it('retourne 204 après rejet de l\'invitation', async () => {
    // Vérifie que le rejet d'une invitation retourne 204 No Content
    mockReject.mockResolvedValue(undefined as never);
    const res = await POST(makeRequest({ invitationId: 'inv-1' }));
    expect(res.status).toBe(204);
    expect(mockReject).toHaveBeenCalledWith('inv-1', 'user-1');
  });

  it('retourne 400 si invitationId est absent', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect(mockReject).not.toHaveBeenCalled();
  });

  it('retourne 404 si l\'invitation n\'existe pas', async () => {
    mockReject.mockRejectedValue(Errors.notFound('Invitation'));
    const res = await POST(makeRequest({ invitationId: 'bad-inv' }));
    expect(res.status).toBe(404);
  });

  it('retourne 401 si non authentifié', async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await POST(makeRequest({ invitationId: 'inv-1' }));
    expect(res.status).toBe(401);
  });
});
