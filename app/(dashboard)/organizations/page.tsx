import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { listOrganizations, listReceivedOrgInvitations } from '@/lib/organizations/service';
import { OrganizationsClient } from '@/components/organizations/organizations-client';

export const dynamic = 'force-dynamic';

export default async function OrganizationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [orgs, invitations] = await Promise.all([
    listOrganizations(session.user.id),
    listReceivedOrgInvitations(session.user.id)
  ]);

  return <OrganizationsClient initialOrgs={orgs} initialInvitations={invitations} />;
}
