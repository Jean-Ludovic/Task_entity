import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

// On mocke le module d'authentification pour contrôler la session dans chaque test
vi.mock('@/lib/auth', () => ({
  auth: vi.fn()
}));

// On mocke le service de notifications pour isoler la route de la logique métier
vi.mock('@/lib/notifications/service', () => ({
  listNotifications: vi.fn()
}));

import { GET } from '@/app/api/notifications/route';
import { auth } from '@/lib/auth';
import { listNotifications } from '@/lib/notifications/service';

const mockAuth = vi.mocked(auth);
const mockListNotifications = vi.mocked(listNotifications);

// Notification fictive pour les tests
const mockNotification = {
  id: 'notif-1',
  userId: 'user-1',
  type: 'task_assigned' as const,
  title: 'Task assigned',
  message: 'You have a task.',
  relatedEntityType: null,
  relatedEntityId: null,
  isRead: false,
  createdAt: new Date('2026-01-01T10:00:00Z')
};

// ─── GET /api/notifications ───────────────────────────────────────────────────

describe('GET /api/notifications', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retourne 401 si l\'utilisateur n\'est pas connecté', async () => {
    // Vérifie que la route est protégée : sans session, on reçoit une 401
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('retourne 200 avec la liste des notifications si connecté', async () => {
    // Vérifie le cas nominal : utilisateur authentifié, notifications disponibles
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    mockListNotifications.mockResolvedValue([mockNotification]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('notif-1');
  });

  it('retourne un tableau vide si l\'utilisateur n\'a aucune notification', async () => {
    // Vérifie que la route renvoie [] et non une erreur quand il n'y a rien
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    mockListNotifications.mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('appelle listNotifications avec le userId de la session', async () => {
    // Vérifie que le bon userId est transmis au service (pas un userId en dur)
    mockAuth.mockResolvedValue({ user: { id: 'user-42' } } as never);
    mockListNotifications.mockResolvedValue([]);

    await GET();
    expect(mockListNotifications).toHaveBeenCalledWith('user-42');
  });
});
