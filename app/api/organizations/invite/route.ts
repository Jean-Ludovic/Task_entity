import { auth } from '@/lib/auth';
import { inviteMember } from '@/lib/organizations/service';
import { InviteMemberSchema } from '@/lib/organizations/validation';
import { Errors, toErrorResponse } from '@/lib/errors';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw Errors.unauthorized();

    const body: unknown = await req.json();
    const parsed = InviteMemberSchema.safeParse(body);
    if (!parsed.success) throw Errors.badRequest('Validation failed', { issues: parsed.error.flatten().fieldErrors });

    const result = await inviteMember(parsed.data.organizationId, session.user.id, parsed.data.receiverId);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
