import { BaseSubAgentPromptBuilder, BaseSubAgentResponse } from '../sub-agent-base-prompt-builder';
import { AIPrompt, StructuredSchema } from '../../generic-ai.service';
import { ToolCall } from '../../../framework/tool-execution';

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  tool: string;
  success: boolean;
  result?: unknown;
  error?: string;
  executionTime: number;
}

/**
 * Pending action for confirmation flow
 */
export interface PendingAction {
  type: string;
  count: number;
  confirmed: boolean;
  risk_level: 'low' | 'medium' | 'high';
  preview?: string;
}

/**
 * Last action for undo mechanism
 */
export interface LastAction {
  type: string;
  count: number;
  timestamp: string;
  affected_items: string[];
  reversible: boolean;
  undo_available_until?: string;
}

/**
 * Input context for tool reassessment
 */
export interface ToolReassessmentContext {
  working_data: Record<string, unknown>;
  tool_call_list: ToolCall[];
  latest_tool_result: ToolExecutionResult;
  is_final_tool: boolean;
}

/**
 * Result of tool reassessment (SubAgent Prompt 2)
 */
export interface ToolReassessmentResponse extends BaseSubAgentResponse {
  working_data: Record<string, unknown>; // Updated working data with tool results
  tool_call_list: ToolCall[]; // Modified tool call list (can add/remove/update)
  needs_confirmation: boolean; // Whether user confirmation is needed
  confirmation_prompt?: string; // Prompt to show user if confirmation needed
  natural_language_response: string; // Response to send to Master Agent
  is_complete: boolean; // Whether all work is done
  pending_action?: PendingAction; // For confirmation flow
  last_action?: LastAction; // For undo mechanism
}

/**
 * SubAgent Prompt 2: Tool Reassessment & Tool Call List Modification
 *
 * Replaces PlanReviewPromptBuilder
 * Updates working_data and modifies tool_call_list after each tool execution
 * Generates natural language response for Master Agent
 */
export class ToolReassessmentPromptBuilder extends BaseSubAgentPromptBuilder<ToolReassessmentResponse> {

  getDescription(): string {
    return 'Reassesses tool execution results, updates working data, and generates natural language response';
  }

  getName(): string {
    return `ToolReassessmentPromptBuilder[${this.domain}]`;
  }

  buildPrompt(context: ToolReassessmentContext): AIPrompt<ToolReassessmentContext> {
    const workingDataSummary = this.formatWorkingData(context.working_data);
    const toolListStatus = this.formatToolList(context.tool_call_list);
    const toolResult = this.formatToolResult(context.latest_tool_result);

    return {
      systemPrompt: `
You are a ${this.domain} SubAgent's Tool Reassessment module. After each tool execution, you update working data and decide next steps.

CURRENT DATE/TIME: ${this.getCurrentDateTime()}

YOUR CHAIN OF THOUGHT PROCESS:

Step 1 - Tool Result Analysis
- Did the tool execution succeed or fail?
- What essential information should I extract from the result?
- Should this be stored in working_data for future tools or final response?

Working Data Guidelines:
- Store ONLY what's needed for next tools or final response
- Discard verbose metadata, full objects, redundant data
- For bulk operations: store IDs array, count, summary stats
- For confirmations: store pending_action with preview
- For undo: store last_action with affected items

Step 2 - Safety Assessment (for write operations)
- Is this a write operation that needs user confirmation?
- Risk assessment:
  * REVERSIBLE: Can be undone (archive, mark read, star)
  * IRREVERSIBLE: Cannot be undone (delete permanently, send email)
  * HIGH IMPACT: Affects many items or external recipients
  * AMBIGUOUS: Selection criteria is vague or broad

Confirmation Decision Matrix:
- Single reversible write (e.g., archive 1 email) → NO confirmation needed
- Bulk reversible write (e.g., archive 50 emails) → SIMPLE confirmation with count
- Single irreversible write (e.g., send to external) → DETAILED confirmation with preview
- Bulk irreversible write (e.g., delete 100 emails) → STRONG warning + detailed preview

Confirmation Flow:
1. If needs confirmation:
   - Store relevant data in working_data (e.g., email_ids array)
   - Create pending_action with type, count, risk_level
   - Generate confirmation_prompt with preview
   - Set needs_confirmation: true
   - DO NOT add the write tool calls yet
2. If confirmation received (Master Agent passes "confirmed" command):
   - Check working_data for pending_action
   - Create actual write tool calls using stored IDs
   - Execute, then store last_action for undo

Undo Mechanism:
- After successful write operation:
  - Store last_action with: type, count, affected_items, timestamp
  - Set reversible: true/false
  - Set undo_available_until (5 minutes from now)
  - Include "Undo?" in natural_language_response if reversible

Step 3 - Tool Call List Modification Assessment
- Did the tool result require changing our approach?
- Do we need additional tools based on new information?
- Should we add, remove, or modify remaining tool calls?

Examples:
- Search returned 0 results → Add broader search tool or report "not found"
- Search returned 100 results but user wanted "the email" → Add clarification or filter
- Contact lookup failed → Add tool to search with different criteria
- Tool failed with auth error → Stop, report error to Master Agent

Step 4 - Completion Assessment
- Is this the final tool (is_final_tool: true)?
- Are all tool calls completed successfully?
- Is the original Master Agent command fully satisfied?
- Are we waiting for user confirmation?

Completion Criteria:
- All necessary tools executed AND
- Original command is satisfied AND
- No pending confirmations or clarifications needed

Step 5 - Natural Language Response Generation
- Create clear, concise response for Master Agent
- For read operations: Summarize findings (aggressive filtering - only essentials!)
- For write operations: Confirm what was done + offer undo if reversible
- For confirmations: Ask clear question with preview of what will happen
- For errors: Explain what failed and why

Response Guidelines:
- Be direct and concise (target: 50-100 tokens)
- Extract only essential facts (80-85% token reduction from full results)
- For bulk operations: Mention count and summary, not full lists
- For confirmations: Clear yes/no question with preview
- For errors: Clear explanation + whether it's recoverable

CRITICAL RULES:
1. working_data should be lean - store only essentials, no full objects
2. For bulk writes: preview results, ask confirmation, store IDs in working_data
3. natural_language_response is what Master Agent sees - make it clear and concise
4. If tool failed: explain error clearly, set is_complete based on recoverability
5. Undo affordance: Always include "Undo?" for reversible write operations

Domain-Specific Guidelines:
${this.getDomainReviewGuidelines()}
      `,
      userPrompt: `
Reassess after this tool execution and generate next steps:

WORKING DATA SO FAR:
${workingDataSummary}

TOOL CALL LIST:
${toolListStatus}

LATEST TOOL EXECUTED:
${toolResult}

IS FINAL TOOL: ${context.is_final_tool ? 'YES' : 'NO'}

Follow your chain of thought and generate:
1. working_data: Updated with essential data from tool result
2. tool_call_list: Modified list (add/remove/update tools as needed)
3. needs_confirmation: true if waiting for user approval
4. confirmation_prompt: If needs confirmation, the question to ask
5. natural_language_response: Concise response for Master Agent (50-100 tokens)
6. is_complete: true only if all work is done
7. pending_action: If waiting for confirmation, store preview data
8. last_action: If completed write operation, store for undo
      `,
      context
    };
  }

  getSchema(): StructuredSchema {
    return {
      type: 'object',
      description: 'Tool reassessment result with updated execution state and natural language response',
      properties: {
        working_data: {
          type: 'object',
          description: 'Updated working data with essential information from tool execution'
        },
        tool_call_list: {
          type: 'array',
          description: 'Updated tool call list (can add, remove, or modify tools)',
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
        needs_confirmation: {
          type: 'boolean',
          description: 'Whether user confirmation is needed before proceeding'
        },
        confirmation_prompt: {
          type: 'string',
          description: 'Question to ask user if confirmation is needed (with preview of action)'
        },
        natural_language_response: {
          type: 'string',
          description: 'Concise natural language response for Master Agent (50-100 tokens, aggressive filtering)'
        },
        is_complete: {
          type: 'boolean',
          description: 'Whether all work is done and no more tools are needed'
        },
        pending_action: {
          type: 'object',
          description: 'Pending action awaiting user confirmation',
          properties: {
            type: { type: 'string', description: 'Type of action (e.g., "bulk_archive")' },
            count: { type: 'number', description: 'Number of items affected' },
            confirmed: { type: 'boolean', description: 'Whether user has confirmed' },
            risk_level: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Risk level of the operation'
            },
            preview: { type: 'string', description: 'Preview of what will happen' }
          },
          required: ['type', 'count', 'confirmed', 'risk_level']
        },
        last_action: {
          type: 'object',
          description: 'Last completed action for undo mechanism',
          properties: {
            type: { type: 'string', description: 'Type of action performed' },
            count: { type: 'number', description: 'Number of items affected' },
            timestamp: { type: 'string', description: 'ISO timestamp of action' },
            affected_items: {
              type: 'array',
              items: { type: 'string' },
              description: 'IDs of items that were affected'
            },
            reversible: { type: 'boolean', description: 'Whether this action can be undone' },
            undo_available_until: { type: 'string', description: 'ISO timestamp when undo expires (5 min)' }
          },
          required: ['type', 'count', 'timestamp', 'affected_items', 'reversible']
        }
      },
      required: ['working_data', 'tool_call_list', 'needs_confirmation', 'natural_language_response', 'is_complete']
    };
  }

  /**
   * Format working data for prompt
   */
  private formatWorkingData(workingData: Record<string, unknown>): string {
    if (!workingData || Object.keys(workingData).length === 0) {
      return '(Empty - no data collected yet)';
    }

    return JSON.stringify(workingData, null, 2);
  }

  /**
   * Format tool call list for prompt
   */
  private formatToolList(toolList: ToolCall[]): string {
    if (!toolList || toolList.length === 0) {
      return '(No remaining tools)';
    }

    return toolList
      .map((call, idx) => `${idx + 1}. ${call.tool}(${JSON.stringify(call.params)}) - ${call.description}`)
      .join('\n');
  }

  /**
   * Format tool execution result for prompt
   */
  private formatToolResult(result: ToolExecutionResult): string {
    const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
    const resultData = result.success
      ? JSON.stringify(result.result, null, 2)
      : result.error;

    return `
Tool: ${result.tool}
Status: ${status}
Execution Time: ${result.executionTime}ms
${result.success ? 'Result:' : 'Error:'}
${resultData}
    `.trim();
  }
}
