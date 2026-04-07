import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/organizations/service', () => ({ listReceivedOrgInvitations: vi.fn() }));

import { GET } from '@/app/api/organizations/invitations/route';
import { listReceivedOrgInvitations } from '@/lib/organizations/service';
import { auth } from '@/lib/auth';

const mockAuth = vi.mocked(auth);
const mockList = vi.mocked(listReceivedOrgInvitations);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
});

// ─── GET /api/organizations/invitations ───────────────────────────────────────

describe('GET /api/organizations/invitations', () => {
  it('retourne 200 avec les invitations reçues', async () => {
    // Vérifie que les invitations en attente pour l'utilisateur sont bien retournées
    mockList.mockResolvedValue([{ id: 'inv-1', organizationId: 'org-1' }] as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(mockList).toHaveBeenCalledWith('user-1');
  });

  it('retourne 200 avec une liste vide si aucune invitation', async () => {
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
