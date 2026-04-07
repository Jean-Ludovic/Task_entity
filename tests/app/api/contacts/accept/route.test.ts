import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/contacts/service', () => ({ acceptContactRequest: vi.fn() }));

import { POST } from '@/app/api/contacts/accept/route';
import { acceptContactRequest } from '@/lib/contacts/service';
import { auth } from '@/lib/auth';

const mockAuth = vi.mocked(auth);
const mockAccept = vi.mocked(acceptContactRequest);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
});

// ─── POST /api/contacts/accept ────────────────────────────────────────────────

describe('POST /api/contacts/accept', () => {
  function makeRequest(body: unknown) {
    return new Request('http://localhost/api/contacts/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  it('retourne 200 après acceptation', async () => {
    // Vérifie que l'acceptation d'une demande retourne les données de la demande mise à jour
    mockAccept.mockResolvedValue({ id: 'req-1', status: 'accepted' } as never);
    const res = await POST(makeRequest({ requestId: 'req-1' }));
    expect(res.status).toBe(200);
    expect(mockAccept).toHaveBeenCalledWith('req-1', 'user-1');
  });

  it('retourne 400 si requestId est absent', async () => {
    // Le body vide doit échouer la validation
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect(mockAccept).not.toHaveBeenCalled();
  });

  it('retourne 401 si non authentifié', async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await POST(makeRequest({ requestId: 'req-1' }));
    expect(res.status).toBe(401);
  });

  it('retourne 500 si le service lève une erreur inattendue', async () => {
    // Vérifie que les erreurs inattendues sont correctement gérées
    mockAccept.mockRejectedValue(new Error('DB error'));
    const res = await POST(makeRequest({ requestId: 'req-1' }));
    expect(res.status).toBe(500);
  });
});
