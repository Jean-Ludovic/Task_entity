import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { autoArrangeTasks } from '@/lib/calendar/service';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tasks = await autoArrangeTasks(session.user.id);
  return NextResponse.json(tasks);
}
