import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { CalendarClient } from '@/components/calendar/calendar-client';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  return <CalendarClient />;
}
