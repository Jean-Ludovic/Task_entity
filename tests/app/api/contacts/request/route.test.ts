import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/contacts/service', () => ({ sendContactRequest: vi.fn() }));

import { POST } from '@/app/api/contacts/request/route';
import { sendContactRequest } from '@/lib/contacts/service';
import { auth } from '@/lib/auth';

const mockAuth = vi.mocked(auth);
const mockSendContactRequest = vi.mocked(sendContactRequest);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
});

const mockRequest = {
  id: 'req-1',
  senderId: 'user-1',
  receiverId: 'user-2',
  status: 'pending',
  createdAt: new Date()
};

// ─── POST /api/contacts/request ───────────────────────────────────────────────

describe('POST /api/contacts/request', () => {
  function makeRequest(body: unknown) {
    return new Request('http://localhost/api/contacts/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  it('retourne 201 avec la demande créée', async () => {
    // Vérifie que l'envoi d'une demande de contact retourne 201
    mockSendContactRequest.mockResolvedValue(mockRequest as never);
    const res = await POST(makeRequest({ receiverId: 'user-2' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.senderId).toBe('user-1');
    expect(mockSendContactRequest).toHaveBeenCalledWith('user-1', 'user-2');
  });

  it('retourne 400 si receiverId est absent', async () => {
    // Vérifie que la validation Zod bloque un body sans receiverId
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect(mockSendContactRequest).not.toHaveBeenCalled();
  });

  it('retourne 400 si receiverId est une chaîne vide', async () => {
    // Un receiverId vide doit échouer la validation min(1)
    const res = await POST(makeRequest({ receiverId: '' }));
    expect(res.status).toBe(400);
  });

  it('retourne 401 si non authentifié', async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await POST(makeRequest({ receiverId: 'user-2' }));
    expect(res.status).toBe(401);
  });
});
