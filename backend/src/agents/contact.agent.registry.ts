import logger from '../utils/logger';
import { BaseAgent } from '../types/agent.types';
import { ToolExecutionContext } from '../types/tools';
import { contactAgent } from './contact.agent';

/**
 * Wrapper class for ContactAgent to implement the new BaseAgent interface
 */
export class ContactAgentWrapper extends BaseAgent {
  readonly name = 'contactAgent';
  readonly description = 'Search and manage contacts from Google Contacts and email history';
  readonly systemPrompt = contactAgent.getSystemPrompt();
  readonly keywords = ['contact', 'find', 'lookup', 'search', 'person', 'email address'];
  readonly requiresConfirmation = false;
  readonly isCritical = true;

  /**
   * Execute the contact agent
   */
  async execute(parameters: any, context: ToolExecutionContext, accessToken?: string): Promise<any> {
    try {
      if (!accessToken) {
        return {
          success: false,
          message: 'Access token required for contact operations',
          error: 'MISSING_ACCESS_TOKEN'
        };
      }

      const result = await contactAgent.processQuery({
        query: parameters.query,
        operation: parameters.operation
      }, accessToken);

      logger.info('ContactAgentWrapper executed successfully', {
        sessionId: context.sessionId,
        success: result.success,
        contactCount: result.data?.contacts?.length || 0
      });

      return result;

    } catch (error) {
      logger.error('ContactAgentWrapper execution failed:', error);
      return this.handleError(error, 'search contacts');
    }
  }

  /**
   * Validate contact agent parameters
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

    if (parameters.operation && !['search', 'create', 'update'].includes(parameters.operation)) {
      errors.push('Operation parameter must be one of: search, create, update');
    }

    return { valid: errors.length === 0, errors };
  }
}