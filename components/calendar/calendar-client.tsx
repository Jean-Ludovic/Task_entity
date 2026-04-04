'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { TaskStatusBadge } from '@/components/tasks/task-status-badge';
import type { TaskWithContext } from '@/lib/tasks/types';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function taskBelongsToDay(task: TaskWithContext, day: Date): boolean {
  const start = task.startAt ? new Date(task.startAt) : task.dueDate ? new Date(task.dueDate) : null;
  if (!start) return false;
  return isSameDay(start, day);
}

function taskHour(task: TaskWithContext): number {
  const start = task.startAt ? new Date(task.startAt) : task.dueDate ? new Date(task.dueDate) : null;
  return start ? start.getHours() : 0;
}

export function CalendarClient() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [tasks, setTasks] = useState<TaskWithContext[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [creating, setCreating] = useState(false);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const from = weekStart.toISOString();
    const to = addDays(weekStart, 7).toISOString();
    const res = await fetch(`/api/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    if (res.ok) setTasks(await res.json());
    setLoading(false);
  }, [weekStart]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  function prevWeek() { setWeekStart((d) => addDays(d, -7)); }
  function nextWeek() { setWeekStart((d) => addDays(d, 7)); }
  function goToday() { setWeekStart(startOfWeek(new Date())); }

  function openCreate(day: Date, hour: number) {
    const start = new Date(day);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start);
    end.setHours(hour + 1);
    setNewStart(start.toISOString().slice(0, 16));
    setNewEnd(end.toISOString().slice(0, 16));
    setNewTitle('');
    setCreateOpen(true);
  }

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setCreating(true);
    const res = await fetch('/api/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle,
        startAt: newStart ? new Date(newStart).toISOString() : undefined,
        endAt: newEnd ? new Date(newEnd).toISOString() : undefined,
        dueDate: newEnd ? new Date(newEnd).toISOString() : undefined
      })
    });
    if (res.ok) {
      setCreateOpen(false);
      fetchTasks();
    }
    setCreating(false);
  }

  const today = new Date();

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
        <Button variant="ghost" size="icon" onClick={prevWeek}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={nextWeek}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {weekStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </span>
        {loading && <span className="text-xs text-muted-foreground ml-2">Loading…</span>}
      </div>

      {/* Grid */}
      <div className="overflow-auto rounded-md border bg-background">
        {/* Day headers */}
        <div className="grid sticky top-0 bg-background z-10 border-b"
          style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
          <div className="border-r" />
          {weekDays.map((day, i) => (
            <div
              key={i}
              className={`text-center py-2 text-xs font-medium border-r last:border-r-0 ${
                isSameDay(day, today) ? 'text-primary font-bold' : 'text-muted-foreground'
              }`}
            >
              <div>{DAYS[day.getDay()]}</div>
              <div className={`text-base ${isSameDay(day, today) ? 'bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center mx-auto' : ''}`}>
                {day.getDate()}
              </div>
            </div>
          ))}
        </div>

        {/* Hour rows */}
        {HOURS.map((hour) => (
          <div
            key={hour}
            className="grid border-b last:border-b-0"
            style={{ gridTemplateColumns: '56px repeat(7, 1fr)', minHeight: '48px' }}
          >
            <div className="text-xs text-muted-foreground px-1 pt-1 border-r text-right">
              {hour === 0 ? '' : `${hour}:00`}
            </div>
            {weekDays.map((day, di) => {
              const dayTasks = tasks.filter(
                (t) => taskBelongsToDay(t, day) && taskHour(t) === hour
              );
              return (
                <div
                  key={di}
                  className="border-r last:border-r-0 p-0.5 cursor-pointer hover:bg-muted/30 relative group"
                  onClick={() => openCreate(day, hour)}
                >
                  <Plus className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-50 absolute top-1 right-1" />
                  {dayTasks.map((t) => (
                    <div
                      key={t.id}
                      className="rounded text-xs px-1 py-0.5 mb-0.5 bg-primary/10 border border-primary/20 truncate"
                      onClick={(e) => e.stopPropagation()}
                      title={`${t.title}${t.assignedBy ? ` · By ${t.assignedBy.name}` : ''}${t.organization ? ` · ${t.organization.name}` : ''}`}
                    >
                      <span className="font-medium">{t.title}</span>
                      {t.organization && (
                        <span className="text-muted-foreground ml-1">· {t.organization.name}</span>
                      )}
                      {t.assignedBy && (
                        <span className="text-muted-foreground ml-1">· {t.assignedBy.name}</span>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input
              placeholder="Task title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Start</label>
                <Input
                  type="datetime-local"
                  value={newStart}
                  onChange={(e) => setNewStart(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">End</label>
                <Input
                  type="datetime-local"
                  value={newEnd}
                  onChange={(e) => setNewEnd(e.target.value)}
                />
              </div>
            </div>
            <Button
              className="w-full"
              onClick={handleCreate}
              disabled={creating || !newTitle.trim()}
            >
              {creating ? 'Creating…' : 'Create task'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
