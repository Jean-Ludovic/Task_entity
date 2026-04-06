'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Loader2, AlertCircle, RefreshCw, Zap, Target, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDashboardSummary } from '@/hooks/use-ai';
import type { DashboardSummaryResponse } from '@/lib/ai/types';
import type { TaskWithContext } from '@/lib/tasks/types';

type Props = {
  tasks: TaskWithContext[];
};

export function AiOverview({ tasks }: Props) {
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const { fetchSummary, loading, error } = useDashboardSummary();

  async function load() {
    setSummary(null);
    const result = await fetchSummary(tasks).catch(() => null);
    if (result) setSummary(result);
  }

  // Auto-fetch on mount
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className="border-violet-200 dark:border-violet-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-violet-500" />
            AI Overview
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={load}
            disabled={loading}
            title="Refresh AI summary"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {loading && !summary && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing your tasks…
          </div>
        )}

        {error && !summary && (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {summary && (
          <div className="flex flex-col gap-4">
            {/* Summary */}
            <p className="text-sm text-muted-foreground leading-relaxed">{summary.summary}</p>

            {/* Top priorities */}
            {summary.top_priorities.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Target className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Top priorities
                  </span>
                </div>
                <ul className="flex flex-col gap-1">
                  {summary.top_priorities.map((p, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400 text-xs font-bold">
                        {i + 1}
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Urgent tasks */}
            {summary.urgent_tasks.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Zap className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Urgent
                  </span>
                </div>
                <ul className="flex flex-col gap-1">
                  {summary.urgent_tasks.map((t, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Suggested actions */}
            {summary.suggested_actions.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <ArrowRight className="h-3.5 w-3.5 text-violet-500" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Suggested actions
                  </span>
                </div>
                <ul className="flex flex-col gap-2">
                  {summary.suggested_actions.map((a, i) => (
                    <li key={i} className="text-sm">
                      <span className="font-medium">{a.action}</span>
                      <span className="text-muted-foreground"> — {a.reason}</span>
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
