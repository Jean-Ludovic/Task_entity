import { NextRequest } from 'next/server';
import { getTaskById, updateTask, deleteTask } from '@/lib/tasks/service';
import { UpdateTaskSchema } from '@/lib/tasks/validation';
import { toErrorResponse, Errors } from '@/lib/errors';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const task = await getTaskById(id);
    return Response.json(task);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body: unknown = await req.json();
    const parsed = UpdateTaskSchema.safeParse(body);

    if (!parsed.success) {
      throw Errors.badRequest('Validation failed', {
        issues: parsed.error.flatten().fieldErrors
      });
    }

    const task = await updateTask(id, parsed.data);
    return Response.json(task);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    await deleteTask(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
