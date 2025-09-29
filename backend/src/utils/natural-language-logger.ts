import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
// Intent analysis type
interface IntentAnalysis {
  intent: string;
  confidence: number;
  entities?: any[];
  intentType?: string;
  reasoning?: string;
  targetDraftId?: string;
  modifications?: any;
  newOperation?: string;
}
import { NaturalLanguageResponse } from '../types/agents/natural-language.types';
import { ENVIRONMENT } from '../config/environment';

// Extend Winston's Logger interface to include custom levels
interface NaturalLanguageLogger extends winston.Logger {
  intent: winston.LeveledLogMethod;
  plan: winston.LeveledLogMethod;
  agent: winston.LeveledLogMethod;
  draft: winston.LeveledLogMethod;
  flow: winston.LeveledLogMethod;
}

interface LogContext {
  correlationId: string;
  userId?: string;
  sessionId: string;
  operation: string;
  metadata?: Record<string, any>;
}

interface NaturalLanguageFlow {
  userInput: string;
  intentAnalysis?: IntentAnalysis;
  agentCommunication?: Array<{
    agent: string;
    request: string;
    response: string;
    success: boolean;
    draftId?: string;
  }>;
  finalResponse?: string;
  executionTime?: number;
}

// Custom log levels for natural language flow
const naturalLanguageLevels = {
  'intent': 0,        // Intent analysis results
  'plan': 1,          // Plan creation and step planning  
  'agent': 2,         // Agent communication
  'draft': 3,         // Draft workflow events
  'flow': 4,          // Complete natural language flow
  'error': 5,         // Errors (always enabled)
  'warn': 6,          // Warnings
  'info': 7,          // General info
  'debug': 8          // Debug information
};

const naturalLanguageColors = {
  intent: 'cyan',
  plan: 'blue',
  agent: 'green', 
  draft: 'yellow',
  flow: 'magenta',
  error: 'red',
  warn: 'yellow',
  info: 'white',
  debug: 'gray'
};

winston.addColors(naturalLanguageColors);

class NaturalLanguageLogger {
  private logger: winston.Logger;
  private isEnabled: boolean;

  constructor() {
    this.isEnabled = ENVIRONMENT.features.naturalLanguageLogging;
    
    this.logger = winston.createLogger({
      levels: naturalLanguageLevels,
      level: ENVIRONMENT.features.naturalLanguageLogLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new DailyRotateFile({
          filename: 'logs/natural-language-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '10m',
          maxFiles: '7d'
        }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              return `${timestamp} [${level}] ${message} ${JSON.stringify(meta, null, 2)}`;
            })
          )
        })
      ]
    });
  }

  /**
   * Log intent analysis results
   */
  logIntentAnalysis(intent: IntentAnalysis, userInput: string, context: LogContext): void {
    if (!this.isEnabled) return;
    
    (this.logger as any).intent('INTENT_ANALYSIS', {
      type: 'intent_analysis',
      sessionId: context.sessionId,
      userId: context.userId,
      correlationId: context.correlationId,
      userInput: userInput.substring(0, 200),
      intent: {
        intentType: intent.intentType,
        confidence: intent.confidence,
        reasoning: intent.reasoning,
        targetDraftId: intent.targetDraftId,
        modifications: intent.modifications,
        newOperation: intent.newOperation
      }
    });
  }

  /**
   * Log plan creation and step planning (legacy)
   */
  logPlanCreation(plan: any, context: LogContext): void {
    if (!this.isEnabled) return;

    (this.logger as any).plan('PLAN_CREATION', {
      type: 'plan_creation',
      sessionId: context.sessionId,
      userId: context.userId,
      correlationId: context.correlationId,
      plan: {
        stepNumber: plan.stepNumber,
        description: plan.description,
        agent: plan.agent,
        operation: plan.operation,
        naturalLanguageRequest: plan.naturalLanguageRequest,
        reasoning: plan.reasoning,
        isComplete: plan.isComplete
      }
    });
  }

  /**
   * Log string-based plan creation
   */
  logStringPlanCreation(
    stepNumber: number,
    stepDescription: string,
    isComplete: boolean,
    reasoning: string,
    context: LogContext
  ): void {
    if (!this.isEnabled) return;

    (this.logger as any).plan('STRING_PLAN_CREATION', {
      type: 'string_plan_creation',
      sessionId: context.sessionId,
      userId: context.userId,
      correlationId: context.correlationId,
      plan: {
        stepNumber,
        stepDescription,
        isComplete,
        reasoning,
        planType: 'string_based'
      }
    });
  }

  /**
   * Log agent communication
   */
  logAgentCommunication(
    agent: string,
    request: string,
    response: NaturalLanguageResponse,
    context: LogContext
  ): void {
    if (!this.isEnabled) return;
    
    // Detect truncation in request and response
    const requestTruncated = request.length > 300;
    const responseTruncated = response.response.length > 300;
    
    (this.logger as any).agent('AGENT_COMMUNICATION', {
      type: 'agent_communication',
      sessionId: context.sessionId,
      userId: context.userId,
      correlationId: context.correlationId,
      agent,
      request: request.substring(0, 300),
      requestTruncated,
      requestLength: request.length,
      response: {
        response: response.response.substring(0, 300),
        responseTruncated,
        responseLength: response.response.length,
        reasoning: response.reasoning,
        hasDraft: !!response.draft,
        draftId: response.draft?.draftId,
        draftType: response.draft?.type,
        suggestions: response.suggestions,
        warnings: response.warnings
      }
    });
  }

  /**
   * Log draft workflow events
   */
  logDraftWorkflow(
    action: 'created' | 'executed' | 'modified' | 'cancelled',
    draftId: string,
    draftType: string,
    context: LogContext,
    details?: any
  ): void {
    if (!this.isEnabled) return;
    
    (this.logger as any).draft('DRAFT_WORKFLOW', {
      type: 'draft_workflow',
      sessionId: context.sessionId,
      userId: context.userId,
      correlationId: context.correlationId,
      action,
      draftId,
      draftType,
      details: details ? JSON.stringify(details).substring(0, 500) : undefined
    });
  }

  /**
   * Log complete natural language flow
   */
  logNaturalLanguageFlow(flow: NaturalLanguageFlow, context: LogContext): void {
    if (!this.isEnabled) return;
    
    (this.logger as any).flow('NATURAL_LANGUAGE_FLOW', {
      type: 'natural_language_flow',
      sessionId: context.sessionId,
      userId: context.userId,
      correlationId: context.correlationId,
      timestamp: new Date().toISOString(),
      flow
    });
  }

  /**
   * Log errors (always enabled)
   */
  logError(error: Error, context: LogContext, additionalInfo?: any): void {
    this.logger.error('NATURAL_LANGUAGE_ERROR', {
      type: 'error',
      sessionId: context.sessionId,
      userId: context.userId,
      correlationId: context.correlationId,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      additionalInfo
    });
  }

  /**
   * Enable/disable logging dynamically
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Check if logging is enabled
   */
  isLoggingEnabled(): boolean {
    return this.isEnabled;
  }
}

// Export singleton instance
export const naturalLanguageLogger = new NaturalLanguageLogger();
export default naturalLanguageLogger;
