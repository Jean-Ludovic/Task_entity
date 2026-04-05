import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn()
}));

vi.mock('@/lib/notifications/service', () => ({
  markAllAsRead: vi.fn()
}));

import { POST } from '@/app/api/notifications/read-all/route';
import { auth } from '@/lib/auth';
import { markAllAsRead } from '@/lib/notifications/service';

const mockAuth = vi.mocked(auth);
const mockMarkAllAsRead = vi.mocked(markAllAsRead);

// ─── POST /api/notifications/read-all ─────────────────────────────────────────

describe('POST /api/notifications/read-all', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retourne 401 si l\'utilisateur n\'est pas connecté', async () => {
    // Vérifie que la route est protégée : impossible de marquer tout comme lu sans être authentifié
    mockAuth.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
    expect(mockMarkAllAsRead).not.toHaveBeenCalled();
  });

  it('retourne 200 et appelle markAllAsRead avec le userId de la session', async () => {
    // Vérifie le cas nominal : toutes les notifications de l'utilisateur sont marquées comme lues
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    mockMarkAllAsRead.mockResolvedValue(undefined);

    const res = await POST();
    expect(res.status).toBe(200);

    // Le service doit être appelé avec uniquement le userId de la session courante
    expect(mockMarkAllAsRead).toHaveBeenCalledWith('user-1');

    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('ne marque pas les notifications d\'un autre utilisateur', async () => {
    // Vérifie que l'opération est bien scopée au userId de la session, pas à tous les users
    mockAuth.mockResolvedValue({ user: { id: 'user-A' } } as never);
    mockMarkAllAsRead.mockResolvedValue(undefined);

    await POST();
    expect(mockMarkAllAsRead).not.toHaveBeenCalledWith('user-B');
    expect(mockMarkAllAsRead).toHaveBeenCalledWith('user-A');
  });
});
