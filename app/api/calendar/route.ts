import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { listCalendarTasks } from '@/lib/tasks/service';
import { createTask } from '@/lib/tasks/service';
import { CreateTaskSchema } from '@/lib/tasks/validation';
import { Errors, toErrorResponse } from '@/lib/errors';
import { z } from 'zod';

const CalendarQuerySchema = z.object({
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true })
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw Errors.unauthorized();

    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = CalendarQuerySchema.safeParse(params);
    if (!parsed.success) throw Errors.badRequest('Provide valid from and to ISO dates');

    const tasks = await listCalendarTasks(
      session.user.id,
      new Date(parsed.data.from),
      new Date(parsed.data.to)
    );
    return Response.json(tasks);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw Errors.unauthorized();

    const body: unknown = await req.json();
    const parsed = CreateTaskSchema.safeParse(body);
    if (!parsed.success) throw Errors.badRequest('Validation failed', { issues: parsed.error.flatten().fieldErrors });

    const task = await createTask(parsed.data, session.user.id);
    return Response.json(task, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
