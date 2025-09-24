/**
 * Slack Agent - Context Intelligence Microservice
 *
 * Natural language Slack context gathering using the NaturalLanguageAgent pattern.
 *
 * Purpose: Provide intelligent Slack context to other agents (read-only).
 *
 * This agent only implements 2 methods:
 * 1. getAgentConfig() - Configuration and metadata
 * 2. executeOperation() - Internal Slack operations
 *
 * Everything else (LLM analysis, response formatting) is handled by the base class.
 */

import { NaturalLanguageAgent, AgentConfig } from '../framework/natural-language-agent';
import { SlackService } from '../services/slack/slack.service';
import { OpenAIService } from '../services/openai.service';
import logger from '../utils/logger';
import { SlackBlock } from '../types/slack/slack.types';
import { SlackAttachment } from '../types/slack/slack-message-reader.types';

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
    [key: string]: unknown;
  }> | undefined;
}

/**
 * Context gathering interfaces for MasterAgent integration
 */
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

interface SlackAnalysisResult {
  summary: string;
  topics?: string[];
  sentiment?: string;
  actionItems?: string[];
  participants?: string[];
  urgency?: string;
}

/**
 * SlackAgent - Context Intelligence Microservice
 *
 * Microservice API:
 *   Input: Natural language query about Slack context
 *   Output: Natural language summary with insights
 *
 * Examples:
 *   "Get latest messages from #general" → "Last 10 messages discuss deployment..."
 *   "Find deployment thread" → "Found thread started by @john at 2:45pm..."
 *   "What mentioned me?" → "You were mentioned 3 times: @john asked..."
 */
export class SlackAgent extends NaturalLanguageAgent {

  /**
   * Agent configuration - defines what this agent can do
   */
  protected getAgentConfig(): AgentConfig {
    return {
      name: 'slackAgent',

      systemPrompt: `You are a Slack context intelligence agent.

Your role is to gather, analyze, and summarize Slack conversations to provide useful context to other agents and users. You are READ-ONLY - you don't post messages or modify Slack.

Your capabilities:
- Fetch and summarize recent channel messages
- Retrieve and analyze thread conversations
- Search for specific topics or keywords
- Extract action items and decisions
- Identify participants and sentiment
- Provide context for decision-making

When analyzing Slack content:
1. Focus on key insights, not raw data dumps
2. Identify important topics and themes
3. Extract action items and decisions
4. Note participant involvement
5. Assess urgency and sentiment
6. Provide actionable context

Always return natural language summaries that help others understand what's happening in Slack.`,

      operations: [
        'get_recent_messages',      // Fetch recent channel messages
        'get_thread_context',        // Get full thread conversation
        'analyze_conversation',      // Summarize and analyze messages
        'find_mentions',             // Find where user was mentioned
        'extract_action_items',      // Pull out TODOs/decisions
        'get_channel_summary'        // Overall channel activity summary
      ],

      services: ['slackService', 'openaiService'],

      auth: {
        type: 'oauth',
        provider: 'slack'
      },

      capabilities: [
        'Retrieve and summarize Slack messages from channels',
        'Analyze conversation threads and extract key points',
        'Search for specific topics or keywords in messages',
        'Identify action items and decisions from discussions',
        'Provide context for drafting responses',
        'Track mentions and user activity',
        'Assess conversation sentiment and urgency'
      ],

      // Slack is read-only, no risky operations
      draftRules: {
        operations: [],
        defaultRiskLevel: 'low'
      },

      limitations: [
        'Read-only access - cannot post or modify messages',
        'Limited to channels the bot has access to',
        'Cannot access private DMs without explicit permission'
      ]
    };
  }

  /**
   * Execute internal operations - the only agent-specific logic
   */
  protected async executeOperation(
    operation: string,
    parameters: any,
    authToken: string
  ): Promise<any> {
    const slackService = this.getService('slackService') as SlackService;
    const openaiService = this.getService('openaiService') as OpenAIService;

    if (!slackService) {
      throw new Error('SlackService not available');
    }

    switch (operation) {
      case 'get_recent_messages': {
        // Fetch recent messages from channel
        const channelId = parameters.channelId || parameters.channel;
        const limit = parameters.limit || 10;

        const result = await slackService.getChannelHistory(channelId, limit);
        const messages = this.normalizeMessages(result.messages);

        // Summarize messages with LLM
        const analysis = await this.analyzeMessagesWithLLM(
          messages,
          openaiService,
          'summarize'
        );

        return {
          messages,
          count: messages.length,
          channel: channelId,
          summary: analysis.summary,
          topics: analysis.topics,
          hasMore: result.hasMore
        };
      }

      case 'get_thread_context': {
        // Fetch thread messages
        const channelId = parameters.channelId || parameters.channel;
        const threadTs = parameters.threadTs || parameters.threadId;

        const result = await slackService.getThreadMessages(channelId, threadTs);
        const messages = this.normalizeMessages(result.messages);

        // Analyze thread with LLM
        const analysis = await this.analyzeMessagesWithLLM(
          messages,
          openaiService,
          'thread_analysis'
        );

        return {
          thread: {
            channelId,
            threadTs,
            messages,
            participantCount: this.countParticipants(messages),
            lastActivity: messages[messages.length - 1]?.timestamp
          },
          summary: analysis.summary,
          actionItems: analysis.actionItems,
          participants: analysis.participants
        };
      }

      case 'analyze_conversation': {
        // Analyze provided messages or fetch from channel
        let messages: SlackMessage[];

        if (parameters.messages) {
          messages = parameters.messages;
        } else if (parameters.channelId) {
          const result = await slackService.getChannelHistory(
            parameters.channelId,
            parameters.limit || 50
          );
          messages = this.normalizeMessages(result.messages);
        } else {
          throw new Error('Either messages or channelId must be provided');
        }

        // Deep analysis with LLM
        const analysis = await this.analyzeMessagesWithLLM(
          messages,
          openaiService,
          'deep_analysis'
        );

        return {
          summary: analysis.summary,
          topics: analysis.topics,
          sentiment: analysis.sentiment,
          actionItems: analysis.actionItems,
          participants: analysis.participants,
          urgency: analysis.urgency,
          messageCount: messages.length
        };
      }

      case 'find_mentions': {
        // Find mentions of user in recent messages
        const userId = parameters.userId;
        const channelId = parameters.channelId;
        const limit = parameters.limit || 50;

        const result = await slackService.getChannelHistory(channelId, limit);
        const messages = this.normalizeMessages(result.messages);

        // Filter messages that mention the user
        const mentions = messages.filter(msg =>
          msg.text.includes(`<@${userId}>`) ||
          msg.text.toLowerCase().includes('everyone') ||
          msg.text.toLowerCase().includes('channel')
        );

        // Summarize mentions
        const analysis = await this.analyzeMessagesWithLLM(
          mentions,
          openaiService,
          'mentions'
        );

        return {
          mentions,
          count: mentions.length,
          summary: analysis.summary,
          actionItems: analysis.actionItems
        };
      }

      case 'extract_action_items': {
        // Extract action items from messages
        let messages: SlackMessage[];

        if (parameters.messages) {
          messages = parameters.messages;
        } else if (parameters.channelId) {
          const result = await slackService.getChannelHistory(
            parameters.channelId,
            parameters.limit || 50
          );
          messages = this.normalizeMessages(result.messages);
        } else {
          throw new Error('Either messages or channelId must be provided');
        }

        // Extract action items with LLM
        const analysis = await this.analyzeMessagesWithLLM(
          messages,
          openaiService,
          'action_items'
        );

        return {
          actionItems: analysis.actionItems || [],
          summary: analysis.summary,
          assignees: this.extractAssignees(messages, analysis.actionItems || [])
        };
      }

      case 'get_channel_summary': {
        // Get overall channel summary
        const channelId = parameters.channelId || parameters.channel;
        const limit = parameters.limit || 30;

        const result = await slackService.getChannelHistory(channelId, limit);
        const messages = this.normalizeMessages(result.messages);

        // Comprehensive summary
        const analysis = await this.analyzeMessagesWithLLM(
          messages,
          openaiService,
          'channel_summary'
        );

        return {
          channel: channelId,
          messageCount: messages.length,
          participantCount: this.countParticipants(messages),
          summary: analysis.summary,
          topics: analysis.topics,
          sentiment: analysis.sentiment,
          actionItems: analysis.actionItems,
          urgency: analysis.urgency
        };
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Analyze messages using LLM
   */
  private async analyzeMessagesWithLLM(
    messages: SlackMessage[],
    openaiService: OpenAIService,
    analysisType: 'summarize' | 'thread_analysis' | 'deep_analysis' | 'mentions' | 'action_items' | 'channel_summary'
  ): Promise<SlackAnalysisResult> {
    if (!messages || messages.length === 0) {
      return {
        summary: 'No messages to analyze',
        topics: [],
        actionItems: []
      };
    }

    // Format messages for LLM
    const messageText = messages.map(msg =>
      `[${msg.timestamp}] User ${msg.userId}: ${msg.text}`
    ).join('\n');

    // Different prompts for different analysis types
    const prompts = {
      summarize: `Summarize these Slack messages in 2-3 sentences. Focus on the main discussion topic and key points.`,

      thread_analysis: `Analyze this Slack thread conversation. Provide:
1. Brief summary of the discussion
2. Key action items or decisions
3. Main participants and their roles`,

      deep_analysis: `Deeply analyze these Slack messages. Provide:
1. Comprehensive summary (3-4 sentences)
2. Main topics discussed (list up to 5)
3. Overall sentiment (positive/neutral/concerned/urgent)
4. Action items and decisions (if any)
5. Urgency level (low/medium/high)`,

      mentions: `Analyze these mentions and summarize:
1. Who mentioned the user and why
2. Any action items or requests
3. Priority level`,

      action_items: `Extract all action items, TODOs, and decisions from these messages. For each:
1. What needs to be done
2. Who is responsible (if mentioned)
3. Any deadlines or urgency`,

      channel_summary: `Provide an executive summary of this channel's recent activity:
1. Main topics of discussion (2-3 sentences)
2. Key themes or patterns
3. Action items or decisions
4. Overall tone and urgency`
    };

    const systemPrompt = `You are a Slack conversation analyzer. ${prompts[analysisType]}

Messages:
${messageText}

Return a JSON object with: { summary, topics, sentiment, actionItems, participants, urgency }
Keep it concise and actionable.`;

    try {
      const response = await openaiService.createChatCompletion([
        { role: 'system', content: systemPrompt }
      ], 500);

      // Try to parse JSON, fallback to text
      try {
        const parsed = JSON.parse(response.content);
        return {
          summary: parsed.summary || response.content,
          topics: parsed.topics || [],
          sentiment: parsed.sentiment,
          actionItems: parsed.actionItems || [],
          participants: parsed.participants || this.extractParticipants(messages),
          urgency: parsed.urgency
        };
      } catch {
        return {
          summary: response.content,
          topics: [],
          participants: this.extractParticipants(messages)
        };
      }
    } catch (error) {
      logger.error('LLM analysis failed', error as Error);
      return {
        summary: `Analyzed ${messages.length} messages`,
        topics: [],
        participants: this.extractParticipants(messages)
      };
    }
  }

  /**
   * Normalize Slack API messages to our format
   */
  private normalizeMessages(apiMessages: any[]): SlackMessage[] {
    return apiMessages.map(msg => ({
      id: msg.ts || msg.client_msg_id || '',
      text: msg.text || '',
      userId: msg.user || msg.bot_id || 'unknown',
      channelId: msg.channel || '',
      timestamp: msg.ts || '',
      threadTs: msg.thread_ts,
      isBot: !!msg.bot_id,
      attachments: msg.attachments,
      blocks: msg.blocks,
      reactions: msg.reactions
    }));
  }

  /**
   * Extract unique participants from messages
   */
  private extractParticipants(messages: SlackMessage[]): string[] {
    const participants = new Set<string>();
    messages.forEach(msg => {
      if (msg.userId && msg.userId !== 'unknown') {
        participants.add(msg.userId);
      }
    });
    return Array.from(participants);
  }

  /**
   * Count unique participants
   */
  private countParticipants(messages: SlackMessage[]): number {
    return this.extractParticipants(messages).length;
  }

  /**
   * Extract assignees from action items
   */
  private extractAssignees(messages: SlackMessage[], actionItems: string[]): string[] {
    const assignees = new Set<string>();

    actionItems.forEach(item => {
      // Look for @mentions in action items
      const mentions = item.match(/@(\w+)/g);
      if (mentions) {
        mentions.forEach(mention => assignees.add(mention.slice(1)));
      }
    });

    return Array.from(assignees);
  }


  /**
   * Get agent capabilities (for MasterAgent discovery)
   */
  static getCapabilities(): string[] {
    const instance = new SlackAgent();
    const config = instance.getAgentConfig();
    return config.capabilities || config.operations;
  }
}
