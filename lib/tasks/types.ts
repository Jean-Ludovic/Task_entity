import { tasks } from './schema';

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

export type TaskStatus = Task['status'];

export type PaginatedTasks = {
  tasks: Task[];
  nextCursor: string | null;
};

export type TaskWithContext = Task & {
  assignedBy: { id: string; name: string | null } | null;
  assignedTo: { id: string; name: string | null } | null;
  organization: { id: string; name: string } | null;
};
