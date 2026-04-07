import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_pw')
  }
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn()
  }
}));

import { db } from '@/lib/db';
import { register } from '@/lib/auth/actions';
import bcrypt from 'bcryptjs';

const mockDb = db as {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
};

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
  return fd;
}

const validFields = {
  name: 'Jean Ludo',
  email: 'jean@example.com',
  password: 'securepassword'
};

describe('register', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // No existing user by default
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    mockDb.select.mockReturnValue({ from });

    // Insert succeeds
    const values = vi.fn().mockResolvedValue(undefined);
    mockDb.insert.mockReturnValue({ values });
  });

  it('returns success when all fields are valid and email is free', async () => {
    const result = await register(makeFormData(validFields));
    expect(result).toEqual({ success: true });
  });

  it('hashes the password before inserting', async () => {
    await register(makeFormData(validFields));
    expect(bcrypt.hash).toHaveBeenCalledWith('securepassword', 12);
    const values = mockDb.insert.mock.results[0].value.values;
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'hashed_pw' })
    );
  });

  it('lowercases and trims the email before storing', async () => {
    await register(makeFormData({ ...validFields, email: '  Jean@EXAMPLE.COM  ' }));
    const values = mockDb.insert.mock.results[0].value.values;
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'jean@example.com' })
    );
  });

  it('returns error when email is missing', async () => {
    const result = await register(makeFormData({ name: 'Jean', password: 'pass1234' }));
    expect(result).toEqual({ error: 'All fields are required.' });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('returns error when password is missing', async () => {
    const result = await register(makeFormData({ name: 'Jean', email: 'a@b.com' }));
    expect(result).toEqual({ error: 'All fields are required.' });
  });

  it('returns error when name is missing', async () => {
    const result = await register(makeFormData({ email: 'a@b.com', password: 'pass1234' }));
    expect(result).toEqual({ error: 'All fields are required.' });
  });

  it('returns error when password is shorter than 8 characters', async () => {
    const result = await register(makeFormData({ ...validFields, password: 'short' }));
    expect(result).toEqual({ error: 'Password must be at least 8 characters.' });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('returns error when email already exists', async () => {
    const limit = vi.fn().mockResolvedValue([{ id: 'existing-id' }]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    mockDb.select.mockReturnValue({ from });

    const result = await register(makeFormData(validFields));
    expect(result).toEqual({ error: 'An account with this email already exists.' });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});
