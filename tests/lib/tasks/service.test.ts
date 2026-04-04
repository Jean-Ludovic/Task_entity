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

import { db } from '@/lib/db';
import {
  createTask,
  getTaskById,
  updateTask,
  deleteTask,
  listTasks
} from '@/lib/tasks/service';
import { AppError } from '@/lib/errors';

const mockDb = db as {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const mockTask = {
  id: 'uuid-1',
  title: 'Test task',
  description: null,
  status: 'todo' as const,
  dueDate: null,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z')
};

// ─── createTask ───────────────────────────────────────────────────────────────

describe('createTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const returning = vi.fn().mockResolvedValue([mockTask]);
    const values = vi.fn().mockReturnValue({ returning });
    mockDb.insert.mockReturnValue({ values });
  });

  it('inserts a task and returns it', async () => {
    const result = await createTask({ title: 'Test task', status: 'todo' });
    expect(mockDb.insert).toHaveBeenCalledOnce();
    expect(result).toEqual(mockTask);
  });

  it('maps dueDate string to a Date object', async () => {
    await createTask({ title: 'T', dueDate: '2025-06-01T12:00:00.000Z' });
    const values = mockDb.insert.mock.results[0].value.values;
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ dueDate: new Date('2025-06-01T12:00:00.000Z') })
    );
  });

  it('sets description to null when omitted', async () => {
    await createTask({ title: 'T' });
    const values = mockDb.insert.mock.results[0].value.values;
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ description: null })
    );
  });

  it('defaults status to todo when not provided', async () => {
    await createTask({ title: 'T' });
    const values = mockDb.insert.mock.results[0].value.values;
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'todo' })
    );
  });
});

// ─── getTaskById ──────────────────────────────────────────────────────────────

describe('getTaskById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const where = vi.fn().mockResolvedValue([mockTask]);
    const from = vi.fn().mockReturnValue({ where });
    mockDb.select.mockReturnValue({ from });
  });

  it('returns the task when found', async () => {
    const result = await getTaskById('uuid-1');
    expect(result).toEqual(mockTask);
  });

  it('throws NOT_FOUND when task does not exist', async () => {
    const where = vi.fn().mockResolvedValue([]);
    const from = vi.fn().mockReturnValue({ where });
    mockDb.select.mockReturnValue({ from });

    await expect(getTaskById('missing-id')).rejects.toBeInstanceOf(AppError);
    await expect(getTaskById('missing-id')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404
    });
  });
});

// ─── updateTask ───────────────────────────────────────────────────────────────

describe('updateTask', () => {
  const updatedTask = { ...mockTask, title: 'Updated', status: 'done' as const };

  beforeEach(() => {
    vi.clearAllMocks();

    // getTaskById chain
    const where = vi.fn().mockResolvedValue([mockTask]);
    const from = vi.fn().mockReturnValue({ where });
    mockDb.select.mockReturnValue({ from });

    // update chain
    const returning = vi.fn().mockResolvedValue([updatedTask]);
    const updateWhere = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where: updateWhere });
    mockDb.update.mockReturnValue({ set });
  });

  it('returns the updated task', async () => {
    const result = await updateTask('uuid-1', { title: 'Updated', status: 'done' });
    expect(result).toEqual(updatedTask);
  });

  it('always sets updatedAt', async () => {
    await updateTask('uuid-1', { title: 'New title' });
    const set = mockDb.update.mock.results[0].value.set;
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ updatedAt: expect.any(Date) })
    );
  });

  it('throws NOT_FOUND if task does not exist', async () => {
    const where = vi.fn().mockResolvedValue([]);
    const from = vi.fn().mockReturnValue({ where });
    mockDb.select.mockReturnValue({ from });

    await expect(updateTask('bad-id', { title: 'X' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404
    });
  });
});

// ─── deleteTask ───────────────────────────────────────────────────────────────

describe('deleteTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const where = vi.fn().mockResolvedValue([mockTask]);
    const from = vi.fn().mockReturnValue({ where });
    mockDb.select.mockReturnValue({ from });

    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    mockDb.delete.mockReturnValue({ where: deleteWhere });
  });

  it('calls delete with the correct id', async () => {
    await deleteTask('uuid-1');
    expect(mockDb.delete).toHaveBeenCalledOnce();
  });

  it('throws NOT_FOUND if task does not exist', async () => {
    const where = vi.fn().mockResolvedValue([]);
    const from = vi.fn().mockReturnValue({ where });
    mockDb.select.mockReturnValue({ from });

    await expect(deleteTask('bad-id')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

// ─── listTasks ────────────────────────────────────────────────────────────────

describe('listTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const limit = vi.fn().mockResolvedValue([mockTask]);
    const orderBy = vi.fn().mockReturnValue({ limit });
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    mockDb.select.mockReturnValue({ from });
  });

  it('returns tasks and null nextCursor when no next page', async () => {
    const result = await listTasks({ sort: 'createdAt', order: 'desc', limit: 20 });
    expect(result.tasks).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it('returns a nextCursor when there are more results', async () => {
    const extra = { ...mockTask, id: 'uuid-2' };
    const limit = vi.fn().mockResolvedValue([mockTask, extra]);
    const orderBy = vi.fn().mockReturnValue({ limit });
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    mockDb.select.mockReturnValue({ from });

    const result = await listTasks({ sort: 'createdAt', order: 'desc', limit: 1 });
    expect(result.tasks).toHaveLength(1);
    expect(result.nextCursor).not.toBeNull();
    expect(typeof result.nextCursor).toBe('string');
  });

  it('throws BAD_REQUEST for an invalid cursor', async () => {
    await expect(
      listTasks({ sort: 'createdAt', order: 'desc', limit: 20, cursor: '!!!invalid!!!' })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('the cursor returned can be decoded as valid JSON', async () => {
    const extra = { ...mockTask, id: 'uuid-2' };
    const limit = vi.fn().mockResolvedValue([mockTask, extra]);
    const orderBy = vi.fn().mockReturnValue({ limit });
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    mockDb.select.mockReturnValue({ from });

    const { nextCursor } = await listTasks({ sort: 'createdAt', order: 'desc', limit: 1 });
    const decoded = JSON.parse(Buffer.from(nextCursor!, 'base64url').toString('utf-8'));
    expect(decoded).toHaveProperty('id');
    expect(decoded).toHaveProperty('createdAt');
  });
});
