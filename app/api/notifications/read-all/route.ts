import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { markAllAsRead } from '@/lib/notifications/service';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await markAllAsRead(session.user.id);
  return NextResponse.json({ ok: true });
}
