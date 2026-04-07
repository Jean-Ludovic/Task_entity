import { auth } from '@/lib/auth';
import { createOrganization, listOrganizations } from '@/lib/organizations/service';
import { CreateOrgSchema } from '@/lib/organizations/validation';
import { Errors, toErrorResponse } from '@/lib/errors';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw Errors.unauthorized();
    const orgs = await listOrganizations(session.user.id);
    return Response.json(orgs);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw Errors.unauthorized();

    const body: unknown = await req.json();
    const parsed = CreateOrgSchema.safeParse(body);
    if (!parsed.success) throw Errors.badRequest('Validation failed', { issues: parsed.error.flatten().fieldErrors });

    const org = await createOrganization(parsed.data, session.user.id);
    return Response.json(org, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
