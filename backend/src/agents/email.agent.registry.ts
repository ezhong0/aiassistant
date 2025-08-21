import logger from '../utils/logger';
import { BaseAgent } from '../types/agent.types';
import { ToolExecutionContext } from '../types/tools';
import { emailAgent } from './email.agent';
import { ContactAgent } from './contact.agent';

/**
 * Wrapper class for EmailAgent to implement the new BaseAgent interface
 */
export class EmailAgentWrapper extends BaseAgent {
  readonly name = 'emailAgent';
  readonly description = 'Send, reply to, search, and manage emails using Gmail API';
  readonly systemPrompt = emailAgent.getSystemPrompt();
  readonly keywords = ['email', 'send', 'reply', 'draft', 'message', 'mail', 'gmail'];
  readonly requiresConfirmation = true;
  readonly isCritical = true;

  /**
   * Execute the email agent
   */
  async execute(parameters: any, context: ToolExecutionContext, accessToken?: string): Promise<any> {
    try {
      if (!accessToken) {
        return {
          success: false,
          message: 'Access token required for email operations',
          error: 'MISSING_ACCESS_TOKEN'
        };
      }

      // Format contacts from contact agent if provided
      let formattedContacts = parameters.contacts;
      if (parameters.contactResults) {
        // Convert contact agent results to the format email agent expects
        formattedContacts = ContactAgent.formatContactsForAgent(parameters.contactResults);
      }

      const result = await emailAgent.processQuery({
        query: parameters.query,
        accessToken,
        contacts: formattedContacts
      });

      logger.info('EmailAgentWrapper executed successfully', {
        sessionId: context.sessionId,
        success: result.success
      });

      return result;

    } catch (error) {
      logger.error('EmailAgentWrapper execution failed:', error);
      return this.handleError(error, 'send email');
    }
  }

  /**
   * Validate email agent parameters
   */
  validateParameters(parameters: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!parameters) {
      errors.push('Parameters are required');
      return { valid: false, errors };
    }

    if (!parameters.query || typeof parameters.query !== 'string') {
      errors.push('Query parameter is required and must be a string');
    }

    if (parameters.contacts && !Array.isArray(parameters.contacts)) {
      errors.push('Contacts parameter must be an array if provided');
    }

    if (parameters.contactResults && !Array.isArray(parameters.contactResults)) {
      errors.push('ContactResults parameter must be an array if provided');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Generate preview for email actions
   */
  async generatePreview(parameters: any, accessToken?: string): Promise<any> {
    const actionId = `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      success: true,
      message: 'Email action prepared for confirmation',
      actionId,
      type: 'email',
      parameters: {
        query: parameters.query,
        preview: this.extractEmailPreview(parameters.query)
      },
      awaitingConfirmation: true,
      confirmationPrompt: 'I\'m about to send an email. Would you like me to proceed?'
    };
  }

  /**
   * Extract basic email preview information from query
   */
  private extractEmailPreview(query: string): any {
    const toMatch = query.match(/(?:to|send.*to)\s+([^\s]+@[^\s]+)/i);
    const subjectMatch = query.match(/(?:subject|about|regarding)\s+([^,.]+)/i);
    
    return {
      to: toMatch ? toMatch[1] : 'recipient',
      subject: subjectMatch ? subjectMatch[1]?.trim() : 'No subject',
      body: query.includes('asking') ? query.split('asking')[1]?.trim() : 'Email content'
    };
  }
}