import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/contacts/service', () => ({ rejectContactRequest: vi.fn() }));

import { POST } from '@/app/api/contacts/reject/route';
import { rejectContactRequest } from '@/lib/contacts/service';
import { auth } from '@/lib/auth';

const mockAuth = vi.mocked(auth);
const mockReject = vi.mocked(rejectContactRequest);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
});

// ─── POST /api/contacts/reject ────────────────────────────────────────────────

describe('POST /api/contacts/reject', () => {
  function makeRequest(body: unknown) {
    return new Request('http://localhost/api/contacts/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  it('retourne 200 après rejet', async () => {
    // Vérifie que le rejet d'une demande retourne les données mises à jour
    mockReject.mockResolvedValue({ id: 'req-1', status: 'rejected' } as never);
    const res = await POST(makeRequest({ requestId: 'req-1' }));
    expect(res.status).toBe(200);
    expect(mockReject).toHaveBeenCalledWith('req-1', 'user-1');
  });

  it('retourne 400 si requestId est absent', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect(mockReject).not.toHaveBeenCalled();
  });

  it('retourne 401 si non authentifié', async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await POST(makeRequest({ requestId: 'req-1' }));
    expect(res.status).toBe(401);
  });
});
