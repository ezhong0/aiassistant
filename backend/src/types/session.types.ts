/**
 * Session state types for conversation management
 */

import { CommandWithStatus } from '../services/prompt-builders/master-agent/context-update-prompt-builder';

/**
 * Master Agent state
 */
export interface MasterState {
  accumulated_knowledge: string;
  command_list: CommandWithStatus[];
}

/**
 * SubAgent working data storage
 */
export interface SubAgentStates {
  email?: Record<string, unknown>;
  calendar?: Record<string, unknown>;
  contact?: Record<string, unknown>;
  [key: string]: Record<string, unknown> | undefined;
}

/**
 * Conversation message
 */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/**
 * Complete session state
 */
export interface SessionState {
  sessionId: string;
  userId: string;
  masterState: MasterState;
  subAgentStates: SubAgentStates;
  conversationHistory: ConversationMessage[];
  createdAt: number;
  lastAccessedAt: number;
}

/**
 * Session creation options
 */
export interface CreateSessionOptions {
  userId: string;
  sessionId?: string;
}
