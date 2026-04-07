import { auth } from '@/lib/auth';
import { getOrganization, listMembers } from '@/lib/organizations/service';
import { Errors, toErrorResponse } from '@/lib/errors';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw Errors.unauthorized();

    const { id } = await params;
    const [org, members] = await Promise.all([
      getOrganization(id, session.user.id),
      listMembers(id, session.user.id)
    ]);
    return Response.json({ ...org, members });
  } catch (error) {
    return toErrorResponse(error);
  }
}
