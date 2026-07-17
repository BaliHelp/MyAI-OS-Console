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
  api_key_id: string | null;
  app_name?: string; // resolved in backend/frontend
  provider: string;
  task_type: string;
  tokens_used: number;
  created_at: string;
  ocr_fallback_to_gpt?:    boolean;
  ocr_fallback_to_claude?: boolean;
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

export interface ChatPersona {
  id: string;
  client_app_id: string;
  persona_name: string;
  tone_description: string;
  language_default: string;
  must_never_say: string[];
  updated_at: string;
}

export type ViewType = 'overview' | 'apps' | 'knowledge' | 'routing' | 'specs' | 'usage' | 'settings' | 'datacenter' | 'personas' | 'costs' | 'auditlog' | 'health';
export type Language = 'id' | 'en';
export type Theme = 'dark' | 'light';
