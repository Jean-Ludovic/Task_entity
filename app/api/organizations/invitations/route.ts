import { auth } from '@/lib/auth';
import { listReceivedOrgInvitations } from '@/lib/organizations/service';
import { Errors, toErrorResponse } from '@/lib/errors';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw Errors.unauthorized();
    const invitations = await listReceivedOrgInvitations(session.user.id);
    return Response.json(invitations);
  } catch (error) {
    return toErrorResponse(error);
  }
}
