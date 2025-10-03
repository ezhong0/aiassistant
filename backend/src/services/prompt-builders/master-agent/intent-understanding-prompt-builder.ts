import { BasePromptBuilder } from '../base-prompt-builder';
import { AIPrompt, StructuredSchema } from '../../generic-ai.service';

/**
 * Input context for intent understanding
 */
export interface IntentUnderstandingContext {
  user_query: string;
  conversation_history: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp?: string;
  }>;
  user_context: {
    email_accounts?: Array<{ id: string; email: string; primary?: boolean }>;
    calendars?: Array<{ id: string; name: string; primary?: boolean }>;
    timezone?: string;
  };
}

/**
 * Command to be executed by a SubAgent
 */
export interface Command {
  agent: 'email' | 'calendar';
  command: string;
  order: number;
}

/**
 * Write operation metadata
 */
export interface WriteMetadata {
  scope: 'single' | 'bulk';
  risk_level: 'low' | 'medium' | 'high';
}

/**
 * Result of intent understanding (Master Prompt 1)
 */
export interface IntentUnderstandingResponse {
  command_list: Command[];
  query_type: 'read' | 'write';
  write_metadata?: WriteMetadata;
  cross_account: boolean;
}

/**
 * Master Prompt 1: Intent Understanding & Command List Creation
 *
 * Replaces Situation Analysis + Workflow Planning
 * Creates initial command_list for SubAgent execution
 */
export class IntentUnderstandingPromptBuilder extends BasePromptBuilder<
  IntentUnderstandingContext,
  IntentUnderstandingResponse
> {

  getDescription(): string {
    return 'Analyzes user intent and creates natural language command list for SubAgents';
  }

  getName(): string {
    return 'IntentUnderstandingPromptBuilder';
  }

  buildPrompt(context: IntentUnderstandingContext): AIPrompt<IntentUnderstandingContext> {
    const conversationHistory = this.formatConversationHistory(context.conversation_history);
    const userContextInfo = this.formatUserContext(context.user_context);

    return {
      systemPrompt: `
You are the Master Agent's Intent Understanding module. Your role is to analyze user requests and create a structured execution plan.

CURRENT DATE/TIME: ${this.getCurrentDateTime()}

USER CONTEXT:
${userContextInfo}

CONVERSATION HISTORY:
${conversationHistory}

YOUR CHAIN OF THOUGHT PROCESS:

Step 1 - Intent Analysis
- What is the user trying to accomplish?
- What is the primary goal?
- What entities are involved (people, meetings, emails, etc.)?

Step 2 - Reference Resolution
- Does the user reference previous conversation turns (e.g., "the first email", "that meeting")?
- Scan conversation_history to resolve pronouns and references
- Extract specific IDs, names, or context from prior turns

Step 3 - READ vs WRITE Detection
- Is this a read operation (search, list, get, check) or write operation (send, create, update, delete, archive)?
- For WRITE operations:
  - Scope: single item or bulk operation (multiple items)?
  - Risk level assessment:
    * LOW: Single item, reversible (e.g., archive 1 email, mark as read)
    * MEDIUM: Bulk operation reversible, or single item high-impact (e.g., archive 50 emails, send to external recipient)
    * HIGH: Bulk operation irreversible, or very high impact (e.g., delete 100 emails permanently, send to 50 external recipients)

Step 4 - Domain Detection
- Which domains are needed? (email, calendar)
- Cross-account detection:
  * Does user say "all accounts", "across accounts", "both accounts"?
  * Does user reference multiple account emails explicitly?
  * Set cross_account: true if multi-account operation is needed

Step 5 - Ambiguity Check
- Is the request clear enough to execute?
- Are there missing parameters that SubAgents cannot infer?
- If ambiguous, still create command_list but include clarification in the command

Step 6 - Command List Creation
- Create natural language commands for SubAgents
- Each command should be:
  * Self-contained and executable
  * Include all context from user_query and conversation_history
  * Specify cross-account parameters if needed
  * Ordered logically (dependencies first)

AVAILABLE AGENTS:
- email: Send, search, reply, archive, label, star emails. Can search contacts for email addresses.
- calendar: Create, update, delete events. Check availability. Can search contacts for meeting attendees.

CRITICAL RULES:
1. Commands are natural language strings that SubAgents will interpret
2. Include cross-account instructions explicitly if cross_account: true
3. For bulk operations, let SubAgent handle the iteration - just specify the criteria
4. Always set query_type accurately (read or write)
5. For write operations, always include write_metadata with scope and risk_level
      `,
      userPrompt: `
Analyze this user request and create a command list:

USER QUERY: "${context.user_query}"

Follow your chain of thought process and generate:
1. command_list: Natural language commands for SubAgents
2. query_type: "read" or "write"
3. write_metadata: If write operation, include scope and risk_level
4. cross_account: true if multi-account operation needed
      `,
      context
    };
  }

  getSchema(): StructuredSchema {
    return {
      type: 'object',
      description: 'Intent understanding result with command list',
      properties: {
        command_list: {
          type: 'array',
          description: 'List of natural language commands for SubAgents',
          items: {
            type: 'object',
            properties: {
              agent: {
                type: 'string',
                enum: ['email', 'calendar'],
                description: 'Target SubAgent'
              },
              command: {
                type: 'string',
                description: 'Natural language command for the SubAgent'
              },
              order: {
                type: 'number',
                description: 'Execution order (1-based)'
              }
            },
            required: ['agent', 'command', 'order']
          }
        },
        query_type: {
          type: 'string',
          enum: ['read', 'write'],
          description: 'Type of operation'
        },
        write_metadata: {
          type: 'object',
          description: 'Metadata for write operations',
          properties: {
            scope: {
              type: 'string',
              enum: ['single', 'bulk'],
              description: 'Operation scope'
            },
            risk_level: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Risk level assessment'
            }
          },
          required: ['scope', 'risk_level']
        },
        cross_account: {
          type: 'boolean',
          description: 'Whether this is a cross-account operation'
        }
      },
      required: ['command_list', 'query_type', 'cross_account']
    };
  }

  protected validateContext(context: IntentUnderstandingContext): void {
    if (!context.user_query || context.user_query.trim().length === 0) {
      throw new Error('user_query is required');
    }

    if (!context.conversation_history) {
      throw new Error('conversation_history is required (can be empty array)');
    }

    if (!context.user_context) {
      throw new Error('user_context is required');
    }
  }

  /**
   * Format conversation history for prompt
   */
  private formatConversationHistory(
    history: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: string }>
  ): string {
    if (!history || history.length === 0) {
      return '(No previous conversation)';
    }

    // Only include last 5 turns to keep context manageable
    const recentHistory = history.slice(-5);

    return recentHistory
      .map((turn, idx) => {
        const timestamp = turn.timestamp ? ` [${turn.timestamp}]` : '';
        return `Turn ${idx + 1}${timestamp}:\n${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.content}`;
      })
      .join('\n\n');
  }

  /**
   * Format user context for prompt
   */
  private formatUserContext(userContext: {
    email_accounts?: Array<{ id: string; email: string; primary?: boolean }>;
    calendars?: Array<{ id: string; name: string; primary?: boolean }>;
    timezone?: string;
  }): string {
    const parts: string[] = [];

    if (userContext.timezone) {
      parts.push(`Timezone: ${userContext.timezone}`);
    }

    if (userContext.email_accounts && userContext.email_accounts.length > 0) {
      const accounts = userContext.email_accounts
        .map(acc => `  - ${acc.email}${acc.primary ? ' (primary)' : ''} [id: ${acc.id}]`)
        .join('\n');
      parts.push(`Email Accounts:\n${accounts}`);
    }

    if (userContext.calendars && userContext.calendars.length > 0) {
      const calendars = userContext.calendars
        .map(cal => `  - ${cal.name}${cal.primary ? ' (primary)' : ''} [id: ${cal.id}]`)
        .join('\n');
      parts.push(`Calendars:\n${calendars}`);
    }

    return parts.length > 0 ? parts.join('\n\n') : '(No user context available)';
  }
}
