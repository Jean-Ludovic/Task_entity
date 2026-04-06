'use client';

import { useState } from 'react';
import { Sparkles, Plus, Check, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useTaskAssistant } from '@/hooks/use-ai';
import type { ExtractedTask } from '@/lib/ai/types';
import type { CreateTaskInput } from '@/lib/tasks/validation';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTasks: (tasks: CreateTaskInput[]) => Promise<void>;
};

const PRIORITY_CLASS: Record<string, string> = {
  low: 'text-slate-500',
  medium: 'text-amber-500',
  high: 'text-red-500',
};

export function TaskAssistantModal({ open, onOpenChange, onCreateTasks }: Props) {
  const [text, setText] = useState('');
  const [extracted, setExtracted] = useState<ExtractedTask[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);

  const { extractTasks, loading, error, reset } = useTaskAssistant();

  async function handleExtract() {
    if (!text.trim()) return;
    reset();
    setCreated(false);
    const result = await extractTasks(text).catch(() => null);
    if (!result) return;
    setExtracted(result.tasks);
    setSelected(new Set(result.tasks.map((_, i) => i)));
  }

  async function handleCreate() {
    const tasks: CreateTaskInput[] = extracted
      .filter((_, i) => selected.has(i))
      .map((t) => ({
        title: t.title,
        description: t.description ?? undefined,
        status: t.status,
        priority: t.priority,
        dueDate: t.due_date ? new Date(t.due_date).toISOString() : null,
      }));

    if (!tasks.length) return;
    setCreating(true);
    try {
      await onCreateTasks(tasks);
      setCreated(true);
      setTimeout(() => {
        onOpenChange(false);
        resetState();
      }, 800);
    } finally {
      setCreating(false);
    }
  }

  function toggleSelect(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function resetState() {
    setText('');
    setExtracted([]);
    setSelected(new Set());
    setCreated(false);
    reset();
  }

  function handleClose(open: boolean) {
    if (!open) resetState();
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            Create tasks with AI
          </DialogTitle>
          <DialogDescription>
            Describe what you need to do — AI will extract structured tasks for you.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Text input */}
          <div className="flex flex-col gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. I need to call the client Monday morning, finish the report by Friday, and fix the login bug ASAP"
              rows={4}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
            <Button
              onClick={handleExtract}
              disabled={loading || !text.trim()}
              className="self-end gap-2"
              size="sm"
            >
              {loading ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Extracting…</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5" /> Extract tasks</>
              )}
            </Button>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Extracted tasks */}
          {extracted.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-muted-foreground">
                {extracted.length} task{extracted.length > 1 ? 's' : ''} found — select which to create:
              </p>
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
                {extracted.map((task, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleSelect(i)}
                    className={`flex items-start gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition-colors ${
                      selected.has(i)
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-muted/30 opacity-60'
                    }`}
                  >
                    <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      selected.has(i) ? 'border-primary bg-primary' : 'border-muted-foreground'
                    }`}>
                      {selected.has(i) && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{task.title}</div>
                      {task.description && (
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {task.description}
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-xs font-medium capitalize ${PRIORITY_CLASS[task.priority]}`}>
                          {task.priority}
                        </span>
                        <span className="text-xs text-muted-foreground capitalize">
                          {task.status.replace('_', ' ')}
                        </span>
                        {task.due_date && (
                          <span className="text-xs text-muted-foreground">
                            Due {new Date(task.due_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">
                  {selected.size} of {extracted.length} selected
                </span>
                <Button
                  onClick={handleCreate}
                  disabled={creating || selected.size === 0 || created}
                  size="sm"
                  className="gap-2"
                >
                  {created ? (
                    <><Check className="h-3.5 w-3.5" /> Created!</>
                  ) : creating ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating…</>
                  ) : (
                    <><Plus className="h-3.5 w-3.5" /> Create {selected.size} task{selected.size > 1 ? 's' : ''}</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {extracted.length === 0 && !loading && text.trim() && !error && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Click "Extract tasks" to parse your text.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
