import { BaseSubAgentPromptBuilder, BaseSubAgentResponse } from '../sub-agent-base-prompt-builder';
import { AIPrompt, StructuredSchema } from '../../generic-ai.service';
import { ToolCall } from '../../../framework/tool-execution';

/**
 * Input context for command interpretation
 */
export interface CommandInterpretationContext {
  master_command: string;
  user_context?: {
    email_accounts?: Array<{ id: string; email: string; primary?: boolean }>;
    calendars?: Array<{ id: string; name: string; primary?: boolean }>;
    timezone?: string;
  };
  cross_account_intent?: boolean;
}

/**
 * Result of command interpretation (SubAgent Prompt 1)
 */
export interface CommandInterpretationResponse extends BaseSubAgentResponse {
  working_data: Record<string, unknown>; // Initial working data (usually empty)
  tool_call_list: ToolCall[]; // List of tool calls to execute
  execution_plan: string; // Plan for execution
  query_type: 'read' | 'write';
  scope?: 'single' | 'bulk';
  needs_clarification?: boolean;
  clarification_question?: string;
}

/**
 * SubAgent Prompt 1: Command Interpretation & Tool Call List Creation
 *
 * Replaces IntentAssessmentPromptBuilder
 * Creates initial tool_call_list for execution
 */
export class CommandInterpretationPromptBuilder extends BaseSubAgentPromptBuilder<CommandInterpretationResponse> {

  getDescription(): string {
    return 'Interprets Master Agent command and creates tool call list for sub-agent execution';
  }

  getName(): string {
    return `CommandInterpretationPromptBuilder[${this.domain}]`;
  }

  buildPrompt(context: CommandInterpretationContext): AIPrompt<CommandInterpretationContext> {
    const userContextInfo = this.formatUserContext(context.user_context);

    return {
      systemPrompt: `
You are a ${this.domain} SubAgent's Command Interpretation module. Your role is to analyze Master Agent commands and create a structured execution plan.

CURRENT DATE/TIME: ${this.getCurrentDateTime()}

USER CONTEXT:
${userContextInfo}

AVAILABLE TOOLS:
${this.getToolDefinitions()}

YOUR CHAIN OF THOUGHT PROCESS:

Step 1 - Command Interpretation
- What is the Master Agent asking me to do?
- What specific entities are mentioned (emails, events, contacts, etc.)?
- Are there any ambiguous references that need clarification?

Step 2 - READ vs WRITE Detection
- Is this a read operation (search, list, get, check)?
- Is this a write operation (send, create, update, delete, archive)?
- For WRITE operations, estimate scope:
  * SINGLE: Operating on one specific item
  * BULK: Operating on multiple items (could be 10s or 100s)

Step 3 - Cross-Account Detection
- Does Master Agent indicate cross-account operation?
- Are multiple accounts mentioned explicitly?
- Should I include account_ids parameter in my tool calls?

Step 4 - Ambiguity Check
- Is the request clear enough to execute?
- Are there missing parameters I cannot infer?
- Would executing this request be dangerous or unexpected?

Examples of ambiguity:
- "Archive all emails from Sarah" → AMBIGUOUS (could be 1000+ emails spanning years)
- "Archive today's newsletters" → CLEAR (specific time constraint)
- "Send email to John" → AMBIGUOUS (which John? What content?)
- "Reply to the last email from Sarah with 'Thanks'" → CLEAR (specific email, specific content)

Step 5 - Tool Call List Creation
- Create concrete tool calls with specific parameters
- Order tools logically (gather info before acting)
- Include validation/lookup tools if needed
- For cross-account: add account_ids parameter if needed

Step 6 - Confirmation Planning
- For write operations: Will I need user confirmation?
- For bulk operations: Should I preview results before acting?
- For ambiguous requests: Should I ask for clarification first?

CRITICAL RULES:
1. If ambiguous and potentially dangerous, set needs_clarification: true
2. For bulk write operations, plan to preview results before executing
3. Cross-account tool calls should include account_ids array
4. Tool calls should have all required parameters filled in
5. working_data starts empty (will be populated during execution)

Domain-Specific Guidelines:
${this.getDomainGuidelines()}
      `,
      userPrompt: `
Analyze this Master Agent command and create a tool call list:

MASTER COMMAND: "${context.master_command}"

${context.cross_account_intent ? 'NOTE: This is a cross-account operation. Include account_ids in tool calls as needed.' : ''}

Follow your chain of thought process and generate:
1. working_data: Empty object (will be populated during execution)
2. tool_call_list: Concrete tool calls with parameters
3. execution_plan: Brief plan describing the approach
4. query_type: "read" or "write"
5. scope: "single" or "bulk" (for write operations)
6. needs_clarification: true if request is ambiguous or dangerous
7. clarification_question: If needs clarification, what to ask user
      `,
      context
    };
  }

  getSchema(): StructuredSchema {
    return {
      type: 'object',
      description: 'Command interpretation result with tool call list',
      properties: {
        working_data: {
          type: 'object',
          description: 'Initial working data (usually empty, will be populated during execution)'
        },
        tool_call_list: {
          type: 'array',
          description: 'List of tool calls to execute',
          items: {
            type: 'object',
            properties: {
              tool: { type: 'string', description: 'Name of the tool to call' },
              params: { type: 'object', description: 'Parameters for the tool call' },
              description: { type: 'string', description: 'Description of what this tool call does' }
            },
            required: ['tool', 'params', 'description']
          }
        },
        execution_plan: {
          type: 'string',
          description: 'Brief plan for tool execution'
        },
        query_type: {
          type: 'string',
          enum: ['read', 'write'],
          description: 'Type of operation'
        },
        scope: {
          type: 'string',
          enum: ['single', 'bulk'],
          description: 'Operation scope (for write operations)'
        },
        needs_clarification: {
          type: 'boolean',
          description: 'Whether the request is ambiguous and needs user clarification'
        },
        clarification_question: {
          type: 'string',
          description: 'Question to ask user if clarification is needed'
        }
      },
      required: ['working_data', 'tool_call_list', 'execution_plan', 'query_type']
    };
  }

  /**
   * Format user context for prompt
   */
  private formatUserContext(userContext?: {
    email_accounts?: Array<{ id: string; email: string; primary?: boolean }>;
    calendars?: Array<{ id: string; name: string; primary?: boolean }>;
    timezone?: string;
  }): string {
    if (!userContext) {
      return '(No user context available)';
    }

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
