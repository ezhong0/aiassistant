import { AIAgent } from '../framework/ai-agent';
import { ToolExecutionContext, SlackAgentParams } from '../types/tools';
import { PreviewGenerationResult } from '../types/api/api.types';
import { resolveSlackService } from '../services/service-resolver';
import { getService, serviceManager } from '../services/service-manager';
import { SlackInterfaceService } from '../services/slack/slack-interface.service';
import { SlackContext, SlackMessageEvent, SlackResponse, SlackBlock } from '../types/slack/slack.types';
import { SlackMessage as ReaderSlackMessage, SlackMessageReaderError, SlackAttachment } from '../types/slack/slack-message-reader.types';
import { AIClassificationService } from '../services/ai-classification.service';
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

// Import focused services
import { SlackMessageAnalyzer, SlackMessageReadingResult } from '../services/slack/slack-message-analyzer.service';
import { SlackDraftManager, SlackDraftManagementResult } from '../services/slack/slack-draft-manager.service';
import { SlackFormatter, SlackFormattingResult, SlackResult } from '../services/slack/slack-formatter.service';

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
  private slackMessageAnalyzer: SlackMessageAnalyzer | null = null;
  private slackDraftManager: SlackDraftManager | null = null;
  private slackFormatter: SlackFormatter | null = null;

  constructor() {
    super({
      name: 'slackAgent',
      description: 'Read Slack message history, manage drafts, and handle confirmations',
      enabled: true,
      timeout: 15000,
      retryCount: 2,
      aiPlanning: {
        enableAIPlanning: true,
        maxPlanningSteps: 5,
        planningTimeout: 10000,
        cachePlans: true,
        planningTemperature: 0.1,
        planningMaxTokens: 1500
      }
    });
  }

  /**
   * Lazy initialization of Slack services
   */
  private ensureServices(): void {
    if (!this.slackMessageAnalyzer) {
      this.slackMessageAnalyzer = serviceManager.getService(SLACK_SERVICE_CONSTANTS.SERVICE_NAMES.SLACK_MESSAGE_ANALYZER) as SlackMessageAnalyzer;
    }
    if (!this.slackDraftManager) {
      this.slackDraftManager = serviceManager.getService(SLACK_SERVICE_CONSTANTS.SERVICE_NAMES.SLACK_DRAFT_MANAGER) as SlackDraftManager;
    }
    if (!this.slackFormatter) {
      this.slackFormatter = serviceManager.getService(SLACK_SERVICE_CONSTANTS.SERVICE_NAMES.SLACK_FORMATTER) as SlackFormatter;
    }
  }

  /**
   * Cleanup focused service dependencies
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.logger.info('Destroying SlackAgent...');
      this.slackMessageAnalyzer = null;
      this.slackDraftManager = null;
      this.slackFormatter = null;
      this.logger.info('SlackAgent destroyed successfully');
    } catch (error) {
      this.logger.error('Error during SlackAgent destruction', error);
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
    this.logger.debug(`Executing Slack tool: ${toolName}`, {
      toolName,
      parametersKeys: Object.keys(parameters),
      sessionId: context.sessionId
    });

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
      this.logger.error(`Error executing Slack tool ${toolName}:`, error);
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
          oldest: parameters.oldest as string,
          latest: parameters.latest as string,
          includeAllMetadata: parameters.includeAttachments as boolean
        }
      );

      if (result.success) {
        // Format the result
        const slackResult: SlackResult = {
          messages: result.messages,
          count: result.count
        };

        const formattingResult = this.slackFormatter!.formatSlackResult(slackResult);
          
          return {
            success: true,
          data: {
            messages: result.messages,
            count: result.count,
            message: formattingResult.formattedText
          }
        };
      } else {
          return {
            success: false,
          error: result.error || SLACK_SERVICE_CONSTANTS.ERRORS.MESSAGE_READING_FAILED
        };
      }
        } catch (error) {
      this.logger.error('Error handling read messages:', error);
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
        const slackResult: SlackResult = {
          messages: result.messages,
          count: result.count
        };

        const formattingResult = this.slackFormatter!.formatSlackResult(slackResult);

          return {
            success: true,
            data: {
            messages: result.messages,
            count: result.count,
            message: formattingResult.formattedText
          }
        };
      } else {
        return {
          success: false,
          error: result.error || SLACK_SERVICE_CONSTANTS.ERRORS.THREAD_READING_FAILED
        };
      }
        } catch (error) {
      this.logger.error('Error handling read thread:', error);
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
        const slackResult: SlackResult = {
          summary: result.analysis?.summary,
          keyTopics: result.analysis?.keyTopics,
          actionItems: result.analysis?.actionItems,
          sentiment: result.analysis?.sentiment,
          participantCount: result.analysis?.participantCount
        };

        const formattingResult = this.slackFormatter!.formatSlackResult(slackResult);
        
        return {
          success: true,
          data: {
            analysis: result.analysis,
            message: formattingResult.formattedText
          }
        };
      } else {
        return {
          success: false,
          error: result.error || SLACK_SERVICE_CONSTANTS.ERRORS.CONVERSATION_ANALYSIS_FAILED
        };
      }
    } catch (error) {
      this.logger.error('Error handling analyze conversation:', error);
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
              draft: result.draft,
              message: SLACK_SERVICE_CONSTANTS.SUCCESS.DRAFT_CREATED
            }
          };
        } else {
          return {
            success: false,
            error: result.error || SLACK_SERVICE_CONSTANTS.ERRORS.DRAFT_CREATION_FAILED
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
          const slackResult: SlackResult = {
            drafts: result.drafts,
            count: result.count
          };

          const formattingResult = this.slackFormatter!.formatSlackResult(slackResult);

    return {
            success: true,
            data: {
              drafts: result.drafts,
              count: result.count,
              message: formattingResult.formattedText
            }
          };
        } else {
          return {
            success: false,
            error: result.error || SLACK_SERVICE_CONSTANTS.ERRORS.DRAFT_LISTING_FAILED
          };
        }
      } else {
    return {
          success: false,
          error: `Unknown draft action: ${action}`
        };
      }
    } catch (error) {
      this.logger.error('Error handling manage drafts:', error);
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

      // Simple confirmation detection logic
      const message = (parameters.message as string).toLowerCase();
      const isConfirmation = message.includes('yes') || 
                           message.includes('confirm') || 
                           message.includes('approve') ||
                           message.includes('ok') ||
                           message.includes('sure') ||
                           message.includes('go ahead');

      const confirmationType = isConfirmation ? 'positive' : 'negative';

      // Format the result
      const slackResult: SlackResult = {
        isConfirmation,
        confirmationType
      };

      const formattingResult = this.slackFormatter!.formatSlackResult(slackResult);
      
      return {
        success: true,
        data: {
          isConfirmation,
          confirmationType,
          message: formattingResult.formattedText
        }
      };
    } catch (error) {
      this.logger.error('Error handling detect confirmations:', error);
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
      name: 'manage_slack',
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
      messages: data.messages || [],
      count: data.count || 0,
      summary: data.analysis?.summary,
      keyTopics: data.analysis?.keyTopics,
      actionItems: data.analysis?.actionItems,
      sentiment: data.analysis?.sentiment,
      participantCount: data.analysis?.participantCount,
      drafts: data.drafts || [],
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

      if (!this.slackMessageAnalyzer) {
        throw new Error('SlackMessageAnalyzer not available');
      }

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
              messages = result.messages.map(msg => ({
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
              relevantContext = this.extractRelevantContext(messages, userInput);
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
            messages = recentResult.messages.map(msg => ({
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
            relevantContext = this.extractRelevantContext(messages, userInput);
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
            // Filter messages based on search terms
            const searchTerms = this.extractSearchTerms(userInput);
            const filteredMessages = searchResult.messages.filter(msg => {
              const text = (msg.text || '').toLowerCase();
              return searchTerms.some(term => text.includes(term.toLowerCase()));
            });
            
            messages = filteredMessages.map(msg => ({
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
            relevantContext = this.extractRelevantContext(messages, userInput);
          }
          break;

        default:
          contextType = 'none';
      }

      this.logger.info('Context gathering completed', {
        contextType,
        messageCount: messages.length,
        confidence: contextDetection.confidence,
        userInput: userInput.substring(0, 100)
      });

      return {
        messages,
        relevantContext,
        contextType,
        confidence: contextDetection.confidence
      };

    } catch (error) {
      this.logger.error('Error gathering context:', error);
      return {
        messages: [],
        relevantContext: '',
        contextType: 'none',
        confidence: 0.0
      };
    }
  }

  /**
   * Extract relevant context from messages for the user input
   */
  private extractRelevantContext(messages: SlackMessage[], userInput: string): string {
    if (messages.length === 0) return '';

    // Simple relevance scoring based on keyword overlap
    const userKeywords = userInput.toLowerCase().split(/\s+/).filter(word => word.length > 3);
    
    const relevantMessages = messages
      .map(msg => ({
        message: msg,
        score: this.calculateRelevanceScore(msg.text, userKeywords)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3); // Top 3 most relevant messages

    return relevantMessages
      .map(item => `[${item.message.timestamp}] ${item.message.text}`)
      .join('\n');
  }

  /**
   * Calculate relevance score between message text and user keywords
   */
  private calculateRelevanceScore(messageText: string, keywords: string[]): number {
    const text = messageText.toLowerCase();
    return keywords.reduce((score, keyword) => {
      return score + (text.includes(keyword) ? 1 : 0);
    }, 0);
  }

  /**
   * Extract search terms from user input
   */
  private extractSearchTerms(userInput: string): string[] {
    // Simple extraction of potential search terms
    const words = userInput.toLowerCase().split(/\s+/);
    return words.filter(word => 
      word.length > 2 && 
      !['the', 'and', 'or', 'but', 'for', 'with', 'about', 'from', 'that', 'this'].includes(word)
    );
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
}
