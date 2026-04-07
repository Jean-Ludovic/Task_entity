'use client';

import { useEffect } from 'react';
import { Sparkles, Loader2, AlertCircle, ChevronRight, AlertTriangle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useDashboardSummary, type AITaskInput, type AITaskStat } from '@/hooks/use-ai';
import type { TaskWithContext } from '@/lib/tasks/types';

type Props = {
  tasks: TaskWithContext[];
};

function buildPayload(tasks: TaskWithContext[]): { aiTasks: AITaskInput[]; stats: AITaskStat } {
  const now = new Date();

  const aiTasks: AITaskInput[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    due_date: t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : null,
    is_overdue:
      t.dueDate != null && new Date(t.dueDate) < now && t.status !== 'done',
  }));

  const stats: AITaskStat = {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === 'todo').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    done: tasks.filter((t) => t.status === 'done').length,
    overdue: aiTasks.filter((t) => t.is_overdue).length,
    high_priority: tasks.filter((t) => t.priority === 'high').length,
  };

  return { aiTasks, stats };
}

export function AISummaryCard({ tasks }: Props) {
  const { data, loading, error, summarize } = useDashboardSummary();

  useEffect(() => {
    if (tasks.length === 0) return;
    const { aiTasks, stats } = buildPayload(tasks);
    summarize(aiTasks, stats);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Runs once on mount with initial server data

  if (tasks.length === 0) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">AI Overview</CardTitle>
            <CardDescription className="text-xs">
              Powered by your current task data
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing your tasks…
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <span>
              AI summary unavailable. Make sure the AI service is running.
            </span>
          </div>
        )}

        {/* Content */}
        {data && !loading && (
          <div className="flex flex-col gap-4">
            {/* Summary */}
            <p className="text-sm text-muted-foreground leading-relaxed">{data.summary}</p>

            {/* Top priorities */}
            {data.top_priorities.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Top Priorities
                </p>
                <ul className="flex flex-col gap-1.5">
                  {data.top_priorities.map((p, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-sm">
                      <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Suggested actions */}
            {data.suggested_actions.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Suggested Actions
                </p>
                <ul className="flex flex-col gap-2">
                  {data.suggested_actions.map((s, i) => (
                    <li
                      key={i}
                      className="rounded-md border border-border/50 bg-background/60 px-3 py-2"
                    >
                      <p className="text-sm font-medium">{s.action}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{s.reason}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Urgent tasks */}
            {data.urgent_tasks.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  Needs Attention
                </p>
                <ul className="flex flex-col gap-1.5">
                  {data.urgent_tasks.map((t, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-sm text-destructive">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
