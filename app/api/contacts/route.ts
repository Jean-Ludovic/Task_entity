import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { listContacts, deleteContact } from '@/lib/contacts/service';
import { DeleteContactSchema } from '@/lib/contacts/validation';
import { Errors, toErrorResponse } from '@/lib/errors';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw Errors.unauthorized();

    const contacts = await listContacts(session.user.id);
    return Response.json(contacts);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw Errors.unauthorized();

    const body: unknown = await req.json();
    const parsed = DeleteContactSchema.safeParse(body);
    if (!parsed.success) throw Errors.badRequest('Validation failed', { issues: parsed.error.flatten().fieldErrors });

    await deleteContact(parsed.data.contactId, session.user.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
