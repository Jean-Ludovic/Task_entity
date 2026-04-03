'use client';

import { useState, useTransition, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { PlusCircle, Pencil, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { TaskStatusBadge } from './task-status-badge';
import { TaskModal } from './task-modal';
import type { Task, PaginatedTasks } from '@/lib/tasks/types';
import type { CreateTaskInput } from '@/lib/tasks/validation';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' }
] as const;

type Props = {
  initialData: PaginatedTasks;
};

export function TaskTable({ initialData }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [tasks, setTasks] = useState<Task[]>(initialData.tasks);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialData.nextCursor
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();

  // ── URL-based filter helpers ──────────────────────────────────────────────

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('cursor'); // reset pagination on filter change
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  async function handleCreate(data: CreateTaskInput) {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create task');
    const created: Task = await res.json();
    setTasks((prev) => [created, ...prev]);
  }

  async function handleUpdate(data: CreateTaskInput) {
    if (!editingTask) return;
    const res = await fetch(`/api/tasks/${editingTask.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update task');
    const updated: Task = await res.json();
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this task?')) return;
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete task');
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  // ── Load more (cursor pagination) ─────────────────────────────────────────

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);

    const params = new URLSearchParams(searchParams.toString());
    params.set('cursor', nextCursor);

    const res = await fetch(`/api/tasks?${params.toString()}`);
    const data: PaginatedTasks = await res.json();

    setTasks((prev) => [...prev, ...data.tasks]);
    setNextCursor(data.nextCursor);
    setLoadingMore(false);
  }, [nextCursor, loadingMore, searchParams]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const currentStatus = searchParams.get('status') ?? '';
  const currentSearch = searchParams.get('q') ?? '';

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tasks</CardTitle>
              <CardDescription>
                Manage your tasks and track progress.
              </CardDescription>
            </div>
            <Button
              size="sm"
              className="h-8 gap-1"
              onClick={() => {
                setEditingTask(undefined);
                setModalOpen(true);
              }}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Add Task
              </span>
            </Button>
          </div>

          {/* Search + filter bar */}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks…"
                defaultValue={currentSearch}
                className="pl-8"
                onChange={(e) => updateParam('q', e.target.value)}
              />
            </div>
            <div className="flex gap-1">
              {STATUS_FILTERS.map((f) => (
                <Button
                  key={f.value}
                  size="sm"
                  variant={currentStatus === f.value ? 'default' : 'outline'}
                  className="h-8"
                  onClick={() => updateParam('status', f.value)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="hidden md:table-cell">
                  Description
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Due Date</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground py-10"
                  >
                    No tasks found.
                  </TableCell>
                </TableRow>
              )}
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {task.title}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground max-w-[250px] truncate">
                    {task.description ?? '—'}
                  </TableCell>
                  <TableCell>
                    <TaskStatusBadge status={task.status} />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {task.dueDate
                      ? new Date(task.dueDate).toLocaleDateString()
                      : '—'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {new Date(task.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingTask(task);
                          setModalOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(task.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>

        {nextCursor && (
          <CardFooter className="justify-center border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={loadMore}
              disabled={loadingMore || isPending}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </Button>
          </CardFooter>
        )}
      </Card>

      <TaskModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        task={editingTask}
        onSubmit={editingTask ? handleUpdate : handleCreate}
      />
    </>
  );
}
