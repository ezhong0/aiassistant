/**
 * Query Intent Types
 *
 * Simple semantic representation of user intent.
 * No technical details (Gmail API syntax, execution order, etc.)
 * Just WHAT the user wants, not HOW to get it.
 */

export type QueryAction =
  | 'filter_emails'
  | 'filter_calendar'
  | 'summarize_thread'
  | 'find_commitment'
  | 'schedule_meeting'
  | 'send_reply'
  | 'label_emails'
  | 'archive_emails'
  | 'search_context';

export type CriterionType =
  // Semantic criteria (need strategies)
  | 'urgency'              // High/medium/low urgency
  | 'sender_type'          // investor, boss, customer, peer, etc.
  | 'requires_response'    // Needs reply/action
  | 'has_commitment'       // User made a promise
  | 'is_question'          // Contains question
  | 'is_escalation'        // Following up, bumping

  // Simple criteria (map to Gmail filters)
  | 'sender_name'          // Specific person
  | 'sender_email'         // Specific email
  | 'recipient'            // To field
  | 'subject_contains'     // Text in subject
  | 'body_contains'        // Text in body/snippet
  | 'has_attachment'       // Has files
  | 'is_read'              // Read status
  | 'is_starred'           // Starred
  | 'label'                // Has label
  | 'in_folder'            // inbox, sent, trash

  // Time criteria
  | 'time_absolute'        // Specific date/range
  | 'time_relative';       // last_7d, today, this_week

export interface QueryCriterion {
  type: CriterionType;
  value: string | boolean | number;
  modifier?: 'NOT' | 'HIGH' | 'LOW' | 'ANY';
  confidence?: number; // 0-100
}

export interface QueryIntent {
  // What action to perform
  action: QueryAction;

  // Filtering criteria
  criteria: QueryCriterion[];

  // Data scope
  scope?: 'inbox' | 'sent' | 'all' | 'archive' | 'important';

  // Time constraints
  time_frame?: string; // "today", "last_7d", "2025-01-01:2025-01-31"

  // Output preferences
  output?: {
    format?: 'list' | 'summary' | 'count' | 'grouped';
    max_results?: number;
    sort_by?: 'date' | 'relevance' | 'urgency' | 'sender';
    group_by?: 'sender' | 'thread' | 'date' | 'label';
  };

  // Additional context
  context?: {
    thread_id?: string;
    reference_emails?: string[];
    mentioned_people?: string[];
  };
}

/**
 * Result from intent extraction
 */
export interface IntentExtractionResult {
  intent: QueryIntent;
  confidence: number; // 0-100
  ambiguities?: string[]; // Things that need clarification
  extracted_entities?: {
    people?: string[];
    dates?: string[];
    topics?: string[];
  };
}
