import { auth } from '@/lib/auth';
import { sendContactRequest } from '@/lib/contacts/service';
import { SendRequestSchema } from '@/lib/contacts/validation';
import { Errors, toErrorResponse } from '@/lib/errors';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw Errors.unauthorized();

    const body: unknown = await req.json();
    const parsed = SendRequestSchema.safeParse(body);
    if (!parsed.success) throw Errors.badRequest('Validation failed', { issues: parsed.error.flatten().fieldErrors });

    const result = await sendContactRequest(session.user.id, parsed.data.receiverId);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
