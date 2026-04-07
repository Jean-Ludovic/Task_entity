import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TaskStatus } from '@/lib/tasks/types';

const statusConfig: Record<
  TaskStatus,
  { label: string; className: string }
> = {
  todo: {
    label: 'Todo',
    className: 'border-slate-200 bg-slate-100 text-slate-700'
  },
  in_progress: {
    label: 'In Progress',
    className: 'border-blue-200 bg-blue-100 text-blue-700'
  },
  done: {
    label: 'Done',
    className: 'border-green-200 bg-green-100 text-green-700'
  }
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const { label, className } = statusConfig[status];
  return (
    <Badge variant="outline" className={cn(className)}>
      {label}
    </Badge>
  );
}
