import { z } from 'zod';

export const SendRequestSchema = z.object({
  receiverId: z.string().min(1, 'receiverId is required')
});

export const RequestActionSchema = z.object({
  requestId: z.string().min(1, 'requestId is required')
});

export const DeleteContactSchema = z.object({
  contactId: z.string().min(1, 'contactId is required')
});

export const UserSearchSchema = z.object({
  q: z.string().min(1).max(100)
});

export type SendRequestInput = z.infer<typeof SendRequestSchema>;
export type RequestActionInput = z.infer<typeof RequestActionSchema>;
export type DeleteContactInput = z.infer<typeof DeleteContactSchema>;
export type UserSearchInput = z.infer<typeof UserSearchSchema>;
