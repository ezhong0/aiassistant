-- Migration: Create simplified user_tokens table
-- Replace complex session management with simple OAuth token storage

-- Create user_tokens table
CREATE TABLE IF NOT EXISTS user_tokens (
  user_id TEXT PRIMARY KEY,                    -- Slack user ID or other user identifier
  
  -- Google OAuth tokens
  google_access_token TEXT,
  google_refresh_token TEXT,
  google_expires_at TIMESTAMP,
  google_token_type TEXT,
  google_scope TEXT,
  
  -- Slack OAuth tokens  
  slack_access_token TEXT,
  slack_team_id TEXT,
  slack_user_id TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_user_tokens_google_expires 
  ON user_tokens(google_expires_at) 
  WHERE google_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_tokens_slack_team_user 
  ON user_tokens(slack_team_id, slack_user_id) 
  WHERE slack_team_id IS NOT NULL;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_tokens_updated_at 
  BEFORE UPDATE ON user_tokens 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Note: This migration creates the new simplified table structure
-- The old session-based tables can be dropped after confirming the new system works
-- To migrate existing data, run a separate data migration script