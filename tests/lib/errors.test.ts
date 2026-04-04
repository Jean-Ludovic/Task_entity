import { describe, it, expect } from 'vitest';
import { AppError, Errors, toErrorResponse } from '@/lib/errors';

describe('AppError', () => {
  it('sets all fields correctly', () => {
    const err = new AppError('NOT_FOUND', 'Task not found', 404, { id: '1' });
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Task not found');
    expect(err.statusCode).toBe(404);
    expect(err.details).toEqual({ id: '1' });
    expect(err.name).toBe('AppError');
  });

  it('is an instance of Error', () => {
    const err = new AppError('X', 'msg', 500);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });
});

describe('Errors helpers', () => {
  it('notFound produces a 404 AppError', () => {
    const err = Errors.notFound('Task');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Task not found');
  });

  it('badRequest produces a 400 AppError with details', () => {
    const err = Errors.badRequest('Invalid input', { field: 'title' });
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.statusCode).toBe(400);
    expect(err.details).toEqual({ field: 'title' });
  });

  it('internal produces a 500 AppError', () => {
    const err = Errors.internal();
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.statusCode).toBe(500);
  });
});

describe('toErrorResponse', () => {
  it('serializes an AppError into the expected JSON shape', async () => {
    const err = Errors.notFound('Task');
    const res = toErrorResponse(err);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Task not found',
        details: {}
      }
    });
  });

  it('returns 500 INTERNAL_ERROR for unknown errors', async () => {
    const res = toErrorResponse(new Error('boom'));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('includes details when present on AppError', async () => {
    const err = Errors.badRequest('Validation failed', { field: 'title' });
    const res = toErrorResponse(err);
    const body = await res.json();
    expect(body.error.details).toEqual({ field: 'title' });
  });
});
