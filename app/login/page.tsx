'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { CheckSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { register } from '@/lib/auth/actions';

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;

    startTransition(async () => {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false
      });

      if (result?.error) {
        setError('Invalid email or password.');
      } else {
        router.push('/tasks');
      }
    });
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;
    const confirm = formData.get('confirm') as string;

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    startTransition(async () => {
      const result = await register(formData);

      if ('error' in result) {
        setError(result.error);
        return;
      }

      const signInResult = await signIn('credentials', {
        email: formData.get('email') as string,
        password,
        redirect: false
      });

      if (signInResult?.error) {
        setError('Account created but sign-in failed. Try signing in manually.');
      } else {
        router.push('/tasks');
      }
    });
  }

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
          <p className="text-sm text-primary-foreground/60">
            TaskFlow — task management prototype
          </p>
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
              onClick={() => { setTab('login'); setError(''); }}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                tab === 'login'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sign in
            </button>
            <button
              onClick={() => { setTab('signup'); setError(''); }}
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
                <CardContent className="space-y-4">
                  <form onSubmit={handleLogin} className="space-y-3">
                    <Input
                      name="email"
                      type="email"
                      placeholder="Email"
                      required
                      autoComplete="email"
                    />
                    <Input
                      name="password"
                      type="password"
                      placeholder="Password"
                      required
                      autoComplete="current-password"
                    />
                    {error && (
                      <p className="text-sm text-destructive">{error}</p>
                    )}
                    <Button type="submit" className="w-full" disabled={isPending}>
                      {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Sign in
                    </Button>
                  </form>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">or</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => signIn('github', { callbackUrl: '/tasks' })}
                      disabled={isPending}
                    >
                      <GitHubIcon className="mr-2 h-4 w-4" />
                      Continue with GitHub
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => signIn('google', { callbackUrl: '/tasks' })}
                      disabled={isPending}
                    >
                      <GoogleIcon className="mr-2 h-4 w-4" />
                      Continue with Google
                    </Button>
                  </div>
                </CardContent>
              </>
            ) : (
              <>
                <CardHeader>
                  <CardTitle>Create an account</CardTitle>
                  <CardDescription>
                    Sign up with email or an OAuth provider.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form onSubmit={handleRegister} className="space-y-3">
                    <Input
                      name="name"
                      type="text"
                      placeholder="Full name"
                      required
                      autoComplete="name"
                    />
                    <Input
                      name="email"
                      type="email"
                      placeholder="Email"
                      required
                      autoComplete="email"
                    />
                    <Input
                      name="password"
                      type="password"
                      placeholder="Password (min. 8 characters)"
                      required
                      autoComplete="new-password"
                    />
                    <Input
                      name="confirm"
                      type="password"
                      placeholder="Confirm password"
                      required
                      autoComplete="new-password"
                    />
                    {error && (
                      <p className="text-sm text-destructive">{error}</p>
                    )}
                    <Button type="submit" className="w-full" disabled={isPending}>
                      {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create account
                    </Button>
                  </form>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">or</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => signIn('github', { callbackUrl: '/tasks' })}
                      disabled={isPending}
                    >
                      <GitHubIcon className="mr-2 h-4 w-4" />
                      Sign up with GitHub
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => signIn('google', { callbackUrl: '/tasks' })}
                      disabled={isPending}
                    >
                      <GoogleIcon className="mr-2 h-4 w-4" />
                      Sign up with Google
                    </Button>
                  </div>
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
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.757-1.333-1.757-1.089-.745.083-.729.083-.729 1.205.084 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.762-1.605-2.665-.3-5.466-1.334-5.466-5.931 0-1.31.468-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.3 1.23a11.5 11.5 0 0 1 3.003-.404c1.02.005 2.047.138 3.003.404 2.29-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.61-2.807 5.628-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.015 2.898-.015 3.293 0 .322.216.694.825.576C20.565 21.796 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
