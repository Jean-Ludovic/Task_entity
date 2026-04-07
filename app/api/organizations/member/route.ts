import { auth } from '@/lib/auth';
import { removeMember } from '@/lib/organizations/service';
import { RemoveMemberSchema } from '@/lib/organizations/validation';
import { Errors, toErrorResponse } from '@/lib/errors';

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw Errors.unauthorized();

    const body: unknown = await req.json();
    const parsed = RemoveMemberSchema.safeParse(body);
    if (!parsed.success) throw Errors.badRequest('Validation failed', { issues: parsed.error.flatten().fieldErrors });

    await removeMember(parsed.data.organizationId, parsed.data.userId, session.user.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
