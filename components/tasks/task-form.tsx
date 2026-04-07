'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TaskWithContext } from '@/lib/tasks/types';
import type { CreateTaskInput } from '@/lib/tasks/validation';

type Member = { userId: string; name: string | null; email: string | null };

type Props = {
  task?: TaskWithContext;
  members?: Member[];
  isOwner?: boolean;
  onSubmit: (data: CreateTaskInput) => Promise<void>;
  onCancel: () => void;
};

const STATUS_OPTIONS = [
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' }
] as const;

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' }
] as const;

function toLocalInput(date: Date | string | null | undefined): string {
  if (!date) return '';
  return new Date(date).toISOString().slice(0, 16);
}

export function TaskForm({ task, members, isOwner = true, onSubmit, onCancel }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const get = (key: string) => (fd.get(key) as string) || undefined;

    const data: CreateTaskInput = {
      title: (fd.get('title') as string) || task?.title || '',
      description: get('description'),
      status: (fd.get('status') as CreateTaskInput['status']) ?? 'todo',
      priority: (fd.get('priority') as CreateTaskInput['priority']) ?? 'medium',
      dueDate: get('dueDate') ? new Date(get('dueDate')!).toISOString() : null,
      startAt: get('startAt') ? new Date(get('startAt')!).toISOString() : null,
      endAt: get('endAt') ? new Date(get('endAt')!).toISOString() : null,
      assignedToUserId: get('assignedToUserId') || null
    };

    try {
      await onSubmit(data);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-medium">
          Title {isOwner && <span className="text-destructive">*</span>}
        </label>
        <Input
          id="title"
          name="title"
          required={isOwner}
          disabled={!isOwner}
          defaultValue={task?.title}
          placeholder="Task title"
        />
      </div>

      {/* Description */}
      {isOwner && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="text-sm font-medium">Description</label>
          <textarea
            id="description"
            name="description"
            defaultValue={task?.description ?? ''}
            placeholder="Optional description"
            rows={3}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
          />
        </div>
      )}

      {/* Status + Priority */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-sm font-medium">Status</label>
          <select
            id="status"
            name="status"
            defaultValue={task?.status ?? 'todo'}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {isOwner && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="priority" className="text-sm font-medium">Priority</label>
            <select
              id="priority"
              name="priority"
              defaultValue={task?.priority ?? 'medium'}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Dates */}
      {isOwner && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="startAt" className="text-sm font-medium">Start</label>
            <Input id="startAt" name="startAt" type="datetime-local" defaultValue={toLocalInput(task?.startAt)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="endAt" className="text-sm font-medium">End</label>
            <Input id="endAt" name="endAt" type="datetime-local" defaultValue={toLocalInput(task?.endAt)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dueDate" className="text-sm font-medium">Due date</label>
            <Input id="dueDate" name="dueDate" type="datetime-local" defaultValue={toLocalInput(task?.dueDate)} />
          </div>
        </div>
      )}

      {/* Assign to (org context) */}
      {isOwner && members && members.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="assignedToUserId" className="text-sm font-medium">Assign to</label>
          <select
            id="assignedToUserId"
            name="assignedToUserId"
            defaultValue={task?.assignedToUserId ?? ''}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name ?? m.email ?? m.userId}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Read-only context for assigned users */}
      {!isOwner && task && (
        <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground space-y-1">
          {task.assignedBy && <p>Assigned by <strong>{task.assignedBy.name}</strong></p>}
          {task.organization && <p>In <strong>{task.organization.name}</strong></p>}
          <p className="italic">You can only update the status of this task.</p>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : task ? 'Update task' : 'Create task'}
        </Button>
      </div>
    </form>
  );
}
