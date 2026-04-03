'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const [tab, setTab] = useState<'login' | 'signup'>('login');

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-primary p-10 text-primary-foreground">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <CheckSquare className="h-6 w-6" />
          <span>TaskFlow</span>
        </div>
        <div className="space-y-2">
          <blockquote className="text-2xl font-light leading-snug">
            "Organise your work.<br />Ship what matters."
          </blockquote>
          <p className="text-sm text-primary-foreground/60">TaskFlow — task management prototype</p>
        </div>
      </div>

      <div className="flex items-center justify-center p-8 bg-muted/40">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex items-center gap-2 lg:hidden">
            <CheckSquare className="h-5 w-5" />
            <span className="font-semibold">TaskFlow</span>
          </div>

          <div className="flex rounded-lg border bg-background p-1 gap-1">
            <button
              onClick={() => setTab('login')}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                tab === 'login'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sign in
            </button>
            <button
              onClick={() => setTab('signup')}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                tab === 'signup'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sign up
            </button>
          </div>

          <Card>
            {tab === 'login' ? (
              <>
                <CardHeader>
                  <CardTitle>Welcome back</CardTitle>
                  <CardDescription>Sign in to access your tasks.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full"
                    onClick={() => signIn('github', { callbackUrl: '/tasks' })}
                  >
                    <GitHubIcon className="mr-2 h-4 w-4" />
                    Continue with GitHub
                  </Button>
                </CardContent>
              </>
            ) : (
              <>
                <CardHeader>
                  <CardTitle>Create an account</CardTitle>
                  <CardDescription>
                    Sign up instantly with your GitHub account.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full"
                    onClick={() => signIn('github', { callbackUrl: '/tasks' })}
                  >
                    <GitHubIcon className="mr-2 h-4 w-4" />
                    Sign up with GitHub
                  </Button>
                </CardContent>
              </>
            )}
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            By continuing, you agree to our terms of service.
          </p>
        </div>
      </div>
    </div>
  );
}

function GitHubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.757-1.333-1.757-1.089-.745.083-.729.083-.729 1.205.084 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.762-1.605-2.665-.3-5.466-1.334-5.466-5.931 0-1.31.468-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.3 1.23a11.5 11.5 0 0 1 3.003-.404c1.02.005 2.047.138 3.003.404 2.29-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.61-2.807 5.628-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.015 2.898-.015 3.293 0 .322.216.694.825.576C20.565 21.796 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}
