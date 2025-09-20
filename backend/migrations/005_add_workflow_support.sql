-- Migration: Add workflow support to confirmations table and create workflow tracking tables
-- Stores workflow state and search history for intelligent multi-agent workflows

-- Add workflow_id to confirmations table
ALTER TABLE confirmations ADD COLUMN workflow_id TEXT;
CREATE INDEX idx_confirmations_workflow ON confirmations(workflow_id);

-- Create workflow_search_history table for tracking search patterns and results
CREATE TABLE IF NOT EXISTS workflow_search_history (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  search_query TEXT NOT NULL,
  time_range TEXT NOT NULL,
  result_count INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  analysis_result JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_workflow_search_history_workflow ON workflow_search_history(workflow_id);
CREATE INDEX idx_workflow_search_history_success ON workflow_search_history(success);
CREATE INDEX idx_workflow_search_history_created ON workflow_search_history(created_at DESC);

-- Create workflow_templates table for reusable workflow patterns
CREATE TABLE IF NOT EXISTS workflow_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  template_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_workflow_templates_name ON workflow_templates(name);

-- Create user_workflow_preferences table for personalized workflow behavior
CREATE TABLE IF NOT EXISTS user_workflow_preferences (
  user_id TEXT PRIMARY KEY,
  preferences JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_workflow_preferences_user ON user_workflow_preferences(user_id);

-- Create workflow_analytics table for performance monitoring
CREATE TABLE IF NOT EXISTS workflow_analytics (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  execution_time INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_workflow_analytics_workflow ON workflow_analytics(workflow_id);
CREATE INDEX idx_workflow_analytics_success ON workflow_analytics(success);
CREATE INDEX idx_workflow_analytics_execution_time ON workflow_analytics(execution_time);
CREATE INDEX idx_workflow_analytics_created ON workflow_analytics(created_at DESC);

-- Insert default workflow templates
INSERT INTO workflow_templates (id, name, description, template_data) VALUES
(
  'email_search_template',
  'Email Search Template',
  'Template for intelligent email search with time range expansion',
  '{
    "description": "Search for emails with intelligent time range expansion",
    "steps": [
      {
        "stepNumber": 1,
        "description": "Search for emails matching query from past 3 months",
        "toolCall": {
          "name": "emailAgent",
          "parameters": {
            "operation": "search",
            "timeRange": "past_3_months",
            "maxResults": 10
          }
        }
      },
      {
        "stepNumber": 2,
        "description": "Analyze search results to determine if target email was found",
        "toolCall": {
          "name": "thinkAgent",
          "parameters": {
            "query": "Analyze these email search results and determine if the target email was found. If not found, suggest next search strategy."
          }
        }
      }
    ]
  }'
),
(
  'meeting_scheduling_template',
  'Meeting Scheduling Template',
  'Template for scheduling meetings with contact resolution and availability checking',
  '{
    "description": "Schedule meeting with contact resolution and availability checking",
    "steps": [
      {
        "stepNumber": 1,
        "description": "Find contact information for meeting attendees",
        "toolCall": {
          "name": "contactAgent",
          "parameters": {
            "operation": "search"
          }
        }
      },
      {
        "stepNumber": 2,
        "description": "Check availability for all attendees",
        "toolCall": {
          "name": "calendarAgent",
          "parameters": {
            "operation": "check_availability",
            "duration": "1 hour"
          }
        }
      },
      {
        "stepNumber": 3,
        "description": "Suggest optimal meeting times",
        "toolCall": {
          "name": "calendarAgent",
          "parameters": {
            "operation": "suggest_times",
            "duration": "1 hour"
          }
        }
      }
    ]
  }'
),
(
  'contact_lookup_template',
  'Contact Lookup Template',
  'Template for finding contact information with intelligent resolution',
  '{
    "description": "Find contact information with intelligent resolution",
    "steps": [
      {
        "stepNumber": 1,
        "description": "Search for contact information",
        "toolCall": {
          "name": "contactAgent",
          "parameters": {
            "operation": "search"
          }
        }
      },
      {
        "stepNumber": 2,
        "description": "Analyze contact results and resolve ambiguities",
        "toolCall": {
          "name": "thinkAgent",
          "parameters": {
            "query": "Analyze these contact search results and resolve any ambiguities. Suggest the most likely contact based on context."
          }
        }
      }
    ]
  }'
),
(
  'calendar_query_template',
  'Calendar Query Template',
  'Template for querying calendar with intelligent event analysis',
  '{
    "description": "Query calendar with intelligent event analysis",
    "steps": [
      {
        "stepNumber": 1,
        "description": "Search calendar for relevant events",
        "toolCall": {
          "name": "calendarAgent",
          "parameters": {
            "operation": "search"
          }
        }
      },
      {
        "stepNumber": 2,
        "description": "Analyze calendar results and provide insights",
        "toolCall": {
          "name": "thinkAgent",
          "parameters": {
            "query": "Analyze these calendar events and provide relevant insights based on the user query."
          }
        }
      }
    ]
  }'
);

-- Add comments for documentation
COMMENT ON TABLE workflow_search_history IS 'Tracks search history for learning and optimization';
COMMENT ON TABLE workflow_templates IS 'Reusable workflow patterns for common scenarios';
COMMENT ON TABLE user_workflow_preferences IS 'User-specific workflow preferences and behavior patterns';
COMMENT ON TABLE workflow_analytics IS 'Performance metrics and analytics for workflow execution';

COMMENT ON COLUMN confirmations.workflow_id IS 'Links confirmations to specific workflows for tracking';
COMMENT ON COLUMN workflow_search_history.analysis_result IS 'JSONB field storing AI analysis of search results';
COMMENT ON COLUMN workflow_templates.template_data IS 'JSONB field storing complete workflow template definition';
COMMENT ON COLUMN user_workflow_preferences.preferences IS 'JSONB field storing user-specific workflow preferences';
COMMENT ON COLUMN workflow_analytics.execution_time IS 'Execution time in milliseconds';
