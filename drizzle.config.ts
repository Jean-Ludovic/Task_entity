import type { Config } from 'drizzle-kit';

export default {
  schema: [
    './lib/auth/schema.ts',
    './lib/contacts/schema.ts',
    './lib/organizations/schema.ts',
    './lib/tasks/schema.ts',
    './lib/notifications/schema.ts'
  ],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL!
  }
} satisfies Config;
