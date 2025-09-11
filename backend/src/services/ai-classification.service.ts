import { BaseService } from './base-service';
import { getService } from './service-manager';
import { OpenAIService } from './openai.service';
import logger from '../utils/logger';

/**
 * AI Classification Service
 * 
 * Centralized service for all AI-driven classification tasks that replace
 * string matching patterns throughout the application.
 * 
 * This service eliminates the need for:
 * - Hardcoded word arrays
 * - Regex patterns for intent detection
 * - String matching for operation classification
 * - Keyword-based priority detection
 */
export class AIClassificationService extends BaseService {
  private openaiService: OpenAIService | null = null;

  constructor() {
    super('aiClassificationService');
  }

  protected async onInitialize(): Promise<void> {
    try {
      const service = getService<OpenAIService>('openaiService');
      this.openaiService = service || null;
      logger.info('AIClassificationService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize AIClassificationService:', error);
      throw error;
    }
  }

  protected async onDestroy(): Promise<void> {
    this.openaiService = null;
    logger.info('AIClassificationService shutdown complete');
  }

  /**
   * Classify confirmation responses using AI instead of hardcoded word arrays
   * Replaces: CONFIRMATION_WORDS arrays
   */
  async classifyConfirmationResponse(text: string): Promise<'confirm' | 'reject' | 'unknown'> {
    if (!this.openaiService) {
      throw new Error('OpenAI service is not available. AI classification is required for this operation.');
    }

    try {
      const response = await this.openaiService.generateText(
        `Classify this response to a confirmation request: "${text}"
        
        Return exactly one word: confirm, reject, or unknown
        
        Examples:
        - "yes" → confirm
        - "go for it" → confirm  
        - "sounds good" → confirm
        - "not now" → reject
        - "cancel" → reject
        - "weather is nice" → unknown
        - "what time is it" → unknown`,
        'Classify confirmation responses. Return only: confirm, reject, or unknown',
        { temperature: 0, maxTokens: 5 }
      );

      const result = response.trim().toLowerCase();
      if (['confirm', 'reject', 'unknown'].includes(result)) {
        return result as 'confirm' | 'reject' | 'unknown';
      }
      return 'unknown';
    } catch (error) {
      logger.error('Failed to classify confirmation response:', error);
      return 'unknown';
    }
  }

  /**
   * Detect operations using AI instead of string matching
   * Replaces: operation pattern matching in agent config
   */
  async detectOperation(query: string, agentName: string): Promise<string> {
    if (!this.openaiService) {
      throw new Error('OpenAI service is not available. AI operation detection is required for this operation.');
    }

    try {
      const response = await this.openaiService.generateText(
        `Classify this user request for ${agentName}: "${query}"
        
        Operations: read, write, search, create, update, delete, unknown
        
        Return only the operation name.
        
        Examples:
        - "what emails do I have" → read
        - "send email to john" → write
        - "find contact for sarah" → search
        - "schedule meeting tomorrow" → create
        - "update my calendar" → update
        - "delete old emails" → delete`,
        'You classify user intents. Return only: read, write, search, create, update, delete, or unknown',
        { temperature: 0.1, maxTokens: 10 }
      );

      const result = response.trim().toLowerCase();
      const validOperations = ['read', 'write', 'search', 'create', 'update', 'delete', 'unknown'];
      return validOperations.includes(result) ? result : 'unknown';
    } catch (error) {
      logger.error('Failed to detect operation:', error);
      return 'unknown';
    }
  }

  /**
   * Extract entities from text using AI instead of regex patterns
   * Replaces: Complex regex patterns in Slack interface
   */
  async extractEntities(text: string): Promise<{
    action: 'email' | 'calendar' | 'contact' | null;
    parameters: {
      recipient?: string;
      subject?: string;
      body?: string;
      title?: string;
      time?: string;
      name?: string;
      email?: string;
    };
  }> {
    if (!this.openaiService) {
      throw new Error('OpenAI service is not available. AI entity extraction is required for this operation.');
    }

    try {
      const response = await this.openaiService.generateText(
        `Parse this proposal text and extract action details: "${text}"
        
        Return JSON with action type and parameters:
        {
          "action": "email" | "calendar" | "contact" | null,
          "parameters": {
            "recipient": "email@example.com",
            "subject": "Meeting Request",
            "body": "Let's meet tomorrow",
            "title": "Team Meeting",
            "time": "2pm tomorrow",
            "name": "John Doe",
            "email": "john.doe@example.com"
          }
        }
        
        Only include parameters that are present in the text.`,
        'Extract structured action data from proposal text. Return valid JSON.',
        { temperature: 0, maxTokens: 200 }
      );

      const result = JSON.parse(response);
      return {
        action: result.action || null,
        parameters: result.parameters || {}
      };
    } catch (error) {
      logger.error('Failed to extract entities:', error);
      return { action: null, parameters: {} };
    }
  }

  /**
   * Classify email priority using AI instead of keyword arrays
   * Replaces: urgentKeywords and lowPriorityKeywords arrays
   */
  async classifyEmailPriority(content: string): Promise<'urgent' | 'normal' | 'low'> {
    if (!this.openaiService) {
      throw new Error('OpenAI service is not available. AI email priority classification is required for this operation.');
    }

    try {
      const response = await this.openaiService.generateText(
        `Classify email priority based on content: "${content}"
        
        Return exactly one word: urgent, normal, or low
        
        Examples:
        - "URGENT: Need this ASAP" → urgent
        - "Emergency response needed" → urgent
        - "Meeting tomorrow at 2pm" → normal
        - "FYI: Newsletter update" → low
        - "Weekly digest" → low`,
        'Classify email priority. Return only: urgent, normal, or low',
        { temperature: 0, maxTokens: 5 }
      );

      const result = response.trim().toLowerCase();
      if (['urgent', 'normal', 'low'].includes(result)) {
        return result as 'urgent' | 'normal' | 'low';
      }
      return 'normal';
    } catch (error) {
      logger.error('Failed to classify email priority:', error);
      return 'normal';
    }
  }

  /**
   * Detect contact operations using AI instead of string matching
   * Replaces: String includes() calls in contact agent
   */
  async detectContactOperation(query: string): Promise<'add' | 'update' | 'search' | 'unknown'> {
    if (!this.openaiService) {
      throw new Error('OpenAI service is not available. AI contact operation detection is required for this operation.');
    }

    try {
      const response = await this.openaiService.generateText(
        `Detect contact operation from query: "${query}"
        
        Return exactly one word: add, update, search, or unknown
        
        Examples:
        - "add john to contacts" → add
        - "create new contact" → add
        - "update sarah's email" → update
        - "find contact for mike" → search
        - "look up john's info" → search`,
        'Detect contact operations. Return only: add, update, search, or unknown',
        { temperature: 0, maxTokens: 5 }
      );

      const result = response.trim().toLowerCase();
      if (['add', 'update', 'search', 'unknown'].includes(result)) {
        return result as 'add' | 'update' | 'search' | 'unknown';
      }
      return 'unknown';
    } catch (error) {
      logger.error('Failed to detect contact operation:', error);
      return 'unknown';
    }
  }

  /**
   * Analyze tool appropriateness using AI instead of regex patterns
   * Replaces: Regex patterns and string matching in think agent
   */
  async analyzeToolAppropriateness(query: string, toolName: string): Promise<{
    appropriateness: 'correct' | 'incorrect' | 'suboptimal';
    reason: string;
  }> {
    if (!this.openaiService) {
      throw new Error('OpenAI service is not available. AI tool appropriateness analysis is required for this operation.');
    }

    try {
      const response = await this.openaiService.generateText(
        `Analyze if this tool is appropriate for the query:
        
        Query: "${query}"
        Tool: ${toolName}
        
        Return JSON:
        {
          "appropriateness": "correct" | "incorrect" | "suboptimal",
          "reason": "explanation"
        }`,
        'Analyze tool appropriateness. Return valid JSON.',
        { temperature: 0, maxTokens: 100 }
      );

      const result = JSON.parse(response);
      return {
        appropriateness: result.appropriateness || 'suboptimal',
        reason: result.reason || 'Analysis failed'
      };
    } catch (error) {
      logger.error('Failed to analyze tool appropriateness:', error);
      return { appropriateness: 'suboptimal', reason: 'Analysis failed' };
    }
  }

  /**
   * Validate operations using AI instead of hardcoded arrays
   * Replaces: Hardcoded operation validation arrays
   */
  async validateOperation(operation: string, agentName: string): Promise<boolean> {
    if (!this.openaiService) {
      throw new Error('OpenAI service is not available. AI operation validation is required for this operation.');
    }

    try {
      const response = await this.openaiService.generateText(
        `Validate if this operation is valid for ${agentName}: "${operation}"
        
        Return exactly: valid or invalid
        
        Examples:
        - "read" for emailAgent → valid
        - "send" for emailAgent → valid
        - "delete" for contactAgent → invalid (contacts are read-only)
        - "create" for calendarAgent → valid`,
        'Validate operations. Return only: valid or invalid',
        { temperature: 0, maxTokens: 5 }
      );

      return response.trim().toLowerCase() === 'valid';
    } catch (error) {
      logger.error('Failed to validate operation:', error);
      return false;
    }
  }

  /**
   * Determine if an operation requires confirmation using AI
   * Replaces: Hardcoded operation arrays for confirmation detection
   */
  async operationRequiresConfirmation(operation: string, agentName: string): Promise<boolean> {
    if (!this.openaiService) {
      throw new Error('OpenAI service is not available. AI confirmation detection is required for this operation.');
    }
    try {
      const response = await this.openaiService.generateText(
        `Determine if this operation requires user confirmation for ${agentName}: "${operation}"
        
        Return exactly: yes or no
        
        Examples:
        - "send email" → yes (write operation)
        - "create calendar event" → yes (write operation)
        - "read inbox" → no (read operation)
        - "search contacts" → no (read operation)
        - "delete contact" → yes (destructive operation)
        - "list emails" → no (read operation)`,
        'Determine if operations require confirmation. Return only: yes or no',
        { temperature: 0, maxTokens: 5 }
      );
      return response.trim().toLowerCase() === 'yes';
    } catch (error) {
      logger.error('Error determining confirmation requirement:', error);
      return true; // Default to requiring confirmation for safety
    }
  }

  /**
   * Detect OAuth requirement from user message using AI
   * Replaces: Hardcoded keyword arrays for OAuth detection
   */
  async detectOAuthRequirement(message: string): Promise<'email_send' | 'email_read' | 'calendar_create' | 'calendar_read' | 'contact_access' | 'none'> {
    if (!this.openaiService) {
      throw new Error('OpenAI service is not available. AI OAuth requirement detection is required for this operation.');
    }
    try {
      const response = await this.openaiService.generateText(
        `Analyze this user message to determine if OAuth is required: "${message}"
        
        Return exactly one of these values:
        - email_send: User wants to send/compose an email
        - email_read: User wants to read/check their inbox
        - calendar_create: User wants to create/schedule a calendar event
        - calendar_read: User wants to view/check their calendar
        - contact_access: User wants to access/manage contacts
        - none: No OAuth required (just mentioning, reading, or general discussion)
        
        Examples:
        - "Send email to John" → email_send
        - "Check my inbox" → email_read
        - "Schedule a meeting" → calendar_create
        - "What's on my calendar?" → calendar_read
        - "Add John to contacts" → contact_access
        - "I got an email from John" → none
        - "Mentioned email in my notes" → none`,
        'Detect OAuth requirements from user messages. Return only: email_send, email_read, calendar_create, calendar_read, contact_access, or none',
        { temperature: 0, maxTokens: 10 }
      );
      const result = response.trim().toLowerCase();
      const validResults = ['email_send', 'email_read', 'calendar_create', 'calendar_read', 'contact_access', 'none'];
      return validResults.includes(result) ? result as any : 'none';
    } catch (error) {
      logger.error('Error detecting OAuth requirement:', error);
      return 'none';
    }
  }

  /**
   * Detect if a message is a help request using AI
   * Replaces hardcoded help keyword arrays
   */
  async detectHelpRequest(message: string): Promise<boolean> {
    if (!this.openaiService) {
      throw new Error('OpenAI service is not available. AI help request detection is required for this operation.');
    }

    try {
      const response = await this.openaiService.generateText(
        `Determine if this message is a help request: "${message}"
        
        A help request is when someone is asking for:
        - Instructions on how to use something
        - Information about available commands
        - Guidance on what they can do
        - General assistance or support
        
        Return exactly: yes or no`,
        'Detect help requests from user messages',
        { temperature: 0, maxTokens: 10 }
      );

      const result = response.toLowerCase().trim();
      return result === 'yes';
    } catch (error) {
      logger.error('Failed to detect help request with AI:', error);
      throw new Error('AI help request detection failed. Please check your OpenAI configuration.');
    }
  }
  async extractContactNames(userInput: string): Promise<{needed: boolean, names: string[]}> {
    if (!this.openaiService) {
      throw new Error('OpenAI service is not available. AI contact name extraction is required for this operation.');
    }

    try {
      const response = await this.openaiService.generateText(
        `Extract person names that need contact lookup: "${userInput}"
        
        Return JSON: {"needed": boolean, "names": ["name1", "name2"]}
        
        Examples:
        - "Send email to John" → {"needed": true, "names": ["John"]}
        - "What's on my calendar?" → {"needed": false, "names": []}
        - "Schedule meeting with Sarah and Mike" → {"needed": true, "names": ["Sarah", "Mike"]}
        - "Send email to john@example.com" → {"needed": false, "names": []}`,
        'Extract contact names from user requests. Always return valid JSON.',
        { temperature: 0, maxTokens: 100 }
      );

      const result = JSON.parse(response);
      return {
        needed: result.needed || false,
        names: result.names || []
      };
    } catch (error) {
      logger.error('Failed to extract contact names:', error);
      return { needed: false, names: [] };
    }
  }
}
