'use client';

import { useState } from 'react';
import { UserPlus, Trash2, Plus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TaskStatusBadge } from '@/components/tasks/task-status-badge';
import { TaskModal } from '@/components/tasks/task-modal';
import type { Organization, OrgMemberWithUser } from '@/lib/organizations/types';
import type { TaskWithContext } from '@/lib/tasks/types';
import type { ContactWithUser } from '@/lib/contacts/types';
import type { CreateTaskInput } from '@/lib/tasks/validation';

type Props = {
  org: Organization;
  initialMembers: OrgMemberWithUser[];
  initialTasks: TaskWithContext[];
  contacts: ContactWithUser[];
  currentUserId: string;
};

function initials(name: string | null, email: string | null) {
  return (name ?? email ?? '??').slice(0, 2).toUpperCase();
}

const PRIORITY_COLOR: Record<string, string> = {
  low: 'text-slate-500',
  medium: 'text-amber-500',
  high: 'text-red-500'
};

export function OrgDetailClient({ org, initialMembers, initialTasks, contacts, currentUserId }: Props) {
  const [members, setMembers] = useState(initialMembers);
  const [tasks, setTasks] = useState(initialTasks);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteTarget, setInviteTarget] = useState('');
  const [inviting, setInviting] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithContext | undefined>();

  const memberIds = new Set(members.map((m) => m.userId));
  const invitableContacts = contacts.filter((c) => !memberIds.has(c.user.id));
  const currentMember = members.find((m) => m.userId === currentUserId);
  const isAdmin = currentMember?.role === 'admin';

  const memberSelectOptions = members.map((m) => ({
    userId: m.userId,
    name: m.name,
    email: m.email
  }));

  // ── Invite ────────────────────────────────────────────────────────────────

  async function handleInvite() {
    if (!inviteTarget) return;
    setInviting(true);
    const res = await fetch('/api/organizations/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: org.id, receiverId: inviteTarget })
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error?.message ?? 'Error');
    } else {
      setInviteOpen(false);
      setInviteTarget('');
    }
    setInviting(false);
  }

  async function handleRemoveMember(userId: string) {
    if (!confirm('Remove this member?')) return;
    await fetch('/api/organizations/member', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: org.id, userId })
    });
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
  }

  // ── Task CRUD ─────────────────────────────────────────────────────────────

  async function handleCreateTask(data: CreateTaskInput) {
    const res = await fetch(`/api/organizations/${org.id}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create task');
    const task: TaskWithContext = await res.json();
    setTasks((prev) => [task, ...prev]);
  }

  async function handleUpdateTask(data: CreateTaskInput) {
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

  async function handleDeleteTask(id: string) {
    if (!confirm('Delete this task?')) return;
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function openEdit(task: TaskWithContext) {
    setEditingTask(task);
    setTaskModalOpen(true);
  }

  function openCreate() {
    setEditingTask(undefined);
    setTaskModalOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{org.name}</h1>
        {org.description && <p className="text-muted-foreground mt-1">{org.description}</p>}
      </div>

      {/* Members */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Members</CardTitle>
              <CardDescription>{members.length} member{members.length > 1 ? 's' : ''}</CardDescription>
            </div>
            {isAdmin && (
              <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="h-8 gap-1">
                    <UserPlus className="h-3.5 w-3.5" /> Invite
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Invite a contact</DialogTitle></DialogHeader>
                  <div className="space-y-3 mt-2">
                    {invitableContacts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">All contacts are already members.</p>
                    ) : (
                      <>
                        <select
                          className="w-full rounded-md border px-3 py-2 text-sm"
                          value={inviteTarget}
                          onChange={(e) => setInviteTarget(e.target.value)}
                        >
                          <option value="">Select a contact…</option>
                          {invitableContacts.map((c) => (
                            <option key={c.user.id} value={c.user.id}>
                              {c.user.name ?? c.user.email}
                            </option>
                          ))}
                        </select>
                        <Button className="w-full" onClick={handleInvite} disabled={inviting || !inviteTarget}>
                          {inviting ? 'Sending…' : 'Send invitation'}
                        </Button>
                      </>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="divide-y rounded-md border">
            {members.map((m) => (
              <div key={m.userId} className="flex items-center justify-between px-4 py-2">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={m.image ?? undefined} />
                    <AvatarFallback className="text-xs">{initials(m.name, m.email)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{m.name ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{m.email} · {m.role}</p>
                  </div>
                </div>
                {isAdmin && m.userId !== currentUserId && (
                  <Button
                    size="icon" variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveMember(m.userId)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tasks */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tasks</CardTitle>
              <CardDescription>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</CardDescription>
            </div>
            <Button size="sm" className="h-8 gap-1" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" /> Add task
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No tasks yet.</p>
          ) : (
            <div className="divide-y rounded-md border">
              {tasks.map((t) => {
                const isTaskOwner = t.userId === currentUserId;
                const canDelete = isTaskOwner || isAdmin;
                return (
                  <div key={t.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {t.assignedTo && (
                          <span className="text-xs text-muted-foreground">
                            → {t.assignedTo.name}
                            {t.assignedBy ? ` (by ${t.assignedBy.name})` : ''}
                          </span>
                        )}
                        {t.dueDate && (
                          <span className="text-xs text-muted-foreground">
                            Due {new Date(t.dueDate).toLocaleDateString()}
                          </span>
                        )}
                        <span className={`text-xs font-medium capitalize ${PRIORITY_COLOR[t.priority] ?? ''}`}>
                          {t.priority}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      <TaskStatusBadge status={t.status} />
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => openEdit(t)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      {canDelete && (
                        <Button
                          size="icon" variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteTask(t.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task Modal */}
      <TaskModal
        open={taskModalOpen}
        onOpenChange={(open) => { setTaskModalOpen(open); if (!open) setEditingTask(undefined); }}
        task={editingTask}
        members={memberSelectOptions}
        currentUserId={currentUserId}
        onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
      />
    </div>
  );
}
