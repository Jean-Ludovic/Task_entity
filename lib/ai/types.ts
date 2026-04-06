// Types TypeScript correspondant exactement aux schémas Pydantic de ai_service/models/schemas.py

export type AiTaskStatus = 'todo' | 'in_progress' | 'done';
export type AiTaskPriority = 'low' | 'medium' | 'high';

// ─── Task Assistant ────────────────────────────────────────────────────────────

export type ExtractedTask = {
  title: string;
  description: string | null;
  status: AiTaskStatus;
  priority: AiTaskPriority;
  due_date: string | null; // YYYY-MM-DD
};

export type TaskAssistantResponse = {
  tasks: ExtractedTask[];
  raw_text: string;
};

// ─── Smart Search ──────────────────────────────────────────────────────────────

export type SearchFilters = {
  status: AiTaskStatus | null;
  priority: AiTaskPriority | null;
  keywords: string[];
  due_before: string | null;
  due_after: string | null;
  interpretation: string;
};

export type SmartSearchResponse = {
  filters: SearchFilters;
  original_query: string;
};

// ─── Dashboard Summary ─────────────────────────────────────────────────────────

export type SuggestedAction = {
  action: string;
  reason: string;
};

export type DashboardSummaryResponse = {
  summary: string;
  top_priorities: string[];
  suggested_actions: SuggestedAction[];
  urgent_tasks: string[];
};
