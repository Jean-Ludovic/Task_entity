import { NextRequest } from 'next/server';
import { getTaskById, updateTask, deleteTask } from '@/lib/tasks/service';
import { UpdateTaskSchema } from '@/lib/tasks/validation';
import { toErrorResponse, Errors } from '@/lib/errors';
import { auth } from '@/lib/auth';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw Errors.unauthorized();
    const { id } = await params;
    const task = await getTaskById(id, session.user.id);
    return Response.json(task);
  } catch (error) {
    return toErrorResponse(error);
  }
}

async function handleUpdate(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw Errors.unauthorized();
    const { id } = await params;
    const body: unknown = await req.json();
    const parsed = UpdateTaskSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest('Validation failed', {
        issues: parsed.error.flatten().fieldErrors
      });
    }
    const task = await updateTask(id, parsed.data, session.user.id);
    return Response.json(task);
  } catch (error) {
    return toErrorResponse(error);
  }
}

// Support both PUT (legacy) and PATCH (standard partial update)
export const PUT = handleUpdate;
export const PATCH = handleUpdate;

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw Errors.unauthorized();
    const { id } = await params;
    await deleteTask(id, session.user.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
