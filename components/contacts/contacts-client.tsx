'use client';

import { useState, useTransition } from 'react';
import { Search, UserPlus, UserCheck, UserX, Trash2, Mail } from 'lucide-react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { ContactWithUser } from '@/lib/contacts/types';

type SearchResult = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

type Props = {
  initialContacts: ContactWithUser[];
  initialReceived: ContactWithUser[];
  initialSent: ContactWithUser[];
};

function initials(name: string | null, email: string | null): string {
  if (name) return name.slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return '??';
}

export function ContactsClient({ initialContacts, initialReceived, initialSent }: Props) {
  const [contacts, setContacts] = useState(initialContacts);
  const [received, setReceived] = useState(initialReceived);
  const [sent, setSent] = useState(initialSent);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [, startTransition] = useTransition();

  async function handleSearch(q: string) {
    setSearchQuery(q);
    if (q.trim().length < 1) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
    const data: SearchResult[] = await res.json();
    setSearchResults(data);
    setIsSearching(false);
  }

  async function handleSendRequest(receiverId: string) {
    const res = await fetch('/api/contacts/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiverId })
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error?.message ?? 'Error sending request');
      return;
    }
    setSearchResults([]);
    setSearchQuery('');
    // refresh sent list
    const sentRes = await fetch('/api/contacts/sent');
    setSent(await sentRes.json());
  }

  async function handleAccept(requestId: string) {
    await fetch('/api/contacts/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId })
    });
    setReceived((prev) => prev.filter((r) => r.requestId !== requestId));
    const contactsRes = await fetch('/api/contacts');
    setContacts(await contactsRes.json());
  }

  async function handleReject(requestId: string) {
    await fetch('/api/contacts/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId })
    });
    setReceived((prev) => prev.filter((r) => r.requestId !== requestId));
  }

  async function handleDelete(contactId: string) {
    if (!confirm('Remove this contact?')) return;
    await fetch('/api/contacts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId })
    });
    setContacts((prev) => prev.filter((c) => c.requestId !== contactId));
  }

  const sentIds = new Set([
    ...sent.map((s) => s.user.id),
    ...contacts.map((c) => c.user.id)
  ]);

  return (
    <div className="space-y-6">
      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Add Contact</CardTitle>
          <CardDescription>Search by name or email address.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users…"
              value={searchQuery}
              className="pl-8"
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          {searchResults.length > 0 && (
            <div className="mt-3 rounded-md border divide-y">
              {searchResults.map((u) => (
                <div key={u.id} className="flex items-center justify-between px-4 py-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={u.image ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {initials(u.name, u.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{u.name ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                  {sentIds.has(u.id) ? (
                    <span className="text-xs text-muted-foreground">Already connected</span>
                  ) : (
                    <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => handleSendRequest(u.id)}>
                      <UserPlus className="h-3.5 w-3.5" />
                      Add
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {isSearching && (
            <p className="mt-2 text-sm text-muted-foreground">Searching…</p>
          )}
        </CardContent>
      </Card>

      {/* Pending received */}
      {received.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Invitations received</CardTitle>
            <CardDescription>{received.length} pending</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y rounded-md border">
              {received.map((r) => (
                <div key={r.requestId} className="flex items-center justify-between px-4 py-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={r.user.image ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {initials(r.user.name, r.user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{r.user.name ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{r.user.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-8 gap-1" onClick={() => handleAccept(r.requestId)}>
                      <UserCheck className="h-3.5 w-3.5" />
                      Accept
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => handleReject(r.requestId)}>
                      <UserX className="h-3.5 w-3.5" />
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sent pending */}
      {sent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sent invitations</CardTitle>
            <CardDescription>{sent.length} pending</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y rounded-md border">
              {sent.map((r) => (
                <div key={r.requestId} className="flex items-center justify-between px-4 py-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={r.user.image ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {initials(r.user.name, r.user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{r.user.name ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{r.user.email}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">Pending</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contacts list */}
      <Card>
        <CardHeader>
          <CardTitle>Contacts</CardTitle>
          <CardDescription>
            {contacts.length === 0 ? 'No contacts yet.' : `${contacts.length} contact${contacts.length > 1 ? 's' : ''}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Search for users above to add your first contact.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Since</TableHead>
                  <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((c) => (
                  <TableRow key={c.requestId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={c.user.image ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {initials(c.user.name, c.user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{c.user.name ?? '—'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {c.user.email ? (
                        <a
                          href={`mailto:${c.user.email}`}
                          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          {c.user.email}
                        </a>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(c.requestId)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Remove</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
