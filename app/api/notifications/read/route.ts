import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { markAsRead } from '@/lib/notifications/service';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  await markAsRead(id, session.user.id);
  return NextResponse.json({ ok: true });
}
