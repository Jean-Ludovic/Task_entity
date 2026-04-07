import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/contacts/service', () => ({ listReceivedRequests: vi.fn() }));

import { GET } from '@/app/api/contacts/requests/route';
import { listReceivedRequests } from '@/lib/contacts/service';
import { auth } from '@/lib/auth';

const mockAuth = vi.mocked(auth);
const mockList = vi.mocked(listReceivedRequests);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
});

// ─── GET /api/contacts/requests ───────────────────────────────────────────────

describe('GET /api/contacts/requests', () => {
  it('retourne 200 avec les demandes reçues en attente', async () => {
    // Vérifie que la liste des demandes reçues est bien retournée
    mockList.mockResolvedValue([{ id: 'req-1', senderId: 'user-2' }] as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(mockList).toHaveBeenCalledWith('user-1');
  });

  it('retourne 200 avec une liste vide si aucune demande', async () => {
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
