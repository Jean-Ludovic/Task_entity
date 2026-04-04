'use client';

import { useState } from 'react';
import { UserPlus, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TaskStatusBadge } from '@/components/tasks/task-status-badge';
import type { Organization, OrgMemberWithUser } from '@/lib/organizations/types';
import type { TaskWithContext } from '@/lib/tasks/types';
import type { ContactWithUser } from '@/lib/contacts/types';

type Props = {
  org: Organization;
  initialMembers: OrgMemberWithUser[];
  initialTasks: TaskWithContext[];
  contacts: ContactWithUser[];
  currentUserId: string;
};

function initials(name: string | null, email: string | null) {
  if (name) return name.slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return '??';
}

export function OrgDetailClient({ org, initialMembers, initialTasks, contacts, currentUserId }: Props) {
  const [members, setMembers] = useState(initialMembers);
  const [tasks, setTasks] = useState(initialTasks);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [assignTo, setAssignTo] = useState('');
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteTarget, setInviteTarget] = useState('');

  const memberIds = new Set(members.map((m) => m.userId));
  const invitableContacts = contacts.filter((c) => !memberIds.has(c.user.id));

  const currentMember = members.find((m) => m.userId === currentUserId);
  const isAdmin = currentMember?.role === 'admin';

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
      alert(err.error?.message ?? 'Error sending invitation');
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

  async function handleCreateTask() {
    if (!taskTitle.trim()) return;
    setCreating(true);
    const res = await fetch(`/api/organizations/${org.id}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: taskTitle,
        assignedToUserId: assignTo || undefined
      })
    });
    if (res.ok) {
      const task = await res.json();
      setTasks((prev) => [task, ...prev]);
      setTaskTitle('');
      setAssignTo('');
      setTaskOpen(false);
    }
    setCreating(false);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{org.name}</h1>
        {org.description && (
          <p className="text-muted-foreground mt-1">{org.description}</p>
        )}
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
                  <DialogHeader>
                    <DialogTitle>Invite a contact</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 mt-2">
                    {invitableContacts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">All your contacts are already members.</p>
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
                        <Button
                          className="w-full"
                          onClick={handleInvite}
                          disabled={inviting || !inviteTarget}
                        >
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
            <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 gap-1">
                  <Plus className="h-3.5 w-3.5" /> Add task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New organization task</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 mt-2">
                  <Input
                    placeholder="Task title"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                  />
                  <select
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={assignTo}
                    onChange={(e) => setAssignTo(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name ?? m.email}
                      </option>
                    ))}
                  </select>
                  <Button
                    className="w-full"
                    onClick={handleCreateTask}
                    disabled={creating || !taskTitle.trim()}
                  >
                    {creating ? 'Creating…' : 'Create task'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No tasks yet.</p>
          ) : (
            <div className="divide-y rounded-md border">
              {tasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{t.title}</p>
                    {t.assignedTo && (
                      <p className="text-xs text-muted-foreground">
                        Assigned to {t.assignedTo.name}
                        {t.assignedBy ? ` by ${t.assignedBy.name}` : ''}
                      </p>
                    )}
                    {t.dueDate && (
                      <p className="text-xs text-muted-foreground">
                        Due {new Date(t.dueDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <TaskStatusBadge status={t.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
