import { z } from 'zod';

export const TaskStatusSchema = z.enum(['todo', 'in_progress', 'done']);

export const CreateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  status: TaskStatusSchema.optional().default('todo'),
  dueDate: z.string().datetime({ offset: true }).optional().nullable()
});

export const UpdateTaskSchema = CreateTaskSchema.partial();

export const ListTasksQuerySchema = z.object({
  q: z.string().optional(),
  status: TaskStatusSchema.optional(),
  sort: z.enum(['createdAt', 'dueDate']).optional().default('createdAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20)
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type ListTasksQuery = z.infer<typeof ListTasksQuerySchema>;
