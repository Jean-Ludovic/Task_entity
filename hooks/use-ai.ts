'use client';

import { useState, useCallback } from 'react';
import type {
  TaskAssistantResponse,
  SmartSearchResponse,
  DashboardSummaryResponse,
} from '@/lib/ai/types';
import type { TaskWithContext } from '@/lib/tasks/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function callAI<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.detail ?? `AI request failed (${res.status})`);
  }

  return res.json() as Promise<T>;
}

// ─── Task Assistant ────────────────────────────────────────────────────────────

type UseTaskAssistantReturn = {
  extractTasks: (text: string) => Promise<TaskAssistantResponse>;
  loading: boolean;
  error: string | null;
  reset: () => void;
};

export function useTaskAssistant(): UseTaskAssistantReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractTasks = useCallback(async (text: string): Promise<TaskAssistantResponse> => {
    setLoading(true);
    setError(null);
    try {
      return await callAI<TaskAssistantResponse>('/api/ai/task-assistant', { text });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'AI service unavailable';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => setError(null), []);

  return { extractTasks, loading, error, reset };
}

// ─── Smart Search ──────────────────────────────────────────────────────────────

type UseSmartSearchReturn = {
  parseQuery: (query: string) => Promise<SmartSearchResponse>;
  loading: boolean;
  error: string | null;
};

export function useSmartSearch(): UseSmartSearchReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseQuery = useCallback(async (query: string): Promise<SmartSearchResponse> => {
    setLoading(true);
    setError(null);
    try {
      return await callAI<SmartSearchResponse>('/api/ai/smart-search', { query });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'AI service unavailable';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { parseQuery, loading, error };
}

// ─── Dashboard Summary ─────────────────────────────────────────────────────────

type TaskStat = {
  total: number;
  todo: number;
  in_progress: number;
  done: number;
  overdue: number;
  high_priority: number;
};

type UseDashboardSummaryReturn = {
  fetchSummary: (tasks: TaskWithContext[]) => Promise<DashboardSummaryResponse>;
  loading: boolean;
  error: string | null;
};

export function useDashboardSummary(): UseDashboardSummaryReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(
    async (tasks: TaskWithContext[]): Promise<DashboardSummaryResponse> => {
      setLoading(true);
      setError(null);

      const now = new Date();
      const stats: TaskStat = {
        total: tasks.length,
        todo: tasks.filter((t) => t.status === 'todo').length,
        in_progress: tasks.filter((t) => t.status === 'in_progress').length,
        done: tasks.filter((t) => t.status === 'done').length,
        overdue: tasks.filter(
          (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'done'
        ).length,
        high_priority: tasks.filter((t) => t.priority === 'high' && t.status !== 'done').length,
      };

      const taskInputs = tasks.slice(0, 50).map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        due_date: t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : null,
        is_overdue: !!t.dueDate && new Date(t.dueDate) < now && t.status !== 'done',
      }));

      try {
        return await callAI<DashboardSummaryResponse>('/api/ai/dashboard-summary', {
          tasks: taskInputs,
          stats,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'AI service unavailable';
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { fetchSummary, loading, error };
}
