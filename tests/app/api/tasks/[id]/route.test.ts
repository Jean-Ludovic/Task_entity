import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/tasks/service', () => ({
  getTaskById: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn()
}));

import { GET, PUT, DELETE } from '@/app/api/tasks/[id]/route';
import { getTaskById, updateTask, deleteTask } from '@/lib/tasks/service';
import { Errors } from '@/lib/errors';

const mockGetTaskById = vi.mocked(getTaskById);
const mockUpdateTask = vi.mocked(updateTask);
const mockDeleteTask = vi.mocked(deleteTask);

const mockTask = {
  id: 'uuid-1',
  title: 'Test task',
  description: null,
  status: 'todo' as const,
  dueDate: null,
  createdAt: new Date(),
  updatedAt: new Date()
};

function makeRequest(method: string, body?: unknown): Request {
  return new Request('http://localhost/api/tasks/uuid-1', {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
}

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/tasks/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with the task', async () => {
    mockGetTaskById.mockResolvedValue(mockTask);
    const res = await GET(makeRequest('GET') as never, makeContext('uuid-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('uuid-1');
  });

  it('returns 404 when task does not exist', async () => {
    mockGetTaskById.mockRejectedValue(Errors.notFound('Task'));
    const res = await GET(makeRequest('GET') as never, makeContext('bad-id'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

describe('PUT /api/tasks/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with the updated task', async () => {
    const updated = { ...mockTask, status: 'done' as const };
    mockUpdateTask.mockResolvedValue(updated);
    const res = await PUT(makeRequest('PUT', { status: 'done' }) as never, makeContext('uuid-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('done');
  });

  it('returns 400 when body is invalid', async () => {
    const res = await PUT(makeRequest('PUT', { status: 'invalid_status' }) as never, makeContext('uuid-1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('BAD_REQUEST');
    expect(mockUpdateTask).not.toHaveBeenCalled();
  });

  it('returns 404 when task does not exist', async () => {
    mockUpdateTask.mockRejectedValue(Errors.notFound('Task'));
    const res = await PUT(makeRequest('PUT', { title: 'X' }) as never, makeContext('bad-id'));
    expect(res.status).toBe(404);
  });

  it('accepts a partial update', async () => {
    mockUpdateTask.mockResolvedValue(mockTask);
    const res = await PUT(makeRequest('PUT', { status: 'in_progress' }) as never, makeContext('uuid-1'));
    expect(res.status).toBe(200);
    expect(mockUpdateTask).toHaveBeenCalledWith(
      'uuid-1',
      expect.objectContaining({ status: 'in_progress' })
    );
  });
});

describe('DELETE /api/tasks/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 204 on successful delete', async () => {
    mockDeleteTask.mockResolvedValue(undefined);
    const res = await DELETE(makeRequest('DELETE') as never, makeContext('uuid-1'));
    expect(res.status).toBe(204);
  });

  it('returns 404 when task does not exist', async () => {
    mockDeleteTask.mockRejectedValue(Errors.notFound('Task'));
    const res = await DELETE(makeRequest('DELETE') as never, makeContext('bad-id'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 500 on unexpected error', async () => {
    mockDeleteTask.mockRejectedValue(new Error('DB down'));
    const res = await DELETE(makeRequest('DELETE') as never, makeContext('uuid-1'));
    expect(res.status).toBe(500);
  });
});
