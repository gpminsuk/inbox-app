// Shared types for both client and server
export type Action = {
  id: string;
  description: string;
  completed: boolean;
  dueDate: Date | null;
  inboxEntryId: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    agentStatus?: 'running' | 'completed' | 'error';
    agentResult?: string;
    agentError?: string;
    agentTaskId?: string;
    recordingFile?: string; // Path to browser recording
  };
};

export type InboxEntry = {
  id: string;
  title: string;
  content: string;
  actions: Action[];
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  emailId?: string | null; // Make emailId accept null values
};

// Agent result types
export type AgentActionResult = {
  is_done: boolean;
  success: boolean | null;
  extracted_content: string | null;
  error: string | null;
  include_in_memory: boolean;
};

export type AgentModelOutput = {
  [key: string]: any;
  interacted_element: any;
};

export type AgentHistoryList = {
  all_results: AgentActionResult[];
  all_model_outputs: AgentModelOutput[];
  recordingFile?: string; // Path to browser recording
};