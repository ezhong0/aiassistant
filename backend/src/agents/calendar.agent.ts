import { ToolExecutionContext, ToolResult } from '../types/tools';
import logger from '../utils/logger';
import { LogContext } from '../utils/log-context';
import { AIAgent } from '../framework/ai-agent';
import { ActionPreview, PreviewGenerationResult, CalendarPreviewData, ActionRiskAssessment } from '../types/api/api.types';
import { CalendarService, CalendarEvent } from '../services/calendar/calendar.service';
import { resolveCalendarService } from '../services/service-resolver';
import { getService, serviceManager } from '../services/service-manager';
// Removed OperationDetectionService - CalendarAgent handles its own operation detection
import { TokenManager } from '../services/token-manager';
import { APP_CONSTANTS } from '../config/constants';
import { CALENDAR_SERVICE_CONSTANTS } from '../config/calendar-service-constants';
import {
  ToolParameters,
  ToolExecutionResult,
  AgentExecutionSummary
} from '../types/agents/agent-parameters';
import {
  CreateEventActionParams,
  CalendarEventResult,
  ListEventsActionParams
} from '../types/agents/agent-specific-parameters';
import {
  AgentExecutionContext,
  AgentIntent,
  AgentCapabilities,
  NaturalLanguageResponse
} from '../types/agents/natural-language.types';

// Focused services removed - CalendarAgent handles validation and formatting internally

// Simple result interface for internal use
interface SimpleCalendarResult {
  success: boolean;
  data?: any;
  message: string;
  error?: string;
}

export interface CalendarAgentRequest {
  action: 'create' | 'list' | 'update' | 'delete' | 'check_availability' | 'find_slots';
  summary?: string;
  description?: string;
  start?: string;
  end?: string;
  attendees?: string[];
  location?: string;
  eventId?: string;
  timeMin?: string;
  timeMax?: string;
  duration?: number;
  query?: string;
  accessToken: string;
  calendarId?: string;
}

export interface CalendarAgentResponse {
  success: boolean;
  message: string;
  event?: any;
  events?: any[];
  count?: number;
  isAvailable?: boolean;
  conflictingEvents?: any[];
  availableSlots?: any[];
  error?: string;
  reauth_reason?: string;
}

/**
 * CalendarAgent - Specialized agent for calendar operations via Google Calendar API
 * 
 * Handles calendar event creation, management, availability checking, and scheduling
 * operations through the Google Calendar API. Provides intelligent event processing
 * and conflict detection with AI-powered planning capabilities.
 * 
 * @example
 * ```typescript
 * const calendarAgent = new CalendarAgent();
 * const result = await calendarAgent.execute({
 *   action: 'create',
 *   summary: 'Team Meeting',
 *   start: '2024-01-15T10:00:00Z',
 *   end: '2024-01-15T11:00:00Z',
 *   attendees: ['john@example.com'],
 *   accessToken: 'oauth_token'
 * });
 * ```
 */
export class CalendarAgent extends AIAgent<CalendarAgentRequest, CalendarAgentResponse> {
  
  // Focused service dependencies
  private calendarService: CalendarService | null = null;
  // Calendar formatting and validation now handled internally

  constructor() {
    super({
      name: 'calendarAgent',
      description: 'Create, update, and manage calendar events and scheduling',
      enabled: true,
      timeout: 30000,
      retryCount: 2,
      // Removed individual agent AI planning - using only Master Agent NextStepPlanningService
      // aiPlanning: {
      //   enableAIPlanning: false,
      //   maxPlanningSteps: 8,
      //   planningTimeout: 25000,
      //   cachePlans: true,
      //   planningTemperature: 0.1,
      //   planningMaxTokens: 2000
      // }
    });

    // Register calendar-specific tools for AI planning
    this.registerCalendarTools();
  }

  /**
   * Lazy initialization of calendar services
   */
  private ensureServices(): void {
    if (!this.calendarService) {
      this.calendarService = serviceManager.getService(CALENDAR_SERVICE_CONSTANTS.SERVICE_NAMES.CALENDAR_SERVICE) as CalendarService;

      if (!this.calendarService) {
        logger.error('Calendar service not available in service manager', new Error('Calendar service initialization failed'), {
          correlationId: 'calendar-service-init',
          operation: 'ensure_services',
          metadata: {
            serviceName: CALENDAR_SERVICE_CONSTANTS.SERVICE_NAMES.CALENDAR_SERVICE,
            serviceManagerState: !!serviceManager,
            availableServices: Object.keys(serviceManager.getAllServicesHealth || {})
          }
        });
      } else {
        logger.debug('Calendar service successfully initialized', {
          correlationId: 'calendar-service-init',
          operation: 'ensure_services',
          metadata: { serviceName: CALENDAR_SERVICE_CONSTANTS.SERVICE_NAMES.CALENDAR_SERVICE }
        });
      }
    }
    // Calendar formatting and validation now handled internally
  }

  /**
   * Required method to process incoming requests - routes to appropriate handlers
   */
  protected async processQuery(params: CalendarAgentRequest, context: ToolExecutionContext): Promise<any> {
    logger.debug('CalendarAgent.processQuery called', {
      correlationId: `calendar-${context.sessionId}-${Date.now()}`,
      operation: 'calendar_process_query',
      metadata: {
        sessionId: context.sessionId,
        userId: context.userId,
        action: params.action,
        hasSlackContext: !!context.slackContext
      }
    });

    const logContext: LogContext = {
      correlationId: `calendar-${context.sessionId}-${Date.now()}`,
      userId: context.userId,
      sessionId: context.sessionId,
      operation: 'calendar_processing',
      metadata: {
        action: params.action,
        hasAccessToken: !!params.accessToken
      }
    };

    logger.info('Calendar processing started', logContext);

    // Ensure services are initialized
    this.ensureServices();

    logger.debug('Calendar services ensured', {
      ...logContext,
      metadata: {
        hasCalendarService: !!this.calendarService,
        calendarFormattingEnabled: true,
        calendarValidationEnabled: true
      }
    });

    // Get access token from TokenManager using Slack context
    let accessToken: string | null = null;

    logger.debug('Attempting to retrieve access token (masked)', {
      correlationId: logContext.correlationId,
      operation: 'calendar_token_lookup',
      metadata: {
        hasSlackContext: !!context.slackContext,
        teamId: context.slackContext?.teamId,
        userId: context.slackContext?.userId,
        hasParamsAccessToken: !!params.accessToken
      }
    });

    logger.debug('Attempting to retrieve access token', {
      ...logContext,
      metadata: {
        hasSlackContext: !!context.slackContext,
        teamId: context.slackContext?.teamId,
        userId: context.slackContext?.userId,
        hasParamsAccessToken: !!params.accessToken
      }
    });

    if (context.slackContext?.teamId && context.slackContext?.userId) {
      logger.debug('Found Slack context, looking up TokenManager', { correlationId: logContext.correlationId });
      const tokenManager = serviceManager.getService<TokenManager>('tokenManager');
      logger.debug('TokenManager lookup result', {
        correlationId: logContext.correlationId,
        operation: 'calendar_token_lookup',
        metadata: { hasTokenManager: !!tokenManager, isTokenManagerReady: tokenManager?.isReady() }
      });

      if (tokenManager) {
        try {
          accessToken = await tokenManager.getValidTokensForCalendar(context.slackContext.teamId, context.slackContext.userId);
          logger.debug('Token retrieval result (masked)', {
            correlationId: logContext.correlationId,
            operation: 'calendar_token_lookup',
            metadata: { hasAccessToken: !!accessToken, accessTokenLength: accessToken?.length || 0 }
          });
        } catch (error) {
          logger.error('Error retrieving access token', error as Error, {
            ...logContext,
            metadata: {
              teamId: context.slackContext.teamId,
              userId: context.slackContext.userId
            }
          });
        }
      } else {
        logger.warn('TokenManager service not available for CalendarAgent', { correlationId: logContext.correlationId });
      }
    } else {
      logger.debug('Missing Slack context for token retrieval', { correlationId: logContext.correlationId });
    }

    // Also check if access token is provided in parameters (for backwards compatibility)
    if (!accessToken && params.accessToken) {
      accessToken = params.accessToken as string;
      logger.debug('Using access token from parameters', {
        ...logContext,
        metadata: { accessTokenLength: accessToken.length }
      });
    }

    if (!accessToken) {
      logger.error('No access token available for calendar operations', new Error('No access token'), {
        ...logContext,
        metadata: {
          hasSlackContext: !!context.slackContext,
          hasParamsAccessToken: !!params.accessToken,
          checkedTokenManager: true
        }
      });
      return {
        success: false,
        message: 'Calendar access not available. Please authenticate with Google Calendar.',
        error: 'No access, refresh token, API key or refresh handler callback is set.'
      };
    }

    // First detect the operation
    const operation = await this.detectOperation(params);

    logger.debug('Operation detected', {
      ...logContext,
      metadata: {
        detectedOperation: operation,
        hasAction: !!params.action,
        hasOperation: !!(params as any).operation,
        hasAccessToken: !!accessToken
      }
    });

    // Route to appropriate handler based on detected operation
    switch (operation.toLowerCase()) {
      case 'create':
        logger.debug('Routing to create event', { ...logContext, metadata: { operation: 'create' } });
        return await this.handleCreateEvent(params as unknown as ToolParameters, context, accessToken);

      case 'list':
        logger.debug('Routing to list events', { ...logContext, metadata: { operation: 'list' } });
        return await this.handleListEvents(params as unknown as ToolParameters, context, accessToken);

      case 'retrieve_events':
        logger.debug('Routing to retrieve events', { ...logContext, metadata: { operation: 'retrieve_events' } });
        return await this.handleListEvents(params as unknown as ToolParameters, context, accessToken);

          case 'retrieve_suggested_times':
            logger.debug('Routing to retrieve suggested times', { ...logContext, metadata: { operation: 'retrieve_suggested_times' } });
            return await this.handleListEvents(params as unknown as ToolParameters, context, accessToken);

          case 'list_events':
        logger.debug('Routing to list events', { ...logContext, metadata: { operation: 'list_events' } });
        return await this.handleListEvents(params as unknown as ToolParameters, context, accessToken);

      case 'update':
        logger.debug('Routing to update event', { ...logContext, metadata: { operation: 'update' } });
        return await this.handleUpdateEvent(params as unknown as ToolParameters, context, accessToken);

      case 'delete':
        logger.debug('Routing to delete event', { ...logContext, metadata: { operation: 'delete' } });
        return await this.handleDeleteEvent(params as unknown as ToolParameters, context, accessToken);

      case 'check_availability':
        logger.debug('Routing to check availability', { ...logContext, metadata: { operation: 'check_availability' } });
        return await this.handleCheckAvailability(params as unknown as ToolParameters, context, accessToken);

      case 'find_slots':
        logger.debug('Routing to find slots', { ...logContext, metadata: { operation: 'find_slots' } });
        return await this.handleFindSlots(params as unknown as ToolParameters, context, accessToken);

      default:
        logger.warn('Unknown operation, defaulting to create', {
          ...logContext,
          metadata: { detectedOperation: operation, action: params.action }
        });
        return await this.handleCreateEvent(params as unknown as ToolParameters, context, accessToken);
    }
  }

  /**
   * Cleanup focused service dependencies
   */
  protected async onDestroy(): Promise<void> {
    try {
      logger.debug('Destroying CalendarAgent', {
        correlationId: 'calendar-destroy',
        operation: 'agent_destroy',
        metadata: { service: 'CalendarAgent' }
      });
      this.calendarService = null;
      // Calendar formatting and validation cleanup handled internally
      logger.debug('CalendarAgent destroyed successfully', {
        correlationId: 'calendar-destroy',
        operation: 'agent_destroy',
        metadata: { service: 'CalendarAgent' }
      });
    } catch (error) {
      logger.error('Error during CalendarAgent destruction', error as Error, {
        correlationId: 'calendar-destroy',
        operation: 'agent_destroy',
        metadata: { service: 'CalendarAgent' }
      });
    }
  }

  /**
   * Register calendar-specific tools for AI planning
   */
  private registerCalendarTools(): void {
    // Primary calendar event creation tool
    this.registerTool({
      name: 'create_calendar_event',
      description: 'Create a new calendar event with attendees, location, and timing',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Event title/summary' },
          description: { type: 'string', description: 'Event description/details' },
          start: { type: 'string', description: 'Event start time (ISO 8601 format)' },
          end: { type: 'string', description: 'Event end time (ISO 8601 format)' },
          attendees: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'List of attendee email addresses'
          },
          location: { type: 'string', description: 'Event location' }
        },
        required: ['summary', 'start', 'end']
      }
    });

    // Calendar event listing tool
    this.registerTool({
      name: 'list_calendar_events',
      description: 'List calendar events within a time range',
      parameters: {
        type: 'object',
        properties: {
          timeMin: { type: 'string', description: 'Start of time range (ISO 8601 format)' },
          timeMax: { type: 'string', description: 'End of time range (ISO 8601 format)' },
          maxResults: { type: 'number', description: 'Maximum number of events to return' }
        }
      }
    });

    // Calendar event update tool
    this.registerTool({
      name: 'update_calendar_event',
      description: 'Update an existing calendar event',
      parameters: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'ID of the event to update' },
          summary: { type: 'string', description: 'Updated event title/summary' },
          description: { type: 'string', description: 'Updated event description' },
          start: { type: 'string', description: 'Updated start time' },
          end: { type: 'string', description: 'Updated end time' },
          attendees: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'Updated list of attendee emails'
          },
          location: { type: 'string', description: 'Updated event location' }
        },
        required: ['eventId']
      }
    });

    // Calendar event deletion tool
    this.registerTool({
      name: 'delete_calendar_event',
      description: 'Delete a calendar event',
      parameters: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'ID of the event to delete' }
        },
        required: ['eventId']
      }
    });

    // Availability checking tool
    this.registerTool({
      name: 'check_calendar_availability',
      description: 'Check if a specific time slot is available',
      parameters: {
        type: 'object',
        properties: {
          startTime: { type: 'string', description: 'Start time to check (ISO 8601 format)' },
          endTime: { type: 'string', description: 'End time to check (ISO 8601 format)' }
        },
        required: ['startTime', 'endTime']
      }
    });

    // Time slot finding tool
    this.registerTool({
      name: 'find_available_slots',
      description: 'Find available time slots within a date range',
      parameters: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'Start of date range (ISO 8601 format)' },
          endDate: { type: 'string', description: 'End of date range (ISO 8601 format)' },
          durationMinutes: { type: 'number', description: 'Duration of desired slots in minutes' }
        },
        required: ['startDate', 'endDate', 'durationMinutes']
      }
    });
  }

  /**
   * Detect operation type from calendar parameters
   */
  protected async detectOperation(params: CalendarAgentRequest): Promise<string> {
    // Check if operation is explicitly specified
    if ((params as any).operation) {
      return (params as any).operation;
    }

    // Check if action is specified (alternative parameter name)
    if (params.action) {
      return params.action;
    }

    // Pure natural language system - no text-based operation detection allowed
    throw new Error('Legacy operation detection method called - use AI-powered intent analysis instead');
  }

  /**
   * Check if operation requires confirmation
   */
  protected async operationRequiresConfirmation(operation: string): Promise<boolean> {
    // Create, update, and delete operations require confirmation
    if (operation === 'create' || operation === 'update' || operation === 'delete') {
      return true;
    }

    // List, search, and availability operations don't require confirmation
    return false;
  }

  /**
   * Generate preview for Calendar operations
   */
  protected async generatePreview(params: CalendarAgentRequest, context: ToolExecutionContext): Promise<PreviewGenerationResult> {
    const logContext: LogContext = {
      correlationId: `calendar-preview-${context.sessionId}-${Date.now()}`,
      userId: context.userId,
      sessionId: context.sessionId,
      operation: 'calendar_preview_generation',
      metadata: {
        action: params.action,
        summary: params.summary,
        start: params.start
      }
    };

    try {
      logger.debug('Generating calendar event preview', logContext);

      // Create preview data for calendar operations
      const previewData: CalendarPreviewData = {
        title: params.summary || 'New Event',
        startTime: params.start || new Date().toISOString(),
        endTime: params.end || new Date(Date.now() + 3600000).toISOString(), // 1 hour later
        duration: '1 hour', // Calculate duration
        attendees: params.attendees || [],
        location: params.location,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        attendeeCount: (params.attendees || []).length
      };

      // Generate action ID for confirmation tracking
      const actionId = `calendar-${params.action || 'create'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create action preview
      const actionPreview: ActionPreview = {
        actionId,
        actionType: 'calendar',
        title: `${params.action || 'create'} Calendar Event`,
        description: `Calendar ${params.action || 'create'}: ${params.summary || 'New Event'}`,
        riskAssessment: {
          level: 'low',
          factors: ['calendar_modification'],
          warnings: ['Event can be modified or deleted after creation']
        },
        estimatedExecutionTime: '2-3 seconds',
        reversible: true,
        requiresConfirmation: true,
        awaitingConfirmation: true,
        originalQuery: params.query || `Calendar ${params.action || 'create'} operation`,
        parameters: params as any,
        previewData
      };

      logger.debug('Calendar preview generated successfully', {
        ...logContext,
        metadata: {
          actionId,
          actionType: params.action || 'create',
          eventSummary: params.summary,
          requiresConfirmation: true
        }
      });

      return {
        success: true,
        preview: actionPreview
      };
    } catch (error) {
      logger.error('Failed to generate calendar preview', error as Error, {
        ...logContext,
        metadata: { action: params.action }
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate calendar preview'
      };
    }
  }

  /**
   * Get system prompt for AI planning
   */
  protected getSystemPrompt(): string {
    return `# Calendar Agent - Intelligent Scheduling Management
You are a specialized calendar and scheduling management agent powered by Google Calendar API.

## Core Personality
- Professional yet approachable tone for scheduling interactions
- Proactive in suggesting optimal meeting times and scheduling strategies
- Respectful of attendees' time and availability constraints
- Context-aware for meeting purposes and participant relationships
- Helpful but not overwhelming with scheduling suggestions
- Empathetic when handling scheduling conflicts or availability issues

## Capabilities
- Create, update, and manage calendar events with intelligent scheduling
- Check availability and find optimal meeting times
- Handle complex scheduling scenarios with multiple attendees
- Manage meeting locations, descriptions, and recurring events
- Provide smart suggestions for meeting optimization
- Handle timezone awareness and scheduling conflicts gracefully

## Scheduling Intelligence & Best Practices
- Always suggest optimal meeting times based on attendee availability
- Consider business hours and timezone differences automatically
- Propose alternative times when conflicts arise
- Suggest appropriate meeting durations based on agenda complexity
- Recommend meeting locations based on attendee locations and preferences
- Handle recurring meetings with intelligent pattern recognition
- Consider meeting buffer times and travel requirements

## Error Handling & User Experience
- Gracefully handle authentication issues with clear, actionable next steps
- Provide helpful suggestions when calendar access is restricted
- Offer practical alternatives when original scheduling strategy won't work
- Explain scheduling conflicts in user-friendly, non-technical language
- Progressive error disclosure: start simple, provide details if requested
- Acknowledge user frustration empathetically and provide reassurance
- Suggest preventive measures to avoid similar scheduling issues

## Response Quality Standards
- Always provide specific, actionable information rather than vague responses
- Include relevant details like event IDs, meeting links, and attendee confirmations
- Proactively suggest next steps or related scheduling actions when appropriate
- Use clear, structured formatting for multiple events or complex scheduling scenarios
- Maintain consistency in tone and helpfulness across all interactions

## Input Processing
You receive structured requests for calendar operations and execute them using Google Calendar API with intelligent scheduling optimization.

## Response Format
Always return structured execution status with event details, scheduling insights, and confirmation. Include relevant scheduling recommendations and alternative options when appropriate.`;
  }

  /**
   * Execute calendar-specific tools during AI planning
   */
  protected async executeCustomTool(toolName: string, parameters: ToolParameters, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    const logContext: LogContext = {
      correlationId: `calendar-tool-${context.sessionId}-${Date.now()}`,
      userId: context.userId,
      sessionId: context.sessionId,
      operation: 'calendar_tool_execution',
      metadata: {
        toolName,
        parametersKeys: Object.keys(parameters)
      }
    };

    logger.debug('Executing calendar tool', logContext);

    logger.debug('Calendar tool execution started with parameters', {
      ...logContext,
      metadata: { parameterKeys: Object.keys(parameters) }
    });
    logger.debug('Calendar tool context information', {
      ...logContext,
      metadata: {
        sessionId: context.sessionId,
        userId: context.userId,
        hasSlackContext: !!context.slackContext
      }
    });

    // Get access token from TokenManager using Slack context
    let accessToken: string | null = null;

    logger.debug('Attempting to retrieve calendar access token', logContext);
    console.log('🔑 CALENDAR AGENT: executeCustomTool - Slack context:', {
      hasSlackContext: !!context.slackContext,
      teamId: context.slackContext?.teamId,
      userId: context.slackContext?.userId,
      hasParamsAccessToken: !!parameters.accessToken
    });

    logger.debug('executeCustomTool: Attempting to retrieve access token', {
      ...logContext,
      metadata: {
        hasSlackContext: !!context.slackContext,
        teamId: context.slackContext?.teamId,
        userId: context.slackContext?.userId,
        hasParamsAccessToken: !!parameters.accessToken
      }
    });

    if (context.slackContext?.teamId && context.slackContext?.userId) {
      console.log('🔑 CALENDAR AGENT: executeCustomTool - Found Slack context, looking up TokenManager');
      const tokenManager = serviceManager.getService<TokenManager>('tokenManager');
      console.log('🔑 CALENDAR AGENT: executeCustomTool - TokenManager lookup result:', {
        hasTokenManager: !!tokenManager,
        isTokenManagerReady: tokenManager?.isReady()
      });

      if (tokenManager) {
        try {
          logger.debug('Getting valid tokens for calendar operation', {
            correlationId: `calendar-agent-tokens-${Date.now()}`,
            operation: 'get_calendar_tokens',
            metadata: {
              teamId: context.slackContext.teamId,
              userId: context.slackContext.userId
            }
          });
          accessToken = await tokenManager.getValidTokensForCalendar(context.slackContext.teamId, context.slackContext.userId);
          logger.debug('Calendar token retrieval completed', {
            correlationId: `calendar-agent-tokens-${Date.now()}`,
            operation: 'calendar_token_result',
            metadata: {
              hasAccessToken: !!accessToken,
              accessTokenLength: accessToken?.length || 0
            }
          });
        } catch (error) {
          logger.error('Error retrieving calendar access token', error as Error, {
            correlationId: `calendar-agent-error-${Date.now()}`,
            operation: 'calendar_token_error'
          });
          logger.error('executeCustomTool: Error retrieving access token', error as Error, {
            ...logContext,
            metadata: {
              teamId: context.slackContext.teamId,
              userId: context.slackContext.userId
            }
          });
        }
      } else {
        console.log('🔑 CALENDAR AGENT: executeCustomTool - TokenManager service not available');
        console.log('🔑 CALENDAR AGENT: executeCustomTool - Available services:', Object.keys((serviceManager as any).services || {}));
      }
    } else {
      console.log('🔑 CALENDAR AGENT: executeCustomTool - Missing Slack context for token retrieval');
      console.log('🔑 CALENDAR AGENT: executeCustomTool - Context details:', {
        hasContext: !!context,
        hasSlackContext: !!context.slackContext,
        contextKeys: context ? Object.keys(context) : []
      });
    }

    // Also check if access token is provided in parameters (for backwards compatibility)
    if (!accessToken && parameters.accessToken) {
      accessToken = parameters.accessToken as string;
      logger.debug('executeCustomTool: Using access token from parameters', {
        ...logContext,
        metadata: { accessTokenLength: accessToken.length }
      });
    }

    if (!accessToken) {
      logger.error('executeCustomTool: No access token available', new Error('No access token'), {
        ...logContext,
        metadata: {
          hasSlackContext: !!context.slackContext,
          hasParamsAccessToken: !!parameters.accessToken
        }
      });
      return {
        success: false,
        error: CALENDAR_SERVICE_CONSTANTS.ERRORS.NO_ACCESS_TOKEN
      };
    }

    // Ensure services are initialized
    this.ensureServices();

    try {
      // Route to appropriate handler based on tool name - Intent-agnostic routing
      // Let OpenAI determine the operation from the parameters
      const operation = (parameters as any).operation;

      logger.debug('Operation detection', {
        ...logContext,
        metadata: {
          toolName,
          operation,
          hasParameters: !!parameters,
          parametersKeys: Object.keys(parameters)
        }
      });

      // If no operation is specified, try to detect from query or parameters
      let detectedOperation = operation;
      if (!detectedOperation && parameters.query) {
        // Use AI-based intent analysis instead of fallback text matching
        throw new Error('Calendar operation detection requires AI intent analysis. Please check your OpenAI configuration.');
      }

      // Default to create if still no operation detected
      if (!detectedOperation) {
        logger.debug('No operation detected, defaulting to create', { ...logContext, metadata: { detectedOperation } });
        detectedOperation = 'create';
      }

      logger.debug('Using operation', {
        ...logContext,
        metadata: {
          originalOperation: operation,
          detectedOperation,
          willExecute: detectedOperation
        }
      });

      if (detectedOperation === CALENDAR_SERVICE_CONSTANTS.CALENDAR_OPERATIONS.CREATE || detectedOperation === 'create') {
        return await this.handleCreateEvent(parameters, context, accessToken);
      } else if (detectedOperation === CALENDAR_SERVICE_CONSTANTS.CALENDAR_OPERATIONS.LIST || detectedOperation === 'list') {
        return await this.handleListEvents(parameters, context, accessToken);
      } else if (detectedOperation === CALENDAR_SERVICE_CONSTANTS.CALENDAR_OPERATIONS.UPDATE || detectedOperation === 'update') {
        return await this.handleUpdateEvent(parameters, context, accessToken);
      } else if (detectedOperation === CALENDAR_SERVICE_CONSTANTS.CALENDAR_OPERATIONS.DELETE || detectedOperation === 'delete') {
        return await this.handleDeleteEvent(parameters, context, accessToken);
      } else if (detectedOperation === CALENDAR_SERVICE_CONSTANTS.CALENDAR_OPERATIONS.CHECK_AVAILABILITY || detectedOperation === 'check_availability') {
        return await this.handleCheckAvailability(parameters, context, accessToken);
      } else if (detectedOperation === CALENDAR_SERVICE_CONSTANTS.CALENDAR_OPERATIONS.FIND_SLOTS || detectedOperation === 'find_slots') {
        return await this.handleFindSlots(parameters, context, accessToken);
      } else {
        logger.warn('Unknown operation, defaulting to create', {
          ...logContext,
          metadata: { detectedOperation }
        });
        return await this.handleCreateEvent(parameters, context, accessToken);
      }
    } catch (error) {
      logger.error('Error executing calendar tool', error as Error, {
        ...logContext,
        metadata: { toolName }
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : CALENDAR_SERVICE_CONSTANTS.ERRORS.UNKNOWN_ERROR
      };
    }
  }

  /**
   * Handle create event operation
   */
  private async handleCreateEvent(parameters: ToolParameters, context: ToolExecutionContext, accessToken: string): Promise<ToolExecutionResult> {
    try {
      // Validate event data
      // Simple internal validation
      const validationResult = this.validateEventData({
        summary: parameters.summary as string,
        description: parameters.description as string,
        start: parameters.start as string,
        end: parameters.end as string,
        attendees: parameters.attendees as string[],
        location: parameters.location as string
      });

      if (!validationResult.isValid) {
        return {
          success: false,
          error: validationResult.errors?.join(', ') || 'Unknown validation error'
        };
      }

      // Create calendar event
      const event: CalendarEvent = {
        summary: parameters.summary as string,
        description: parameters.description as string,
        start: { dateTime: parameters.start as string },
        end: { dateTime: parameters.end as string },
        attendees: (parameters.attendees as string[])?.map(email => ({ email })),
        location: parameters.location as string
      };

      // Check if calendar service is available
      if (!this.calendarService) {
        return {
          success: false,
          error: 'Calendar service not available. Please check your calendar integration setup.'
        };
      }

      const createdEvent = await this.calendarService.createEvent(
        event,
        accessToken,
        (parameters.calendarId as string) || CALENDAR_SERVICE_CONSTANTS.DEFAULTS.DEFAULT_CALENDAR_ID
      );

      // Format the result
      const calendarResult: SimpleCalendarResult = {
        success: true,
        message: `Event created successfully: ${createdEvent?.summary || 'Untitled'}`,
        data: {
          event: createdEvent,
          summary: createdEvent?.summary || undefined,
          start: createdEvent?.start?.dateTime || undefined,
          end: createdEvent?.end?.dateTime || undefined,
          location: createdEvent?.location || undefined,
          attendees: createdEvent?.attendees?.map((att: any) => att.email)
        }
      };

      // Simple formatting now handled directly by CalendarAgent
      const formattingResult = {
        success: calendarResult.success,
        message: calendarResult.message,
        data: calendarResult.data
      };

      return {
        success: true,
        message: calendarResult.message,
        data: calendarResult.data
      };
    } catch (error) {
      logger.error('Error handling create event', error as Error, {
        correlationId: 'calendar-create',
        operation: 'calendar_create',
        metadata: { summary: parameters.summary }
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : CALENDAR_SERVICE_CONSTANTS.ERRORS.EVENT_CREATION_FAILED
      };
    }
  }

  /**
   * Handle list events operation
   */
  private async handleListEvents(parameters: ToolParameters, context: ToolExecutionContext, accessToken: string): Promise<ToolExecutionResult> {
    try {
      // Map parameters from different sources (start_date/end_date from NextStepPlanning, timeMin/timeMax from direct calls)
      const timeMin = parameters.timeMin as string || parameters.start_date as string;
      const timeMax = parameters.timeMax as string || parameters.end_date as string;
      
      // Validate query options
      // Simple internal validation
      const validationResult = this.validateQueryOptions({
        timeMin: timeMin,
        timeMax: timeMax,
        maxResults: parameters.maxResults as number
      });

      if (!validationResult.isValid) {
        return {
          success: false,
          error: validationResult.errors?.join(', ') || 'Unknown validation error'
        };
      }

      // Check if calendar service is available
      if (!this.calendarService) {
        return {
          success: false,
          error: 'Calendar service not available. Please check your calendar integration setup.'
        };
      }

      // List events
      const events = await this.calendarService.getEvents(
        accessToken,
        {
          timeMin: timeMin,
          timeMax: timeMax,
          maxResults: (parameters.maxResults as number) || 10
        },
        (parameters.calendarId as string) || CALENDAR_SERVICE_CONSTANTS.DEFAULTS.DEFAULT_CALENDAR_ID
      );

      // Format the result
      const calendarResult: SimpleCalendarResult = {
        success: true,
        message: `Found ${events.length} events`,
        data: {
          events: events,
          count: events.length
        }
      };

      // Simple formatting now handled directly by CalendarAgent
      const formattingResult = {
        success: calendarResult.success,
        message: calendarResult.message,
        data: calendarResult.data
      };

      return {
        success: true,
        message: calendarResult.message,
        data: calendarResult.data
      };
    } catch (error) {
      logger.error('Error handling list events', error as Error, {
        correlationId: 'calendar-list',
        operation: 'calendar_list',
        metadata: { query: parameters.query }
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : CALENDAR_SERVICE_CONSTANTS.ERRORS.EVENT_LISTING_FAILED
      };
    }
  }

  /**
   * Handle update event operation
   */
  private async handleUpdateEvent(parameters: ToolParameters, context: ToolExecutionContext, accessToken: string): Promise<ToolExecutionResult> {
    try {
      // Validate event ID
      // Simple internal validation
      const eventIdValidation = this.validateEventId(parameters.eventId as string);
      if (!eventIdValidation.isValid) {
        return {
          success: false,
          error: eventIdValidation.errors?.join(', ') || 'Unknown validation error'
        };
      }

      // Validate event data
      // Simple internal validation
      const validationResult = this.validateEventData({
        summary: parameters.summary as string,
        description: parameters.description as string,
        start: parameters.start as string,
        end: parameters.end as string,
        attendees: parameters.attendees as string[],
        location: parameters.location as string
      });

      if (!validationResult.isValid) {
        return {
          success: false,
          error: validationResult.errors?.join(', ') || 'Unknown validation error'
        };
      }

      // Update event
      const eventUpdate: Partial<CalendarEvent> = {
        summary: parameters.summary as string,
        description: parameters.description as string,
        start: { dateTime: parameters.start as string },
        end: { dateTime: parameters.end as string },
        attendees: (parameters.attendees as string[])?.map(email => ({ email })),
        location: parameters.location as string
      };

      // Check if calendar service is available
      if (!this.calendarService) {
        return {
          success: false,
          error: 'Calendar service not available. Please check your calendar integration setup.'
        };
      }

      const updatedEvent = await this.calendarService.updateEvent(
        parameters.eventId as string,
        eventUpdate,
        accessToken,
        (parameters.calendarId as string) || CALENDAR_SERVICE_CONSTANTS.DEFAULTS.DEFAULT_CALENDAR_ID
      );

      // Format the result
      const calendarResult: SimpleCalendarResult = {
        success: true,
        message: `Event updated successfully: ${updatedEvent?.summary || 'Untitled'}`,
        data: {
          event: updatedEvent,
          summary: updatedEvent?.summary || undefined,
          start: updatedEvent?.start?.dateTime || undefined,
          end: updatedEvent?.end?.dateTime || undefined,
          location: updatedEvent?.location || undefined,
          attendees: updatedEvent?.attendees?.map((att: any) => att.email)
        }
      };

      // Simple formatting now handled directly by CalendarAgent
      const formattingResult = {
        success: calendarResult.success,
        message: calendarResult.message,
        data: calendarResult.data
      };

      return {
        success: true,
        message: calendarResult.message,
        data: calendarResult.data
      };
    } catch (error) {
      logger.error('Error handling update event', error as Error, {
        correlationId: 'calendar-update',
        operation: 'calendar_update',
        metadata: { eventId: parameters.eventId }
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : CALENDAR_SERVICE_CONSTANTS.ERRORS.EVENT_UPDATE_FAILED
      };
    }
  }

  /**
   * Handle delete event operation
   */
  private async handleDeleteEvent(parameters: ToolParameters, context: ToolExecutionContext, accessToken: string): Promise<ToolExecutionResult> {
    try {
      // Validate event ID
      // Simple internal validation
      const eventIdValidation = this.validateEventId(parameters.eventId as string);
      if (!eventIdValidation.isValid) {
        return {
          success: false,
          error: eventIdValidation.errors?.join(', ') || 'Unknown validation error'
        };
      }

      // Check if calendar service is available
      if (!this.calendarService) {
        return {
          success: false,
          error: 'Calendar service not available. Please check your calendar integration setup.'
        };
      }

      // Delete event
      await this.calendarService.deleteEvent(
        parameters.eventId as string,
        accessToken,
        (parameters.calendarId as string) || CALENDAR_SERVICE_CONSTANTS.DEFAULTS.DEFAULT_CALENDAR_ID
      );

      return {
        success: true,
        message: CALENDAR_SERVICE_CONSTANTS.SUCCESS.EVENT_DELETED,
        data: {
          eventId: parameters.eventId as string
        }
      };
    } catch (error) {
      logger.error('Error handling delete event', error as Error, {
        correlationId: 'calendar-delete',
        operation: 'calendar_delete',
        metadata: { eventId: parameters.eventId }
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : CALENDAR_SERVICE_CONSTANTS.ERRORS.EVENT_DELETION_FAILED
      };
    }
  }

  /**
   * Handle check availability operation
   */
  private async handleCheckAvailability(parameters: ToolParameters, context: ToolExecutionContext, accessToken: string): Promise<ToolExecutionResult> {
    try {
      // Check if calendar service is available
      if (!this.calendarService) {
        return {
          success: false,
          error: 'Calendar service not available. Please check your calendar integration setup.'
        };
      }

      // Check availability
      const availabilityResult = await this.calendarService.checkAvailability(
        accessToken,
        parameters.startTime as string,
        parameters.endTime as string,
        [(parameters.calendarId as string) || CALENDAR_SERVICE_CONSTANTS.DEFAULTS.DEFAULT_CALENDAR_ID]
      );

      // Format the result
      const calendarResult: SimpleCalendarResult = {
        success: true,
        message: !availabilityResult.busy ? 'Time slot is available' : 'Time slot has conflicts',
        data: {
          isAvailable: !availabilityResult.busy,
          conflictingEvents: availabilityResult.conflicts
        }
      };

      // Simple formatting now handled directly by CalendarAgent
      const formattingResult = {
        success: calendarResult.success,
        message: calendarResult.message,
        data: calendarResult.data
      };

      return {
        success: true,
        message: calendarResult.message,
        data: calendarResult.data
      };
    } catch (error) {
      logger.error('Error handling check availability', error as Error, {
        correlationId: 'calendar-availability',
        operation: 'calendar_availability',
        metadata: { startTime: parameters.startTime, endTime: parameters.endTime }
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : CALENDAR_SERVICE_CONSTANTS.ERRORS.AVAILABILITY_CHECK_FAILED
      };
    }
  }

  /**
   * Handle find slots operation
   */
  private async handleFindSlots(parameters: ToolParameters, context: ToolExecutionContext, accessToken: string): Promise<ToolExecutionResult> {
    try {
      // Check if calendar service is available
      if (!this.calendarService) {
        return {
          success: false,
          error: 'Calendar service not available. Please check your calendar integration setup.'
        };
      }

      // Find available slots
      const availableSlots = await this.calendarService.findAvailableSlots(
        accessToken,
        parameters.startDate as string,
        parameters.endDate as string,
        parameters.durationMinutes as number,
        [(parameters.calendarId as string) || CALENDAR_SERVICE_CONSTANTS.DEFAULTS.DEFAULT_CALENDAR_ID]
      );

      // Format the result
      const calendarResult: SimpleCalendarResult = {
        success: true,
        message: `Found ${availableSlots.length} available time slots`,
        data: {
          availableSlots: availableSlots
        }
      };

      // Simple formatting now handled directly by CalendarAgent
      const formattingResult = {
        success: calendarResult.success,
        message: calendarResult.message,
        data: calendarResult.data
      };

      return {
        success: true,
        message: calendarResult.message,
        data: calendarResult.data
      };
    } catch (error) {
      logger.error('Error handling find slots', error as Error, {
        correlationId: 'calendar-find-slots',
        operation: 'calendar_find_slots',
        metadata: { startTime: parameters.startTime, endTime: parameters.endTime }
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : CALENDAR_SERVICE_CONSTANTS.ERRORS.TIME_SLOT_SEARCH_FAILED
      };
    }
  }

  /**
   * Get OpenAI function schema for calendar operations
   */
  static getOpenAIFunctionSchema(): any {
    return {
      name: 'calendarAgent',
      description: 'Comprehensive calendar management using Google Calendar API. Create events, check availability, find time slots, list events, update and delete events. Let OpenAI determine the operation from natural language.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The calendar request in natural language. Examples: "Create a meeting with John tomorrow at 2pm", "What\'s on my calendar today?", "Check if I\'m free Friday afternoon", "Find 30-minute slots next week", "Update the meeting time", "Cancel the 3pm meeting"'
          },
          operation: {
            type: 'string',
            description: 'The type of calendar operation to perform - determined by OpenAI from the query',
            enum: Object.values(CALENDAR_SERVICE_CONSTANTS.CALENDAR_OPERATIONS)
          },
          summary: {
            type: 'string',
            description: 'Event title/summary'
          },
          description: {
            type: 'string',
            description: 'Event description/details'
          },
          start: {
            type: 'string',
            description: 'Event start time (ISO 8601 format)'
          },
          end: {
            type: 'string',
            description: 'Event end time (ISO 8601 format)'
          },
          attendees: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of attendee email addresses'
          },
          location: {
            type: 'string',
            description: 'Event location'
          },
          eventId: {
            type: 'string',
            description: 'ID of the event (for update/delete operations)'
          },
          timeMin: {
            type: 'string',
            description: 'Start of time range for listing events (ISO 8601 format)'
          },
          timeMax: {
            type: 'string',
            description: 'End of time range for listing events (ISO 8601 format)'
          },
          maxResults: {
            type: 'number',
            description: 'Maximum number of events to return'
          },
          startTime: {
            type: 'string',
            description: 'Start time to check availability (ISO 8601 format)'
          },
          endTime: {
            type: 'string',
            description: 'End time to check availability (ISO 8601 format)'
          },
          startDate: {
            type: 'string',
            description: 'Start of date range for finding slots (ISO 8601 format)'
          },
          endDate: {
            type: 'string',
            description: 'End of date range for finding slots (ISO 8601 format)'
          },
          durationMinutes: {
            type: 'number',
            description: 'Duration of desired time slots in minutes'
          },
          calendarId: {
            type: 'string',
            description: 'Calendar ID (defaults to primary)'
          }
        },
        required: ['query']
      }
    };
  }

  /**
   * Build final result from tool execution results
   */
  protected buildFinalResult(
    summary: AgentExecutionSummary,
    successfulResults: ToolExecutionResult[],
    failedResults: ToolExecutionResult[],
    params: CalendarAgentRequest,
    context: ToolExecutionContext
  ): CalendarAgentResponse {
    if (successfulResults.length === 0) {
      return {
        success: false,
        message: 'No operations completed successfully',
        error: failedResults[0]?.error || 'Unknown error'
      };
    }

    // Get the first successful result
    const firstResult = successfulResults[0];
    if (!firstResult) {
      return {
        success: false,
        message: 'No successful results found',
        error: 'Unknown error'
      };
    }

    const data = firstResult.data as any;

    return {
      success: true,
      message: data.message || '📅💖 Yay! Calendar operation completed successfully! Your schedule is looking amazing! ✨',
      event: data.event,
      events: data.events,
      count: data.count,
      isAvailable: data.isAvailable,
      conflictingEvents: data.conflictingEvents,
      availableSlots: data.availableSlots
    };
  }

  /**
   * Get agent capabilities
   */
  static getCapabilities(): string[] {
    return [
      'Create calendar events with attendees and details',
      'List upcoming calendar events',
      'Update existing calendar events',
      'Delete calendar events',
      'Check calendar availability',
      'Find free time slots for meetings',
      'Handle recurring events',
      'Manage event reminders and notifications'
    ];
  }

  /**
   * Get agent limitations
   */
  static getLimitations(): string[] {
    return [
      'Cannot access calendars without proper OAuth permissions',
      'Cannot modify events created by others without permission',
      'Limited to Google Calendar API rate limits',
      'Cannot access private calendar data without user consent'
    ];
  }

  /**
   * Simple internal validation methods (replacing removed validator service)
   */
  private validateEventData(data: any): { isValid: boolean; errors?: string[] } {
    const errors: string[] = [];
    if (!data.summary || data.summary.trim().length === 0) {
      errors.push('Event summary is required');
    }
    if (data.start && !this.isIsoDateTime(data.start)) {
      errors.push('Start time must be ISO 8601 datetime');
    }
    if (data.end && !this.isIsoDateTime(data.end)) {
      errors.push('End time must be ISO 8601 datetime');
    }
    if (data.start && data.end && new Date(data.start).getTime() >= new Date(data.end).getTime()) {
      errors.push('End time must be after start time');
    }
    if (Array.isArray(data.attendees) && data.attendees.length > 100) {
      errors.push('Too many attendees (max 100)');
    }
    return { isValid: errors.length === 0, errors };
  }

  private validateQueryOptions(options: any): { isValid: boolean; errors?: string[] } {
    const errors: string[] = [];
    if (options.timeMin && !this.isIsoDateTime(options.timeMin)) {
      errors.push('timeMin must be ISO 8601 datetime');
    }
    if (options.timeMax && !this.isIsoDateTime(options.timeMax)) {
      errors.push('timeMax must be ISO 8601 datetime');
    }
    if (options.timeMin && options.timeMax && new Date(options.timeMin).getTime() > new Date(options.timeMax).getTime()) {
      errors.push('timeMin must be before or equal to timeMax');
    }
    if (options.maxResults && (typeof options.maxResults !== 'number' || options.maxResults <= 0)) {
      errors.push('maxResults must be a positive number');
    }
    return { isValid: errors.length === 0, errors };
  }

  private validateEventId(eventId: string): { isValid: boolean; errors?: string[] } {
    const errors: string[] = [];
    if (!eventId || eventId.trim().length === 0) {
      errors.push('Event ID is required');
    }
    return { isValid: errors.length === 0, errors };
  }

  private isIsoDateTime(value: string): boolean {
    if (typeof value !== 'string') return false;
    // Basic ISO 8601 validation using Date
    const d = new Date(value);
    return !isNaN(d.getTime()) && /\d{4}-\d{2}-\d{2}T/.test(value);
  }


  // ========================================
  // NATURAL LANGUAGE PROCESSING CAPABILITIES
  // ========================================

  /**
   * Process natural language requests with contextual responses
   * This is the new natural language interface for agent communication
   */
  async processNaturalLanguageRequest(
    request: string,
    context: AgentExecutionContext
  ): Promise<NaturalLanguageResponse> {
    const logContext: LogContext = {
      correlationId: context.correlationId,
      userId: context.userId,
      sessionId: context.sessionId,
      operation: 'natural_language_processing',
      metadata: { request: request.substring(0, 100) }
    };

    try {
      logger.info('Processing natural language calendar request', logContext);

      // AI-powered intent analysis for calendar operations
      const intent = await this.analyzeCalendarIntent(request);

      logger.debug('Calendar intent analyzed', {
        ...logContext,
        metadata: { ...logContext.metadata, intent }
      });

      // Execute operation based on intent using internal execution to avoid recursion
      const toolResult = await this.executeInternalOperation(intent.operation, {
        ...intent.parameters,
        accessToken: context.accessToken
      }, {
        sessionId: context.sessionId,
        userId: context.userId,
        timestamp: context.timestamp,
        metadata: {
          correlationId: context.correlationId,
          toolName: 'calendarAgent',
          naturalLanguageRequest: true
        }
      });

      // Extract the result data from ToolResult
      const result: CalendarAgentResponse = {
        success: toolResult.success,
        message: toolResult.result?.message || (toolResult.success ? 'Operation completed' : 'Operation failed'),
        event: toolResult.result?.data?.event,
        events: toolResult.result?.data?.events,
        count: toolResult.result?.data?.count || toolResult.result?.data?.events?.length,
        isAvailable: toolResult.result?.data?.isAvailable,
        conflictingEvents: toolResult.result?.data?.conflictingEvents,
        availableSlots: toolResult.result?.data?.availableSlots,
        error: toolResult.error
      };

      // Generate contextual natural language response
      const naturalResponse = await this.generateContextualResponse(request, result, intent);

      // Create the natural language response
      const nlResponse: NaturalLanguageResponse = {
        response: naturalResponse,
        reasoning: `Analyzed request and detected ${intent.operation} operation. ${intent.reasoning || 'Executed successfully.'}`,
        metadata: {
          operation: intent.operation,
          resultsCount: result.count || (result.events?.length) || (result.event ? 1 : 0),
          confidence: intent.confidence || 0.8,
          parameters: intent.parameters
        }
      };

      // Log agent communication using natural language logger
      const { naturalLanguageLogger } = await import('../utils/natural-language-logger');
      naturalLanguageLogger.logAgentCommunication(
        'calendarAgent',
        request,
        nlResponse,
        {
          correlationId: context.correlationId,
          sessionId: context.sessionId,
          userId: context.userId,
          operation: 'agent_communication'
        }
      );

      return nlResponse;

    } catch (error) {
      logger.error('Natural language calendar processing failed', error as Error, logContext);

      return {
        response: `I encountered an issue processing your calendar request: ${(error as Error).message}. Please try rephrasing your request or check if you have the necessary permissions.`,
        reasoning: `Failed to process request due to: ${(error as Error).message}`,
        metadata: {
          operation: 'error',
          error: (error as Error).message
        }
      };
    }
  }

  /**
   * AI-powered intent analysis for calendar operations
   */
  private async analyzeCalendarIntent(request: string): Promise<{
    operation: 'create' | 'list' | 'update' | 'delete' | 'check_availability' | 'find_slots',
    parameters: any,
    confidence: number,
    reasoning: string
  }> {
    const openaiService = this.getOpenAIService();
    if (!openaiService) {
      throw new Error('AI service unavailable. Calendar intent analysis requires OpenAI service.');
    }

    const prompt = `You are a calendar assistant. Analyze the user's request and choose the appropriate operation.

Choose the operation and extract parameters:

OPERATIONS (choose ONE):
- list: Show calendar events
- create: Make new events
- update: Modify events
- delete: Remove events
- check_availability: Check if free
- find_slots: Find open times

For LIST requests like "show my calendar", "what's on my calendar", "events for next week":
- Operation: "list"
- Parameters: timeframe details

For CREATE requests like "schedule meeting", "book appointment":
- Operation: "create"
- Parameters: event details

IMPORTANT: Always provide a complete JSON response with all 4 fields.

Example for "show my calendar":
{
  "operation": "list",
  "parameters": {"timeMin": "2025-01-01T00:00:00Z", "maxResults": 50},
  "confidence": 0.9,
  "reasoning": "User wants to view calendar events"
}

Return this exact JSON format:
{
  "operation": "list",
  "parameters": {},
  "confidence": 0.9,
  "reasoning": "Brief explanation"
}

Remember: operation must be exactly one of: list, create, update, delete, check_availability, find_slots`;

    try {
      console.log('Calendar Intent Analysis - Sending prompt to AI:', {
        request: request.substring(0, 100),
        promptLength: prompt.length
      });

      const analysis = await openaiService.generateStructuredData(
        request,
        prompt,
        {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              enum: ['create', 'list', 'update', 'delete', 'check_availability', 'find_slots']
            },
            parameters: { type: 'object' },
            confidence: { type: 'number' },
            reasoning: { type: 'string' }
          },
          required: ['operation', 'parameters', 'confidence', 'reasoning']
        },
        {
          temperature: 0.1,
          maxTokens: 800
        }
      ) as {
        operation: string;
        parameters: any;
        confidence: number;
        reasoning: string;
      };

      console.log('Calendar Intent Analysis - AI Response received:', {
        request: request.substring(0, 100),
        hasAnalysis: !!analysis,
        analysisKeys: analysis ? Object.keys(analysis) : []
      });

      // Validate the analysis
      const validOperations = ['create', 'list', 'update', 'delete', 'check_availability', 'find_slots'];

      // Log the raw AI response for debugging
      console.log('Calendar AI Analysis Result:', {
        request: request.substring(0, 100),
        analysis,
        analysisType: typeof analysis,
        operationType: typeof analysis?.operation,
        operationValue: analysis?.operation,
        analysisKeys: analysis ? Object.keys(analysis) : 'null/undefined'
      });

      if (!analysis || typeof analysis !== 'object') {
        throw new Error(`AI returned invalid response format: ${typeof analysis}`);
      }

      // Check if AI returned empty object
      if (Object.keys(analysis).length === 0) {
        throw new Error('AI returned empty object - likely a prompt parsing issue');
      }

      if (!analysis.operation || !validOperations.includes(analysis.operation)) {
        console.error('Calendar intent analysis validation failed:', {
          request,
          receivedOperation: analysis.operation,
          validOperations,
          fullAnalysis: analysis,
          analysisKeys: Object.keys(analysis)
        });
        throw new Error(`Invalid operation detected: "${analysis.operation}". Valid operations: ${validOperations.join(', ')}`);
      }

      return {
        operation: analysis.operation as 'create' | 'list' | 'update' | 'delete' | 'check_availability' | 'find_slots',
        parameters: analysis.parameters || {},
        confidence: Math.min(Math.max(analysis.confidence || 0.7, 0), 1),
        reasoning: analysis.reasoning || 'AI analysis completed'
      };

    } catch (error) {
      logger.error('AI intent analysis failed - no fallback available in pure NL system', error as Error, {
        correlationId: `calendar-intent-error-${Date.now()}`,
        operation: 'intent_analysis_error',
        metadata: { request: request.substring(0, 100) }
      });

      // In a pure natural language system, we must rely on AI
      // If AI fails, we cannot process the request properly
      throw new Error(`AI intent analysis failed and no text-based fallback allowed in pure natural language system: ${(error as Error).message}`);
    }
  }

  /**
   * Generate contextual natural language response based on the original request and results
   */
  private async generateContextualResponse(
    originalRequest: string,
    result: CalendarAgentResponse,
    intent: any
  ): Promise<string> {
    const openaiService = this.getOpenAIService();

    if (!openaiService) {
      // Fallback response generation
      return this.generateFallbackResponse(result, intent.operation);
    }

    const prompt = `The user asked: "${originalRequest}"

I detected this was a ${intent.operation} operation and here's what happened:

OPERATION RESULT:
${JSON.stringify({
  success: result.success,
  message: result.message,
  eventsCount: result.events?.length || (result.event ? 1 : 0),
  events: result.events?.slice(0, 5)?.map(e => ({
    summary: e.summary,
    start: e.start?.dateTime || e.start?.date,
    end: e.end?.dateTime || e.end?.date,
    location: e.location
  })) || (result.event ? [{
    summary: result.event.summary,
    start: result.event.start?.dateTime || result.event.start?.date,
    end: result.event.end?.dateTime || result.event.end?.date,
    location: result.event.location
  }] : []),
  isAvailable: result.isAvailable,
  availableSlots: result.availableSlots?.slice(0, 3),
  error: result.error
}, null, 2)}

Generate a natural, conversational response that:
1. Directly addresses what the user asked
2. Summarizes what was accomplished
3. Includes relevant details (times, titles, locations) but not technical IDs
4. Uses a helpful, friendly tone
5. If there are multiple events, format them clearly
6. If something went wrong, explain it helpfully

Keep the response focused and informative. Don't use markdown formatting.`;

    try {
      const response = await openaiService.generateText(
        prompt,
        'Generate contextual responses for calendar operations',
        { temperature: 0.7, maxTokens: 600 }
      );

      return response.trim();

    } catch (error) {
      logger.error('AI response generation failed - no fallback available', error as Error, {
        correlationId: `calendar-response-error-${Date.now()}`,
        operation: 'response_generation_error'
      });

      throw error;
    }
  }

  /**
   * Fallback response generation when AI services are unavailable
   */
  private generateFallbackResponse(result: CalendarAgentResponse, operation: string): string {
    if (!result.success) {
      return `I had trouble with your calendar request: ${result.error || result.message}`;
    }

    switch (operation) {
      case 'create':
        return result.event
          ? `I've created your calendar event "${result.event.summary}" successfully.`
          : 'I\'ve created your calendar event successfully.';

      case 'list':
        if (result.events && result.events.length > 0) {
          const eventsList = result.events.slice(0, 5).map(e =>
            `• ${e.summary}${e.start?.dateTime ? ` at ${new Date(e.start.dateTime).toLocaleString()}` : ''}`
          ).join('\n');
          return `I found ${result.count || result.events.length} events:\n${eventsList}${result.events.length > 5 ? '\n...and more' : ''}`;
        } else {
          return 'I didn\'t find any calendar events matching your request.';
        }

      case 'update':
        return result.event
          ? `I've updated the calendar event "${result.event.summary}" successfully.`
          : 'I\'ve updated your calendar event successfully.';

      case 'delete':
        return 'I\'ve deleted the calendar event successfully.';

      case 'check_availability':
        return result.isAvailable
          ? 'That time slot appears to be available.'
          : `That time slot has conflicts. ${result.conflictingEvents?.length || 0} conflicting events found.`;

      case 'find_slots':
        if (result.availableSlots && result.availableSlots.length > 0) {
          return `I found ${result.availableSlots.length} available time slots.`;
        } else {
          return 'I couldn\'t find any available time slots in that range.';
        }

      default:
        return result.message || 'Calendar operation completed successfully.';
    }
  }

  /**
   * Execute operation internally without going through main execute method
   * This prevents recursion when called from processNaturalLanguageRequest
   */
  private async executeInternalOperation(
    operation: string,
    parameters: any,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      let result: ToolExecutionResult;

      // Call the appropriate internal handler based on operation
      switch (operation) {
        case 'create':
          result = await this.handleCreateEvent(parameters, context, parameters.accessToken);
          break;
        case 'list':
          result = await this.handleListEvents(parameters, context, parameters.accessToken);
          break;
        case 'update':
          result = await this.handleUpdateEvent(parameters, context, parameters.accessToken);
          break;
        case 'delete':
          result = await this.handleDeleteEvent(parameters, context, parameters.accessToken);
          break;
        case 'check_availability':
          result = await this.handleCheckAvailability(parameters, context, parameters.accessToken);
          break;
        case 'find_slots':
          result = await this.handleFindSlots(parameters, context, parameters.accessToken);
          break;
        default:
          throw new Error(`Unsupported calendar operation: ${operation}`);
      }

      // Convert ToolExecutionResult to ToolResult format
      return {
        toolName: 'calendarAgent',
        success: result.success,
        result: result,
        error: result.error,
        executionTime: 0 // Will be calculated by caller if needed
      };

    } catch (error) {
      return {
        toolName: 'calendarAgent',
        success: false,
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: 0
      };
    }
  }

  // ============================================================================
  // NATURAL LANGUAGE TEMPLATE IMPLEMENTATION
  // ============================================================================

  /**
   * Get agent capability description for MasterAgent
   */
  getCapabilityDescription(): AgentCapabilities {
    return {
      name: 'Calendar Expert',
      description: 'Manages calendar events, scheduling, and availability checking using Google Calendar',
      capabilities: [
        'Create calendar events',
        'List upcoming events',
        'Check availability',
        'Find meeting slots',
        'Update existing events',
        'Delete events',
        'Schedule meetings',
        'Manage appointments'
      ],
      limitations: [
        'Requires Google Calendar access and authentication',
        'Cannot access external calendars without proper permissions',
        'Limited to Google Calendar platform only'
      ],
      examples: [
        'Schedule a meeting tomorrow at 2pm',
        'What meetings do I have today?',
        'Check if I\'m free Friday afternoon',
        'Cancel my 3pm meeting',
        'Create a dentist appointment next week',
        'Show me my calendar for tomorrow',
        'Find a free slot for a 1-hour meeting this week',
        'Update my team meeting to 4pm'
      ],
      domains: ['calendar', 'scheduling', 'meetings', 'appointments', 'events'],
      requirements: ['Google OAuth authentication', 'Calendar read/write permissions']
    };
  }

  /**
   * Analyze natural language intent for calendar domain
   */
  protected async analyzeIntent(request: string, context: AgentExecutionContext): Promise<AgentIntent> {
    // Use existing analyzeCalendarIntent method
    const analysis = await this.analyzeCalendarIntent(request);

    return {
      operation: analysis.operation,
      parameters: analysis.parameters,
      confidence: analysis.confidence,
      reasoning: analysis.reasoning,
      toolsUsed: [analysis.operation]
    };
  }

  /**
   * Execute the tool selected by intent analysis
   */
  protected async executeSelectedTool(intent: AgentIntent, context: AgentExecutionContext): Promise<ToolResult> {
    // Convert AgentExecutionContext to ToolExecutionContext and use existing method
    const toolContext: ToolExecutionContext = {
      sessionId: context.sessionId,
      userId: context.userId,
      timestamp: context.timestamp,
      metadata: context.metadata
    };

    // Use existing executeInternalOperation method
    return await this.executeInternalOperation(intent.operation, {
      ...intent.parameters,
      accessToken: context.accessToken
    }, toolContext);
  }

  /**
   * Generate natural language response from tool execution result
   */
  protected async generateResponse(
    request: string,
    result: ToolResult,
    intent: AgentIntent,
    context: AgentExecutionContext
  ): Promise<string> {
    // Use existing generateContextualResponse method
    const calendarResult: CalendarAgentResponse = {
      success: result.success,
      message: result.result?.message || (result.success ? 'Operation completed' : 'Operation failed'),
      event: result.result?.data?.event,
      events: result.result?.data?.events,
      count: result.result?.data?.count || result.result?.data?.events?.length,
      isAvailable: result.result?.data?.isAvailable,
      conflictingEvents: result.result?.data?.conflictingEvents,
      availableSlots: result.result?.data?.availableSlots,
      error: result.error
    };

    return await this.generateContextualResponse(request, calendarResult, {
      operation: intent.operation,
      parameters: intent.parameters,
      confidence: intent.confidence,
      reasoning: intent.reasoning
    });
  }
}
