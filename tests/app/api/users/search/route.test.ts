import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/contacts/service', () => ({ searchUsers: vi.fn() }));

import { GET } from '@/app/api/users/search/route';
import { searchUsers } from '@/lib/contacts/service';
import { auth } from '@/lib/auth';

const mockAuth = vi.mocked(auth);
const mockSearch = vi.mocked(searchUsers);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
});

function makeRequest(q?: string): NextRequest {
  const url = new URL('http://localhost/api/users/search');
  if (q !== undefined) url.searchParams.set('q', q);
  return new NextRequest(url.toString(), { method: 'GET' });
}

// ─── GET /api/users/search ────────────────────────────────────────────────────

describe('GET /api/users/search', () => {
  it('retourne 200 avec les utilisateurs correspondants', async () => {
    // Vérifie que la recherche retourne les utilisateurs dont le nom/email correspond
    mockSearch.mockResolvedValue([
      { id: 'user-2', name: 'Alice', email: 'alice@example.com' }
    ] as never);
    const res = await GET(makeRequest('Alice') as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(mockSearch).toHaveBeenCalledWith('Alice', 'user-1');
  });

  it('retourne 400 si le paramètre q est absent', async () => {
    // Vérifie que la validation Zod bloque une recherche sans terme de recherche
    const res = await GET(makeRequest() as never);
    expect(res.status).toBe(400);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('retourne 400 si q est une chaîne vide', async () => {
    // Un terme de recherche vide ne doit pas atteindre le service (min(1))
    const res = await GET(makeRequest('') as never);
    expect(res.status).toBe(400);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('retourne 200 avec une liste vide si aucun résultat', async () => {
    // Vérifie que l'absence de résultats retourne bien un tableau vide
    mockSearch.mockResolvedValue([] as never);
    const res = await GET(makeRequest('nobody') as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('n\'inclut pas l\'utilisateur courant dans les résultats (géré par le service)', async () => {
    // Vérifie que le userId est bien transmis au service pour s'exclure des résultats
    mockSearch.mockResolvedValue([] as never);
    await GET(makeRequest('user') as never);
    expect(mockSearch).toHaveBeenCalledWith('user', 'user-1');
  });

  it('retourne 401 si non authentifié', async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await GET(makeRequest('Alice') as never);
    expect(res.status).toBe(401);
  });
});
