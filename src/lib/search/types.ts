// Shared (client + server) types for global search.

export const SEARCH_GROUPS = ["tickets", "tasks", "projects", "users", "customers", "assets", "knowledge"] as const;
export type SearchGroup = (typeof SEARCH_GROUPS)[number];

export const SEARCH_GROUP_LABELS: Record<SearchGroup, string> = {
  tickets: "Tickets",
  tasks: "Tasks",
  projects: "Projects",
  users: "Users",
  customers: "Customers",
  assets: "Assets",
  knowledge: "Knowledge",
};

export type SearchHit = {
  id: string;
  group: SearchGroup;
  title: string;
  /** Secondary text (number, email, status…). */
  subtitle: string | null;
  url: string;
  /** Optional hex color (status). */
  color?: string | null;
};

export type SearchResponse = { query: string; groups: Record<SearchGroup, SearchHit[]> };

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 100;
