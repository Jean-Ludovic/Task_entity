import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn()
}));

vi.mock('@/lib/notifications/service', () => ({
  markAsRead: vi.fn()
}));

import { POST } from '@/app/api/notifications/read/route';
import { auth } from '@/lib/auth';
import { markAsRead } from '@/lib/notifications/service';

const mockAuth = vi.mocked(auth);
const mockMarkAsRead = vi.mocked(markAsRead);

// Helper : crée une Request POST avec le body JSON donné
function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/notifications/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

// ─── POST /api/notifications/read ─────────────────────────────────────────────

describe('POST /api/notifications/read', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retourne 401 si l\'utilisateur n\'est pas connecté', async () => {
    // Vérifie que la route est protégée par l'authentification
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ id: 'notif-1' }) as never);
    expect(res.status).toBe(401);
    expect(mockMarkAsRead).not.toHaveBeenCalled();
  });

  it('retourne 400 si le champ id est absent du body', async () => {
    // Vérifie que la validation du body rejette les requêtes sans id
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    const res = await POST(makeRequest({}) as never);
    expect(res.status).toBe(400);
    expect(mockMarkAsRead).not.toHaveBeenCalled();
  });

  it('retourne 200 et appelle markAsRead avec les bons arguments', async () => {
    // Vérifie le cas nominal : notification marquée comme lue avec notifId + userId
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    mockMarkAsRead.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ id: 'notif-1' }) as never);
    expect(res.status).toBe(200);

    // Le service doit être appelé avec l'id de la notification ET l'userId de la session
    expect(mockMarkAsRead).toHaveBeenCalledWith('notif-1', 'user-1');

    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
