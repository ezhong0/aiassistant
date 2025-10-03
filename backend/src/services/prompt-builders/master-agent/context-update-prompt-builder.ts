import { BasePromptBuilder } from '../base-prompt-builder';
import { AIPrompt, StructuredSchema } from '../../generic-ai.service';

/**
 * Command with execution status
 */
export interface CommandWithStatus {
  agent: 'email' | 'calendar';
  command: string;
  order: number;
  status: 'pending' | 'executing' | 'completed' | 'failed';
}

/**
 * Input context for context update
 */
export interface ContextUpdateContext {
  accumulated_knowledge: string;
  command_list: CommandWithStatus[];
  latest_subagent_response: string;
  conversation_history?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp?: string;
  }>;
}

/**
 * Result of context update (Master Prompt 2)
 */
export interface ContextUpdateResponse {
  accumulated_knowledge: string;
  command_list: CommandWithStatus[];
  needs_user_confirmation: boolean;
  confirmation_prompt?: string;
  is_complete: boolean;
  next_command_order?: number;
}

/**
 * Master Prompt 2: Context Update & Command List Modification
 *
 * Replaces Action Execution + Environment Check + Progress Assessment
 * Updates accumulated_knowledge and modifies command_list after each SubAgent response
 */
export class ContextUpdatePromptBuilder extends BasePromptBuilder<
  ContextUpdateContext,
  ContextUpdateResponse
> {

  getDescription(): string {
    return 'Extracts essential information from SubAgent response and updates execution context';
  }

  getName(): string {
    return 'ContextUpdatePromptBuilder';
  }

  buildPrompt(context: ContextUpdateContext): AIPrompt<ContextUpdateContext> {
    const commandListStatus = this.formatCommandList(context.command_list);
    const conversationContext = context.conversation_history
      ? this.formatConversationHistory(context.conversation_history.slice(-3))
      : '(No recent conversation)';

    return {
      systemPrompt: `
You are the Master Agent's Context Update module. After each SubAgent response, you extract essential information and decide next steps.

CURRENT DATE/TIME: ${this.getCurrentDateTime()}

RECENT CONVERSATION:
${conversationContext}

YOUR CHAIN OF THOUGHT PROCESS:

Step 1 - Response Analysis & Extraction
- What essential information did the SubAgent provide?
- Extract ONLY key facts (numbers, names, IDs, decisions)
- Discard verbose explanations, metadata, redundant details
- Target: 80-85% token reduction from SubAgent response
- Examples:
  * SubAgent: "I found 47 newsletters from today across 3 accounts..." (500 tokens)
  * Extract: "Found 47 newsletters today (28 work, 15 personal, 4 consulting)" (15 tokens)

Step 2 - Safety Assessment (for write operations)
- Did SubAgent request confirmation? (look for phrases like "Archive all 47?", "Confirm to send?")
- Is this a high-risk operation waiting for user approval?
- Did user just provide confirmation? (look for "yes", "confirm", "go ahead" in latest user message)
- Validate confirmation matches pending action context

Step 3 - Command List Modification Assessment
- Did SubAgent complete its task successfully?
- Did SubAgent encounter an error that requires retry or alternative approach?
- Do we need additional commands based on new information?
- Should we modify, add, or remove commands from command_list?

Examples:
- SubAgent failed to find contact → Add command to search with broader criteria
- SubAgent found multiple matches → Add command to disambiguate
- SubAgent completed read operation → No new commands needed if query complete
- SubAgent is waiting for confirmation → Pause, don't add new commands yet

Step 4 - Completion Assessment
- Is the user's original goal fully satisfied?
- Are there pending commands still to execute?
- Is SubAgent waiting for user input/confirmation?
- Can we respond to user with accumulated_knowledge, or do we need more work?

Completion Criteria:
- All commands completed successfully AND
- User's goal is satisfied AND
- No pending confirmations or user input needed

Step 5 - Response Synthesis
- Update accumulated_knowledge with extracted essentials
- Update command_list statuses and add/remove commands as needed
- Set needs_user_confirmation if SubAgent is waiting
- Set is_complete if workflow is done
- If continuing, set next_command_order to the next pending command

CRITICAL RULES:
1. Accumulated knowledge should be LEAN - extract only essential facts
2. If SubAgent says "Archive all 47?" or similar, set needs_user_confirmation: true
3. If user says "yes"/"confirm" and there's pending confirmation, validate it matches context
4. Don't add redundant commands - check if command_list already has what's needed
5. Mark commands as 'completed' when SubAgent successfully finishes them
6. Mark commands as 'failed' if SubAgent reports errors
7. is_complete should only be true when EVERYTHING is done and user's goal is met
      `,
      userPrompt: `
Update the execution context based on this SubAgent response:

CURRENT ACCUMULATED KNOWLEDGE:
${context.accumulated_knowledge || '(Empty - first iteration)'}

COMMAND LIST STATUS:
${commandListStatus}

LATEST SUBAGENT RESPONSE:
${context.latest_subagent_response}

Follow your chain of thought and generate:
1. accumulated_knowledge: Updated with extracted essentials (aggressive filtering!)
2. command_list: Updated command list with status changes and any new/removed commands
3. needs_user_confirmation: true if SubAgent is waiting for user approval
4. confirmation_prompt: If needs confirmation, the prompt to show user
5. is_complete: true only if user's goal is fully satisfied
6. next_command_order: If continuing, the order number of next command to execute
      `,
      context
    };
  }

  getSchema(): StructuredSchema {
    return {
      type: 'object',
      description: 'Context update result with modified execution state',
      properties: {
        accumulated_knowledge: {
          type: 'string',
          description: 'Updated accumulated knowledge with extracted essentials from SubAgent response'
        },
        command_list: {
          type: 'array',
          description: 'Updated command list with status changes and modifications',
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
              },
              status: {
                type: 'string',
                enum: ['pending', 'executing', 'completed', 'failed'],
                description: 'Command execution status'
              }
            },
            required: ['agent', 'command', 'order', 'status']
          }
        },
        needs_user_confirmation: {
          type: 'boolean',
          description: 'Whether SubAgent is waiting for user confirmation'
        },
        confirmation_prompt: {
          type: 'string',
          description: 'Prompt to show user if confirmation is needed'
        },
        is_complete: {
          type: 'boolean',
          description: 'Whether the workflow is complete and user goal is satisfied'
        },
        next_command_order: {
          type: 'number',
          description: 'Order number of the next command to execute (if continuing)'
        }
      },
      required: ['accumulated_knowledge', 'command_list', 'needs_user_confirmation', 'is_complete']
    };
  }

  protected validateContext(context: ContextUpdateContext): void {
    if (!context.accumulated_knowledge && context.accumulated_knowledge !== '') {
      throw new Error('accumulated_knowledge is required (can be empty string for first iteration)');
    }

    if (!context.command_list || !Array.isArray(context.command_list)) {
      throw new Error('command_list is required and must be an array');
    }

    if (!context.latest_subagent_response || context.latest_subagent_response.trim().length === 0) {
      throw new Error('latest_subagent_response is required');
    }
  }

  /**
   * Format command list for prompt
   */
  private formatCommandList(commandList: CommandWithStatus[]): string {
    if (!commandList || commandList.length === 0) {
      return '(No commands in list)';
    }

    return commandList
      .map(cmd => {
        const statusEmoji = {
          'pending': '⏳',
          'executing': '▶️',
          'completed': '✅',
          'failed': '❌'
        }[cmd.status] || '❓';

        return `${statusEmoji} [${cmd.order}] ${cmd.agent}: ${cmd.command} (${cmd.status})`;
      })
      .join('\n');
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

    return history
      .map((turn, idx) => {
        const timestamp = turn.timestamp ? ` [${turn.timestamp}]` : '';
        return `Turn ${idx + 1}${timestamp}:\n${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.content}`;
      })
      .join('\n\n');
  }
}
