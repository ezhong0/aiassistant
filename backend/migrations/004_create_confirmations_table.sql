-- Migration: Create confirmations table for confirmation and preview system
-- Stores pending action confirmations with preview data and execution results

-- Create confirmations table
CREATE TABLE IF NOT EXISTS confirmations (
  id TEXT PRIMARY KEY,                         -- Confirmation ID (conf_xxxx format)
  session_id TEXT NOT NULL,                    -- Session ID for tracking
  user_id TEXT,                                -- User ID (optional)
  
  -- Action data (stored as JSONB for flexibility and indexing)
  action_preview JSONB NOT NULL,               -- ActionPreview object with all preview data
  original_tool_call JSONB NOT NULL,           -- Original ToolCall that requires confirmation
  
  -- Status tracking
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'rejected', 'expired', 'executed', 'failed')),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  confirmed_at TIMESTAMP,                      -- When user responded to confirmation
  executed_at TIMESTAMP,                       -- When action was actually executed
  
  -- Execution results
  execution_result JSONB,                      -- ToolResult from execution (if executed)
  
  -- Context for Slack integration
  slack_context JSONB,                         -- Slack team, channel, user, thread info
  response_context JSONB                       -- Context from user's response
);

-- Add indexes for common queries and performance
CREATE INDEX IF NOT EXISTS idx_confirmations_session_status 
  ON confirmations(session_id, status);

CREATE INDEX IF NOT EXISTS idx_confirmations_status_expires 
  ON confirmations(status, expires_at) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_confirmations_user_created 
  ON confirmations(user_id, created_at DESC) 
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_confirmations_slack_team_user 
  ON confirmations USING GIN((slack_context->>'team_id'), (slack_context->>'user_id')) 
  WHERE slack_context IS NOT NULL;

-- Index on action type for analytics
CREATE INDEX IF NOT EXISTS idx_confirmations_action_type 
  ON confirmations USING GIN((action_preview->>'actionType'));

-- Index for cleanup operations
CREATE INDEX IF NOT EXISTS idx_confirmations_expired_cleanup 
  ON confirmations(expires_at, status) 
  WHERE status IN ('pending', 'confirmed');

-- Add updated_at trigger for tracking changes
-- (Reuse the function from previous migration)
CREATE TRIGGER update_confirmations_updated_at 
  BEFORE UPDATE ON confirmations 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add check constraint to ensure confirmed_at is set when status changes to confirmed/rejected
ALTER TABLE confirmations 
  ADD CONSTRAINT check_confirmed_at 
  CHECK (
    (status IN ('confirmed', 'rejected') AND confirmed_at IS NOT NULL) 
    OR 
    (status NOT IN ('confirmed', 'rejected'))
  );

-- Add check constraint to ensure executed_at is set when status is executed/failed
ALTER TABLE confirmations 
  ADD CONSTRAINT check_executed_at 
  CHECK (
    (status IN ('executed', 'failed') AND executed_at IS NOT NULL AND execution_result IS NOT NULL) 
    OR 
    (status NOT IN ('executed', 'failed'))
  );

-- Comments for documentation
COMMENT ON TABLE confirmations IS 'Stores action confirmations with preview data and execution tracking';
COMMENT ON COLUMN confirmations.id IS 'Unique confirmation identifier (conf_xxxx format)';
COMMENT ON COLUMN confirmations.action_preview IS 'ActionPreview object with title, description, risk assessment, and preview data';
COMMENT ON COLUMN confirmations.original_tool_call IS 'Original ToolCall that triggered the confirmation requirement';
COMMENT ON COLUMN confirmations.slack_context IS 'Slack integration context: team_id, channel_id, user_id, thread_ts, message_ts';
COMMENT ON COLUMN confirmations.response_context IS 'Context from user response: slack_user_id, response_channel, response_thread_ts';

-- Grant appropriate permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON confirmations TO your_app_user;
-- GRANT USAGE ON confirmations_id_seq TO your_app_user; -- if using sequences

-- Note: This table supports the confirmation and preview system architecture
-- It stores rich preview data as JSONB for flexibility while maintaining performance through targeted indexes
-- The status field tracks the full lifecycle of confirmations from creation to execution
-- Cleanup of expired confirmations should be handled by the confirmation system