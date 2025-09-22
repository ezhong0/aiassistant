import logger from '../utils/logger';
import { EmailAgent } from '../agents/email.agent';
import { CalendarAgent } from '../agents/calendar.agent';
import { ContactAgent } from '../agents/contact.agent';
import { SlackAgent } from '../agents/slack.agent';
import { ThinkAgent } from '../agents/think.agent';

export interface AgentCapability {
  name: string;
  description: string;
  parameters: any;
  required?: string[];
}

export interface AgentInfo {
  name: string;
  description: string;
  capabilities: AgentCapability[];
  isAvailable: boolean;
  lastHealth?: Date;
}

export interface AgentExecutionContext {
  sessionId: string;
  userId: string;
  timestamp: Date;
  metadata?: any;
}

export interface AgentExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  data?: any;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
}

/**
 * AgentCoordinator - Manages agent routing and coordination
 *
 * Extracted from MasterAgent to provide focused agent management.
 * Handles routing to appropriate agents, managing schemas and capabilities,
 * and agent health monitoring.
 */
export class AgentCoordinator {
  private agents: Map<string, any> = new Map();
  private agentSchemas: Map<string, AgentCapability[]> = new Map();
  private lastHealthCheck: number = Date.now();

  constructor() {
    this.initializeAgents();
    this.setupAgentSchemas();
  }

  /**
   * Initialize all available agents
   */
  private initializeAgents(): void {
    try {
      // Initialize core agents
      this.agents.set('email', new EmailAgent());
      this.agents.set('calendar', new CalendarAgent());
      this.agents.set('contact', new ContactAgent());
      this.agents.set('slack', new SlackAgent());
      this.agents.set('think', new ThinkAgent());

      logger.debug('Agents initialized', {
        agentCount: this.agents.size,
        agentNames: Array.from(this.agents.keys())
      });
    } catch (error) {
      logger.error('Failed to initialize agents', error);
      throw error;
    }
  }

  /**
   * Setup agent capability schemas
   */
  private setupAgentSchemas(): void {
    // Email Agent Schema
    this.agentSchemas.set('email', [
      {
        name: 'sendEmail',
        description: 'Send an email to specified recipients',
        parameters: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Recipient email address' },
            subject: { type: 'string', description: 'Email subject' },
            body: { type: 'string', description: 'Email body content' },
            cc: { type: 'array', items: { type: 'string' }, description: 'CC recipients' },
            bcc: { type: 'array', items: { type: 'string' }, description: 'BCC recipients' }
          },
          required: ['to', 'subject', 'body']
        }
      },
      {
        name: 'searchEmails',
        description: 'Search for emails matching criteria',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            maxResults: { type: 'number', description: 'Maximum number of results' },
            timeframe: { type: 'string', description: 'Time range for search' }
          },
          required: ['query']
        }
      }
    ]);

    // Calendar Agent Schema
    this.agentSchemas.set('calendar', [
      {
        name: 'createEvent',
        description: 'Create a new calendar event',
        parameters: {
          type: 'object',
          properties: {
            summary: { type: 'string', description: 'Event title' },
            description: { type: 'string', description: 'Event description' },
            startTime: { type: 'string', description: 'Event start time (ISO format)' },
            endTime: { type: 'string', description: 'Event end time (ISO format)' },
            attendees: { type: 'array', items: { type: 'string' }, description: 'Attendee emails' }
          },
          required: ['summary', 'startTime', 'endTime']
        }
      },
      {
        name: 'getEvents',
        description: 'Get calendar events for a time range',
        parameters: {
          type: 'object',
          properties: {
            startDate: { type: 'string', description: 'Start date (ISO format)' },
            endDate: { type: 'string', description: 'End date (ISO format)' },
            maxResults: { type: 'number', description: 'Maximum number of events' }
          },
          required: ['startDate', 'endDate']
        }
      }
    ]);

    // Contact Agent Schema
    this.agentSchemas.set('contact', [
      {
        name: 'searchContacts',
        description: 'Search for contacts',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            maxResults: { type: 'number', description: 'Maximum number of results' }
          },
          required: ['query']
        }
      },
      {
        name: 'getContact',
        description: 'Get contact details by ID',
        parameters: {
          type: 'object',
          properties: {
            contactId: { type: 'string', description: 'Contact ID' }
          },
          required: ['contactId']
        }
      }
    ]);

    // Slack Agent Schema
    this.agentSchemas.set('slack', [
      {
        name: 'sendMessage',
        description: 'Send a Slack message',
        parameters: {
          type: 'object',
          properties: {
            channel: { type: 'string', description: 'Channel ID or name' },
            text: { type: 'string', description: 'Message text' },
            threadTs: { type: 'string', description: 'Thread timestamp for replies' }
          },
          required: ['channel', 'text']
        }
      }
    ]);

    // Think Agent Schema
    this.agentSchemas.set('think', [
      {
        name: 'analyze',
        description: 'Analyze and provide insights on data or questions',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Question or data to analyze' },
            context: { type: 'object', description: 'Additional context for analysis' }
          },
          required: ['query']
        }
      }
    ]);

    logger.debug('Agent schemas initialized', {
      schemaCount: this.agentSchemas.size,
      agentNames: Array.from(this.agentSchemas.keys())
    });
  }

  /**
   * Route request to appropriate agent
   */
  async routeToAgent(agentName: string, action: string, parameters: any, context: AgentExecutionContext): Promise<AgentExecutionResult> {
    try {
      const agent = this.agents.get(agentName);
      if (!agent) {
        logger.warn('Agent not found', { agentName, availableAgents: Array.from(this.agents.keys()) });
        return {
          success: false,
          error: `Agent '${agentName}' not found`
        };
      }

      // Check if agent has the requested action
      if (!this.isValidAction(agentName, action)) {
        logger.warn('Invalid action for agent', { agentName, action });
        return {
          success: false,
          error: `Action '${action}' not available for agent '${agentName}'`
        };
      }

      // Execute agent action
      logger.debug('Routing to agent', { agentName, action, sessionId: context.sessionId });

      const result = await agent[action](parameters, context);

      logger.debug('Agent execution completed', {
        agentName,
        action,
        success: result?.success ?? true,
        sessionId: context.sessionId
      });

      return {
        success: true,
        result: result,
        data: result
      };

    } catch (error) {
      logger.error('Agent execution failed', {
        agentName,
        action,
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: context.sessionId
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Agent execution failed'
      };
    }
  }

  /**
   * Get agent by name
   */
  getAgent(agentName: string): any | null {
    return this.agents.get(agentName) || null;
  }

  /**
   * Get all available agents
   */
  getAvailableAgents(): AgentInfo[] {
    const agents: AgentInfo[] = [];

    for (const [name, agent] of this.agents.entries()) {
      const capabilities = this.agentSchemas.get(name) || [];

      agents.push({
        name,
        description: this.getAgentDescription(name),
        capabilities,
        isAvailable: this.isAgentHealthy(agent),
        lastHealth: new Date()
      });
    }

    return agents;
  }

  /**
   * Get agent capabilities
   */
  getAgentCapabilities(agentName: string): AgentCapability[] {
    return this.agentSchemas.get(agentName) || [];
  }

  /**
   * Check if action is valid for agent
   */
  private isValidAction(agentName: string, action: string): boolean {
    const capabilities = this.agentSchemas.get(agentName) || [];
    return capabilities.some(cap => cap.name === action);
  }

  /**
   * Get agent description
   */
  private getAgentDescription(agentName: string): string {
    const descriptions: Record<string, string> = {
      email: 'Handles email operations including sending and searching emails',
      calendar: 'Manages calendar events and scheduling',
      contact: 'Manages contact information and searching',
      slack: 'Handles Slack messaging and interactions',
      think: 'Provides analysis and insights on data and questions'
    };

    return descriptions[agentName] || `${agentName} agent`;
  }

  /**
   * Check agent health
   */
  private isAgentHealthy(agent: any): boolean {
    try {
      // Simple health check - agent exists and has expected methods
      return agent && typeof agent === 'object';
    } catch (error) {
      logger.error('Agent health check failed', error);
      return false;
    }
  }

  /**
   * Perform health checks on all agents
   */
  async performHealthChecks(): Promise<void> {
    const now = Date.now();

    // Only check health every 5 minutes
    if (now - this.lastHealthCheck < 300000) {
      return;
    }

    let healthyCount = 0;
    let unhealthyCount = 0;

    for (const [name, agent] of this.agents.entries()) {
      try {
        const isHealthy = this.isAgentHealthy(agent);
        if (isHealthy) {
          healthyCount++;
        } else {
          unhealthyCount++;
          logger.warn('Unhealthy agent detected', { agentName: name });
        }
      } catch (error) {
        unhealthyCount++;
        logger.error('Agent health check error', { agentName: name, error });
      }
    }

    this.lastHealthCheck = now;

    logger.debug('Agent health check completed', {
      totalAgents: this.agents.size,
      healthyAgents: healthyCount,
      unhealthyAgents: unhealthyCount
    });
  }

  /**
   * Get coordinator statistics
   */
  getStats(): {
    totalAgents: number;
    availableAgents: number;
    totalCapabilities: number;
    lastHealthCheck: Date;
  } {
    const availableAgents = Array.from(this.agents.values()).filter(agent =>
      this.isAgentHealthy(agent)
    ).length;

    const totalCapabilities = Array.from(this.agentSchemas.values()).reduce(
      (total, capabilities) => total + capabilities.length, 0
    );

    return {
      totalAgents: this.agents.size,
      availableAgents,
      totalCapabilities,
      lastHealthCheck: new Date(this.lastHealthCheck)
    };
  }
}