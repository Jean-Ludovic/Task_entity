import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getOrganization, listMembers } from '@/lib/organizations/service';
import { listOrgTasks } from '@/lib/tasks/service';
import { OrgDetailClient } from '@/components/organizations/org-detail-client';
import { listContacts } from '@/lib/contacts/service';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export default async function OrgDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { id } = await params;

  try {
    const [org, members, tasks, contacts] = await Promise.all([
      getOrganization(id, session.user.id),
      listMembers(id, session.user.id),
      listOrgTasks(id, session.user.id),
      listContacts(session.user.id)
    ]);

    return (
      <OrgDetailClient
        org={org}
        initialMembers={members}
        initialTasks={tasks}
        contacts={contacts}
        currentUserId={session.user.id}
      />
    );
  } catch {
    notFound();
  }
}
