import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listNotifications } from '@/lib/notifications/service';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const items = await listNotifications(session.user.id);
  return NextResponse.json(items);
}
