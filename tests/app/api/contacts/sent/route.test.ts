import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/contacts/service', () => ({ listSentRequests: vi.fn() }));

import { GET } from '@/app/api/contacts/sent/route';
import { listSentRequests } from '@/lib/contacts/service';
import { auth } from '@/lib/auth';

const mockAuth = vi.mocked(auth);
const mockList = vi.mocked(listSentRequests);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
});

// ─── GET /api/contacts/sent ───────────────────────────────────────────────────

describe('GET /api/contacts/sent', () => {
  it('retourne 200 avec les demandes envoyées', async () => {
    // Vérifie que la liste des demandes envoyées par l'utilisateur est bien retournée
    mockList.mockResolvedValue([{ id: 'req-1', receiverId: 'user-2' }] as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(mockList).toHaveBeenCalledWith('user-1');
  });

  it('retourne 200 avec une liste vide si aucune demande envoyée', async () => {
    mockList.mockResolvedValue([] as never);
    const res = await GET();
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('retourne 401 si non authentifié', async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
