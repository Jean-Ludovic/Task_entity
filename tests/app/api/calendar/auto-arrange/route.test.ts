import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn()
}));

// On mocke le service calendrier pour tester uniquement la route
vi.mock('@/lib/calendar/service', () => ({
  autoArrangeTasks: vi.fn()
}));

import { POST } from '@/app/api/calendar/auto-arrange/route';
import { auth } from '@/lib/auth';
import { autoArrangeTasks } from '@/lib/calendar/service';

const mockAuth = vi.mocked(auth);
const mockAutoArrangeTasks = vi.mocked(autoArrangeTasks);

// Tâche fictive après arrangement automatique
const mockArrangedTask = {
  id: 'task-1',
  userId: 'user-1',
  title: 'Fix bug',
  description: null,
  status: 'todo' as const,
  priority: 'medium' as const,
  dueDate: null,
  startAt: new Date('2026-04-07T09:00:00Z'),
  endAt: new Date('2026-04-07T10:00:00Z'),
  organizationId: null,
  assignedToUserId: null,
  assignedByUserId: null,
  assignedBy: null,
  assignedTo: null,
  organization: null,
  createdAt: new Date(),
  updatedAt: new Date()
};

// ─── POST /api/calendar/auto-arrange ─────────────────────────────────────────

describe('POST /api/calendar/auto-arrange', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retourne 401 si l\'utilisateur n\'est pas connecté', async () => {
    // Vérifie que la route exige une session valide avant d'arranger les tâches
    mockAuth.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
    expect(mockAutoArrangeTasks).not.toHaveBeenCalled();
  });

  it('retourne 200 avec les tâches arrangées si connecté', async () => {
    // Vérifie le cas nominal : les tâches sont retournées après arrangement
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    mockAutoArrangeTasks.mockResolvedValue([mockArrangedTask]);

    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('task-1');
  });

  it('retourne un tableau vide s\'il n\'y a aucune tâche', async () => {
    // Vérifie que la route renvoie [] correctement quand l'utilisateur n'a pas de tâches
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    mockAutoArrangeTasks.mockResolvedValue([]);

    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('appelle autoArrangeTasks avec le userId de la session', async () => {
    // Vérifie que le bon userId est passé au service (et non un userId en dur)
    mockAuth.mockResolvedValue({ user: { id: 'user-99' } } as never);
    mockAutoArrangeTasks.mockResolvedValue([]);

    await POST();
    expect(mockAutoArrangeTasks).toHaveBeenCalledWith('user-99');
  });
});
