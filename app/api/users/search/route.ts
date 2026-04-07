import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { searchUsers } from '@/lib/contacts/service';
import { UserSearchSchema } from '@/lib/contacts/validation';
import { Errors, toErrorResponse } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw Errors.unauthorized();

    const q = req.nextUrl.searchParams.get('q') ?? '';
    const parsed = UserSearchSchema.safeParse({ q });
    if (!parsed.success) throw Errors.badRequest('Invalid search query');

    const results = await searchUsers(parsed.data.q, session.user.id);
    return Response.json(results);
  } catch (error) {
    return toErrorResponse(error);
  }
}
