import { describe, it, expect } from 'vitest';
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  ListTasksQuerySchema
} from '@/lib/tasks/validation';

describe('CreateTaskSchema', () => {
  it('accepts a minimal valid payload', () => {
    const result = CreateTaskSchema.safeParse({ title: 'My task' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('todo');
    }
  });

  it('rejects an empty title', () => {
    const result = CreateTaskSchema.safeParse({ title: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.title).toBeDefined();
    }
  });

  it('rejects a missing title', () => {
    const result = CreateTaskSchema.safeParse({ description: 'no title' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid statuses', () => {
    for (const status of ['todo', 'in_progress', 'done'] as const) {
      const result = CreateTaskSchema.safeParse({ title: 'T', status });
      expect(result.success).toBe(true);
    }
  });

  it('rejects an invalid status', () => {
    const result = CreateTaskSchema.safeParse({ title: 'T', status: 'pending' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid ISO dueDate', () => {
    const result = CreateTaskSchema.safeParse({
      title: 'T',
      dueDate: '2025-12-01T00:00:00.000Z'
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-ISO dueDate', () => {
    const result = CreateTaskSchema.safeParse({
      title: 'T',
      dueDate: '2025-12-01'
    });
    expect(result.success).toBe(false);
  });

  it('accepts null dueDate', () => {
    const result = CreateTaskSchema.safeParse({ title: 'T', dueDate: null });
    expect(result.success).toBe(true);
  });
});

describe('UpdateTaskSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    const result = UpdateTaskSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts a partial update', () => {
    const result = UpdateTaskSchema.safeParse({ status: 'done' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid status on partial update', () => {
    const result = UpdateTaskSchema.safeParse({ status: 'archived' });
    expect(result.success).toBe(false);
  });
});

describe('ListTasksQuerySchema', () => {
  it('applies defaults when no params provided', () => {
    const result = ListTasksQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sort).toBe('createdAt');
      expect(result.data.order).toBe('desc');
      expect(result.data.limit).toBe(20);
    }
  });

  it('coerces limit from string to number', () => {
    const result = ListTasksQuerySchema.safeParse({ limit: '10' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
    }
  });

  it('rejects limit above 100', () => {
    const result = ListTasksQuerySchema.safeParse({ limit: '200' });
    expect(result.success).toBe(false);
  });

  it('rejects limit below 1', () => {
    const result = ListTasksQuerySchema.safeParse({ limit: '0' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid status filter', () => {
    const result = ListTasksQuerySchema.safeParse({ status: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid sort field', () => {
    const result = ListTasksQuerySchema.safeParse({ sort: 'title' });
    expect(result.success).toBe(false);
  });

  it('accepts valid sort and order', () => {
    const result = ListTasksQuerySchema.safeParse({
      sort: 'dueDate',
      order: 'asc'
    });
    expect(result.success).toBe(true);
  });
});
