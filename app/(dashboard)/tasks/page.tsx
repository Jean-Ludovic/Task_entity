import { listTasks } from '@/lib/tasks/service';
import { ListTasksQuerySchema } from '@/lib/tasks/validation';
import { TaskTable } from '@/components/tasks/task-table';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function TasksPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = await props.searchParams;

  // Flatten array values (Next.js can send arrays for repeated params)
  const flat = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
  );

  const query = ListTasksQuerySchema.parse(flat);
  const initialData = await listTasks(query);

  return <TaskTable initialData={initialData} />;
}
