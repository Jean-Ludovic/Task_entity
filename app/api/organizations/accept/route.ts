import { auth } from '@/lib/auth';
import { acceptOrgInvitation } from '@/lib/organizations/service';
import { InvitationActionSchema } from '@/lib/organizations/validation';
import { Errors, toErrorResponse } from '@/lib/errors';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw Errors.unauthorized();

    const body: unknown = await req.json();
    const parsed = InvitationActionSchema.safeParse(body);
    if (!parsed.success) throw Errors.badRequest('Validation failed', { issues: parsed.error.flatten().fieldErrors });

    await acceptOrgInvitation(parsed.data.invitationId, session.user.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
