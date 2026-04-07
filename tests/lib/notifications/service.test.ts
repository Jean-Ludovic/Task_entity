import { describe, it, expect, vi, beforeEach } from 'vitest';

// On neutralise le module server-only pour pouvoir importer le service dans un contexte de test Node.js
vi.mock('server-only', () => ({}));

// On remplace le client de base de données par des fonctions espion (vi.fn())
// pour isoler le service et ne pas toucher à la vraie BDD.
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}));

import { db } from '@/lib/db';
import {
  createNotification,
  listNotifications,
  markAsRead,
  markAllAsRead
} from '@/lib/notifications/service';

const mockDb = db as {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

// Notification fictive réutilisée dans les tests
const mockNotification = {
  id: 'notif-1',
  userId: 'user-1',
  type: 'task_assigned' as const,
  title: 'Task assigned to you',
  message: 'Alice assigned you "Fix bug".',
  relatedEntityType: 'task',
  relatedEntityId: 'task-1',
  isRead: false,
  createdAt: new Date('2026-01-01T10:00:00Z')
};

// Helper : simule la chaîne db.select().from().where()
function makeSelectWhere(data: unknown[]) {
  const where = vi.fn().mockResolvedValue(data);
  const from = vi.fn().mockReturnValue({ where });
  return { from };
}

// ─── createNotification ───────────────────────────────────────────────────────

describe('createNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // createNotification fait db.insert().values() sans .returning()
    const values = vi.fn().mockResolvedValue(undefined);
    mockDb.insert.mockReturnValue({ values });
  });

  it('insère une notification avec les champs obligatoires corrects', async () => {
    // Vérifie que db.insert est appelé une seule fois et que les données envoyées sont exactes
    await createNotification({
      userId: 'user-1',
      type: 'task_assigned',
      title: 'Task assigned',
      message: 'You have a new task.'
    });

    expect(mockDb.insert).toHaveBeenCalledOnce();
    const valuesFn = mockDb.insert.mock.results[0].value.values;
    expect(valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'task_assigned',
        title: 'Task assigned',
        message: 'You have a new task.'
      })
    );
  });

  it('transmet relatedEntityType et relatedEntityId quand ils sont fournis', async () => {
    // Vérifie que les champs de relation optionnels sont bien propagés à la BDD
    await createNotification({
      userId: 'user-1',
      type: 'task_assigned',
      title: 'T',
      message: 'M',
      relatedEntityType: 'task',
      relatedEntityId: 'task-99'
    });

    const valuesFn = mockDb.insert.mock.results[0].value.values;
    expect(valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        relatedEntityType: 'task',
        relatedEntityId: 'task-99'
      })
    );
  });

  it('met relatedEntityType et relatedEntityId à null quand ils sont omis', async () => {
    // Vérifie que les champs optionnels valent null par défaut (pas undefined)
    await createNotification({
      userId: 'user-1',
      type: 'contact_invitation_received',
      title: 'T',
      message: 'M'
    });

    const valuesFn = mockDb.insert.mock.results[0].value.values;
    expect(valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        relatedEntityType: null,
        relatedEntityId: null
      })
    );
  });
});

// ─── listNotifications ────────────────────────────────────────────────────────

describe('listNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // listNotifications fait db.select().from().where().orderBy().limit()
    const limit = vi.fn().mockResolvedValue([mockNotification]);
    const orderBy = vi.fn().mockReturnValue({ limit });
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    mockDb.select.mockReturnValue({ from });
  });

  it('retourne la liste des notifications pour un utilisateur', async () => {
    // Vérifie le cas nominal : une notification est bien retournée
    const result = await listNotifications('user-1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('notif-1');
  });

  it('retourne un tableau vide si l\'utilisateur n\'a aucune notification', async () => {
    // Vérifie que la fonction gère proprement le cas sans données
    const limit = vi.fn().mockResolvedValue([]);
    const orderBy = vi.fn().mockReturnValue({ limit });
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    mockDb.select.mockReturnValue({ from });

    const result = await listNotifications('user-1');
    expect(result).toHaveLength(0);
  });
});

// ─── markAsRead ───────────────────────────────────────────────────────────────

describe('markAsRead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // markAsRead fait db.update().set({ isRead: true }).where(and(id, userId))
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    mockDb.update.mockReturnValue({ set });
  });

  it('appelle update avec isRead: true', async () => {
    // Vérifie que le champ isRead est bien passé à true lors du marquage
    await markAsRead('notif-1', 'user-1');

    expect(mockDb.update).toHaveBeenCalledOnce();
    const setFn = mockDb.update.mock.results[0].value.set;
    expect(setFn).toHaveBeenCalledWith({ isRead: true });
  });

  it('appelle bien update (et non insert ou delete)', async () => {
    // Vérifie qu'on met à jour et qu'on ne crée ni ne supprime de ligne
    await markAsRead('notif-1', 'user-1');
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.delete).not.toHaveBeenCalled();
  });
});

// ─── markAllAsRead ────────────────────────────────────────────────────────────

describe('markAllAsRead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // markAllAsRead fait db.update().set({ isRead: true }).where(userId AND isRead=false)
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    mockDb.update.mockReturnValue({ set });
  });

  it('appelle update avec isRead: true pour toutes les notifications de l\'utilisateur', async () => {
    // Vérifie que toutes les notifications non lues sont marquées comme lues
    await markAllAsRead('user-1');

    expect(mockDb.update).toHaveBeenCalledOnce();
    const setFn = mockDb.update.mock.results[0].value.set;
    expect(setFn).toHaveBeenCalledWith({ isRead: true });
  });

  it('ne fait qu\'un seul appel update (pas un par notification)', async () => {
    // Vérifie que markAllAsRead est une opération bulk (une seule requête SQL)
    await markAllAsRead('user-1');
    expect(mockDb.update).toHaveBeenCalledOnce();
  });
});
