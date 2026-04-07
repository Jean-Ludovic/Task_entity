import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

// In dev, FastAPI runs separately (default: http://localhost:8000).
// On Vercel, set AI_SERVICE_URL to your deployment URL (e.g. https://your-app.vercel.app).
// The vercel.json rewrite will then route /api/ai/* to the Python function.
const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? 'http://localhost:8000';
const AI_SECRET_KEY = process.env.AI_SECRET_KEY ?? '';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const { path } = await params;
  const endpoint = path.join('/');
  const targetUrl = `${AI_SERVICE_URL}/api/ai/${endpoint}`;

  const body = await req.text();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (AI_SECRET_KEY) {
    headers['X-AI-Secret-Key'] = AI_SECRET_KEY;
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body,
      // Disable Next.js cache for AI calls
      cache: 'no-store',
    });

    const data: unknown = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'AI service unavailable';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}
