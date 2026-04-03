import { auth, signOut } from '@/lib/auth';
import Image from 'next/image';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

export async function UserNav() {
  const session = await auth();
  const user = session?.user;

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-accent transition-colors">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full overflow-hidden bg-primary text-primary-foreground">
            {user?.image ? (
              <Image
                src={user.image}
                width={32}
                height={32}
                alt="Avatar"
                className="rounded-full object-cover"
              />
            ) : (
              <span className="text-xs font-semibold">{initials}</span>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium truncate">
              {user?.name ?? 'Account'}
            </span>
            {user?.email && (
              <span className="text-xs text-muted-foreground truncate">
                {user.email}
              </span>
            )}
          </div>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="right" align="end" className="w-52">
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <button type="submit" className="w-full text-left">
              Sign Out
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
