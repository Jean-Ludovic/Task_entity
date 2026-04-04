import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/tasks/service', () => ({
  createTask: vi.fn(),
  listTasks: vi.fn()
}));

import { POST, GET } from '@/app/api/tasks/route';
import { createTask, listTasks } from '@/lib/tasks/service';

const mockCreateTask = vi.mocked(createTask);
const mockListTasks = vi.mocked(listTasks);

const now = new Date('2026-01-01T00:00:00.000Z');

const mockTask = {
  id: 'uuid-1',
  title: 'My task',
  description: null,
  status: 'todo' as const,
  dueDate: null,
  createdAt: now,
  updatedAt: now
};

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

function makeGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/tasks');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString(), { method: 'GET' });
}

describe('POST /api/tasks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 201 with the created task', async () => {
    mockCreateTask.mockResolvedValue(mockTask);
    const res = await POST(makePostRequest({ title: 'My task' }) as never);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      id: 'uuid-1',
      title: 'My task',
      status: 'todo',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    });
    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'My task' })
    );
  });

  it('returns 400 when title is missing', async () => {
    const res = await POST(makePostRequest({ description: 'no title' }) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('BAD_REQUEST');
    expect(mockCreateTask).not.toHaveBeenCalled();
  });

  it('returns 500 when service throws unexpectedly', async () => {
    mockCreateTask.mockRejectedValue(new Error('DB connection failed'));
    const res = await POST(makePostRequest({ title: 'Task' }) as never);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});

describe('GET /api/tasks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns paginated tasks', async () => {
    mockListTasks.mockResolvedValue({ tasks: [mockTask], nextCursor: null });
    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tasks).toHaveLength(1);
    expect(body.nextCursor).toBeNull();
  });

  it('passes status filter to service', async () => {
    mockListTasks.mockResolvedValue({ tasks: [], nextCursor: null });
    await GET(makeGetRequest({ status: 'done' }) as never);
    expect(mockListTasks).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'done' })
    );
  });

  it('returns 400 for invalid status filter', async () => {
    const res = await GET(makeGetRequest({ status: 'invalid' }) as never);
    expect(res.status).toBe(400);
  });
});
