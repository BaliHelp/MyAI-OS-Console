export interface ClientApp {
  id: string;
  name: string;
  slug: string;
  tier: 'internal' | 'community';
  status: 'active' | 'inactive';
  created_at: string;
  key_count?: number;
}

export interface ApiKey {
  id: string;
  client_app_id: string;
  key_prefix: string;
  key_hash: string;
  provider_scope: string[]; // e.g. ['claude', 'gpt', 'gemini']
  rate_limit_per_day: number | null; // null = unlimited
  status: 'active' | 'revoked';
  created_at: string;
  last_used_at: string | null;
}

export interface UsageLog {
  id: string;
  api_key_id: string;
  app_name?: string; // resolved in backend/frontend
  provider: 'claude' | 'gpt' | 'gemini';
  task_type: 'text' | 'image' | 'audio' | 'embeddings';
  tokens_used: number;
  created_at: string;
}

export interface BusinessProfile {
  id: string;
  title: string;
  content: string;
  updated_at: string;
}

export interface KnowledgeDocument {
  id: string;
  client_app_id: string | null; // null = global
  title: string;
  content: string;
  created_at: string;
}

export type ViewType = 'overview' | 'apps' | 'knowledge' | 'routing' | 'specs' | 'usage' | 'settings';
export type Language = 'id' | 'en';
export type Theme = 'dark' | 'light';
