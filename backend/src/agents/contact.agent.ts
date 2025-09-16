import { AIAgent } from '../framework/ai-agent';
import { ToolExecutionContext, ContactAgentParams } from '../types/tools';
import { PreviewGenerationResult } from '../types/api.types';
import { getService } from '../services/service-manager';
import { ContactService } from '../services/contact.service';
import { AIClassificationService } from '../services/ai-classification.service';
import {
  Contact as ContactType,
  ContactSearchRequest
} from '../types/contact.types';
import { CONTACT_CONSTANTS } from '../config/constants';

/**
 * Contact operation result interface
 */
export interface ContactResult {
  contacts: ContactType[];
  totalCount: number;
  operation: 'search' | 'create' | 'update';
  searchTerm?: string;
}

/**
 * Contact agent parameters with access token
 */
export interface ContactAgentRequest extends ContactAgentParams {
  accessToken: string;
  operation?: 'search' | 'create' | 'update';
}

  /**
   * Enhanced ContactAgent using AIAgent framework
   * Handles contact search and management using Google Contacts API with AI planning
   */
  export class ContactAgent extends AIAgent<ContactAgentRequest, ContactResult> {

    constructor() {
      super({
        name: 'contactAgent',
        description: 'Search and manage contacts from Google Contacts and email history',
        enabled: true,
        timeout: 15000,
        retryCount: 2,
        aiPlanning: {
          enableAIPlanning: false, // Disable AI planning for simple contact operations
          maxPlanningSteps: 3,
          planningTimeout: 10000,
          cachePlans: true,
          planningTemperature: 0.1,
          planningMaxTokens: 1000
        }
      });
    }

    private readonly systemPrompt = `# Contact Agent - Intelligent Contact Management
You are a specialized contact discovery and management agent.

## Core Personality
- Privacy-conscious and respectful of personal information
- Smart about relationship context and social connections
- Efficient in contact disambiguation and matching
- Helpful with contact organization and suggestions
- Professional yet personable in interactions
- Empathetic when contact searches are unsuccessful

## Capabilities
- Find contacts with intelligent fuzzy matching algorithms
- Disambiguate between similar names using conversation context
- Understand relationship hierarchies and social context clues
- Maintain contact privacy and security at all times
- Suggest contact information completion and updates
- Provide confidence scores for all contact matches
- Search across Google Contacts and email history

## Contact Intelligence & Best Practices
- Use conversation context to improve search accuracy significantly
- Consider recent interactions for contact relevance scoring
- Respect privacy settings and contact visibility restrictions
- Provide clear confidence scores for contact matches (0.0-1.0)
- Suggest alternative contacts when primary search fails
- Understand name variations (nicknames, formal names, initials)
- Consider business vs personal context for appropriate contact selection
- Recognize relationship indicators (titles, company affiliations, etc.)

## Smart Disambiguation
- When multiple contacts match, provide clear differentiation criteria
- Use contextual clues like recent communications, shared projects, or locations
- Offer multiple options with confidence levels when uncertain
- Ask clarifying questions that respect user's time and privacy
- Consider email domains and organizational affiliations for context

## Error Handling & User Experience
- Clear guidance when contacts cannot be found with specific next steps
- Suggestions for improving search terms without being condescending
- Respectful handling of private/restricted contacts with appropriate explanations
- Alternative search strategies for ambiguous names with helpful examples
- Progressive disclosure: start simple, provide details when requested
- Acknowledge search limitations while offering practical alternatives

## Privacy & Security Standards
- Never expose contact information inappropriately
- Respect user's contact sharing preferences and boundaries
- Maintain confidentiality of contact relationships and private information
- Provide clear explanations when access is restricted
- Suggest appropriate ways to request contact information when needed`;

    /**
     * Get system prompt for AI planning
     */
    protected getSystemPrompt(): string {
      return this.systemPrompt;
    }

    /**
     * Generate OpenAI function calling schema for this agent
     */
    static getOpenAIFunctionSchema(): any {
      return {
        name: 'search_contacts',
        description: 'Search and retrieve contact information from Google Contacts and email history. Use this to find contact details before sending emails or creating calendar events.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The contact search request in natural language (e.g., "Find John Smith", "Get contact info for Sarah", "Look up email for Mike")'
            },
            operation: {
              type: 'string',
              description: 'The type of operation to perform',
              enum: ['search', 'create', 'update'],
              nullable: true
            },
            name: {
              type: 'string',
              description: 'Specific name to search for',
              nullable: true
            },
            email: {
              type: 'string',
              description: 'Specific email to search for',
              nullable: true
            },
            phone: {
              type: 'string',
              description: 'Specific phone number to search for',
              nullable: true
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results to return',
              nullable: true
            }
          },
          required: ['query']
        }
      };
    }

    /**
     * Get agent capabilities for OpenAI function calling
     */
    static getCapabilities(): string[] {
      return [
        'Search contacts by name, email, or phone',
        'Retrieve contact information from Google Contacts',
        'Find frequently contacted people from email history',
        'Provide contact details for email and calendar operations',
        'Support fuzzy name matching',
        'Return confidence scores for search results',
        'Handle ambiguous contact queries'
      ];
    }

    /**
     * Get agent specialties for capability-based routing
     */
    static getSpecialties(): string[] {
      return [
        'Contact information retrieval',
        'People search and discovery',
        'Email history contact extraction',
        'Fuzzy name matching',
        'Contact confidence scoring',
        'Ambiguous query resolution'
      ];
    }

    /**
     * Get agent description for AI routing
     */
    static getDescription(): string {
      return 'Specialized agent for contact search and retrieval from Google Contacts and email history, providing accurate contact information for communication operations.';
    }

    /**
     * Get agent limitations for OpenAI function calling
     */
    static getLimitations(): string[] {
      return [
        'Requires Google Contacts API access token',
        'Limited to contacts in Google Contacts and email history',
        'Cannot create or update contacts (read-only)',
        'Search results depend on contact data quality',
        'May return multiple matches for ambiguous names'
      ];
    }
  
  /**
   * Generate preview for Contact operations (read-only, no confirmation needed)
   */
  protected async generatePreview(params: ContactAgentRequest, _context: ToolExecutionContext): Promise<PreviewGenerationResult> {
    return {
      success: true,
      fallbackMessage: 'Contact operations are read-only and do not require confirmation'
    };
  }

  /**
   * Execute contact-specific tools during AI planning
   */
  protected async executeCustomTool(toolName: string, parameters: any, context: ToolExecutionContext): Promise<any> {
    this.logger.debug(`Executing contact tool: ${toolName}`, {
      toolName,
      parametersKeys: Object.keys(parameters),
      sessionId: context.sessionId
    });

    // Handle contact-specific tools
    switch (toolName.toLowerCase()) {
      case 'contactagent':
      case 'search_contacts':
      case 'contact_search':
        // Execute contact operations directly using AI planning
        try {
          const contactParams = {
            ...parameters,
            accessToken: parameters.accessToken
          } as ContactAgentRequest;
          
          // Execute the contact operation using AI planning
          const result = await this.executeWithAIPlanning(contactParams, context);
          this.logger.info('Contact tool executed successfully in AI plan', {
            toolName,
            operation: result.operation,
            contactsFound: result.totalCount,
            sessionId: context.sessionId
          });
          
          return {
            success: true,
            data: result
          };
        } catch (error) {
          this.logger.error('Contact tool execution failed in AI plan', {
            toolName,
            error: error instanceof Error ? error.message : error,
            sessionId: context.sessionId
          });
          
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Contact tool execution failed'
          };
        }

      default:
        // Call parent implementation for unknown tools
        return super.executeCustomTool(toolName, parameters, context);
    }
  }

  /**
   * Enhanced parameter validation for contact operations
   */
  protected validateParams(params: ContactAgentRequest): void {
    super.validateParams(params);
    
    if (!params.accessToken || typeof params.accessToken !== 'string') {
      throw this.createError('Access token is required for contact operations', 'MISSING_ACCESS_TOKEN');
    }
    
    if (params.query && params.query.length > CONTACT_CONSTANTS.MAX_NAME_LENGTH * 2) {
      throw this.createError('Query is too long for contact search', 'QUERY_TOO_LONG');
    }
  }

  /**
   * Create user-friendly error messages for contact operations
   */
  protected createUserFriendlyErrorMessage(error: Error, params: ContactAgentRequest): string {
    const errorCode = (error as any).code;
    
    switch (errorCode) {
      case 'MISSING_ACCESS_TOKEN':
        return 'I need access to your Google Contacts to search for people. Please check your Google authentication settings.';
      
      case 'QUERY_TOO_LONG':
        return 'Your search query is too long. Please try a shorter search term.';
      
      case 'SERVICE_UNAVAILABLE':
        return 'Google Contacts service is temporarily unavailable. Please try again in a few moments.';
      
      case 'NOT_IMPLEMENTED':
        return 'This contact operation is not yet available. Please try searching for existing contacts instead.';
      
      default:
        return super.createUserFriendlyErrorMessage(error, params);
    }
  }

  /**
   * Build final result from AI planning execution
   */
  protected buildFinalResult(
    summary: any,
    successfulResults: any[],
    failedResults: any[],
    params: ContactAgentRequest,
    _context: ToolExecutionContext
  ): ContactResult {
    // For contact operations, we typically want the first successful result
    if (successfulResults.length > 0) {
      return successfulResults[0] as ContactResult;
    }

    // If no successful results, create a summary result
    return {
      contacts: [],
      totalCount: 0,
      operation: 'search',
      searchTerm: params.query
    };
  }
  
  /**
   * Pre-execution hook - validate Google Contacts access
   */
  protected async beforeExecution(params: ContactAgentRequest, context: ToolExecutionContext): Promise<void> {
    await super.beforeExecution(params, context);
    
    // Log contact operation start
    this.logger.debug('Google Contacts access validated', { 
      sessionId: context.sessionId,
      operation: params.operation || 'search'
    });
  }
  
  /**
   * Post-execution hook - log contact metrics
   */
  protected async afterExecution(result: ContactResult, context: ToolExecutionContext): Promise<void> {
    await super.afterExecution(result, context);
    
    // Log contact operation metrics
    this.logger.info('Contact operation completed', {
      operation: result.operation,
      contactsFound: result.totalCount,
      searchTerm: result.searchTerm?.substring(0, 50),
      sessionId: context.sessionId
    });
  }
  
  /**
   * Sanitize sensitive data from logs
   */
  protected sanitizeForLogging(params: ContactAgentRequest): any {
    return {
      query: params.query?.substring(0, 100) + (params.query?.length > 100 ? '...' : ''),
      accessToken: '[REDACTED]',
      operation: params.operation,
      name: params.name,
      email: params.email ? '[EMAIL]' : undefined,
      phone: params.phone ? '[PHONE]' : undefined
    };
  }
  
  // PRIVATE IMPLEMENTATION METHODS
  
  /**
   * Handle contact search queries
   */
  private async handleSearchContacts(params: ContactAgentRequest): Promise<ContactResult> {
    // Extract search parameters from query
    const searchParams = await this.extractSearchParameters(params.query);
    
    const searchRequest: ContactSearchRequest = {
      query: searchParams.searchTerm,
      maxResults: Math.min(
        searchParams.maxResults || CONTACT_CONSTANTS.DEFAULT_SEARCH_RESULTS,
        CONTACT_CONSTANTS.MAX_SEARCH_RESULTS
      ),
      includeOtherContacts: true // Always include frequently contacted
    };

    // Use retry mechanism from AIAgent for reliability
    const searchResult = await this.withRetries(async () => {
      const contactService = getService<ContactService>('contactService');
      if (!contactService) {
        throw new Error('Contact service not available');
      }
      return await contactService.searchContacts(searchRequest.query, params.accessToken);
    });

    this.logger.info('Contact search completed successfully', {
      query: searchParams.searchTerm,
      foundCount: searchResult.contacts.length
    });

    return {
      contacts: searchResult.contacts,
      totalCount: searchResult.totalCount,
      operation: 'search',
      searchTerm: searchParams.searchTerm
    };
  }
  
  /**
   * Handle contact creation (placeholder - requires additional permissions)
   */
  private async handleCreateContact(params: ContactAgentRequest): Promise<ContactResult> {
    this.logger.info('Contact creation requested (not implemented)', { query: params.query });
    
    throw this.createError(
      'Contact creation not yet implemented. This requires additional Google API permissions.',
      'NOT_IMPLEMENTED'
    );
  }
  
  /**
   * Handle contact updates (placeholder - requires additional permissions)
   */
  private async handleUpdateContact(params: ContactAgentRequest): Promise<ContactResult> {
    this.logger.info('Contact update requested (not implemented)', { query: params.query });
    
    throw this.createError(
      'Contact updates not yet implemented. This requires additional Google API permissions.',
      'NOT_IMPLEMENTED'
    );
  }
  
  /**
   * Determine operation type from query using AI instead of string matching
   * Replaces string includes() calls with AI operation detection
   */
  private async determineOperation(query: string): Promise<'search' | 'create' | 'update'> {
    try {
      const aiClassificationService = getService<AIClassificationService>('aiClassificationService');
      if (!aiClassificationService) {
        throw new Error('AI Classification Service is not available. AI operation detection is required for this operation.');
      }
      const operation = await aiClassificationService.detectContactOperation(query);
      
      // Convert AI result to expected format
      switch (operation) {
        case 'add':
          return 'create';
        case 'update':
          return 'update';
        case 'search':
          return 'search';
        default:
          return 'search'; // Default fallback
      }
    } catch (error) {
      this.logger.error('Failed to determine contact operation:', error);
      throw new Error('AI contact operation detection failed. Please check your OpenAI configuration.');
    }
  }
  
  /**
   * Extract search parameters from natural language query using AI
   * Replaces regex patterns with AI entity extraction
   */
  private async extractSearchParameters(query: string): Promise<{
    searchTerm: string;
    maxResults?: number;
  }> {
    try {
      const aiClassificationService = getService<AIClassificationService>('aiClassificationService');
      if (!aiClassificationService) {
        throw new Error('AI Classification Service is not available. AI search parameter extraction is required for this operation.');
      }
      
      // Use AI to extract contact names and determine if limit is specified
      const contactLookup = await aiClassificationService.extractContactNames(query);
      
      // For now, use the original query as search term, but this could be enhanced
      // to extract more specific search parameters using AI
      let searchTerm = query;
      let maxResults: number | undefined;
      
      // Simple fallback for limit detection (could be enhanced with AI)
      const limitMatch = query.match(/(?:first|top|limit)\s+(\d+)/i);
      if (limitMatch && limitMatch[1]) {
        maxResults = Math.min(parseInt(limitMatch[1]), CONTACT_CONSTANTS.MAX_SEARCH_RESULTS);
      }
      
      return {
        searchTerm,
        maxResults
      };
    } catch (error) {
      this.logger.error('Failed to extract search parameters:', error);
      throw new Error('AI search parameter extraction failed. Please check your OpenAI configuration.');
    }
  }
  
  // STATIC UTILITY METHODS (for other agents to use)
  
  /**
   * Format contacts for use by other agents (especially EmailAgent)
   */
  static formatContactsForAgent(contacts: ContactType[]): Array<{
    name: string;
    email: string;
    phone?: string;
  }> {
    return contacts.map(contact => ({
      name: contact.name,
      email: contact.email,
      phone: contact.phone
    }));
  }
  
  /**
   * Get the best matching contact from a search result
   */
  static getBestMatch(contacts: ContactType[]): ContactType | null {
    if (contacts.length === 0) return null;
    
    // Return the first contact (highest confidence due to ranking)
    return contacts[0] || null;
  }
  
  /**
   * Check if a search result is ambiguous (multiple good matches)
   */
  static isAmbiguous(contacts: ContactType[], confidenceThreshold: number = CONTACT_CONSTANTS.HIGH_CONFIDENCE_THRESHOLD): boolean {
    if (contacts.length < 2) return false;
    
    // Check if we have multiple contacts with high confidence
    const highConfidenceContacts = contacts.filter(c => (c.confidence || 0) >= confidenceThreshold);
    return highConfidenceContacts.length > 1;
  }
  
  /**
   * Filter contacts by minimum confidence score
   */
  static filterByConfidence(contacts: ContactType[], minConfidence: number = CONTACT_CONSTANTS.MIN_CONFIDENCE_SCORE): ContactType[] {
    return contacts.filter(contact => (contact.confidence || 0) >= minConfidence);
  }
}