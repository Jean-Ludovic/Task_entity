/**
 * Seed script — creates 4 test users + random tasks
 * Run: npx tsx scripts/seed.ts
 */
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import { users } from '../lib/auth/schema';
import { tasks } from '../lib/tasks/schema';

dotenv.config({ path: '.env' });

const pool = new Pool({ connectionString: process.env.POSTGRES_URL! });
const db = drizzle(pool);

const SEED_USERS = [
  { name: 'Alice Martin', email: 'alice@example.com', password: 'password123' },
  { name: 'Bob Dupont', email: 'bob@example.com', password: 'password123' },
  { name: 'Clara Nguyen', email: 'clara@example.com', password: 'password123' },
  { name: 'David Okoro', email: 'david@example.com', password: 'password123' }
];

const TASK_TITLES = [
  'Set up project repository',
  'Write unit tests',
  'Design database schema',
  'Implement authentication',
  'Create REST API',
  'Review pull requests',
  'Update documentation',
  'Fix login bug',
  'Deploy to staging',
  'Optimize database queries',
  'Add error handling',
  'Write integration tests',
  'Refactor authentication module',
  'Add pagination support',
  'Configure CI/CD pipeline',
  'Implement dark mode',
  'Fix responsive layout',
  'Add search functionality',
  'Set up monitoring',
  'Write API documentation'
];

const DESCRIPTIONS = [
  'High priority task that needs attention',
  'Follow up with team before proceeding',
  'Check existing implementation first',
  null,
  'Blocked by other tasks',
  null,
  'Needs code review after completion',
  null,
  'Estimated 2-3 hours of work',
  null
];

const STATUSES: Array<'todo' | 'in_progress' | 'done'> = ['todo', 'in_progress', 'done'];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysAhead: number): Date | null {
  if (Math.random() < 0.3) return null;
  const d = new Date();
  d.setDate(d.getDate() + Math.floor(Math.random() * daysAhead));
  return d;
}

async function seed() {
  console.log('🌱 Seeding database...\n');

  for (const userData of SEED_USERS) {
    // Upsert user (skip if email already exists)
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, userData.email));

    let userId: string;

    if (existing) {
      console.log(`⏭  User ${userData.email} already exists — skipping creation`);
      userId = existing.id;
    } else {
      const hashed = await bcrypt.hash(userData.password, 12);
      const [created] = await db
        .insert(users)
        .values({
          name: userData.name,
          email: userData.email,
          password: hashed
        })
        .returning();
      userId = created.id;
      console.log(`✅ Created user: ${userData.name} (${userData.email})`);
    }

    // Delete existing seed tasks for this user to avoid duplicates
    await db.delete(tasks).where(eq(tasks.userId, userId));

    // Insert 5-8 random tasks
    const taskCount = 5 + Math.floor(Math.random() * 4);
    const usedTitles = new Set<string>();
    const taskInserts = [];

    for (let i = 0; i < taskCount; i++) {
      let title = randomItem(TASK_TITLES);
      // avoid duplicate titles per user
      while (usedTitles.has(title)) title = randomItem(TASK_TITLES);
      usedTitles.add(title);

      taskInserts.push({
        userId,
        title,
        description: randomItem(DESCRIPTIONS),
        status: randomItem(STATUSES),
        dueDate: randomDate(30)
      });
    }

    await db.insert(tasks).values(taskInserts);
    console.log(`   → Inserted ${taskCount} tasks\n`);
  }

  console.log('✅ Seed complete!');
  console.log('\nTest accounts (password: password123):');
  SEED_USERS.forEach((u) => console.log(`  ${u.email}`));

  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
