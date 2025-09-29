/**
 * Email SubAgent - Email management using BaseSubAgent architecture
 * 
 * Implements the Generic SubAgent design pattern for email operations:
 * - 3-phase workflow (Intent Assessment, Tool Execution, Response Formatting)
 * - Direct integration with EmailDomainService
 * - Natural language interface
 * - Tool-to-service mapping
 */

import { BaseSubAgent, AgentCapabilities } from '../framework/base-subagent';
import { DomainServiceResolver } from '../services/domain/dependency-injection/domain-service-container';
import { IDomainService } from '../services/domain/interfaces/base-domain.interface';
import { IEmailDomainService } from '../services/domain/interfaces/email-domain.interface';

export class EmailAgent extends BaseSubAgent {
  private emailService: IEmailDomainService;

  constructor() {
    super('email', {
      name: 'EmailSubAgent',
      description: 'Email management sub-agent for sending, searching, and managing emails',
      enabled: true,
      timeout: 30000,
      retryCount: 3
    });

    // Get existing domain service from container
    this.emailService = DomainServiceResolver.getEmailService();
  }


  /**
   * Tool-to-service method mapping
   */
  protected getToolToServiceMap(): Record<string, string> {
    return {
      'send_email': 'sendEmail',
      'search_emails': 'searchEmails',
      'get_email': 'getEmail',
      'reply_to_email': 'replyToEmail',
      'get_email_thread': 'getEmailThread'
    };
  }

  /**
   * Get the email domain service
   */
  protected getService(): IDomainService {
    return this.emailService;
  }

  /**
   * Execute tool call by mapping to email service method
   */
  protected async executeToolCall(toolName: string, params: any): Promise<any> {
    const serviceMethod = this.getToolToServiceMap()[toolName];
    if (!serviceMethod) {
      throw new Error(`Unknown email tool: ${toolName}`);
    }

    const { userId, ...serviceParams } = params;
    if (!userId) {
      throw new Error('userId is required for email operations');
    }

    // TypeScript will enforce that service[serviceMethod] exists
    const service = this.getService() as IEmailDomainService;
    
    try {
      // Handle different method signatures
      switch (toolName) {
        case 'get_email':
          // getEmail only needs messageId, no userId required
          return await service.getEmail(serviceParams.messageId);
        case 'reply_to_email':
          // replyToEmail has different signature
          return await service.replyToEmail(serviceParams);
        case 'get_email_thread':
          // getEmailThread only needs threadId
          return await service.getEmailThread(serviceParams.threadId);
        default:
          // Most methods follow the pattern: method(userId, params)
          return await (service as any)[serviceMethod](userId, serviceParams);
      }
    } catch (error) {
      throw new Error(`Email ${toolName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get agent capabilities for discovery
   */
  getCapabilityDescription(): AgentCapabilities {
    return {
      name: 'EmailSubAgent',
      description: 'Comprehensive email management including sending, searching, and conversation handling',
      operations: [
        'send_email',
        'search_emails',
        'get_email',
        'reply_to_email',
        'get_email_thread'
      ],
      requiresAuth: true,
      requiresConfirmation: true, // Email operations need confirmation
      isCritical: true, // Email operations are critical
      examples: [
        'Send an email to John about the project meeting',
        'Search for emails from Sarah about budget',
        'Reply to the latest email in my inbox',
        'Find all emails with attachments from last week',
        'Get the full conversation thread about the proposal'
      ]
    };
  }

}