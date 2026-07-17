-- Migration: gw_audit_logs
-- Records all sensitive admin actions without exposing secret values.

CREATE TABLE IF NOT EXISTS gw_audit_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action     text NOT NULL,      -- e.g. 'login_success', 'revoke_api_key', 'add_provider_key'
  actor_email text,              -- admin who performed the action
  target_type text,              -- 'provider_key' | 'api_key' | 'persona' | 'field_spec' | 'auth'
  target_id  text,               -- UUID of the affected row (if applicable)
  detail     jsonb DEFAULT '{}', -- extra metadata; NEVER include raw secret values
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- Index for dashboard queries (latest first, filter by action)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON gw_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON gw_audit_logs (action);

-- RLS: Only service role can write; no public access
ALTER TABLE gw_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_service_only" ON gw_audit_logs
  FOR ALL USING (false);
