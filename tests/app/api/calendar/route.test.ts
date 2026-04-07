import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/tasks/service', () => ({
  listCalendarTasks: vi.fn(),
  createTask: vi.fn()
}));

import { GET, POST } from '@/app/api/calendar/route';
import { listCalendarTasks, createTask } from '@/lib/tasks/service';
import { auth } from '@/lib/auth';

const mockAuth = vi.mocked(auth);
const mockListCalendar = vi.mocked(listCalendarTasks);
const mockCreateTask = vi.mocked(createTask);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
});

const FROM = '2026-04-07T00:00:00.000Z';
const TO = '2026-04-13T23:59:59.000Z';

const mockTask = {
  id: 'task-1',
  title: 'Calendar task',
  status: 'todo',
  priority: 'medium',
  startAt: new Date(FROM),
  endAt: null,
  userId: 'user-1',
  assignedBy: null,
  assignedTo: null,
  organization: null
};

function makeGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/calendar');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString(), { method: 'GET' });
}

// ─── GET /api/calendar ────────────────────────────────────────────────────────

describe('GET /api/calendar', () => {
  it('retourne 200 avec les tâches de la plage de dates', async () => {
    // Vérifie que la route retourne les tâches entre from et to
    mockListCalendar.mockResolvedValue([mockTask] as never);
    const res = await GET(makeGetRequest({ from: FROM, to: TO }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(mockListCalendar).toHaveBeenCalledWith(
      'user-1',
      new Date(FROM),
      new Date(TO)
    );
  });

  it('retourne 400 si from est absent', async () => {
    // Vérifie que la validation Zod rejette les requêtes sans les deux paramètres de date
    const res = await GET(makeGetRequest({ to: TO }) as never);
    expect(res.status).toBe(400);
    expect(mockListCalendar).not.toHaveBeenCalled();
  });

  it('retourne 400 si to est absent', async () => {
    const res = await GET(makeGetRequest({ from: FROM }) as never);
    expect(res.status).toBe(400);
  });

  it('retourne 400 si les dates ne sont pas au format ISO', async () => {
    // Les dates invalides doivent échouer la validation datetime
    const res = await GET(makeGetRequest({ from: 'not-a-date', to: TO }) as never);
    expect(res.status).toBe(400);
  });

  it('retourne 200 avec une liste vide si aucune tâche dans la plage', async () => {
    mockListCalendar.mockResolvedValue([] as never);
    const res = await GET(makeGetRequest({ from: FROM, to: TO }) as never);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('retourne 401 si non authentifié', async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await GET(makeGetRequest({ from: FROM, to: TO }) as never);
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/calendar ───────────────────────────────────────────────────────

describe('POST /api/calendar', () => {
  function makePostRequest(body: unknown) {
    return new Request('http://localhost/api/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  it('retourne 201 avec la tâche créée', async () => {
    // Vérifie que la création d'une tâche via le calendrier retourne 201
    mockCreateTask.mockResolvedValue(mockTask as never);
    const res = await POST(makePostRequest({ title: 'Calendar task' }));
    expect(res.status).toBe(201);
    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Calendar task' }),
      'user-1'
    );
  });

  it('retourne 400 si le titre est absent', async () => {
    // La validation Zod doit bloquer les créations sans titre
    const res = await POST(makePostRequest({}));
    expect(res.status).toBe(400);
    expect(mockCreateTask).not.toHaveBeenCalled();
  });

  it('retourne 401 si non authentifié', async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await POST(makePostRequest({ title: 'Task' }));
    expect(res.status).toBe(401);
  });
});
