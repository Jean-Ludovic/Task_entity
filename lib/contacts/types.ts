import { contactRequests } from './schema';
import { users } from '@/lib/auth/schema';

export type ContactRequest = typeof contactRequests.$inferSelect;

export type ContactStatus = ContactRequest['status'];

// A contact as seen by the current user — includes the other party's profile
export type ContactWithUser = {
  requestId: string;
  status: ContactStatus;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  /** true = current user sent the request, false = received it */
  isSender: boolean;
};
