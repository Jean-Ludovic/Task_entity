import { auth, signOut } from '@/lib/auth';
import Image from 'next/image';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';

export async function UserNav() {
  const session = await auth();
  const user = session?.user;

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button className="flex h-9 w-9 items-center justify-center rounded-full overflow-hidden border bg-muted hover:ring-2 hover:ring-primary transition-all md:h-8 md:w-8">
              {user?.image ? (
                <Image
                  src={user.image}
                  width={36}
                  height={36}
                  alt="Avatar"
                  className="rounded-full object-cover"
                />
              ) : (
                <span className="text-xs font-semibold text-foreground">
                  {initials}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p className="font-medium">{user?.name ?? 'Account'}</p>
          {user?.email && (
            <p className="text-xs text-muted-foreground">{user.email}</p>
          )}
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent side="right" align="end" className="w-52">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span>{user?.name ?? 'Account'}</span>
          {user?.email && (
            <span className="text-xs font-normal text-muted-foreground truncate">
              {user.email}
            </span>
          )}
        </DropdownMenuLabel>
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
