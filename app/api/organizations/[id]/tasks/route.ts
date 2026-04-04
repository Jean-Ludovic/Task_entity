import { auth } from '@/lib/auth';
import { listOrgTasks, createOrgTask } from '@/lib/tasks/service';
import { CreateTaskSchema } from '@/lib/tasks/validation';
import { Errors, toErrorResponse } from '@/lib/errors';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw Errors.unauthorized();

    const { id } = await params;
    const tasks = await listOrgTasks(id, session.user.id);
    return Response.json(tasks);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw Errors.unauthorized();

    const { id } = await params;
    const body: unknown = await req.json();
    const parsed = CreateTaskSchema.safeParse(body);
    if (!parsed.success) throw Errors.badRequest('Validation failed', { issues: parsed.error.flatten().fieldErrors });

    const task = await createOrgTask(id, parsed.data, session.user.id);
    return Response.json(task, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
