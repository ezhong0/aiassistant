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

// Types
import { SlackContext } from '../types/slack/slack.types';

/**
 * Processing result interface for the new Master Agent
 */
export interface ProcessingResult {
  message: string;
  success: boolean;
  metadata?: {
    processingTime?: number;
    workflowId?: string;
    totalSteps?: number;
    workflowAction?: string;
  };
}

/**
 * Master Agent following the 4-Prompt Architecture
 *
 * New 2-Prompt Flow:
 * 1. Intent Understanding (Prompt 1): Creates command_list
 * 2. Execution Loop with Context Update (Prompt 2): Updates accumulated_knowledge after each SubAgent
 * 3. Returns accumulated_knowledge as final response
 */
export class MasterAgent {
  private aiService: GenericAIService;
  private contextManager: ContextManager;
  private tokenManager: TokenManager;
  private isInitialized = false;

  // New prompt builders for 2-prompt architecture
  private intentUnderstandingBuilder: IntentUnderstandingPromptBuilder;
  private contextUpdateBuilder: ContextUpdatePromptBuilder;

  // Internal state for execution
  private accumulated_knowledge: string = '';
  private command_list: CommandWithStatus[] = [];

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
   * Initialize the new Master Agent
   * @deprecated No longer needed - initialization happens in constructor
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Validate injected dependencies
    if (!this.aiService) {
      throw ErrorFactory.domain.serviceError('MasterAgent', 'GenericAIService not provided to MasterAgent');
    }

    if (!this.contextManager) {
      throw ErrorFactory.domain.serviceError('MasterAgent', 'ContextManager not provided to MasterAgent');
    }

    if (!this.tokenManager) {
      throw ErrorFactory.domain.serviceError('MasterAgent', 'TokenManager not provided to MasterAgent');
    }

    this.isInitialized = true;

    logger.info('MasterAgent initialized successfully', {
      operation: 'master_agent_init',
    });
  }

  /**
   * Process user input with the new 2-prompt architecture
   */
  async processUserInput(
    userInput: string,
    sessionId: string,
    userId?: string,
    slackContext?: SlackContext,
  ): Promise<ProcessingResult> {
    await this.ensureInitialized();

    const processingStartTime = Date.now();

    logger.info('Processing user input with Master Agent (2-prompt architecture)', {
      userInputLength: userInput?.length || 0,
      sessionId,
      userId,
      hasSlackContext: !!slackContext,
      operation: 'process_user_input',
    });

    try {
      // Reset state for new request
      this.accumulated_knowledge = '';
      this.command_list = [];

      // Stage 1: Build message history
      if (slackContext?.updateProgress) {
        await slackContext.updateProgress('Understanding your request...');
      }

      const conversationHistory = await this.buildConversationHistory(userInput, sessionId, slackContext);
      const userContext = await this.gatherUserContext(userId);

      // Stage 2: Master Prompt 1 - Intent Understanding & Command List Creation
      logger.info('Executing Master Prompt 1: Intent Understanding', { sessionId, userId });

      const intentContext: IntentUnderstandingContext = {
        user_query: userInput,
        conversation_history: conversationHistory,
        user_context: userContext
      };

      const intentResult = await this.intentUnderstandingBuilder.execute(intentContext);

      // Store initial command list
      this.command_list = intentResult.command_list.map(cmd => ({
        ...cmd,
        status: 'pending' as const
      }));

      logger.info('Intent understood, created command list', {
        sessionId,
        userId,
        commandCount: this.command_list.length,
        queryType: intentResult.query_type,
        crossAccount: intentResult.cross_account,
        operation: 'intent_understanding_complete'
      });

      // Stage 3: Execution Loop (Max 10 iterations)
      if (slackContext?.updateProgress) {
        await slackContext.updateProgress('Executing commands...');
      }

      const MAX_ITERATIONS = 10;
      let iteration = 0;
      let isComplete = false;

      while (iteration < MAX_ITERATIONS && !isComplete) {
        iteration++;

        // Get next pending command
        const nextCommand = this.command_list.find(cmd => cmd.status === 'pending');

        if (!nextCommand) {
          // No more pending commands
          isComplete = true;
          break;
        }

        logger.info(`Executing command ${nextCommand.order}/${this.command_list.length}`, {
          sessionId,
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
            sessionId,
            userId: userId || 'unknown',
            correlationId: `master-${sessionId}-${iteration}`
          }
        );

        // Check if SubAgent execution failed
        if (!agentResult.success) {
          logger.warn('SubAgent execution failed', {
            sessionId,
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
        logger.info('Executing Master Prompt 2: Context Update', { sessionId, userId, iteration });

        const contextUpdateInput: ContextUpdateContext = {
          accumulated_knowledge: this.accumulated_knowledge,
          command_list: this.command_list,
          latest_subagent_response: subAgentResponse,
          conversation_history: conversationHistory
        };

        const updateResult = await this.contextUpdateBuilder.execute(contextUpdateInput);

        // Update state from Prompt 2
        this.accumulated_knowledge = updateResult.accumulated_knowledge;
        this.command_list = updateResult.command_list;
        isComplete = updateResult.is_complete;

        logger.info('Context updated', {
          sessionId,
          userId,
          iteration,
          isComplete,
          needsConfirmation: updateResult.needs_user_confirmation,
          commandsRemaining: this.command_list.filter(c => c.status === 'pending').length
        });

        // Check if waiting for user confirmation
        if (updateResult.needs_user_confirmation) {
          logger.info('Workflow paused - waiting for user confirmation', { sessionId, userId });
          return {
            message: updateResult.confirmation_prompt || this.accumulated_knowledge,
            success: true,
            metadata: {
              processingTime: Date.now() - processingStartTime,
              totalSteps: iteration,
              workflowAction: 'awaiting_confirmation'
            }
          };
        }

        // Check if complete
        if (isComplete) {
          logger.info('Workflow completed', { sessionId, userId, iterations: iteration });
          break;
        }
      }

      if (iteration >= MAX_ITERATIONS) {
        logger.warn('Max iterations reached', { sessionId, userId, iterations: iteration });
        this.accumulated_knowledge += '\n\n(Note: Maximum execution steps reached. Some commands may not have completed.)';
      }

      // Stage 4: Return accumulated knowledge as final response
      return {
        message: this.accumulated_knowledge || 'Request processed successfully.',
        success: true,
        metadata: {
          processingTime: Date.now() - processingStartTime,
          totalSteps: iteration
        }
      };

    } catch (error) {
      logger.error('Failed to process user input', error as Error, {
        userInput: `${userInput.substring(0, 100)}...`,
        sessionId,
        userId,
        operation: 'process_user_input_error',
      });

      return this.createErrorResult('I encountered an error while processing your request. Please try again.', processingStartTime);
    }
  }

  /**
   * Build conversation history from Slack context
   */
  private async buildConversationHistory(
    userInput: string,
    sessionId: string,
    slackContext?: SlackContext,
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string; timestamp?: string }>> {
    logger.info('Building conversation history', { sessionId });

    const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: string }> = [];

    // Add conversation history if available
    if (slackContext && this.contextManager) {
      try {
        const gatheredContext = await this.contextManager.gatherContext(sessionId, slackContext);

        // Convert recent messages to conversation history format
        if (gatheredContext.conversation.recentMessages.length > 0) {
          gatheredContext.conversation.recentMessages.forEach(msg => {
            conversationHistory.push({
              role: msg.user === 'bot' ? 'assistant' : 'user',
              content: msg.text,
              timestamp: msg.timestamp
            });
          });
        }
      } catch (error) {
        logger.warn('Failed to gather conversation context', { error, sessionId });
      }
    }

    // Add current user input as latest turn
    conversationHistory.push({
      role: 'user',
      content: userInput
    });

    return conversationHistory.slice(-5); // Keep only last 5 turns
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
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

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