import { AIAgent } from '../framework/ai-agent';
import logger from '../utils/logger';
import { LogContext } from '../utils/log-context';
import { ToolExecutionContext, SlackAgentParams } from '../types/tools';
import { PreviewGenerationResult } from '../types/api/api.types';
import { resolveSlackService } from '../services/service-resolver';
import { getService, serviceManager } from '../services/service-manager';
import { OpenAIService } from '../services/openai.service';
import { SlackService } from '../services/slack/slack.service';
import { DraftManager, WriteOperation } from '../services/draft-manager.service';
import { SlackContext, SlackMessageEvent, SlackResponse, SlackBlock } from '../types/slack/slack.types';
import { SlackMessage as ReaderSlackMessage, SlackMessageReaderError, SlackAttachment } from '../types/slack/slack-message-reader.types';
import { SLACK_CONSTANTS } from '../config/constants';
import { SLACK_SERVICE_CONSTANTS } from '../config/slack-service-constants';
import {
  ToolParameters,
  ToolExecutionResult,
  AgentExecutionSummary
} from '../types/agents/agent-parameters';
import {
  SlackReadMessagesParams,
  SlackMessageSummary,
  SlackReadResult
} from '../types/agents/agent-specific-parameters';
import {
  AgentExecutionContext,
  AgentIntent,
  NaturalLanguageResponse,
  AgentCapabilities
} from '../types/agents/natural-language.types';

// Focused services removed - SlackAgent handles analysis, drafts, and formatting internally

// Simple result interface for internal use
interface SimpleSlackResult {
  success: boolean;
  data?: any;
  message: string;
  error?: string;
}

// Import context gathering interfaces from MasterAgent
export interface ContextGatheringResult {
  messages: SlackMessage[];
  relevantContext: string;
  contextType: 'recent_messages' | 'thread_history' | 'search_results' | 'none';
  confidence: number;
}

export interface ContextDetectionResult {
  needsContext: boolean;
  contextType: 'recent_messages' | 'thread_history' | 'search_results' | 'none';
  confidence: number;
  reasoning: string;
}

/**
 * Slack message data structure
 */
export interface SlackMessage {
  id: string;
  text: string;
  userId: string;
  channelId: string;
  timestamp: string;
  threadTs?: string | undefined;
  isBot: boolean;
  attachments?: Array<Record<string, unknown> | SlackAttachment> | undefined;
  blocks?: SlackBlock[] | undefined;
  reactions?: Array<{
    name: string;
    count: number;
    users: string[];
    [key: string]: unknown; // Index signature for Record<string, unknown> compatibility
  }> | undefined;
}

/**
 * Slack conversation thread data
 */
export interface SlackThread {
  channelId: string;
  threadTs: string;
  messages: SlackMessage[];
  participantCount: number;
  lastActivity: string;
}

/**
 * Slack agent result interface - Intent-agnostic
 * No hardcoded action strings - result content determines formatting
 */
export interface SlackAgentResult {
  success: boolean;
  messages?: SlackMessage[];
  count?: number;
  summary?: string;
  keyTopics?: string[];
  actionItems?: string[];
  sentiment?: string;
  participantCount?: number;
  drafts?: any[];
  isConfirmation?: boolean;
  confirmationType?: string;
  error?: string;
  reauth_reason?: string;
}

/**
 * Slack agent parameters with access token
 */
export interface SlackAgentRequest extends SlackAgentParams {
  accessToken: string;
  operation?: 'read_messages' | 'read_thread' | 'detect_drafts' | 'manage_drafts' | 'confirmation_handling' | undefined;
  channelId?: string | undefined;
  threadTs?: string | undefined;
  limit?: number | undefined;
  includeAttachments?: boolean | undefined;
}

/**
 * SlackAgent - Specialized agent for Slack operations and context gathering
 * 
 * Handles Slack message reading, context gathering, and message analysis operations
 * through the Slack API. Provides intelligent context extraction and message
 * processing with AI-powered analysis capabilities.
 * 
 * @example
 * ```typescript
 * const slackAgent = new SlackAgent();
 * const result = await slackAgent.execute({
 *   operation: 'read_messages',
 *   channelId: 'C1234567890',
 *   limit: 10,
 *   accessToken: 'slack_token'
 * });
 * ```
 */
export class SlackAgent extends AIAgent<SlackAgentRequest, SlackAgentResult> {

  // Focused service dependencies
  // Slack services now handled internally by SlackAgent
  private slackService: SlackService | null = null;
  // Remove private draftManager - using inherited protected one from AIAgent

  private slackMessageAnalyzer = {
    readMessageHistory: async (channelId: string, options: { limit?: number; includeAllMetadata?: boolean }) => {
      if (!this.slackService) return { success: false, messages: [], message: 'SlackService unavailable' };
      const limit = typeof options?.limit === 'number' ? options.limit : 10;
      const { messages } = await this.slackService.getChannelHistory(channelId, limit);
      return { success: true, messages, message: 'ok' };
    },
    readThreadMessages: async (channelId: string, threadTs: string, options: { limit?: number; includeAllMetadata?: boolean }) => {
      if (!this.slackService) return { success: false, messages: [], message: 'SlackService unavailable' };
      const limit = typeof options?.limit === 'number' ? options.limit : 20;
      const { messages } = await this.slackService.getThreadMessages(channelId, threadTs, limit);
      return { success: true, messages, message: 'ok' };
    },
    analyzeConversationContext: async (messages: any[], _options: { includeSentiment?: boolean; includeKeyTopics?: boolean; includeActionItems?: boolean }) => {
      const openai = getService<OpenAIService>('openaiService');
      const joined = messages.map(m => (m.text || '')).filter(Boolean).slice(0, 50).join('\n');
      if (!openai) {
        return { success: true, summary: joined.slice(0, 500), message: 'fallback' } as any;
      }
      const prompt = `Summarize the following Slack conversation. Provide summary, key topics, action items, sentiment and participant count.\n\n${joined}`;
      const summary = await openai.generateText(prompt, 'You summarize Slack conversations.', { temperature: 0.2, maxTokens: 300 });
      return { success: true, analysis: { summary }, message: 'ok' } as any;
    }
  };

  private slackDraftManager = {
    createDraft: async (channelId: string, text: string, options: { threadTs?: string; scheduledTime?: string }) => {
      if (!this.draftManager) return { success: false, message: 'DraftManager unavailable' } as any;
      const writeOp: WriteOperation = {
        type: 'slack',
        operation: 'send_message',
        parameters: { channelId, text, threadTs: options?.threadTs, scheduledTime: options?.scheduledTime },
        toolCall: { name: 'slack_send_message', parameters: { channelId, text, threadTs: options?.threadTs } },
        confirmationReason: 'User requested to send a Slack message',
        riskLevel: 'low',
        previewDescription: `Send Slack message to ${channelId}${options?.threadTs ? ' in thread' : ''}`
      };
      const draft = await this.draftManager.createDraft(`slack:${channelId}`, writeOp);
      return { success: true, draftId: draft.id, draft } as any;
    },
    listDrafts: async (_channelId: string, _options: { limit?: number; includeScheduled?: boolean }) => {
      if (!this.draftManager) return { success: false, drafts: [], message: 'DraftManager unavailable' } as any;
      const drafts = await this.draftManager.getSessionDrafts(`slack:*`);
      return { success: true, drafts } as any;
    }
  };

  private slackFormatter = {
    formatMessages: (messages: SlackMessage[]) => {
      const formattedText = messages.map(m => `[@${m.userId}] ${m.text}`).join('\n');
      return { success: true, formattedText, message: 'ok' } as any;
    }
  };

  constructor() {
    super({
      name: 'slackAgent',
      description: 'Read Slack message history, manage drafts, and handle confirmations',
      enabled: true,
      timeout: 15000,
      retryCount: 2,
      // Removed individual agent AI planning - using only Master Agent NextStepPlanningService
      // aiPlanning: {
      //   enableAIPlanning: false,
      //   maxPlanningSteps: 5,
      //   planningTimeout: 10000,
      //   cachePlans: true,
      //   planningTemperature: 0.1,
      //   planningMaxTokens: 1500
      // }
    });
  }

  /**
   * Lazy initialization of Slack services
   */
  private ensureServices(): void {
    if (!this.slackService) {
      this.slackService = (getService<SlackService>('slackService') || null);
    }
    if (!this.draftManager) {
      this.draftManager = (getService<DraftManager>('draftManager') || null);
    }
  }

  /**
   * Cleanup focused service dependencies
   */
  protected async onDestroy(): Promise<void> {
    try {
      logger.debug('Destroying SlackAgent', {
        correlationId: 'slack-destroy',
        operation: 'agent_destroy',
        metadata: { service: 'SlackAgent' }
      });
      // Cleanup completed - services are now handled by SlackAgent directly
      logger.debug('SlackAgent destroyed successfully', {
        correlationId: 'slack-destroy',
        operation: 'agent_destroy',
        metadata: { service: 'SlackAgent' }
      });
    } catch (error) {
      logger.error('Error during SlackAgent destruction', error as Error, {
        correlationId: 'slack-destroy',
        operation: 'agent_destroy',
        metadata: { service: 'SlackAgent' }
      });
    }
  }

  private readonly systemPrompt = `# Slack Agent - Intelligent Workspace Communication
You are a specialized Slack workspace management agent focused on reading and understanding conversations.

## Core Personality
- Respectful of workspace culture and communication norms
- Efficient with team communication understanding
- Context-aware for thread management and conversation flow
- Professional but appropriately casual for Slack environment
- Helpful in organizing and interpreting team communications
- Mindful of workspace hierarchy and permissions

## Capabilities
- Read and analyze Slack conversations intelligently
- Understand thread context and conversation relationships
- Respect channel purposes and target audiences
- Manage draft messages and scheduling considerations
- Navigate workspace hierarchy and permission structures
- Detect and manage confirmation workflows and pending actions
- Provide conversation summaries and context extraction

## Slack Communication Intelligence
- Respect channel purposes and intended audiences
- Use threads appropriately to avoid cluttering main channels
- Consider timezone and working hours for communication context
- Maintain appropriate tone for specific workspace culture
- Suggest optimal communication channels for different content types
- Understand urgency levels and appropriate response expectations
- Recognize formal vs informal communication patterns

## Conversation Context & Analysis
- Extract key information from message histories accurately
- Understand conversation threads and participant relationships
- Identify action items, decisions, and follow-up requirements
- Recognize sentiment and communication patterns
- Provide relevant context for ongoing conversations
- Summarize key points from long conversation threads
- Identify mentions, reactions, and engagement patterns

## Workspace Etiquette & Best Practices
- Respect privacy and confidentiality of workspace communications
- Understand different channel types (public, private, DM) and their purposes
- Recognize appropriate times for interruptions vs asynchronous communication
- Consider cultural norms around response times and availability
- Respect "do not disturb" settings and offline status indicators
- Understand escalation paths for urgent vs routine communications

## Error Handling & User Experience
- Clear guidance for permission-related issues with helpful alternatives
- Suggestions for alternative communication methods when primary approach fails
- Respectful handling of private/restricted channels with appropriate explanations
- Context-aware error recovery for failed operations
- Progressive disclosure: start simple, provide details when requested
- Acknowledge limitations while providing practical workarounds

## Privacy & Security Standards
- Never expose private conversation content inappropriately
- Respect channel privacy settings and access controls
- Maintain confidentiality of team communications and sensitive information
- Provide clear explanations when access is restricted
- Suggest appropriate ways to request access or information when needed`;

  /**
   * Get system prompt for AI planning
   */
  protected getSystemPrompt(): string {
    return this.systemPrompt;
  }

  /**
   * Execute Slack-specific tools during AI planning
   */
  protected async executeCustomTool(toolName: string, parameters: ToolParameters, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    const logContext: LogContext = {
      correlationId: `slack-tool-${context.sessionId}-${Date.now()}`,
      userId: context.userId,
      sessionId: context.sessionId,
      operation: 'slack_tool_execution',
      metadata: {
        toolName,
        parametersKeys: Object.keys(parameters)
      }
    };

    logger.debug('Executing Slack tool', logContext);

    try {
      // Route to appropriate handler based on tool name - Intent-agnostic routing
      // Let OpenAI determine the operation from the parameters
      const operation = (parameters as any).operation;
      
      if (operation === SLACK_SERVICE_CONSTANTS.SLACK_OPERATIONS.READ_MESSAGES) {
        return await this.handleReadMessages(parameters, context);
      } else if (operation === SLACK_SERVICE_CONSTANTS.SLACK_OPERATIONS.READ_THREAD) {
        return await this.handleReadThread(parameters, context);
      } else if (operation === SLACK_SERVICE_CONSTANTS.SLACK_OPERATIONS.ANALYZE_CONVERSATION) {
        return await this.handleAnalyzeConversation(parameters, context);
      } else if (operation === SLACK_SERVICE_CONSTANTS.SLACK_OPERATIONS.MANAGE_DRAFTS) {
        return await this.handleManageDrafts(parameters, context);
      } else if (operation === SLACK_SERVICE_CONSTANTS.SLACK_OPERATIONS.DETECT_CONFIRMATIONS) {
        return await this.handleDetectConfirmations(parameters, context);
      } else {
        throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      logger.error('Error executing Slack tool', error as Error, {
        ...logContext,
        metadata: { toolName }
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : SLACK_SERVICE_CONSTANTS.ERRORS.UNKNOWN_ERROR
      };
    }
  }

  /**
   * Handle read messages operation
   */
  private async handleReadMessages(parameters: ToolParameters, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      if (!parameters.channelId) {
          return {
            success: false,
          error: SLACK_SERVICE_CONSTANTS.ERRORS.CHANNEL_ID_REQUIRED
        };
      }

      const result = await this.slackMessageAnalyzer!.readMessageHistory(
        parameters.channelId as string,
        {
          limit: parameters.limit as number,
          includeAllMetadata: parameters.includeAttachments as boolean
        }
      );

      if (result.success) {
        // Format the result
        const slackResult: SimpleSlackResult = {
          success: true,
          message: 'Messages retrieved successfully',
          data: {
            messages: result.messages,
            count: result.messages?.length || 0
          }
        };

        // Simple formatting now handled directly by SlackAgent
        const formattingResult = {
          success: slackResult.success,
          message: slackResult.message,
          data: slackResult.data
        };

          return {
            success: true,
          data: {
            data: { messages: result.messages },
            count: result.messages?.length || 0,
            message: formattingResult.message
          }
        };
      } else {
          return {
            success: false,
          error: (result as any).error || SLACK_SERVICE_CONSTANTS.ERRORS.MESSAGE_READING_FAILED
        };
      }
        } catch (error) {
      logger.error('Error handling read messages', error as Error, {
        correlationId: 'slack-read-messages',
        operation: 'slack_read_messages',
        metadata: { channel: parameters.channel }
      });
          return {
            success: false,
        error: error instanceof Error ? error.message : SLACK_SERVICE_CONSTANTS.ERRORS.MESSAGE_READING_FAILED
      };
    }
  }

  /**
   * Handle read thread operation
   */
  private async handleReadThread(parameters: ToolParameters, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      if (!parameters.channelId) {
        return {
          success: false,
          error: SLACK_SERVICE_CONSTANTS.ERRORS.CHANNEL_ID_REQUIRED
        };
      }

      if (!parameters.threadTs) {
            return {
          success: false,
          error: SLACK_SERVICE_CONSTANTS.ERRORS.THREAD_TS_REQUIRED
        };
      }

      const result = await this.slackMessageAnalyzer!.readThreadMessages(
        parameters.channelId as string,
        parameters.threadTs as string,
        {
          limit: parameters.limit as number,
          includeAllMetadata: parameters.includeAttachments as boolean
        }
      );

      if (result.success) {
        // Format the result
        const slackResult: SimpleSlackResult = {
          success: true,
          message: 'Thread messages retrieved successfully',
          data: {
            messages: result.messages,
            count: result.messages?.length || 0
          }
        };

        // Simple formatting now handled directly by SlackAgent
        const formattingResult = {
          success: slackResult.success,
          message: slackResult.message,
          data: slackResult.data
        };

          return {
            success: true,
            data: {
            data: { messages: result.messages },
            count: result.messages?.length || 0,
            message: formattingResult.message
          }
        };
      } else {
        return {
          success: false,
          error: (result as any).error || SLACK_SERVICE_CONSTANTS.ERRORS.THREAD_READING_FAILED
        };
      }
        } catch (error) {
      logger.error('Error handling read thread', error as Error, {
        correlationId: 'slack-read-thread',
        operation: 'slack_read_thread',
        metadata: { threadTs: parameters.threadTs }
      });
          return {
            success: false,
        error: error instanceof Error ? error.message : SLACK_SERVICE_CONSTANTS.ERRORS.THREAD_READING_FAILED
          };
    }
  }

  /**
   * Handle analyze conversation operation
   */
  private async handleAnalyzeConversation(parameters: ToolParameters, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      if (!parameters.messages || !Array.isArray(parameters.messages)) {
        return {
          success: false,
          error: 'Messages array is required for conversation analysis'
        };
      }

      const result = await this.slackMessageAnalyzer!.analyzeConversationContext(
        parameters.messages as any[],
        {
          includeSentiment: parameters.includeSentiment as boolean,
          includeKeyTopics: parameters.includeKeyTopics as boolean,
          includeActionItems: parameters.includeActionItems as boolean
        }
      );

      if (result.success) {
        // Format the result
        const slackResult: SimpleSlackResult = {
          success: true,
          message: 'Conversation analysis completed successfully',
          data: {
            summary: (result as any).analysis?.summary || (result as any).summary,
            keyTopics: (result as any).analysis?.keyTopics,
            actionItems: (result as any).analysis?.actionItems,
            sentiment: (result as any).analysis?.sentiment,
            participantCount: (result as any).analysis?.participantCount
          }
        };

        // Simple formatting now handled directly by SlackAgent
        const formattingResult = {
          success: slackResult.success,
          message: slackResult.message,
          data: slackResult.data
        };

        return {
          success: true,
          data: {
            analysis: (result as any).analysis || { summary: (result as any).summary },
            message: formattingResult.message
          }
        };
      } else {
        return {
          success: false,
          error: (result as any).error || SLACK_SERVICE_CONSTANTS.ERRORS.CONVERSATION_ANALYSIS_FAILED
        };
      }
    } catch (error) {
      logger.error('Error handling analyze conversation', error as Error, {
        correlationId: 'slack-analyze-conversation',
        operation: 'slack_analyze_conversation',
        metadata: { channel: parameters.channel }
      });
    return {
        success: false,
        error: error instanceof Error ? error.message : SLACK_SERVICE_CONSTANTS.ERRORS.CONVERSATION_ANALYSIS_FAILED
      };
    }
  }

  /**
   * Handle manage drafts operation
   */
  private async handleManageDrafts(parameters: ToolParameters, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      const action = (parameters.action as string) || 'list';

      if (action === 'create') {
        if (!parameters.channelId || !parameters.text) {
    return {
            success: false,
            error: 'Channel ID and text are required for creating drafts'
          };
        }

        const result = await this.slackDraftManager!.createDraft(
          parameters.channelId as string,
          parameters.text as string,
          {
            threadTs: parameters.threadTs as string,
            scheduledTime: parameters.scheduledTime as string
          }
        );

        if (result.success) {
    return {
            success: true,
            data: {
              draft: (result as any).draft || { id: (result as any).draftId },
              message: SLACK_SERVICE_CONSTANTS.SUCCESS.DRAFT_CREATED
            }
          };
        } else {
          return {
            success: false,
            error: (result as any).error || SLACK_SERVICE_CONSTANTS.ERRORS.DRAFT_CREATION_FAILED
          };
        }
      } else if (action === 'list') {
        const result = await this.slackDraftManager!.listDrafts(
          parameters.channelId as string,
          {
            limit: parameters.limit as number,
            includeScheduled: parameters.includeScheduled as boolean
          }
        );

        if (result.success) {
          // Format the result
          const slackResult: SimpleSlackResult = {
            success: true,
            message: 'Drafts retrieved successfully',
            data: {
              drafts: result.drafts,
              count: result.drafts?.length || 0
            }
          };

          // Simple formatting now handled directly by SlackAgent
        const formattingResult = {
          success: slackResult.success,
          message: slackResult.message,
          data: slackResult.data
        };

    return {
            success: true,
            data: {
              data: { drafts: result.drafts },
              count: result.drafts?.length || 0,
              message: formattingResult.message
            }
          };
        } else {
          return {
            success: false,
            error: (result as any).error || SLACK_SERVICE_CONSTANTS.ERRORS.DRAFT_LISTING_FAILED
          };
        }
      } else {
    return {
          success: false,
          error: `Unknown draft action: ${action}`
        };
      }
    } catch (error) {
      logger.error('Error handling manage drafts', error as Error, {
        correlationId: 'slack-manage-drafts',
        operation: 'slack_manage_drafts',
        metadata: { channel: parameters.channel }
      });
    return {
        success: false,
        error: error instanceof Error ? error.message : SLACK_SERVICE_CONSTANTS.ERRORS.DRAFT_CREATION_FAILED
      };
    }
  }

  /**
   * Handle detect confirmations operation
   */
  private async handleDetectConfirmations(parameters: ToolParameters, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      if (!parameters.message) {
        return {
          success: false,
          error: 'Message is required for confirmation detection'
        };
      }

      // AI-powered confirmation detection
      const confirmationAnalysis = await this.analyzeConfirmation(parameters.message as string);
      const isConfirmation = confirmationAnalysis.isConfirmation;
      const confirmationType = confirmationAnalysis.type;

      // Format the result
      const slackResult: SimpleSlackResult = {
        success: true,
        message: 'Confirmation detection completed',
        data: {
          isConfirmation,
          confirmationType
        }
      };

      // Simple formatting now handled directly by SlackAgent
      const formattingResult = {
        success: slackResult.success,
        message: slackResult.message,
        data: slackResult.data
      };
      
      return {
        success: true,
        data: {
          isConfirmation,
          confirmationType,
          message: formattingResult.message
        }
      };
    } catch (error) {
      logger.error('Error handling detect confirmations', error as Error, {
        correlationId: 'slack-detect-confirmations',
        operation: 'slack_detect_confirmations',
        metadata: { channel: parameters.channel }
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : SLACK_SERVICE_CONSTANTS.ERRORS.CONFIRMATION_DETECTION_FAILED
      };
    }
  }
  
  /**
   * Get OpenAI function schema for Slack operations
   */
  static getOpenAIFunctionSchema(): any {
    return {
      name: 'slackAgent',
      description: 'Comprehensive Slack workspace management. Read messages, analyze conversations, manage drafts, detect confirmations. Let OpenAI determine the operation from natural language.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The Slack request in natural language. Examples: "Read recent messages in #general", "Analyze the conversation in this thread", "Create a draft message", "Detect if this is a confirmation"'
          },
          operation: {
            type: 'string',
            description: 'The type of Slack operation to perform - determined by OpenAI from the query',
            enum: Object.values(SLACK_SERVICE_CONSTANTS.SLACK_OPERATIONS)
          },
          channelId: {
            type: 'string',
            description: 'Slack channel ID'
          },
          threadTs: {
            type: 'string',
            description: 'Thread timestamp for thread operations'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of messages to retrieve'
          },
          includeAttachments: {
            type: 'boolean',
            description: 'Whether to include message attachments'
          },
          text: {
            type: 'string',
            description: 'Text content for draft creation'
          },
          scheduledTime: {
            type: 'string',
            description: 'Scheduled time for draft (ISO 8601 format)'
          },
          action: {
            type: 'string',
            description: 'Action for draft management (create, list, update, delete)'
          },
          includeScheduled: {
            type: 'boolean',
            description: 'Whether to include scheduled drafts'
          },
          messages: {
            type: 'array',
            description: 'Array of messages for conversation analysis'
          },
          includeSentiment: {
            type: 'boolean',
            description: 'Whether to include sentiment analysis'
          },
          includeKeyTopics: {
            type: 'boolean',
            description: 'Whether to include key topics extraction'
          },
          includeActionItems: {
            type: 'boolean',
            description: 'Whether to include action items extraction'
          },
          message: {
            type: 'string',
            description: 'Message text for confirmation detection'
          }
        },
        required: ['query']
      }
    };
  }

  /**
   * Build final result from tool execution results
   */
  protected buildFinalResult(
    summary: AgentExecutionSummary,
    successfulResults: ToolExecutionResult[],
    failedResults: ToolExecutionResult[],
    params: SlackAgentRequest,
    context: ToolExecutionContext
  ): SlackAgentResult {
    if (successfulResults.length === 0) {
      return {
        success: false,
        error: failedResults[0]?.error || 'Unknown error'
      };
    }

    // Get the first successful result
    const firstResult = successfulResults[0];
    if (!firstResult) {
      return {
        success: false,
        error: 'No successful results found'
      };
    }

    const data = firstResult.data as any;

    // Add defensive checks for data object
    if (!data) {
      return {
        success: false,
        error: 'No data returned from operation'
      };
    }

    return {
      success: true,
      messages: data.data?.messages || [],
      count: data.count || 0,
      summary: data.analysis?.summary,
      keyTopics: data.analysis?.keyTopics,
      actionItems: data.analysis?.actionItems,
      sentiment: data.analysis?.sentiment,
      participantCount: data.analysis?.participantCount,
      drafts: data.data?.drafts || [],
      isConfirmation: data.isConfirmation || false,
      confirmationType: data.confirmationType
    };
  }

  /**
   * Gather context from Slack messages based on detection result
   * This method is called by MasterAgent to delegate context gathering
   */
  async gatherContext(
    userInput: string,
    contextDetection: ContextDetectionResult,
    slackContext: SlackContext
  ): Promise<ContextGatheringResult> {
    try {
      // Ensure services are initialized
      this.ensureServices();

      // Message analysis now handled internally by SlackAgent

      let messages: SlackMessage[] = [];
      let contextType: ContextGatheringResult['contextType'] = 'none';
      let relevantContext = '';

      switch (contextDetection.contextType) {
        case 'thread_history':
          if (slackContext.threadTs) {
            const result = await this.slackMessageAnalyzer.readThreadMessages(
              slackContext.channelId,
              slackContext.threadTs,
              {
                limit: 20,
                includeAllMetadata: false
              }
            );
            
            if (result.success && result.messages) {
              messages = (result.messages as any[]).map((msg: any) => ({
                id: msg.id || '',
                text: msg.text || '',
                userId: msg.userId || '',
                channelId: msg.channelId || '',
                timestamp: msg.timestamp?.toISOString() || new Date().toISOString(),
                threadTs: msg.threadTs,
                isBot: !!msg.botId,
                attachments: msg.attachments,
                reactions: msg.reactions,
                blocks: undefined
              }));
              contextType = 'thread_history';
              relevantContext = await this.extractRelevantContext(messages, userInput);
            }
          }
          break;

        case 'recent_messages':
          const recentResult = await this.slackMessageAnalyzer.readMessageHistory(
            slackContext.channelId,
            {
              limit: 10,
              includeAllMetadata: false
            }
          );
          
          if (recentResult.success && recentResult.messages) {
            messages = (recentResult.messages as any[]).map((msg: any) => ({
              id: msg.id || '',
              text: msg.text || '',
              userId: msg.userId || '',
              channelId: msg.channelId || '',
              timestamp: msg.timestamp?.toISOString() || new Date().toISOString(),
              threadTs: msg.threadTs,
              isBot: !!msg.botId,
              attachments: msg.attachments,
              reactions: msg.reactions,
              blocks: undefined
            }));
            contextType = 'recent_messages';
            relevantContext = await this.extractRelevantContext(messages, userInput);
          }
          break;

        case 'search_results':
          // Use readMessageHistory to implement search functionality
          const searchResult = await this.slackMessageAnalyzer.readMessageHistory(
            slackContext.channelId,
            {
              limit: 20,
              includeAllMetadata: false
            }
          );
          
          if (searchResult.success && searchResult.messages) {
            // Use the search results directly - AI service already handled filtering
            const filteredMessages = searchResult.messages as any[];
            
            messages = filteredMessages.map((msg: any) => ({
              id: msg.id || '',
              text: msg.text || '',
              userId: msg.userId || '',
              channelId: msg.channelId || '',
              timestamp: msg.timestamp?.toISOString() || new Date().toISOString(),
              threadTs: msg.threadTs,
              isBot: !!msg.botId,
              attachments: msg.attachments,
              reactions: msg.reactions,
              blocks: undefined
            }));
            contextType = 'search_results';
            relevantContext = await this.extractRelevantContext(messages, userInput);
          }
          break;

        default:
          contextType = 'none';
      }

      logger.debug('Context gathering completed', {
        correlationId: 'slack-context-gathering',
        operation: 'slack_context_gathering',
        metadata: {
          contextType,
          messageCount: messages.length,
          confidence: contextDetection.confidence,
          userInput: userInput.substring(0, 100)
        }
      });

      return {
        messages,
        relevantContext,
        contextType,
        confidence: contextDetection.confidence
      };

    } catch (error) {
      logger.error('Error gathering context', error as Error, {
        correlationId: 'slack-context-gathering',
        operation: 'slack_context_gathering',
        metadata: { userInput: userInput.substring(0, 100) }
      });
      return {
        messages: [],
        relevantContext: '',
        contextType: 'none',
        confidence: 0.0
      };
    }
  }

  /**
   * Extract relevant context from messages for the user input using AI
   */
  private async extractRelevantContext(messages: SlackMessage[], userInput: string): Promise<string> {
    if (messages.length === 0) return '';

    try {
      const openaiService = getService<OpenAIService>('openaiService');
      if (!openaiService) {
        throw new Error('AI service unavailable. Context extraction requires OpenAI service.');
      }

      const messageTexts = messages.map(msg => `[${msg.timestamp}] ${msg.text}`).join('\n');

      const prompt = `Extract the most relevant context from these Slack messages for the user request: "${userInput}"

Messages:
${messageTexts}

Return the 3 most relevant messages that provide context for the user's request. Focus on messages that:
- Relate to the same topic or project
- Mention similar keywords or concepts
- Provide background context that would help understand the user's request

Return only the relevant message text with timestamps, one per line.`;

      const response = await openaiService.generateText(
        prompt,
        'You extract relevant context from Slack messages based on user requests.',
        { temperature: 0.1, maxTokens: 500 }
      );

      return response.trim();
    } catch (error) {
      logger.error('AI context extraction failed', error as Error);
      throw new Error('Context extraction failed. Please check your OpenAI configuration.');
    }
  }

  /**
   * Extract search terms from user input
   */

  /**
   * AI-powered confirmation analysis
   */
  private async analyzeConfirmation(message: string): Promise<{
    isConfirmation: boolean;
    type: 'positive' | 'negative';
    confidence: number;
  }> {
    try {
      const openaiService = getService<OpenAIService>('openaiService');
      if (!openaiService) {
        throw new Error('AI service unavailable. Confirmation analysis requires OpenAI service.');
      }

      const prompt = `Analyze this message to determine if it's a confirmation/response and what type:

Message: "${message}"

Determine:
1. Is this a confirmation/response to a previous request? (true/false)
2. If it is a confirmation, is it positive (agreeing/accepting) or negative (declining/rejecting)?
3. Confidence level (0.0 to 1.0)

Examples:
- "Yes, send that email" → confirmation: true, type: positive, confidence: 0.95
- "No thanks" → confirmation: true, type: negative, confidence: 0.9
- "Cancel that" → confirmation: true, type: negative, confidence: 0.9
- "What's the weather?" → confirmation: false, type: negative, confidence: 0.1

Return only JSON: {"isConfirmation": boolean, "type": "positive"|"negative", "confidence": number}`;

      const response = await openaiService.generateText(
        prompt,
        'You are an expert at analyzing user messages for confirmation intent. Return only valid JSON.',
        { temperature: 0.1, maxTokens: 100 }
      );

      return JSON.parse(response);
    } catch (error) {
      // Fallback to simple detection on error
      const lowerMessage = message.toLowerCase();
      const isPositive = lowerMessage.includes('yes') || lowerMessage.includes('confirm');
      return {
        isConfirmation: isPositive || lowerMessage.includes('no') || lowerMessage.includes('cancel'),
        type: isPositive ? 'positive' : 'negative',
        confidence: 0.3
      };
    }
  }

  /**
   * Get agent limitations
   */
  static getLimitations(): string[] {
    return [
      'Cannot access private channels without proper permissions',
      'Limited by Slack API rate limits',
      'Cannot read messages from channels the bot is not a member of',
      'Draft management is local to this service instance'
    ];
  }

  // NATURAL LANGUAGE INTERFACE IMPLEMENTATION

  /**
   * Get agent capability description for MasterAgent
   */
  getCapabilityDescription(): AgentCapabilities {
    return {
      name: 'Slack Expert',
      description: 'Reads Slack messages, analyzes conversations, and manages Slack communication workflows',
      capabilities: [
        'Read messages from Slack channels and threads',
        'Analyze conversation context and extract key topics',
        'Provide message summaries and sentiment analysis',
        'Track action items and follow-ups from discussions',
        'Search through message history with filters',
        'Identify conversation participants and engagement patterns',
        'Extract relevant context for ongoing conversations',
        'Handle thread-based discussions and replies'
      ],
      limitations: [
        'Cannot access private channels without proper permissions',
        'Limited by Slack API rate limits and access tokens',
        'Cannot read messages from channels the bot is not a member of',
        'Cannot send messages or modify Slack content (read-only)',
        'Draft management is local to this service instance'
      ],
      examples: [
        'Read the latest 10 messages from #general channel',
        'Summarize the discussion in the project thread',
        'What are the key topics from today\'s standup messages?',
        'Show me recent messages mentioning the release',
        'Analyze sentiment of the team discussion',
        'Extract action items from the planning conversation'
      ],
      domains: ['slack', 'messaging', 'team communication', 'conversation analysis'],
      requirements: ['Slack API access', 'Bot token with appropriate scopes']
    };
  }

  /**
   * Domain-specific intent analysis for Slack operations
   */
  protected async analyzeIntent(request: string, context: AgentExecutionContext): Promise<AgentIntent> {
    try {
      const prompt = `Analyze this Slack request: "${request}"

Available Slack operations:
- read_messages: Read recent messages from a channel
- read_thread: Read messages from a specific thread
- analyze_context: Analyze conversation context and extract insights
- search_messages: Search through message history
- summarize: Summarize conversations or discussions

Return JSON with operation, parameters, confidence (0-1), and reasoning.

Parameters should include:
- query: The full request for context
- channelId: Slack channel ID (if specified or can be inferred)
- threadTs: Thread timestamp (for thread operations)
- limit: Number of messages to read (default 10)
- includeAttachments: Whether to include message attachments
- searchQuery: Search terms (for search operations)
- operation: The specific Slack operation to perform`;

      const response = await this.openaiService?.generateStructuredData(prompt, 'Slack intent analyzer', {
        type: 'object',
        properties: {
          operation: { type: 'string' },
          parameters: { type: 'object' },
          confidence: { type: 'number' },
          reasoning: { type: 'string' }
        }
      }) as { operation?: string; parameters?: any; confidence?: number; reasoning?: string };

      return {
        operation: response?.operation || 'read_messages',
        parameters: response?.parameters || { query: request, limit: 10 },
        confidence: response?.confidence || 0.8,
        reasoning: response?.reasoning || 'Slack operation detected',
        toolsUsed: ['slackAgent', response?.operation || 'read_messages']
      };
    } catch (error) {
      console.error('Slack intent analysis failed:', error);
      // Fallback to read_messages operation
      return {
        operation: 'read_messages',
        parameters: { query: request, limit: 10 },
        confidence: 0.7,
        reasoning: 'Fallback to Slack message reading due to analysis error',
        toolsUsed: ['slackAgent']
      };
    }
  }

  /**
   * Execute the selected tool based on intent analysis
   */
  protected async executeSelectedTool(intent: AgentIntent, context: AgentExecutionContext): Promise<any> {
    const params: SlackAgentRequest = {
      query: intent.parameters.query || '',
      accessToken: context.accessToken || '',
      operation: intent.operation as 'read_messages' | 'read_thread' | 'detect_drafts' | 'manage_drafts' | 'confirmation_handling',
      channelId: intent.parameters.channelId || context.slackContext?.channelId,
      threadTs: intent.parameters.threadTs || context.slackContext?.threadTs,
      limit: intent.parameters.limit || 10,
      includeAttachments: intent.parameters.includeAttachments || false
    };

    const toolContext = {
      sessionId: context.sessionId,
      userId: context.userId,
      timestamp: context.timestamp,
      metadata: { correlationId: context.correlationId }
    };

    return await this.processQuery(params, toolContext);
  }

  /**
   * Generate natural language response from tool execution results
   */
  protected async generateResponse(
    request: string,
    result: any,
    intent: AgentIntent,
    context: AgentExecutionContext
  ): Promise<string> {
    try {
      const slackResult = result as SlackAgentResult;

      if (!slackResult.success) {
        return `I encountered an issue while accessing Slack: ${slackResult.error || 'Unknown error'}. Please check your Slack connection and permissions.`;
      }

      switch (intent.operation) {
        case 'read_messages':
          if (!slackResult.messages || slackResult.messages.length === 0) {
            return 'No messages found in the specified channel. The channel might be empty or you may not have access to it.';
          }
          return `📱 Found ${slackResult.count || slackResult.messages.length} message${(slackResult.count || slackResult.messages.length) === 1 ? '' : 's'} from Slack.${slackResult.summary ? `\n\n**Summary:** ${slackResult.summary}` : ''}${slackResult.keyTopics && slackResult.keyTopics.length > 0 ? `\n\n**Key Topics:** ${slackResult.keyTopics.join(', ')}` : ''}`;

        case 'read_thread':
          if (!slackResult.messages || slackResult.messages.length === 0) {
            return 'No messages found in the specified thread. The thread might be empty or no longer accessible.';
          }
          return `🧵 Found ${slackResult.count || slackResult.messages.length} message${(slackResult.count || slackResult.messages.length) === 1 ? '' : 's'} in the thread.${slackResult.participantCount ? ` Participants: ${slackResult.participantCount}` : ''}${slackResult.summary ? `\n\n**Thread Summary:** ${slackResult.summary}` : ''}`;

        case 'analyze_context':
          return `🔍 Slack context analysis completed.${slackResult.summary ? `\n\n**Analysis:** ${slackResult.summary}` : ''}${slackResult.sentiment ? `\n**Sentiment:** ${slackResult.sentiment}` : ''}${slackResult.actionItems && slackResult.actionItems.length > 0 ? `\n\n**Action Items:**\n${slackResult.actionItems.map(item => `• ${item}`).join('\n')}` : ''}`;

        case 'search_messages':
          if (!slackResult.messages || slackResult.messages.length === 0) {
            return 'No messages found matching your search criteria. Try adjusting your search terms or expanding the time range.';
          }
          return `🔍 Found ${slackResult.count || slackResult.messages.length} message${(slackResult.count || slackResult.messages.length) === 1 ? '' : 's'} matching your search.${slackResult.keyTopics && slackResult.keyTopics.length > 0 ? `\n\n**Topics Found:** ${slackResult.keyTopics.join(', ')}` : ''}`;

        case 'summarize':
          return `📋 Slack conversation summary:${slackResult.summary ? `\n\n${slackResult.summary}` : '\n\nNo significant content to summarize.'}${slackResult.actionItems && slackResult.actionItems.length > 0 ? `\n\n**Action Items:**\n${slackResult.actionItems.map(item => `• ${item}`).join('\n')}` : ''}`;

        default:
          return `Slack operation completed successfully. ${slackResult.count ? `Found ${slackResult.count} items.` : ''}${slackResult.summary ? ` ${slackResult.summary}` : ''}`;
      }
    } catch (error) {
      console.error('Slack response generation failed:', error);
      return `I encountered an issue while processing your Slack request: "${request}". Please check your Slack connection and try again.`;
    }
  }
}
