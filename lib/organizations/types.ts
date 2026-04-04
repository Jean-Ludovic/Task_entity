import { organizations, organizationMembers, organizationInvitations } from './schema';

export type Organization = typeof organizations.$inferSelect;
export type OrgMember = typeof organizationMembers.$inferSelect;
export type OrgInvitation = typeof organizationInvitations.$inferSelect;
export type OrgRole = OrgMember['role'];

export type OrgMemberWithUser = {
  userId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: OrgRole;
  joinedAt: Date;
};

export type OrganizationWithRole = Organization & {
  role: OrgRole;
  memberCount: number;
};

export type OrgInvitationWithDetails = {
  id: string;
  organization: { id: string; name: string };
  sender: { id: string; name: string | null; email: string | null };
  status: OrgInvitation['status'];
  createdAt: Date;
};
