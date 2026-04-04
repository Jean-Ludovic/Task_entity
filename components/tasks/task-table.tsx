'use client';

import { useState, useTransition, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { PlusCircle, Pencil, Trash2, Search, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableHead, TableHeader, TableRow, TableCell
} from '@/components/ui/table';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle
} from '@/components/ui/card';
import { TaskStatusBadge } from './task-status-badge';
import { TaskModal } from './task-modal';
import type { TaskWithContext } from '@/lib/tasks/types';
import type { CreateTaskInput } from '@/lib/tasks/validation';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' }
] as const;

const PRIORITY_BADGE: Record<string, string> = {
  low: 'text-slate-500',
  medium: 'text-amber-500',
  high: 'text-red-500'
};

type Props = {
  initialData: { tasks: TaskWithContext[]; nextCursor: string | null };
  currentUserId?: string;
};

export function TaskTable({ initialData, currentUserId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [tasks, setTasks] = useState<TaskWithContext[]>(initialData.tasks);
  const [nextCursor, setNextCursor] = useState<string | null>(initialData.nextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithContext | undefined>();

  useEffect(() => {
    setTasks(initialData.tasks);
    setNextCursor(initialData.nextCursor);
  }, [initialData]);

  // ── URL helpers ──────────────────────────────────────────────────────────────

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete('cursor');
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  function updateParam(key: string, value: string) {
    updateParams({ [key]: value });
  }

  // ── Mutations ────────────────────────────────────────────────────────────────

  async function handleCreate(data: CreateTaskInput) {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create task');
    const created: TaskWithContext = await res.json();
    setTasks((prev) => [created, ...prev]);
  }

  async function handleUpdate(data: CreateTaskInput) {
    if (!editingTask) return;
    const res = await fetch(`/api/tasks/${editingTask.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update task');
    const updated: TaskWithContext = await res.json();
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this task?')) return;
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete task');
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  // ── Load more ────────────────────────────────────────────────────────────────

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const params = new URLSearchParams(searchParams.toString());
    params.set('cursor', nextCursor);
    const res = await fetch(`/api/tasks?${params.toString()}`);
    const data: { tasks: TaskWithContext[]; nextCursor: string | null } = await res.json();
    setTasks((prev) => [...prev, ...data.tasks]);
    setNextCursor(data.nextCursor);
    setLoadingMore(false);
  }, [nextCursor, loadingMore, searchParams]);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const currentStatus = searchParams.get('status') ?? '';
  const currentSort = searchParams.get('sort') ?? 'createdAt';
  const currentOrder = searchParams.get('order') ?? 'desc';
  const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '');

  useEffect(() => {
    const timer = setTimeout(() => updateParam('q', searchInput), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function toggleDateSort() {
    if (currentSort !== 'dueDate') updateParams({ sort: 'dueDate', order: 'asc' });
    else updateParam('order', currentOrder === 'asc' ? 'desc' : 'asc');
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tasks</CardTitle>
              <CardDescription>Manage your tasks and track progress.</CardDescription>
            </div>
            <Button
              size="sm"
              className="h-8 gap-1"
              onClick={() => { setEditingTask(undefined); setModalOpen(true); }}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Add Task</span>
            </Button>
          </div>

          {/* Filter bar */}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks…"
                value={searchInput}
                className="pl-8"
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <div className="flex gap-1 flex-wrap">
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
              <Button
                size="sm"
                variant={currentSort === 'dueDate' ? 'default' : 'outline'}
                className="h-8 gap-1"
                onClick={toggleDateSort}
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                Due date {currentSort === 'dueDate' ? (currentOrder === 'asc' ? '↑' : '↓') : ''}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="hidden lg:table-cell">Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Priority</TableHead>
                <TableHead className="hidden md:table-cell">Due Date</TableHead>
                <TableHead className="hidden xl:table-cell">Assigned to</TableHead>
                <TableHead className="hidden xl:table-cell">Organization</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                    No tasks found.
                  </TableCell>
                </TableRow>
              )}
              {tasks.map((task) => {
                const isOwner = !currentUserId || task.userId === currentUserId;
                return (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium max-w-[180px] truncate">
                      <div>{task.title}</div>
                      {task.assignedBy && !isOwner && (
                        <div className="text-xs text-muted-foreground truncate">
                          by {task.assignedBy.name}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground max-w-[220px] truncate">
                      {task.description ?? '—'}
                    </TableCell>
                    <TableCell><TaskStatusBadge status={task.status} /></TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className={`text-xs font-medium capitalize ${PRIORITY_BADGE[task.priority] ?? ''}`}>
                        {task.priority}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-muted-foreground text-sm">
                      {task.assignedTo?.name ?? '—'}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-muted-foreground text-sm">
                      {task.organization?.name ?? '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon" variant="ghost" className="h-8 w-8"
                          onClick={() => { setEditingTask(task); setModalOpen(true); }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        {isOwner && (
                          <Button
                            size="icon" variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(task.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>

        {nextCursor && (
          <CardFooter className="justify-center border-t pt-4">
            <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore || isPending}>
              {loadingMore ? 'Loading…' : 'Load more'}
            </Button>
          </CardFooter>
        )}
      </Card>

      <TaskModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        task={editingTask}
        currentUserId={currentUserId}
        onSubmit={editingTask ? handleUpdate : handleCreate}
      />
    </>
  );
}
