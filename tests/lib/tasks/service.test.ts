import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock 'server-only' so it doesn't throw in test env
vi.mock('server-only', () => ({}));

// Mock the Drizzle db client
const mockReturning = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockOffset = vi.fn();
const mockOrderBy = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockValues = vi.fn();
const mockSet = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete
  }
}));

import { createTask, getTaskById, deleteTask } from '@/lib/tasks/service';
import { AppError } from '@/lib/errors';

const mockTask = {
  id: 'uuid-1',
  title: 'Test task',
  description: null,
  status: 'todo' as const,
  dueDate: null,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z')
};

describe('createTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Chain: db.insert(tasks).values(data).returning()
    mockReturning.mockResolvedValue([mockTask]);
    mockValues.mockReturnValue({ returning: mockReturning });
    mockInsert.mockReturnValue({ values: mockValues });
  });

  it('inserts a task and returns it', async () => {
    const result = await createTask({
      title: 'Test task',
      status: 'todo'
    });

    expect(mockInsert).toHaveBeenCalledOnce();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Test task', status: 'todo' })
    );
    expect(result).toEqual(mockTask);
  });

  it('maps dueDate string to Date', async () => {
    await createTask({
      title: 'Task with due date',
      dueDate: '2025-06-01T12:00:00.000Z'
    });

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        dueDate: new Date('2025-06-01T12:00:00.000Z')
      })
    );
  });
});

describe('getTaskById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWhere.mockResolvedValue([mockTask]);
    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });
  });

  it('returns the task when found', async () => {
    const result = await getTaskById('uuid-1');
    expect(result).toEqual(mockTask);
  });

  it('throws NOT_FOUND when task does not exist', async () => {
    mockWhere.mockResolvedValue([]);

    await expect(getTaskById('missing-id')).rejects.toThrow(AppError);
    await expect(getTaskById('missing-id')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404
    });
  });
});

describe('deleteTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // getTaskById mock
    mockWhere.mockResolvedValue([mockTask]);
    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    // delete mock
    const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
  });

  it('calls delete with the correct id', async () => {
    await deleteTask('uuid-1');
    expect(mockDelete).toHaveBeenCalledOnce();
  });

  it('throws NOT_FOUND if task does not exist', async () => {
    mockWhere.mockResolvedValue([]);
    await expect(deleteTask('bad-id')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });
});
