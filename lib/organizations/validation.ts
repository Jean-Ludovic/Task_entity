import { z } from 'zod';

export const CreateOrgSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional()
});

export const InviteMemberSchema = z.object({
  organizationId: z.string().min(1),
  receiverId: z.string().min(1)
});

export const RemoveMemberSchema = z.object({
  organizationId: z.string().min(1),
  userId: z.string().min(1)
});

export const InvitationActionSchema = z.object({
  invitationId: z.string().min(1)
});

export type CreateOrgInput = z.infer<typeof CreateOrgSchema>;
export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;
export type RemoveMemberInput = z.infer<typeof RemoveMemberSchema>;
export type InvitationActionInput = z.infer<typeof InvitationActionSchema>;
