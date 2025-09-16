/**
 * Slack Context Extraction Types and Definitions
 * Focused type definitions for Slack context extraction
 */

import { SlackContext } from '../slack/slack.types';

/**
 * Slack context extraction source data
 */
export interface SlackContextExtractionSource {
  event: any;
  teamId: string;
  payload?: any;
  commandInfo?: {
    command: string;
    channelName: string;
    triggerId: string;
    responseUrl: string;
  };
}

/**
 * Slack context extraction result
 */
export interface SlackContextExtractionResult {
  success: boolean;
  context?: SlackContext;
  error?: string;
  extractionMethod: 'event' | 'command' | 'interactive';
  metadata?: {
    eventType?: string;
    channelType?: string;
    isDirectMessage?: boolean;
    hasThread?: boolean;
  };
}

/**
 * Slack context validation result
 */
export interface SlackContextValidationResult {
  isValid: boolean;
  context?: SlackContext;
  errors: string[];
  warnings: string[];
}

/**
 * Slack context enrichment data
 */
export interface SlackContextEnrichmentData {
  context: SlackContext;
  userName?: string;
  channelName?: string;
  teamName?: string;
  isFirstTimeUser?: boolean;
  hasOAuth?: boolean;
  lastActivity?: number;
}

/**
 * Slack context enrichment result
 */
export interface SlackContextEnrichmentResult {
  success: boolean;
  enrichedContext?: SlackContextEnrichmentData;
  error?: string;
  enrichmentLevel: 'basic' | 'enhanced' | 'full';
}

/**
 * Slack session creation data
 */
export interface SlackSessionCreationData {
  slackContext: SlackContext;
  sessionId?: string;
  expiresAt?: number;
  metadata?: Record<string, any>;
}

/**
 * Slack session creation result
 */
export interface SlackSessionCreationResult {
  success: boolean;
  sessionId?: string;
  error?: string;
  expiresAt?: number;
  created: boolean; // true if new session, false if existing
}

/**
 * Slack context extraction configuration
 */
export interface SlackContextExtractionConfig {
  enableValidation: boolean;
  enableEnrichment: boolean;
  enableSessionCreation: boolean;
  sessionTTL: number; // in milliseconds
  maxContextAge: number; // in milliseconds
}
