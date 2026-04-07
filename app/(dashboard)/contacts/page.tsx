import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { listContacts, listReceivedRequests, listSentRequests } from '@/lib/contacts/service';
import { ContactsClient } from '@/components/contacts/contacts-client';

export const dynamic = 'force-dynamic';

export default async function ContactsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [contacts, received, sent] = await Promise.all([
    listContacts(session.user.id),
    listReceivedRequests(session.user.id),
    listSentRequests(session.user.id)
  ]);

  return (
    <ContactsClient
      initialContacts={contacts}
      initialReceived={received}
      initialSent={sent}
    />
  );
}
