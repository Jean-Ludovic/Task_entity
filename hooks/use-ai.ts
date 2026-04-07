'use client';

import { useState, useCallback } from 'react';

// ─── Shared types (mirror Python Pydantic schemas) ────────────────────────────

export type ExtractedTask = {
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  due_date: string | null;
};

export type TaskAssistantResult = {
  tasks: ExtractedTask[];
  raw_text: string;
};

export type SearchFilters = {
  status: 'todo' | 'in_progress' | 'done' | null;
  priority: 'low' | 'medium' | 'high' | null;
  keywords: string[];
  due_before: string | null;
  due_after: string | null;
  interpretation: string;
};

export type SmartSearchResult = {
  filters: SearchFilters;
  original_query: string;
};

export type SuggestedAction = { action: string; reason: string };

export type DashboardSummaryResult = {
  summary: string;
  top_priorities: string[];
  suggested_actions: SuggestedAction[];
  urgent_tasks: string[];
};

export type AITaskInput = {
  id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  due_date: string | null;
  is_overdue: boolean;
};

export type AITaskStat = {
  total: number;
  todo: number;
  in_progress: number;
  done: number;
  overdue: number;
  high_priority: number;
};

// ─── Internal fetch helper ────────────────────────────────────────────────────

async function callAIProxy<TReq, TRes>(endpoint: string, body: TReq): Promise<TRes> {
  const res = await fetch(`/api/ai-proxy/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(err?.detail ?? `AI request failed (${res.status})`);
  }
  return res.json() as Promise<TRes>;
}

// ─── Generic AI state ─────────────────────────────────────────────────────────

type AIState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

// ─── useTaskAssistant ─────────────────────────────────────────────────────────

export function useTaskAssistant() {
  const [state, setState] = useState<AIState<TaskAssistantResult>>({
    data: null,
    loading: false,
    error: null,
  });

  const extract = useCallback(async (text: string): Promise<TaskAssistantResult | null> => {
    setState({ data: null, loading: true, error: null });
    try {
      const result = await callAIProxy<{ text: string }, TaskAssistantResult>(
        'task-assistant',
        { text }
      );
      setState({ data: result, loading: false, error: null });
      return result;
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      setState({ data: null, loading: false, error });
      return null;
    }
  }, []);

  const reset = useCallback(
    () => setState({ data: null, loading: false, error: null }),
    []
  );

  return { ...state, extract, reset };
}

// ─── useSmartSearch ───────────────────────────────────────────────────────────

export function useSmartSearch() {
  const [state, setState] = useState<AIState<SmartSearchResult>>({
    data: null,
    loading: false,
    error: null,
  });

  const search = useCallback(async (query: string): Promise<SmartSearchResult | null> => {
    if (!query.trim()) return null;
    setState({ data: null, loading: true, error: null });
    try {
      const result = await callAIProxy<{ query: string }, SmartSearchResult>(
        'smart-search',
        { query }
      );
      setState({ data: result, loading: false, error: null });
      return result;
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      setState({ data: null, loading: false, error });
      return null;
    }
  }, []);

  const reset = useCallback(
    () => setState({ data: null, loading: false, error: null }),
    []
  );

  return { ...state, search, reset };
}

// ─── useDashboardSummary ──────────────────────────────────────────────────────

export function useDashboardSummary() {
  const [state, setState] = useState<AIState<DashboardSummaryResult>>({
    data: null,
    loading: false,
    error: null,
  });

  const summarize = useCallback(
    async (
      tasks: AITaskInput[],
      stats: AITaskStat
    ): Promise<DashboardSummaryResult | null> => {
      setState({ data: null, loading: true, error: null });
      try {
        const result = await callAIProxy<
          { tasks: AITaskInput[]; stats: AITaskStat },
          DashboardSummaryResult
        >('dashboard-summary', { tasks, stats });
        setState({ data: result, loading: false, error: null });
        return result;
      } catch (e) {
        const error = e instanceof Error ? e.message : 'Unknown error';
        setState({ data: null, loading: false, error });
        return null;
      }
    },
    []
  );

  const reset = useCallback(
    () => setState({ data: null, loading: false, error: null }),
    []
  );

  return { ...state, summarize, reset };
}
