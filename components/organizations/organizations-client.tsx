'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Building2, Plus, Users, ChevronRight, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import type { OrganizationWithRole } from '@/lib/organizations/types';
import type { OrgInvitationWithDetails } from '@/lib/organizations/types';

type Props = {
  initialOrgs: OrganizationWithRole[];
  initialInvitations: OrgInvitationWithDetails[];
};

export function OrganizationsClient({ initialOrgs, initialInvitations }: Props) {
  const [orgs, setOrgs] = useState(initialOrgs);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    const res = await fetch('/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: description || undefined })
    });
    if (res.ok) {
      const org = await res.json();
      setOrgs((prev) => [{ ...org, role: 'admin', memberCount: 1 }, ...prev]);
      setName('');
      setDescription('');
      setCreateOpen(false);
    }
    setCreating(false);
  }

  async function handleAccept(invitationId: string) {
    await fetch('/api/organizations/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationId })
    });
    setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    const res = await fetch('/api/organizations');
    setOrgs(await res.json());
  }

  async function handleReject(invitationId: string) {
    await fetch('/api/organizations/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationId })
    });
    setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
  }

  return (
    <div className="space-y-6">
      {/* Invitations */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Organization invitations</CardTitle>
            <CardDescription>{invitations.length} pending</CardDescription>
          </CardHeader>
          <CardContent className="divide-y rounded-md border">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium text-sm">{inv.organization.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Invited by {inv.sender.name ?? inv.sender.email}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="h-8 gap-1" onClick={() => handleAccept(inv.id)}>
                    <Check className="h-3.5 w-3.5" /> Accept
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => handleReject(inv.id)}>
                    <X className="h-3.5 w-3.5" /> Decline
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Organizations list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Organizations</CardTitle>
              <CardDescription>
                {orgs.length === 0 ? 'No organizations yet.' : `${orgs.length} organization${orgs.length > 1 ? 's' : ''}`}
              </CardDescription>
            </div>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 gap-1">
                  <Plus className="h-3.5 w-3.5" /> New
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create organization</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 mt-2">
                  <Input
                    placeholder="Organization name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <Input
                    placeholder="Description (optional)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  <Button className="w-full" onClick={handleCreate} disabled={creating || !name.trim()}>
                    {creating ? 'Creating…' : 'Create'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {orgs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Create your first organization or wait for an invitation.
            </p>
          ) : (
            <div className="divide-y rounded-md border">
              {orgs.map((org) => (
                <Link
                  key={org.id}
                  href={`/organizations/${org.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{org.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {org.memberCount} member{org.memberCount > 1 ? 's' : ''} · {org.role}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
