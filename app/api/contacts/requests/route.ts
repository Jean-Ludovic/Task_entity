import { auth } from '@/lib/auth';
import { listReceivedRequests } from '@/lib/contacts/service';
import { Errors, toErrorResponse } from '@/lib/errors';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw Errors.unauthorized();

    const requests = await listReceivedRequests(session.user.id);
    return Response.json(requests);
  } catch (error) {
    return toErrorResponse(error);
  }
}
