import { NextRequest } from 'next/server';
import { listTasks, createTask } from '@/lib/tasks/service';
import { ListTasksQuerySchema, CreateTaskSchema } from '@/lib/tasks/validation';
import { toErrorResponse, Errors } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = ListTasksQuerySchema.safeParse(params);

    if (!parsed.success) {
      throw Errors.badRequest('Invalid query parameters', {
        issues: parsed.error.flatten().fieldErrors
      });
    }

    const result = await listTasks(parsed.data);
    return Response.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    const parsed = CreateTaskSchema.safeParse(body);

    if (!parsed.success) {
      throw Errors.badRequest('Validation failed', {
        issues: parsed.error.flatten().fieldErrors
      });
    }

    const task = await createTask(parsed.data);
    return Response.json(task, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
