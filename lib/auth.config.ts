import type { NextAuthConfig } from 'next-auth';

export const authConfig: NextAuthConfig = {
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLoginPage = nextUrl.pathname === '/login';

      if (isLoggedIn && isOnLoginPage) {
        return Response.redirect(new URL('/tasks', nextUrl));
      }
      if (!isLoggedIn && !isOnLoginPage) {
        return Response.redirect(new URL('/login', nextUrl));
      }
      return true;
    }
  }
};
