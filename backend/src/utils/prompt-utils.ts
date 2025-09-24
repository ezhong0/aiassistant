/**
 * Prompt Utilities
 *
 * Helper functions for building consistent, context-aware prompts across the system
 */

import { AgentExecutionContext, ConversationTurn, UserPreferences } from '../types/agents/natural-language.types';

export class PromptUtils {
  /**
   * Get temporal context string for prompts
   * Includes current date/time in user's timezone
   */
  static getTemporalContext(context: AgentExecutionContext): string {
    const timezone = context.timezone || 'America/Los_Angeles'; // Default to PST
    const locale = context.locale || 'en-US';

    const now = new Date();
    const userDateTime = now.toLocaleString(locale, {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    return `Current date/time: ${userDateTime}\nTimezone: ${timezone}`;
  }

  /**
   * Get conversation history context string
   * Shows recent turns for multi-turn understanding
   */
  static getConversationContext(context: AgentExecutionContext, maxTurns: number = 3): string {
    if (!context.conversationHistory || context.conversationHistory.length === 0) {
      return '';
    }

    const recentTurns = context.conversationHistory.slice(-maxTurns);
    const historyText = recentTurns.map(turn => {
      const role = turn.role === 'user' ? 'User' : `Assistant${turn.agentName ? ` (${turn.agentName})` : ''}`;
      return `${role}: ${turn.message}`;
    }).join('\n');

    return `\nRecent conversation:\n${historyText}\n`;
  }

  /**
   * Get user preferences context string
   * Describes how to tailor the response
   */
  static getUserPreferencesContext(prefs?: UserPreferences): string {
    if (!prefs) {
      return '';
    }

    const parts: string[] = [];

    if (prefs.verbosity) {
      parts.push(`- Response style: ${prefs.verbosity}`);
    }

    if (prefs.tone) {
      parts.push(`- Tone: ${prefs.tone}`);
    }

    if (prefs.includeMetadata !== undefined) {
      parts.push(prefs.includeMetadata
        ? '- Include relevant IDs, links, and technical details'
        : '- Hide technical details, focus on user-friendly information'
      );
    }

    if (prefs.displayName) {
      parts.push(`- User prefers to be called: ${prefs.displayName}`);
    }

    if (parts.length === 0) {
      return '';
    }

    return `\nUser preferences:\n${parts.join('\n')}\n`;
  }

  /**
   * Build complete context block for prompts
   * Combines temporal, conversation, and preference context
   */
  static buildContextBlock(context: AgentExecutionContext, options?: {
    includeTemporal?: boolean;
    includeConversation?: boolean;
    includePreferences?: boolean;
    maxConversationTurns?: number;
  }): string {
    const opts = {
      includeTemporal: true,
      includeConversation: true,
      includePreferences: true,
      maxConversationTurns: 3,
      ...options
    };

    const parts: string[] = [];

    if (opts.includeTemporal) {
      parts.push(this.getTemporalContext(context));
    }

    if (opts.includeConversation) {
      const convContext = this.getConversationContext(context, opts.maxConversationTurns);
      if (convContext) {
        parts.push(convContext);
      }
    }

    if (opts.includePreferences) {
      const prefContext = this.getUserPreferencesContext(context.userPreferences);
      if (prefContext) {
        parts.push(prefContext);
      }
    }

    return parts.join('\n');
  }

  /**
   * Add few-shot examples to a prompt
   */
  static addFewShotExamples(examples: Array<{ input: string; output: string }>): string {
    if (examples.length === 0) {
      return '';
    }

    const exampleText = examples.map((ex, i) =>
      `Example ${i + 1}:\nInput: ${ex.input}\nOutput: ${ex.output}`
    ).join('\n\n');

    return `\nExamples:\n${exampleText}\n`;
  }

  /**
   * Format agent capabilities for selection prompts
   */
  static formatAgentCapabilities(agents: Array<{
    name: string;
    capabilities: string[];
    limitations: string[];
    description?: string;
  }>): string {
    return agents.map(agent => `
${agent.name}:
  Description: ${agent.description || 'N/A'}
  Can: ${agent.capabilities.join(', ')}
  Cannot: ${agent.limitations.join(', ')}
    `.trim()).join('\n\n');
  }
}