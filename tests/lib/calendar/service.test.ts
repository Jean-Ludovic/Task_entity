import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}));

// On mocke enrichTasks depuis tasks/service pour éviter des appels db supplémentaires
vi.mock('@/lib/tasks/service', () => ({
  enrichTasks: vi.fn()
}));

import { db } from '@/lib/db';
import { enrichTasks } from '@/lib/tasks/service';
import { autoArrangeTasks } from '@/lib/calendar/service';

const mockDb = db as {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const mockEnrichTasks = vi.mocked(enrichTasks);

// Helper : simule db.select().from().where()
function makeSelectChain(data: unknown[]) {
  const where = vi.fn().mockResolvedValue(data);
  const from = vi.fn().mockReturnValue({ where });
  return { from };
}

// Helper : simule db.update().set().where()
function makeUpdateChain() {
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where });
  return { set };
}

// Base d'une tâche déjà planifiée (startAt et endAt renseignés)
const scheduledTask = {
  id: 'task-sched',
  userId: 'user-1',
  title: 'Already scheduled',
  description: null,
  status: 'todo' as const,
  priority: 'medium' as const,
  dueDate: null,
  startAt: new Date('2026-04-07T09:00:00Z'),
  endAt: new Date('2026-04-07T10:00:00Z'),
  organizationId: null,
  assignedToUserId: null,
  assignedByUserId: null,
  createdAt: new Date(),
  updatedAt: new Date()
};

// Base d'une tâche non planifiée (startAt = null)
const unscheduledTask = {
  id: 'task-unsched',
  userId: 'user-1',
  title: 'Needs scheduling',
  description: null,
  status: 'todo' as const,
  priority: 'medium' as const,
  dueDate: null,
  startAt: null,
  endAt: null,
  organizationId: null,
  assignedToUserId: null,
  assignedByUserId: null,
  createdAt: new Date(),
  updatedAt: new Date()
};

// ─── autoArrangeTasks ─────────────────────────────────────────────────────────

describe('autoArrangeTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Par défaut, enrichTasks retourne les tâches telles quelles avec les champs contextuels à null
    mockEnrichTasks.mockImplementation(async (tasks) =>
      tasks.map((t) => ({ ...t, assignedBy: null, assignedTo: null, organization: null }))
    );
  });

  it('ne déclenche aucun update si toutes les tâches ont déjà un startAt', async () => {
    // Vérifie que des tâches déjà planifiées ne sont pas modifiées
    mockDb.select.mockReturnValueOnce(makeSelectChain([scheduledTask]));

    await autoArrangeTasks('user-1');

    // Aucune mise à jour ne doit avoir lieu : tout est déjà planifié
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('assigne un startAt et un endAt à une tâche sans créneau', async () => {
    // Vérifie qu'une tâche avec startAt=null reçoit bien un créneau horaire
    mockDb.select
      .mockReturnValueOnce(makeSelectChain([unscheduledTask]))   // 1ère requête : toutes les tâches
      .mockReturnValueOnce(makeSelectChain([{                     // 2ème requête : refresh après update
        ...unscheduledTask,
        startAt: new Date('2026-04-07T09:00:00Z'),
        endAt: new Date('2026-04-07T10:00:00Z')
      }]));

    const assignedSlot = { startAt: null as Date | null, endAt: null as Date | null };
    mockDb.update.mockImplementation(() => ({
      set: (patch: Record<string, unknown>) => {
        // On capture les valeurs assignées pour vérification
        assignedSlot.startAt = patch.startAt as Date;
        assignedSlot.endAt = patch.endAt as Date;
        return { where: vi.fn().mockResolvedValue(undefined) };
      }
    }));

    await autoArrangeTasks('user-1');

    expect(mockDb.update).toHaveBeenCalledOnce();
    // Le créneau doit avoir une heure de début et une heure de fin
    expect(assignedSlot.startAt).toBeInstanceOf(Date);
    expect(assignedSlot.endAt).toBeInstanceOf(Date);
    // La durée doit être d'exactement 1 heure (3600 secondes)
    expect(
      (assignedSlot.endAt!.getTime() - assignedSlot.startAt!.getTime()) / 1000
    ).toBe(3600);
  });

  it('traite en premier les tâches avec dueDate, planifiées sur leur date d\'échéance', async () => {
    // L'algorithme traite les tâches avec dueDate avant celles sans.
    // La tâche avec dueDate (ex: 10 avril) est planifiée SUR ce jour-là (futur),
    // tandis que la tâche sans dueDate est planifiée à partir de maintenant (aujourd'hui).
    // Donc le premier update (tâche avec dueDate) a un startAt PLUS TARDIF que le second.
    const taskNoDue = { ...unscheduledTask, id: 'no-due', dueDate: null };
    const taskWithDue = {
      ...unscheduledTask,
      id: 'with-due',
      dueDate: new Date('2026-04-10T00:00:00Z')
    };

    // On fournit les tâches dans l'ordre inverse pour s'assurer que le tri est bien fait
    mockDb.select
      .mockReturnValueOnce(makeSelectChain([taskNoDue, taskWithDue]))
      .mockReturnValueOnce(makeSelectChain([]));

    const slots: { start: Date }[] = [];
    mockDb.update.mockImplementation(() => ({
      set: (patch: Record<string, unknown>) => ({
        where: vi.fn().mockImplementation(() => {
          slots.push({ start: patch.startAt as Date });
          return Promise.resolve();
        })
      })
    }));

    await autoArrangeTasks('user-1');

    // Les deux tâches doivent être planifiées (2 updates)
    expect(mockDb.update).toHaveBeenCalledTimes(2);

    // La tâche avec dueDate (futur) est planifiée APRÈS la tâche sans dueDate (planifiée dès maintenant).
    // slots[0] = taskWithDue → planifiée sur sa dueDate (10 avril, dans le futur)
    // slots[1] = taskNoDue  → planifiée à partir de maintenant (aujourd'hui, plus tôt)
    expect(slots[1].start.getTime()).toBeLessThan(slots[0].start.getTime());
  });

  it('n\'assigne pas de créneaux qui se chevauchent pour plusieurs tâches', async () => {
    // Vérifie qu'aucun créneau n'est attribué en double quand plusieurs tâches doivent être planifiées
    const task1 = { ...unscheduledTask, id: 'task-a' };
    const task2 = { ...unscheduledTask, id: 'task-b' };

    mockDb.select
      .mockReturnValueOnce(makeSelectChain([task1, task2]))
      .mockReturnValueOnce(makeSelectChain([]));

    const slots: { start: Date; end: Date }[] = [];
    mockDb.update.mockImplementation(() => ({
      set: (patch: Record<string, unknown>) => ({
        where: vi.fn().mockImplementation(() => {
          // On capture chaque créneau assigné pour vérifier l'absence de chevauchement
          slots.push({ start: patch.startAt as Date, end: patch.endAt as Date });
          return Promise.resolve();
        })
      })
    }));

    await autoArrangeTasks('user-1');

    expect(slots).toHaveLength(2);
    const [s1, s2] = slots;
    // Deux créneaux ne doivent pas se chevaucher : l'un doit finir avant que l'autre commence
    const overlap = s1.start < s2.end && s1.end > s2.start;
    expect(overlap).toBe(false);
  });

  it('respecte le créneau déjà occupé d\'une tâche planifiée', async () => {
    // Vérifie que l'algorithme ne place pas une nouvelle tâche sur un créneau déjà pris
    const newTask = { ...unscheduledTask, id: 'new-task' };

    mockDb.select
      .mockReturnValueOnce(makeSelectChain([scheduledTask, newTask]))
      .mockReturnValueOnce(makeSelectChain([]));

    let assignedStart: Date | null = null;
    mockDb.update.mockImplementation(() => ({
      set: (patch: Record<string, unknown>) => ({
        where: vi.fn().mockImplementation(() => {
          assignedStart = patch.startAt as Date;
          return Promise.resolve();
        })
      })
    }));

    await autoArrangeTasks('user-1');

    expect(mockDb.update).toHaveBeenCalledOnce();
    // Le nouveau créneau ne doit pas chevaucher le créneau existant (9h–10h)
    const existingEnd = new Date('2026-04-07T10:00:00Z');
    const existingStart = new Date('2026-04-07T09:00:00Z');
    const newEnd = new Date(assignedStart!.getTime() + 3600_000);
    const overlap = assignedStart! < existingEnd && newEnd > existingStart;
    expect(overlap).toBe(false);
  });
});
