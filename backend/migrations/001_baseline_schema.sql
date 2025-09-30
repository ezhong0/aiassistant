-- Migration 001: Baseline Schema
-- This is the clean baseline schema after database cleanup
-- Created: September 30, 2025

-- Create user_tokens table (the only table we actually use)
CREATE TABLE user_tokens (
  user_id TEXT PRIMARY KEY,  -- Format: teamId:slackUserId or just userId

  -- Google OAuth tokens (encrypted by application layer)
  google_access_token TEXT,
  google_refresh_token TEXT,
  google_expires_at TIMESTAMPTZ,
  google_token_type TEXT DEFAULT 'Bearer',
  google_scope TEXT,

  -- Slack OAuth tokens (encrypted by application layer)
  slack_access_token TEXT,
  slack_team_id TEXT,
  slack_user_id TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Optimized indexes for common queries
CREATE INDEX idx_user_tokens_google_expires
  ON user_tokens(google_expires_at)
  WHERE google_expires_at IS NOT NULL;

CREATE INDEX idx_user_tokens_slack_team_user
  ON user_tokens(slack_team_id, slack_user_id)
  WHERE slack_team_id IS NOT NULL;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Updated_at trigger for user_tokens
CREATE TRIGGER update_user_tokens_updated_at
  BEFORE UPDATE ON user_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE user_tokens IS 'Stores OAuth tokens for Google and Slack. Tokens are encrypted by the application layer.';
COMMENT ON COLUMN user_tokens.user_id IS 'Unique user identifier, format: teamId:slackUserId';
COMMENT ON COLUMN user_tokens.google_expires_at IS 'Google token expiration time (UTC)';
