import { BasePromptBuilder } from '../base-prompt-builder';
import { AIPrompt, StructuredSchema } from '../../generic-ai.service';

// Context is just a string - no need for separate type

/**
 * Result of situation analysis
 */
export interface SituationAnalysisResponse {
  context: string; // Updated context with initial analysis including risk level and output strategy
}

/**
 * Prompt builder for analyzing user requests and determining initial strategy
 */
export class SituationAnalysisPromptBuilder extends BasePromptBuilder<string, SituationAnalysisResponse> {
  
  getDescription(): string {
    return 'Analyzes user requests to determine intent, assess risk, and set output strategy';
  }

  getName(): string {
    return 'SituationAnalysisPromptBuilder';
  }

  buildPrompt(context: string): AIPrompt<string> {
    return {
      systemPrompt: `
        You are an AI assistant that analyzes user requests to understand their intent and determine the appropriate response strategy.
        
        Your task is to:
        1. Analyze the user's input to understand their primary intent
        2. Assess the risk level of the requested operation
        3. Determine the appropriate output strategy based on risk and complexity (direct, preview, confirmation)
        4. Initialize the context structure with your analysis
        
        Risk Assessment Guidelines:
        - High Risk: Mass operations, financial commitments, legal/compliance actions, operations affecting others
        - Medium Risk: Important communications, meeting changes, contact updates, template modifications
        - Low Risk: Information retrieval, availability checks, reading/summarizing, simple confirmations
        
        Output Strategy Guidelines:
        - Direct: Low risk operations that can be executed immediately
        - Preview: Medium risk operations that should show a draft first
        - Confirmation: High risk operations that require explicit user approval
        
        ${this.CONTEXT_FORMAT}
        
        Additional Fields for Situation Analysis:
        RISK_LEVEL: [low/medium/high - risk assessment of the operation]
        OUTPUT_STRATEGY: [direct/preview/confirmation - how to present results]
        CONFIDENCE: [0-100 - initial confidence that the user intent is correctly understood]
        
        Context Initialization Guidelines:
        - GOAL: Extract the primary user intent from the request
        - ENTITIES: Identify all people, companies, meetings, emails mentioned
        - CONSTRAINTS: Note time limits, approval needs, risk factors
        - DATA: Start empty - will be populated during execution
        - PROGRESS: Mark as "Intent analyzed, strategy determined"
        - BLOCKERS: Note any immediate issues or missing information
        - NEXT: Specify the first action step to take
        - CURRENT_TIME: Include current date/time with timezone: ${this.getCurrentDateTime()}
        
        Be concise, functional, and explicit. Prefer precise nouns and verbs. Avoid verbose narrative.
      `,
      userPrompt: `
        Analyze this user request and provide your analysis:
        
        ${context}
        
        Provide your analysis and initialize the context structure using the fields above, including RISK_LEVEL, OUTPUT_STRATEGY, and CONFIDENCE.
      `,
      context
    };
  }

  getSchema(): StructuredSchema {
    return {
      type: 'object',
      description: 'Situation analysis result with risk assessment and output strategy in context',
      properties: {
        context: {
          type: 'string',
          description: 'Updated context with initial analysis including RISK_LEVEL and OUTPUT_STRATEGY in the specified format'
        }
      },
      required: ['context']
    };
  }

  protected validateContext(context: string): void {
    if (!context || context.trim().length === 0) {
      throw new Error('Context is required for situation analysis');
    }
  }
}
