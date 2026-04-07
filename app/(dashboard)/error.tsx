'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function DashboardError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isDbError =
    error.message?.toLowerCase().includes('does not exist') ||
    error.message?.toLowerCase().includes('connection');

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <div className="flex flex-col items-center gap-2 text-center max-w-md">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <h1 className="text-xl font-semibold">Something went wrong</h1>

        {isDbError ? (
          <p className="text-sm text-muted-foreground">
            The database table is not ready yet. Run{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
              pnpm db:push
            </code>{' '}
            to create the schema, then refresh.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{error.message}</p>
        )}

        <Button size="sm" onClick={reset} className="mt-2">
          Try again
        </Button>
      </div>
    </main>
  );
}
