import { BaseService } from './base-service';
import { OpenAIService } from './openai.service';
import { serviceManager } from "./service-manager";
import { DraftManager } from './draft-manager.service';
import { z } from 'zod';

/**
 * Intent Analysis interfaces
 */
export interface IntentAnalysis {
  intentType: 'confirmation_positive' | 'confirmation_negative' | 'draft_modification' | 'new_request' | 'new_write_operation' | 'read_operation';
  confidence: number;
  reasoning: string;
  intentDescription: string; // Natural language description of what the user wants
  targetDraftId?: string;
  modifications?: {
    fieldsToUpdate: string[];
    newValues: Record<string, unknown>;
  };
  newOperation?: WriteOperation;
}

export interface AnalysisContext {
  userInput: string;
  sessionId: string;
  hasPendingDrafts: boolean;
  existingDrafts: {
    id: string;
    type: string;
    description: string;
    parameters: unknown;
    createdAt: Date;
    riskLevel: string;
  }[];
  conversationHistory?: string[];
  slackContext?: {
    channel: string;
    userId: string;
    teamId: string;
    threadTs?: string;
    recentMessages?: Array<{
      text: string;
      user: string;
      timestamp: string;
    }>;
  };
}

// Import types from appropriate modules
import { WriteOperation } from './draft-manager.service';
import { ToolCall } from '../types/tools';

/**
 * Service responsible for analyzing user intent and resolving dependencies
 *
 * Single Responsibility: Intent Analysis & Dependency Resolution
 * - Analyzes user input to determine intent
 * - Resolves service dependencies based on intent
 * - Provides context-aware intent classification
 */
export class IntentAnalysisService extends BaseService {
  private openaiService: OpenAIService | null = null;
  private draftManager: DraftManager | null = null;

  constructor() {
    super('IntentAnalysisService');
  }

  /**
   * Service initialization - get dependencies
   */
  protected async onInitialize(): Promise<void> {
    this.openaiService = serviceManager.getService<OpenAIService>('openaiService') || null;
    this.draftManager = serviceManager.getService<DraftManager>('draftManager') || null;

    if (!this.openaiService) {
      throw new Error('OpenAIService not available for intent analysis');
    }

    this.logInfo('IntentAnalysisService initialized successfully');
  }

  /**
   * Service cleanup
   */
  protected async onDestroy(): Promise<void> {
    this.logInfo('IntentAnalysisService destroyed');
  }

  /**
   * Analyze user intent with comprehensive context
   *
   * @param context - Analysis context including user input and conversation state
   * @returns Promise resolving to analyzed intent
   */
  async analyzeIntent(context: AnalysisContext): Promise<IntentAnalysis> {
    this.assertReady();

    if (!this.openaiService) {
      throw new Error('OpenAI service not available for intent analysis');
    }

    this.logDebug('Starting comprehensive intent analysis', {
      userInput: context.userInput.substring(0, 100) + '...',
      hasPendingDrafts: context.hasPendingDrafts,
      existingDraftsCount: context.existingDrafts.length
    });

    const prompt = this.buildIntentAnalysisPrompt(context);

    try {
      const response = await this.openaiService.generateText(
        context.userInput,
        prompt,
        {
          temperature: 0.1,
          maxTokens: 800
        }
      );

      const analysisResult = await this.parseIntentAnalysisResponse(response, context);

      this.logInfo('Intent analysis completed successfully', {
        intentType: analysisResult.intentType,
        confidence: analysisResult.confidence,
        targetDraftId: analysisResult.targetDraftId
      });

      return analysisResult;
    } catch (error) {
      this.logError('Failed to analyze intent', { error, context });
      // Fallback to basic intent analysis
      return this.fallbackIntentAnalysis(context);
    }
  }

  /**
   * Resolve service dependencies based on analyzed intent
   *
   * @param intent - Analyzed intent
   * @returns Array of service names required to fulfill the intent
   */
  async resolveDependencies(intent: IntentAnalysis): Promise<string[]> {
    this.assertReady();

    const dependencies: Set<string> = new Set();

    // Add core dependencies
    dependencies.add('openaiService');

    // Add intent-specific dependencies
    switch (intent.intentType) {
      case 'new_write_operation':
        if (intent.newOperation?.type === 'email') {
          dependencies.add('gmailService');
          dependencies.add('contactService');
          dependencies.add('tokenManager');
        }
        if (intent.newOperation?.type === 'calendar') {
          dependencies.add('calendarService');
          dependencies.add('tokenManager');
        }
        dependencies.add('draftManager');
        break;

      case 'read_operation':
        // For read operations, we'll determine dependencies based on intent description
        if (intent.intentDescription.toLowerCase().includes('email') || intent.intentDescription.toLowerCase().includes('gmail')) {
          dependencies.add('gmailService');
          dependencies.add('tokenManager');
        }
        if (intent.intentDescription.toLowerCase().includes('calendar')) {
          dependencies.add('calendarService');
          dependencies.add('tokenManager');
        }
        if (intent.intentDescription.toLowerCase().includes('contact')) {
          dependencies.add('contactService');
          dependencies.add('tokenManager');
        }
        break;

      case 'confirmation_positive':
      case 'confirmation_negative':
      case 'draft_modification':
        dependencies.add('draftManager');
        dependencies.add('toolExecutorService');
        break;

      default:
        // For new_request, we'll need to analyze further
        dependencies.add('draftManager');
        dependencies.add('toolExecutorService');
    }

    const dependencyArray = Array.from(dependencies);

    this.logDebug('Resolved dependencies for intent', {
      intentType: intent.intentType,
      dependencies: dependencyArray
    });

    return dependencyArray;
  }

  /**
   * Build prompt for intent analysis
   */
  private buildIntentAnalysisPrompt(context: AnalysisContext): string {
    const draftsContext = context.existingDrafts.length > 0
      ? `\nExisting drafts:\n${context.existingDrafts.map(draft =>
          `- ID: ${draft.id}, Type: ${draft.type}, Description: ${draft.description}, Risk: ${draft.riskLevel}`
        ).join('\n')}`
      : '\nNo existing drafts.';

    const conversationContext = context.conversationHistory?.length
      ? `\nRecent conversation:\n${context.conversationHistory.slice(-3).join('\n')}`
      : '';

    return `You are an AI assistant specialized in analyzing user intent for email and productivity tasks.

CONTEXT:
User Input: "${context.userInput}"
Has Pending Drafts: ${context.hasPendingDrafts}${draftsContext}${conversationContext}

Your task is to analyze the user's intent and classify it into one of these categories:

1. **confirmation_positive** - User is confirming/approving a pending action
   - Examples: "yes", "send it", "that looks good", "go ahead"

2. **confirmation_negative** - User is rejecting a pending action
   - Examples: "no", "cancel", "don't send", "abort"

3. **draft_modification** - User wants to modify an existing draft
   - Examples: "change the subject to...", "add John to recipients", "make it more formal"

4. **new_write_operation** - User wants to create new content (email, calendar event)
   - Examples: "send email to...", "schedule meeting with...", "create calendar event"

5. **read_operation** - User wants to read/search existing content
   - Examples: "show my emails", "find meetings today", "search for emails from..."

6. **new_request** - General new request that may require multiple steps
   - Examples: complex tasks, multi-step operations

IMPORTANT: Focus on providing a clear, natural language description of what the user wants to accomplish. This description will be used by other services to plan and execute the appropriate actions.

RESPONSE FORMAT (JSON):
{
  "intentType": "<category>",
  "confidence": <0.0-1.0>,
  "reasoning": "<explanation>",
  "intentDescription": "<natural_language_description_of_what_user_wants>",
  "targetDraftId": "<draft_id_if_applicable>",
  "modifications": {
    "fieldsToUpdate": ["<field_names>"],
    "newValues": {"<field>": "<value>"}
  },
  "newOperation": {
    "type": "<email|calendar|contact>",
    "action": "<send|create|schedule>",
    "parameters": {}
  }
}

Analyze the intent and respond with valid JSON only.`;
  }

  /**
   * Parse intent analysis response from OpenAI with direct JSON parsing
   */
  private async parseIntentAnalysisResponse(response: string, context: AnalysisContext): Promise<IntentAnalysis> {
    try {
      // Try direct JSON parsing first
      const directParse = this.tryDirectJsonParse(response);
      if (directParse) {
        return this.validateAndFormatIntent(directParse, context);
      }

      throw new Error('No valid JSON found in response');
    } catch (error) {
      this.logError('Failed to parse intent analysis response', { error, response });
      return this.fallbackIntentAnalysis(context);
    }
  }

  /**
   * Try direct JSON parsing
   */
  private tryDirectJsonParse(response: string): any | null {
    try {
      return JSON.parse(response.trim());
    } catch {
      return null;
    }
  }



  /**
   * Validate and format intent analysis result
   */
  private validateAndFormatIntent(parsed: any, context: AnalysisContext): IntentAnalysis {
    // Validate required fields
    if (!parsed.intentType || !parsed.confidence || !parsed.reasoning) {
      throw new Error('Missing required fields in response');
    }

    // Validate intentType is one of the allowed values
    const validIntentTypes = [
      'confirmation_positive', 'confirmation_negative', 'draft_modification',
      'new_request', 'new_write_operation', 'read_operation'
    ];
    
    if (!validIntentTypes.includes(parsed.intentType)) {
      throw new Error(`Invalid intentType: ${parsed.intentType}`);
    }

    // Validate confidence is a number between 0 and 1
    if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
      throw new Error(`Invalid confidence: ${parsed.confidence}`);
    }

    return {
      intentType: parsed.intentType,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      intentDescription: parsed.intentDescription || context.userInput,
      targetDraftId: parsed.targetDraftId,
      modifications: parsed.modifications,
      newOperation: parsed.newOperation
    };
  }

  /**
   * Fallback intent analysis when OpenAI fails
   */
  private fallbackIntentAnalysis(context: AnalysisContext): IntentAnalysis {
    const userInput = context.userInput.toLowerCase().trim();

    // Simple keyword-based analysis
    if (userInput.match(/\b(yes|ok|okay|send|go ahead|looks good|approve)\b/)) {
      return {
        intentType: 'confirmation_positive',
        confidence: 0.8,
        reasoning: 'Keyword-based detection of positive confirmation',
        intentDescription: 'User is confirming or approving a pending action'
      };
    }

    if (userInput.match(/\b(no|cancel|don't|abort|stop)\b/)) {
      return {
        intentType: 'confirmation_negative',
        confidence: 0.8,
        reasoning: 'Keyword-based detection of negative confirmation',
        intentDescription: 'User is rejecting or cancelling a pending action'
      };
    }

    if (userInput.match(/\b(change|modify|update|edit)\b/) && context.hasPendingDrafts) {
      return {
        intentType: 'draft_modification',
        confidence: 0.7,
        reasoning: 'Keyword-based detection of draft modification',
        intentDescription: 'User wants to modify an existing draft'
      };
    }

    if (userInput.match(/\b(send|email|mail)\b.*\b(to|@)\b/)) {
      return {
        intentType: 'new_write_operation',
        confidence: 0.7,
        reasoning: 'Keyword-based detection of email operation',
        intentDescription: 'User wants to send an email',
        newOperation: {
          type: 'email',
          operation: 'send',
          parameters: {
            action: 'send'
          },
          toolCall: {
            name: 'send_email',
            parameters: {}
          },
          confirmationReason: 'Email sending requires confirmation',
          riskLevel: 'medium',
          previewDescription: 'Send email operation'
        }
      };
    }

    if (userInput.match(/\b(show|find|search|get|read)\b/)) {
      return {
        intentType: 'read_operation',
        confidence: 0.6,
        reasoning: 'Keyword-based detection of read operation',
        intentDescription: 'User wants to view or search for information'
      };
    }

    // Default to new request
    return {
      intentType: 'new_request',
      confidence: 0.5,
      reasoning: 'Fallback analysis - treating as new request',
      intentDescription: context.userInput
    };
  }
}