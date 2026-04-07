import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn()
}));

import { POST } from '@/app/api/ai-proxy/[...path]/route';
import { auth } from '@/lib/auth';

const mockAuth = vi.mocked(auth);

function makeRequest(body: unknown, path: string[] = ['task-assistant']): {
  req: NextRequest;
  ctx: { params: Promise<{ path: string[] }> };
} {
  const req = new NextRequest('http://localhost/api/ai-proxy/task-assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { req, ctx: { params: Promise.resolve({ path }) } };
}

// ─── Shared mock fetch helpers ─────────────────────────────────────────────────
// vi.stubGlobal retourne la VALEUR ORIGINALE remplacée, pas le mock.
// On crée toujours le vi.fn() AVANT de l'enregistrer avec stubGlobal.

function stubFetchOk(data: unknown, status = 200): ReturnType<typeof vi.fn> {
  const mock = vi.fn().mockResolvedValue({
    ok: true,
    status,
    json: () => Promise.resolve(data)
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

function stubFetchError(status: number, data: unknown): ReturnType<typeof vi.fn> {
  const mock = vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve(data)
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

function stubFetchThrow(error: unknown): ReturnType<typeof vi.fn> {
  const mock = vi.fn().mockRejectedValue(error);
  vi.stubGlobal('fetch', mock);
  return mock;
}

// ─── Auth guard ───────────────────────────────────────────────────────────────

describe('POST /api/ai-proxy — auth guard', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('returns 401 when there is no session', async () => {
    mockAuth.mockResolvedValue(null);
    const { req, ctx } = makeRequest({ text: 'hello' });
    const res = await POST(req, ctx);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.detail).toMatch(/unauthorized/i);
  });

  it('returns 401 when session has no user id', async () => {
    mockAuth.mockResolvedValue({ user: {} } as never);
    const { req, ctx } = makeRequest({ text: 'hello' });
    const res = await POST(req, ctx);
    expect(res.status).toBe(401);
  });

  it('does not call fetch when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const fetchMock = stubFetchOk({});
    const { req, ctx } = makeRequest({ text: 'hello' });
    await POST(req, ctx);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ─── Proxy forwarding ─────────────────────────────────────────────────────────

describe('POST /api/ai-proxy — proxy forwarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('forwards the response body and status from upstream', async () => {
    const upstreamData = { tasks: [{ title: 'Write tests' }], raw_text: 'Write tests' };
    stubFetchOk(upstreamData, 200);

    const { req, ctx } = makeRequest({ text: 'Write tests' });
    const res = await POST(req, ctx);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(upstreamData);
  });

  it('builds the correct target URL from path segments', async () => {
    const fetchMock = stubFetchOk({}, 200);

    const { req, ctx } = makeRequest({ text: 'x' }, ['task-assistant']);
    await POST(req, ctx);

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/ai/task-assistant');
  });

  it('builds a multi-segment path correctly', async () => {
    const fetchMock = stubFetchOk({}, 200);

    const req = new NextRequest('http://localhost/api/ai-proxy/smart-search', {
      method: 'POST',
      body: JSON.stringify({ query: 'overdue' })
    });
    await POST(req, { params: Promise.resolve({ path: ['smart-search'] }) });

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/ai/smart-search');
  });

  it('sends Content-Type: application/json to upstream', async () => {
    const fetchMock = stubFetchOk({}, 200);

    const { req, ctx } = makeRequest({ text: 'hello' });
    await POST(req, ctx);

    const calledOptions = fetchMock.mock.calls[0][1] as RequestInit;
    expect((calledOptions.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('forwards the request body verbatim to upstream', async () => {
    const fetchMock = stubFetchOk({}, 200);

    const payload = { text: 'finish the report by Friday' };
    const { req, ctx } = makeRequest(payload);
    await POST(req, ctx);

    const sentBody = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(sentBody.body as string)).toEqual(payload);
  });

  it('forwards upstream error status codes (e.g. 422)', async () => {
    stubFetchError(422, { detail: [{ msg: 'value_error' }] });

    const { req, ctx } = makeRequest({ text: 'x' });
    const res = await POST(req, ctx);

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.detail).toBeDefined();
  });

  it('forwards 501 from upstream (feature not yet implemented)', async () => {
    stubFetchError(501, { detail: 'Not implemented' });

    const { req, ctx } = makeRequest({ text: 'x' });
    const res = await POST(req, ctx);

    expect(res.status).toBe(501);
  });
});

// ─── Network / upstream errors ────────────────────────────────────────────────

describe('POST /api/ai-proxy — upstream failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('returns 502 when fetch throws (service unreachable)', async () => {
    stubFetchThrow(new Error('ECONNREFUSED'));

    const { req, ctx } = makeRequest({ text: 'hello' });
    const res = await POST(req, ctx);

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.detail).toContain('ECONNREFUSED');
  });

  it('returns 502 with a fallback message when error is not an Error instance', async () => {
    stubFetchThrow('string error');

    const { req, ctx } = makeRequest({ text: 'hello' });
    const res = await POST(req, ctx);

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.detail).toBe('AI service unavailable');
  });

  it('returns 502 with a human-readable message on timeout', async () => {
    stubFetchThrow(new Error('The operation was aborted'));

    const { req, ctx } = makeRequest({ text: 'hello' });
    const res = await POST(req, ctx);

    expect(res.status).toBe(502);
  });
});
