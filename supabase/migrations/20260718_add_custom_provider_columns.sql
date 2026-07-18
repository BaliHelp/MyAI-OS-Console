-- Migration: Add columns to support Others/Custom OpenAI Compatible provider keys
-- Run this in Supabase SQL Editor if not synced automatically:
-- ALTER TABLE gw_provider_keys ADD COLUMN base_url TEXT;
-- ALTER TABLE gw_provider_keys ADD COLUMN model_name TEXT;

ALTER TABLE gw_provider_keys ADD COLUMN IF NOT EXISTS base_url TEXT;
ALTER TABLE gw_provider_keys ADD COLUMN IF NOT EXISTS model_name TEXT;
