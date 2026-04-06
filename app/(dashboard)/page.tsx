import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { listTasks } from '@/lib/tasks/service';
import { AiOverview } from '@/components/ai/ai-overview';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckSquare, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  // On charge toutes les tâches pour le résumé AI (sans pagination, limit élevée)
  const { tasks } = await listTasks(
    { sort: 'createdAt', order: 'desc', limit: 100 },
    session.user.id
  );

  const now = new Date();
  const stats = {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === 'todo').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    done: tasks.filter((t) => t.status === 'done').length,
    overdue: tasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'done'
    ).length,
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total tasks"
          value={stats.total}
          icon={<CheckSquare className="h-4 w-4 text-muted-foreground" />}
          href="/tasks"
        />
        <StatCard
          title="In progress"
          value={stats.inProgress}
          icon={<TrendingUp className="h-4 w-4 text-blue-500" />}
          href="/tasks?status=in_progress"
        />
        <StatCard
          title="Todo"
          value={stats.todo}
          icon={<Clock className="h-4 w-4 text-amber-500" />}
          href="/tasks?status=todo"
        />
        <StatCard
          title="Overdue"
          value={stats.overdue}
          icon={<AlertCircle className="h-4 w-4 text-red-500" />}
          href="/tasks"
          alert={stats.overdue > 0}
        />
      </div>

      {/* AI Overview + Quick access */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AiOverview tasks={tasks} />
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick access</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/tasks">All tasks</Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/tasks?status=in_progress">In progress</Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/tasks?status=todo">Todo</Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/calendar">Calendar</Link>
              </Button>
            </CardContent>
          </Card>

          {tasks.filter((t) => t.status !== 'done').length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Recent tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {tasks
                    .filter((t) => t.status !== 'done')
                    .slice(0, 5)
                    .map((t) => (
                      <li key={t.id} className="flex items-start gap-2 text-sm">
                        <span
                          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                            t.priority === 'high'
                              ? 'bg-red-500'
                              : t.priority === 'medium'
                              ? 'bg-amber-500'
                              : 'bg-slate-400'
                          }`}
                        />
                        <span className="truncate">{t.title}</span>
                      </li>
                    ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  href,
  alert = false,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  href: string;
  alert?: boolean;
}) {
  return (
    <Card className={alert && value > 0 ? 'border-red-200 dark:border-red-800' : ''}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${alert && value > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
          {value}
        </div>
        <Link href={href} className="text-xs text-muted-foreground hover:underline">
          View →
        </Link>
      </CardContent>
    </Card>
  );
}
