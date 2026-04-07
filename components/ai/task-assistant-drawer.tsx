'use client';

import { useState } from 'react';
import { Sparkles, Plus, Check, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useTaskAssistant, type ExtractedTask } from '@/hooks/use-ai';
import type { CreateTaskInput } from '@/lib/tasks/validation';

const PRIORITY_CLASS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
};

const STATUS_LABEL: Record<string, string> = {
  todo: 'Todo',
  in_progress: 'In Progress',
  done: 'Done',
};

type Props = {
  onCreateTask: (data: CreateTaskInput) => Promise<void>;
};

function toCreateInput(task: ExtractedTask): CreateTaskInput {
  return {
    title: task.title,
    description: task.description ?? undefined,
    status: task.status,
    priority: task.priority,
    dueDate: task.due_date ? new Date(task.due_date).toISOString() : null,
  };
}

export function TaskAssistantDrawer({ onCreateTask }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);

  const { extract, loading, error, data, reset } = useTaskAssistant();

  function handleOpen(value: boolean) {
    setOpen(value);
    if (!value) {
      setText('');
      setSelected(new Set());
      setCreatedCount(0);
      reset();
    }
  }

  async function handleExtract() {
    if (!text.trim()) return;
    setSelected(new Set());
    setCreatedCount(0);
    const result = await extract(text.trim());
    if (result?.tasks.length) {
      setSelected(new Set(result.tasks.map((_, i) => i)));
    }
  }

  function toggleSelect(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  async function handleCreate() {
    if (!data?.tasks.length || selected.size === 0) return;
    setCreating(true);
    let count = 0;
    for (const i of selected) {
      try {
        await onCreateTask(toCreateInput(data.tasks[i]));
        count++;
      } catch {
        // Continue with remaining tasks
      }
    }
    setCreatedCount(count);
    setSelected(new Set());
    setCreating(false);
  }

  const tasks = data?.tasks ?? [];

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 gap-1">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Create with AI</span>
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col overflow-hidden">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Task Assistant
          </SheetTitle>
          <SheetDescription>
            Describe what you need to do. The AI will extract structured tasks from your text.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex flex-col gap-4 overflow-y-auto flex-1 pr-1">
          {/* Text input */}
          <div className="flex flex-col gap-2">
            <label htmlFor="ai-input" className="text-sm font-medium">
              What do you need to do?
            </label>
            <textarea
              id="ai-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleExtract();
              }}
              placeholder="e.g. Review the PR by tomorrow, fix the login bug (high priority), and write unit tests for the auth module by Friday"
              rows={5}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
            <p className="text-xs text-muted-foreground">Tip: Press Ctrl+Enter to extract</p>
          </div>

          <Button onClick={handleExtract} disabled={loading || !text.trim()} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Extracting tasks…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Extract tasks
              </>
            )}
          </Button>

          {/* Error state */}
          {error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Success feedback */}
          {createdCount > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              <Check className="h-4 w-4 shrink-0" />
              {createdCount} task{createdCount > 1 ? 's' : ''} created successfully.
            </div>
          )}

          {/* Empty state after extraction */}
          {tasks.length === 0 && data && !loading && (
            <p className="rounded-md bg-muted/50 px-3 py-4 text-center text-sm text-muted-foreground">
              No actionable tasks found. Try being more specific.
            </p>
          )}

          {/* Extracted task list */}
          {tasks.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {tasks.length} task{tasks.length > 1 ? 's' : ''} extracted
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() =>
                    setSelected(
                      selected.size === tasks.length
                        ? new Set()
                        : new Set(tasks.map((_, i) => i))
                    )
                  }
                >
                  {selected.size === tasks.length ? 'Deselect all' : 'Select all'}
                </Button>
              </div>

              <div className="flex flex-col gap-2">
                {tasks.map((task, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleSelect(i)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      selected.has(i)
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className={`mt-0.5 h-4 w-4 shrink-0 rounded-sm border-2 flex items-center justify-center transition-colors ${
                          selected.has(i)
                            ? 'border-primary bg-primary'
                            : 'border-muted-foreground/50'
                        }`}
                      >
                        {selected.has(i) && (
                          <Check className="h-2.5 w-2.5 text-primary-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">{task.title}</p>
                        {task.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                            {task.description}
                          </p>
                        )}
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_CLASS[task.priority]}`}
                          >
                            {task.priority}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {STATUS_LABEL[task.status]}
                          </span>
                          {task.due_date && (
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                              Due {new Date(task.due_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <Button
                onClick={handleCreate}
                disabled={creating || selected.size === 0}
                className="w-full"
              >
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create {selected.size} task{selected.size !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
