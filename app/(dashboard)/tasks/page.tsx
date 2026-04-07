import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { listTasks } from '@/lib/tasks/service';
import { ListTasksQuerySchema } from '@/lib/tasks/validation';
import { TaskTable } from '@/components/tasks/task-table';
import { AISummaryCard } from '@/components/ai/ai-summary-card';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function TasksPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const raw = await props.searchParams;
  const flat = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
  );

  const query = ListTasksQuerySchema.parse(flat);
  const initialData = await listTasks(query, session.user.id);

  const key = `${query.status ?? ''}-${query.q ?? ''}-${query.sort}-${query.order}`;

  return (
    <div className="flex flex-col gap-4">
      <AISummaryCard tasks={initialData.tasks} />
      <TaskTable
        key={key}
        initialData={initialData}
        currentUserId={session.user.id}
      />
    </div>
  );
}
