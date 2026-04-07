import { auth } from '@/lib/auth';
import { rejectContactRequest } from '@/lib/contacts/service';
import { RequestActionSchema } from '@/lib/contacts/validation';
import { Errors, toErrorResponse } from '@/lib/errors';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw Errors.unauthorized();

    const body: unknown = await req.json();
    const parsed = RequestActionSchema.safeParse(body);
    if (!parsed.success) throw Errors.badRequest('Validation failed', { issues: parsed.error.flatten().fieldErrors });

    const result = await rejectContactRequest(parsed.data.requestId, session.user.id);
    return Response.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
