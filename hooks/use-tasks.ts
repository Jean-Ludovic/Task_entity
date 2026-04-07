'use client';

import { useState, useCallback } from 'react';
import type { Task, PaginatedTasks } from '@/lib/tasks/types';
import type { CreateTaskInput, UpdateTaskInput } from '@/lib/tasks/validation';

type UseMutationsReturn = {
  createTask: (data: CreateTaskInput) => Promise<Task>;
  updateTask: (id: string, data: UpdateTaskInput) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  loading: boolean;
  error: string | null;
};

/**
 * Low-level fetch helpers for task mutations.
 * Used when you need imperative control outside of TaskTable.
 */
export function useTaskMutations(): UseMutationsReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function request<T>(
    url: string,
    options: RequestInit
  ): Promise<T> {
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message ?? 'Request failed');
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  const createTask = useCallback(
    async (data: CreateTaskInput): Promise<Task> => {
      setLoading(true);
      setError(null);
      try {
        return await request<Task>('/api/tasks', {
          method: 'POST',
          body: JSON.stringify(data)
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateTask = useCallback(
    async (id: string, data: UpdateTaskInput): Promise<Task> => {
      setLoading(true);
      setError(null);
      try {
        return await request<Task>(`/api/tasks/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data)
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteTask = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await request<void>(`/api/tasks/${id}`, { method: 'DELETE' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { createTask, updateTask, deleteTask, loading, error };
}

/**
 * Paginated task fetcher with cursor support.
 */
export function useTaskList(initialData: PaginatedTasks) {
  const [tasks, setTasks] = useState<Task[]>(initialData.tasks);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialData.nextCursor
  );
  const [loading, setLoading] = useState(false);

  const loadMore = useCallback(
    async (params: URLSearchParams) => {
      if (!nextCursor || loading) return;
      setLoading(true);

      const p = new URLSearchParams(params.toString());
      p.set('cursor', nextCursor);

      const res = await fetch(`/api/tasks?${p.toString()}`);
      const data: PaginatedTasks = await res.json();

      setTasks((prev) => [...prev, ...data.tasks]);
      setNextCursor(data.nextCursor);
      setLoading(false);
    },
    [nextCursor, loading]
  );

  return { tasks, setTasks, nextCursor, loadMore, loading };
}
