import Link from 'next/link';
import {
  CheckSquare,
  LayoutDashboard,
  PanelLeft,
  Settings
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Analytics } from '@vercel/analytics/react';
import { UserNav } from './user-nav';
import Providers from './providers';
import { NavItem } from './nav-item';
import { SearchInput } from './search';
import { DashboardBreadcrumb } from './breadcrumb';

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <main className="flex min-h-screen w-full flex-col bg-muted/40">
        <DesktopNav />
        <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-56">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
            <MobileNav />
            <DashboardBreadcrumb />
            <SearchInput />
          </header>
          <main className="grid flex-1 items-start gap-2 p-4 sm:px-6 sm:py-0 md:gap-4 bg-muted/40">
            {children}
          </main>
        </div>
        <Analytics />
      </main>
    </Providers>
  );
}

function DesktopNav() {
  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-56 flex-col border-r bg-background sm:flex">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Link href="/tasks" className="flex items-center gap-2 font-semibold">
          <CheckSquare className="h-5 w-5" />
          <span>TaskFlow</span>
        </Link>
      </div>

      <nav className="flex flex-col gap-1 px-2 py-4">
        <NavItem href="/tasks" label="Dashboard">
          <LayoutDashboard className="h-5 w-5" />
        </NavItem>
        <NavItem href="/tasks" label="Tasks">
          <CheckSquare className="h-5 w-5" />
        </NavItem>
      </nav>

      <div className="mt-auto border-t px-2 py-4">
        <NavItem href="#" label="Settings">
          <Settings className="h-5 w-5" />
        </NavItem>
        <div className="mt-2">
          <UserNav />
        </div>
      </div>
    </aside>
  );
}

function MobileNav() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="icon" variant="outline" className="sm:hidden">
          <PanelLeft className="h-5 w-5" />
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="sm:max-w-xs">
        <nav className="grid gap-6 text-lg font-medium">
          <Link
            href="/tasks"
            className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base"
          >
            <CheckSquare className="h-5 w-5 transition-all group-hover:scale-110" />
            <span className="sr-only">TaskFlow</span>
          </Link>
          <Link
            href="/tasks"
            className="flex items-center gap-4 px-2.5 text-foreground"
          >
            <LayoutDashboard className="h-5 w-5" />
            Dashboard
          </Link>
          <Link
            href="/tasks"
            className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
          >
            <CheckSquare className="h-5 w-5" />
            Tasks
          </Link>
          <Link
            href="#"
            className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
          >
            <Settings className="h-5 w-5" />
            Settings
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
