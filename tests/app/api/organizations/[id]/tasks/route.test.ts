import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/tasks/service', () => ({
  listOrgTasks: vi.fn(),
  createOrgTask: vi.fn()
}));

import { GET, POST } from '@/app/api/organizations/[id]/tasks/route';
import { listOrgTasks, createOrgTask } from '@/lib/tasks/service';
import { auth } from '@/lib/auth';
import { Errors } from '@/lib/errors';

const mockAuth = vi.mocked(auth);
const mockListOrgTasks = vi.mocked(listOrgTasks);
const mockCreateOrgTask = vi.mocked(createOrgTask);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
});

const mockTask = {
  id: 'task-1',
  title: 'Org task',
  status: 'todo',
  priority: 'medium',
  organizationId: 'org-1',
  userId: 'user-1',
  assignedBy: null,
  assignedTo: null,
  organization: { id: 'org-1', name: 'Acme' }
};

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ─── GET /api/organizations/[id]/tasks ────────────────────────────────────────

describe('GET /api/organizations/[id]/tasks', () => {
  it('retourne 200 avec les tâches de l\'organisation', async () => {
    // Vérifie que les tâches de l'org sont bien retournées pour un membre autorisé
    mockListOrgTasks.mockResolvedValue([mockTask] as never);
    const res = await GET(new Request('http://localhost') as never, makeContext('org-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(mockListOrgTasks).toHaveBeenCalledWith('org-1', 'user-1');
  });

  it('retourne 403 si l\'utilisateur n\'est pas membre de l\'org', async () => {
    // Vérifie que le FORBIDDEN du service est traduit en 403
    mockListOrgTasks.mockRejectedValue(Errors.forbidden());
    const res = await GET(new Request('http://localhost') as never, makeContext('org-1'));
    expect(res.status).toBe(403);
  });

  it('retourne 401 si non authentifié', async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await GET(new Request('http://localhost') as never, makeContext('org-1'));
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/organizations/[id]/tasks ───────────────────────────────────────

describe('POST /api/organizations/[id]/tasks', () => {
  function makeRequest(body: unknown) {
    return new Request('http://localhost/api/organizations/org-1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  it('retourne 201 avec la tâche créée dans l\'organisation', async () => {
    // Vérifie que la création d'une tâche org retourne 201 et les données correctes
    mockCreateOrgTask.mockResolvedValue(mockTask as never);
    const res = await POST(makeRequest({ title: 'Org task' }) as never, makeContext('org-1'));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.organizationId).toBe('org-1');
    expect(mockCreateOrgTask).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({ title: 'Org task' }),
      'user-1'
    );
  });

  it('retourne 400 si le titre est absent', async () => {
    // Vérifie que la validation Zod bloque un body sans titre
    const res = await POST(makeRequest({}) as never, makeContext('org-1'));
    expect(res.status).toBe(400);
    expect(mockCreateOrgTask).not.toHaveBeenCalled();
  });

  it('retourne 401 si non authentifié', async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await POST(makeRequest({ title: 'Task' }) as never, makeContext('org-1'));
    expect(res.status).toBe(401);
  });
});
