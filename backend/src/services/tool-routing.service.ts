import { BaseService } from './base-service';
import { getService } from './service-manager';
import { OpenAIService } from './openai.service';
import { AgentFactory } from '../framework/agent-factory';
import { ToolCall, ToolExecutionContext } from '../types/tools';
import logger from '../utils/logger';
import { z } from 'zod';

/**
 * Agent Capability Metadata
 */
export interface AgentCapability {
  agentName: string;
  capabilities: string[];
  description: string;
  specialties: string[];
  limitations: string[];
  requiresConfirmation: boolean;
  estimatedExecutionTime: number;
}

/**
 * Tool Routing Decision
 */
export interface ToolRoutingDecision {
  selectedAgent: string;
  toolCall: ToolCall;
  confidence: number;
  reasoning: string;
  requiresConfirmation: boolean;
  confirmationMessage?: string | undefined;
  parameters: any;
}

/**
 * Confirmation Message Generation Result
 */
export interface ConfirmationMessage {
  message: string;
  prompt: string;
  riskLevel: 'low' | 'medium' | 'high';
  contextualDetails: string[];
}

/**
 * AI-Powered Tool Routing Service
 * 
 * Replaces hardcoded if/else chains with intelligent agent selection
 * and dynamic response generation based on user intent and agent capabilities.
 */
export class ToolRoutingService extends BaseService {
  private openaiService: OpenAIService | null = null;
  private agentCapabilities = new Map<string, AgentCapability>();

  constructor() {
    super('toolRoutingService');
  }

  protected async onInitialize(): Promise<void> {
    try {
      const service = getService<OpenAIService>('openaiService');
      this.openaiService = service || null;
      
      // Initialize agent capabilities
      await this.initializeAgentCapabilities();
      
      logger.info('ToolRoutingService initialized successfully', {
        hasOpenAI: !!this.openaiService,
        registeredAgents: this.agentCapabilities.size
      });
    } catch (error) {
      logger.error('Failed to initialize ToolRoutingService:', error);
      throw error;
    }
  }

  protected async onDestroy(): Promise<void> {
    this.openaiService = null;
    this.agentCapabilities.clear();
    logger.info('ToolRoutingService shutdown complete');
  }

  /**
   * Initialize agent capabilities from AgentFactory
   */
  private async initializeAgentCapabilities(): Promise<void> {
    const agentNames = AgentFactory.getEnabledAgentNames();
    
    for (const agentName of agentNames) {
      try {
        const agent = AgentFactory.getAgent(agentName);
        if (agent) {
          // Get capabilities from agent's static methods
          const capabilities = this.extractAgentCapabilities(agentName, agent);
          this.agentCapabilities.set(agentName, capabilities);
          
          logger.debug(`Registered capabilities for agent: ${agentName}`, {
            capabilities: capabilities.capabilities,
            specialties: capabilities.specialties
          });
        }
      } catch (error) {
        logger.warn(`Failed to extract capabilities for agent ${agentName}:`, error);
      }
    }
  }

  /**
   * Extract agent capabilities using dynamic discovery
   */
  private extractAgentCapabilities(agentName: string, agent: any): AgentCapability {
    // Try to get capabilities from agent's static methods
    const AgentClass = agent.constructor;
    
    let capabilities: string[] = [];
    let description = '';
    let specialties: string[] = [];
    let limitations: string[] = [];
    
    try {
      if (typeof AgentClass.getCapabilities === 'function') {
        capabilities = AgentClass.getCapabilities();
      }
      if (typeof AgentClass.getDescription === 'function') {
        description = AgentClass.getDescription();
      } else if (agent.config?.description) {
        description = agent.config.description;
      }
      if (typeof AgentClass.getSpecialties === 'function') {
        specialties = AgentClass.getSpecialties();
      }
      if (typeof AgentClass.getLimitations === 'function') {
        limitations = AgentClass.getLimitations();
      }
    } catch (error) {
      logger.debug(`Could not extract all capabilities for ${agentName}, using defaults:`, error);
    }

    // Fallback capabilities based on agent name
    if (capabilities.length === 0) {
      capabilities = this.getDefaultCapabilities(agentName);
    }

    return {
      agentName,
      capabilities,
      description: description || `${agentName} agent for specialized operations`,
      specialties: specialties.length > 0 ? specialties : capabilities,
      limitations,
      requiresConfirmation: this.agentRequiresConfirmation(agentName),
      estimatedExecutionTime: 5000
    };
  }

  /**
   * Get default capabilities based on agent name (fallback)
   */
  private getDefaultCapabilities(agentName: string): string[] {
    const defaultCapabilities: Record<string, string[]> = {
      'emailAgent': ['email_send', 'email_read', 'email_search', 'email_draft'],
      'calendarAgent': ['calendar_create', 'calendar_read', 'calendar_update', 'calendar_delete'],
      'contactAgent': ['contact_search', 'contact_create', 'contact_update'],
      'slackAgent': ['slack_read', 'slack_thread', 'slack_drafts', 'slack_analysis'],
      'thinkAgent': ['reasoning', 'analysis', 'planning']
    };

    return defaultCapabilities[agentName] || ['general_operations'];
  }

  /**
   * Determine if agent requires confirmation (fallback logic)
   */
  private agentRequiresConfirmation(agentName: string): boolean {
    const confirmationRequired = ['emailAgent', 'calendarAgent'];
    return confirmationRequired.includes(agentName);
  }

  /**
   * AI-powered agent selection based on user intent and capabilities
   */
  async selectAgentForTask(
    userQuery: string, 
    context: ToolExecutionContext,
    availableAgents?: string[]
  ): Promise<ToolRoutingDecision> {
    if (!this.openaiService) {
      throw new Error('OpenAI service not available for intelligent tool routing');
    }

    try {
      // Get available agents and their capabilities
      const agents = availableAgents || Array.from(this.agentCapabilities.keys());
      const capabilitiesContext = this.buildCapabilitiesContext(agents);

      // AI-powered agent selection
      const selectionPrompt = `Select the best agent to handle this user request based on agent capabilities.

User Request: "${userQuery}"

Available Agents and Their Capabilities:
${capabilitiesContext}

Analyze the user's intent and select the most appropriate agent. Consider:
1. Which agent's capabilities best match the user's request
2. The specificity of the request (email vs calendar vs contact operations)
3. The complexity of the task
4. Whether the operation requires external actions

Return JSON with:
{
  "selectedAgent": "agentName",
  "confidence": 0.95,
  "reasoning": "explanation of why this agent was selected",
  "requiresConfirmation": boolean,
  "suggestedParameters": {
    "query": "refined query for the agent",
    "operation": "specific operation if applicable"
  }
}`;

      const response = await this.openaiService.generateStructuredData<{
        selectedAgent: string;
        confidence: number;
        reasoning: string;
        requiresConfirmation: boolean;
        suggestedParameters?: any;
      }>(
        userQuery,
        selectionPrompt,
        z.object({
          selectedAgent: z.string(),
          confidence: z.number().min(0).max(1),
          reasoning: z.string(),
          requiresConfirmation: z.boolean(),
          suggestedParameters: z.any().optional()
        }),
        { temperature: 0.2, maxTokens: 500 }
      );

      // Validate selected agent exists
      if (!this.agentCapabilities.has(response.selectedAgent)) {
        logger.error('AI selected unknown agent', {
          selectedAgent: response.selectedAgent,
          availableAgents: agents
        });
        throw new Error(`AI selected unknown agent: ${response.selectedAgent}. Available agents: ${agents.join(', ')}`);
      }

      // Create tool call
      const toolCall: ToolCall = {
        name: response.selectedAgent,
        parameters: {
          query: userQuery,
          ...response.suggestedParameters
        }
      };

      // Generate confirmation message if needed
      let confirmationMessage: string | undefined;
      if (response.requiresConfirmation) {
        const confirmation = await this.generateConfirmationMessage(response.selectedAgent, userQuery, toolCall.parameters);
        confirmationMessage = confirmation.message;
      }

      const decision: ToolRoutingDecision = {
        selectedAgent: response.selectedAgent,
        toolCall,
        confidence: response.confidence,
        reasoning: response.reasoning,
        requiresConfirmation: response.requiresConfirmation,
        confirmationMessage,
        parameters: toolCall.parameters
      };

      logger.info('AI agent selection completed', {
        userQuery: userQuery.substring(0, 100),
        selectedAgent: decision.selectedAgent,
        confidence: decision.confidence,
        requiresConfirmation: decision.requiresConfirmation
      });

      return decision;

    } catch (error) {
      logger.error('AI agent selection failed', error);
      throw new Error('AI agent selection failed. Please check your OpenAI configuration.');
    }
  }

  /**
   * Generate AI-powered confirmation messages
   */
  async generateConfirmationMessage(
    agentName: string,
    userQuery: string,
    parameters: any
  ): Promise<ConfirmationMessage> {
    if (!this.openaiService) {
      throw new Error('OpenAI service is not available. AI confirmation generation is required for this operation.');
    }

    try {
      const agentCapability = this.agentCapabilities.get(agentName);
      const capabilities = agentCapability?.capabilities.join(', ') || 'operations';

      const confirmationPrompt = `Generate a contextual confirmation message for this operation.

Agent: ${agentName}
Agent Capabilities: ${capabilities}
User Request: "${userQuery}"
Parameters: ${JSON.stringify(parameters, null, 2)}

Create a confirmation message that:
1. Clearly states what action will be taken
2. Includes relevant details from the parameters
3. Highlights any important implications or risks
4. Uses a conversational, professional tone

Return JSON with:
{
  "message": "detailed confirmation message",
  "prompt": "instruction for user response",
  "riskLevel": "low|medium|high",
  "contextualDetails": ["key detail 1", "key detail 2"]
}`;

      const response = await this.openaiService.generateStructuredData<ConfirmationMessage>(
        userQuery,
        confirmationPrompt,
        z.object({
          message: z.string(),
          prompt: z.string(),
          riskLevel: z.enum(['low', 'medium', 'high']),
          contextualDetails: z.array(z.string())
        }),
        { temperature: 0.3, maxTokens: 400 }
      );

      logger.debug('AI confirmation message generated', {
        agentName,
        riskLevel: response.riskLevel,
        hasDetails: response.contextualDetails?.length > 0
      });

      return response;

    } catch (error) {
      logger.error('AI confirmation generation failed', error);
      throw new Error('AI confirmation generation failed. Please check your OpenAI configuration.');
    }
  }

  /**
   * Build capabilities context for AI agent selection
   */
  private buildCapabilitiesContext(agentNames: string[]): string {
    return agentNames.map(agentName => {
      const capability = this.agentCapabilities.get(agentName);
      if (!capability) return `${agentName}: No capabilities defined`;

      return `${agentName}:
  - Capabilities: ${capability.capabilities.join(', ')}
  - Description: ${capability.description}
  - Specialties: ${capability.specialties.join(', ')}
  - Requires Confirmation: ${capability.requiresConfirmation}`;
    }).join('\n\n');
  }

  /**
   * Get registered agent capabilities (for debugging)
   */
  getAgentCapabilities(): Map<string, AgentCapability> {
    return new Map(this.agentCapabilities);
  }

  /**
   * Register custom agent capability (for testing or custom agents)
   */
  registerCustomCapability(capability: AgentCapability): void {
    this.agentCapabilities.set(capability.agentName, capability);
    logger.debug('Custom agent capability registered', { agentName: capability.agentName });
  }

  /**
   * Format preview details dynamically based on action type and data
   * Replaces hardcoded formatting with AI-generated descriptions
   */
  async formatPreviewDetails(actionType: string, previewData: any): Promise<string> {
    try {
      if (!this.openaiService) {
        return this.getFallbackPreviewFormat(actionType, previewData);
      }

      const formatPrompt = `Format this ${actionType} preview for a user to review before confirming:

${JSON.stringify(previewData, null, 2)}

Show the key details they need to know in a clean, readable format.`;

      const formattedDetails = await this.openaiService.generateText(
        JSON.stringify(previewData),
        formatPrompt,
        { temperature: 0.1, maxTokens: 300 }
      );

      return formattedDetails || this.getFallbackPreviewFormat(actionType, previewData);

    } catch (error) {
      logger.warn('Failed to generate AI preview formatting:', error);
      return this.getFallbackPreviewFormat(actionType, previewData);
    }
  }

  /**
   * Fallback preview formatting when AI is unavailable
   */
  private getFallbackPreviewFormat(actionType: string, previewData: any): string {
    const emoji = this.getActionEmoji(actionType);
    let details = `${emoji} **${actionType.charAt(0).toUpperCase() + actionType.slice(1)} Details:**\n`;

    try {
      // Handle common action types with fallback formatting
      if (actionType === 'email' && previewData) {
        if (previewData.recipients?.to) {
          details += `• **To:** ${previewData.recipients.to.join(', ')}\n`;
        }
        if (previewData.recipients?.cc?.length > 0) {
          details += `• **CC:** ${previewData.recipients.cc.join(', ')}\n`;
        }
        if (previewData.subject) {
          details += `• **Subject:** ${previewData.subject}\n`;
        }
        if (previewData.recipientCount) {
          details += `• **Recipients:** ${previewData.recipientCount}\n`;
        }
        if (previewData.externalDomains?.length > 0) {
          details += `• **External Domains:** ${previewData.externalDomains.join(', ')}\n`;
        }
      } else if (actionType === 'calendar' && previewData) {
        if (previewData.title) {
          details += `• **Title:** ${previewData.title}\n`;
        }
        if (previewData.startTime) {
          details += `• **Start:** ${new Date(previewData.startTime).toLocaleString()}\n`;
        }
        if (previewData.duration) {
          details += `• **Duration:** ${previewData.duration}\n`;
        }
        if (previewData.attendees?.length > 0) {
          details += `• **Attendees:** ${previewData.attendees.join(', ')}\n`;
        }
        if (previewData.location) {
          details += `• **Location:** ${previewData.location}\n`;
        }
        if (previewData.conflicts?.length > 0) {
          details += `⚠️ **Conflicts:** ${previewData.conflicts.length} detected\n`;
        }
      } else {
        // Generic fallback for unknown action types
        details += `• **Type:** ${actionType}\n`;
        if (typeof previewData === 'object' && previewData !== null) {
          const keyCount = Object.keys(previewData).length;
          details += `• **Parameters:** ${keyCount} configuration items\n`;
        }
      }
    } catch (error) {
      logger.warn('Error in fallback preview formatting:', error);
      details += `• **Action:** ${actionType}\n• **Status:** Preview available\n`;
    }

    return details;
  }

  /**
   * Get appropriate emoji for action type
   */
  private getActionEmoji(actionType: string): string {
    const emojis: Record<string, string> = {
      'email': '📧',
      'calendar': '📅',
      'contact': '👤',
      'search': '🔍',
      'task': '✅',
      'note': '📝',
      'file': '📄'
    };
    
    return emojis[actionType.toLowerCase()] || '🔧';
  }
}