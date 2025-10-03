import logger from '../utils/logger';
import { GenericAIService } from '../services/generic-ai.service';
import { ContextManager } from '../services/context-manager.service';
import { AgentFactory } from '../framework/agent-factory';

// Utilities and error handling
import { ErrorFactory } from '../errors';

import { TokenManager } from '../services/token-manager';

// Prompt builders
import {
  IntentUnderstandingPromptBuilder,
  IntentUnderstandingContext,
  Command
} from '../services/prompt-builders/master-agent/intent-understanding-prompt-builder';
import {
  ContextUpdatePromptBuilder,
  ContextUpdateContext,
  CommandWithStatus
} from '../services/prompt-builders/master-agent/context-update-prompt-builder';

/**
 * Conversation message for stateless architecture
 */
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

/**
 * Processing result interface for stateless Master Agent
 */
export interface ProcessingResult {
  message: string;
  success: boolean;
  masterState?: any;
  subAgentStates?: any;
  metadata?: {
    processingTime?: number;
    workflowId?: string;
    totalSteps?: number;
    workflowAction?: string;
  };
}

/**
 * Stateless Master Agent following the 4-Prompt Architecture
 *
 * New 2-Prompt Flow:
 * 1. Intent Understanding (Prompt 1): Creates command_list
 * 2. Execution Loop with Context Update (Prompt 2): Updates accumulated_knowledge after each SubAgent
 * 3. Returns accumulated_knowledge and updated state as final response
 *
 * Architecture: Stateless - client provides conversationHistory and state, receives updated state
 */
export class MasterAgent {
  private aiService: GenericAIService;
  private contextManager: ContextManager;
  private tokenManager: TokenManager;
  private isInitialized = false;

  // New prompt builders for 2-prompt architecture
  private intentUnderstandingBuilder: IntentUnderstandingPromptBuilder;
  private contextUpdateBuilder: ContextUpdatePromptBuilder;

  constructor(
    aiService: GenericAIService,
    contextManager: ContextManager,
    tokenManager: TokenManager,
  ) {
    this.aiService = aiService;
    this.contextManager = contextManager;
    this.tokenManager = tokenManager;
    this.intentUnderstandingBuilder = new IntentUnderstandingPromptBuilder(aiService);
    this.contextUpdateBuilder = new ContextUpdatePromptBuilder(aiService);
    this.isInitialized = true;
  }

  /**
   * Process user input with the new 2-prompt architecture (stateless)
   *
   * @param userInput - The user's message
   * @param userId - User ID for authentication
   * @param conversationHistory - Full conversation history from client
   * @param masterState - Previous master agent state (optional)
   * @param subAgentStates - Previous subagent states (optional)
   */
  async processUserInput(
    userInput: string,
    userId: string,
    conversationHistory: ConversationMessage[] = [],
    masterState?: any,
    subAgentStates?: any,
  ): Promise<ProcessingResult> {
    const processingStartTime = Date.now();

    logger.info('Processing user input with Master Agent (stateless, 2-prompt architecture)', {
      userInputLength: userInput?.length || 0,
      userId,
      conversationLength: conversationHistory.length,
      operation: 'process_user_input',
    });

    try {
      // Initialize state for this request (use provided state or create new)
      let accumulated_knowledge = masterState?.accumulated_knowledge || '';
      let command_list: CommandWithStatus[] = masterState?.command_list || [];

      // Stage 1: Build message history from provided conversationHistory
      const formattedHistory = this.formatConversationHistory(conversationHistory);
      const userContext = await this.gatherUserContext(userId);

      // Stage 2: Master Prompt 1 - Intent Understanding & Command List Creation
      logger.info('Executing Master Prompt 1: Intent Understanding', { userId });

      const intentContext: IntentUnderstandingContext = {
        user_query: userInput,
        conversation_history: formattedHistory,
        user_context: userContext
      };

      const intentResult = await this.intentUnderstandingBuilder.execute(intentContext);

      // Store initial command list
      command_list = intentResult.command_list.map(cmd => ({
        ...cmd,
        status: 'pending' as const
      }));

      logger.info('Intent understood, created command list', {
        userId,
        commandCount: command_list.length,
        queryType: intentResult.query_type,
        crossAccount: intentResult.cross_account,
        operation: 'intent_understanding_complete'
      });

      // Stage 3: Execution Loop (Max 10 iterations)
      const MAX_ITERATIONS = 10;
      let iteration = 0;
      let isComplete = false;

      while (iteration < MAX_ITERATIONS && !isComplete) {
        iteration++;

        // Get next pending command
        const nextCommand = command_list.find(cmd => cmd.status === 'pending');

        if (!nextCommand) {
          // No more pending commands
          isComplete = true;
          break;
        }

        logger.info(`Executing command ${nextCommand.order}/${command_list.length}`, {
          userId,
          iteration,
          agent: nextCommand.agent,
          command: nextCommand.command.substring(0, 100)
        });

        // Mark as executing
        nextCommand.status = 'executing';

        // Execute SubAgent
        const agentResult = await AgentFactory.executeAgentWithNaturalLanguage(
          `${nextCommand.agent}Agent`,
          nextCommand.command,
          {
            sessionId: `${userId}-${Date.now()}`, // Generate temporary ID for logging
            userId,
            correlationId: `master-${userId}-${iteration}`
          }
        );

        // Check if SubAgent execution failed
        if (!agentResult.success) {
          logger.warn('SubAgent execution failed', {
            userId,
            agent: nextCommand.agent,
            error: agentResult.error
          });
          nextCommand.status = 'failed';
          // Continue to Prompt 2 to decide how to handle failure
        } else {
          nextCommand.status = 'completed';
        }

        const subAgentResponse = agentResult.response || agentResult.error || 'No response';

        // Master Prompt 2 - Context Update
        logger.info('Executing Master Prompt 2: Context Update', { userId, iteration });

        const contextUpdateInput: ContextUpdateContext = {
          accumulated_knowledge,
          command_list,
          latest_subagent_response: subAgentResponse,
          conversation_history: formattedHistory
        };

        const updateResult = await this.contextUpdateBuilder.execute(contextUpdateInput);

        // Update state from Prompt 2
        accumulated_knowledge = updateResult.accumulated_knowledge;
        command_list = updateResult.command_list;
        isComplete = updateResult.is_complete;

        logger.info('Context updated', {
          userId,
          iteration,
          isComplete,
          needsConfirmation: updateResult.needs_user_confirmation,
          commandsRemaining: command_list.filter(c => c.status === 'pending').length
        });

        // Check if waiting for user confirmation
        if (updateResult.needs_user_confirmation) {
          logger.info('Workflow paused - waiting for user confirmation', { userId });
          return {
            message: updateResult.confirmation_prompt || accumulated_knowledge,
            success: true,
            masterState: { accumulated_knowledge, command_list },
            subAgentStates,
            metadata: {
              processingTime: Date.now() - processingStartTime,
              totalSteps: iteration,
              workflowAction: 'awaiting_confirmation'
            }
          };
        }

        // Check if complete
        if (isComplete) {
          logger.info('Workflow completed', { userId, iterations: iteration });
          break;
        }
      }

      if (iteration >= MAX_ITERATIONS) {
        logger.warn('Max iterations reached', { userId, iterations: iteration });
        accumulated_knowledge += '\n\n(Note: Maximum execution steps reached. Some commands may not have completed.)';
      }

      // Stage 4: Return accumulated knowledge and updated state
      return {
        message: accumulated_knowledge || 'Request processed successfully.',
        success: true,
        masterState: { accumulated_knowledge, command_list },
        subAgentStates,
        metadata: {
          processingTime: Date.now() - processingStartTime,
          totalSteps: iteration
        }
      };

    } catch (error) {
      logger.error('Failed to process user input', error as Error, {
        userInput: `${userInput.substring(0, 100)}...`,
        userId,
        operation: 'process_user_input_error',
      });

      return this.createErrorResult('I encountered an error while processing your request. Please try again.', processingStartTime);
    }
  }

  /**
   * Format conversation history from client format to prompt format
   */
  private formatConversationHistory(
    conversationHistory: ConversationMessage[]
  ): Array<{ role: 'user' | 'assistant'; content: string; timestamp?: string }> {
    logger.debug('Formatting conversation history', {
      messageCount: conversationHistory.length
    });

    const formatted = conversationHistory.map(msg => ({
      role: msg.role === 'system' ? 'assistant' as const : msg.role,
      content: msg.content,
      timestamp: new Date(msg.timestamp).toISOString()
    }));

    // Keep only last 5 turns for context window management
    return formatted.slice(-5);
  }

  /**
   * Gather user context (accounts, calendars, timezone)
   */
  private async gatherUserContext(userId?: string): Promise<{
    email_accounts?: Array<{ id: string; email: string; primary?: boolean }>;
    calendars?: Array<{ id: string; name: string; primary?: boolean }>;
    timezone?: string;
  }> {
    // TODO: Implement actual user context gathering from TokenManager
    // For now, return basic context
    // In future, this should fetch:
    // - User's email accounts from TokenManager
    // - User's calendars from TokenManager
    // - User's timezone preference

    logger.debug('Gathering user context', { userId });

    return {
      timezone: 'America/Los_Angeles', // Default for now
      email_accounts: [],
      calendars: []
    };
  }

  /**
   * Cleanup method
   */
  cleanup(): void {
    this.isInitialized = false;
    logger.info('MasterAgent cleanup completed', { operation: 'master_agent_cleanup' });
  }

  /**
   * Private helper methods
   */
  private createErrorResult(message: string, processingStartTime: number): ProcessingResult {
    return {
      message,
      success: false,
      metadata: {
        processingTime: Date.now() - processingStartTime,
      },
    };
  }

}