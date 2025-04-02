// Shared types for both client and server
export type Action = {
  id: string;
  description: string;
  completed: boolean;
  dueDate: Date | null;
  inboxEntryId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type InboxEntry = {
  id: string;
  title: string;
  content: string;
  actions: Action[];
  createdAt: Date;
  updatedAt: Date;
  userId: string;
};
