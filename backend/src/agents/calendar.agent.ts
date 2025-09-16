import { ToolExecutionContext } from '../types/tools';
import { AIAgent } from '../framework/ai-agent';
import { ActionPreview, PreviewGenerationResult, CalendarPreviewData, ActionRiskAssessment } from '../types/api.types';
import { CalendarService, CalendarEvent } from '../services/calendar.service';
import { getService } from '../services/service-manager';
import { TokenManager } from '../services/token-manager';
import { APP_CONSTANTS } from '../config/constants';
import {
  ToolParameters,
  ToolExecutionResult,
  AgentExecutionSummary
} from '../types/agent-parameters';
import {
  CreateEventActionParams,
  CalendarEventResult,
  ListEventsActionParams
} from '../types/agent-specific-parameters';

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
  data?: {
    events?: CalendarEvent[] | undefined;
    event?: CalendarEvent | undefined;
    availability?: {
      busy: boolean;
      conflicts: CalendarEvent[];
    } | undefined;
    slots?: Array<{ start: string; end: string }> | undefined;
  } | undefined;
  error?: string | undefined;
  needsReauth?: boolean | undefined;
  reauth_reason?: string;
}

/**
 * Calendar Agent - Manages calendar events and scheduling
 * Integrates with Google Calendar API for comprehensive calendar management with AI planning
 */
export class CalendarAgent extends AIAgent<CalendarAgentRequest, CalendarAgentResponse> {
  
  constructor() {
    super({
      name: 'calendarAgent',
      description: 'Create, update, and manage calendar events and scheduling',
      enabled: true,
      timeout: 30000,
      retryCount: 2,
      aiPlanning: {
        enableAIPlanning: true, // Enable AI planning for complex calendar operations
        maxPlanningSteps: 8,
        planningTimeout: 25000,
        cachePlans: true,
        planningTemperature: 0.1,
        planningMaxTokens: 2000
      }
    });

    // Register calendar-specific tools for AI planning
    this.registerCalendarTools();
  }

  /**
   * Register calendar-specific tools for AI planning
   */
  private registerCalendarTools(): void {
    // Primary calendar event creation tool
    this.registerTool({
      name: 'create_calendar_event',
      description: 'Create a new calendar event with specified details including attendees and location',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Event title or summary' },
          description: { type: 'string', description: 'Event description' },
          start: { type: 'string', description: 'Event start time in ISO format' },
          end: { type: 'string', description: 'Event end time in ISO format' },
          attendees: { type: 'array', items: { type: 'string' }, description: 'List of attendee email addresses' },
          location: { type: 'string', description: 'Event location' },
          calendarId: { type: 'string', description: 'Calendar ID (defaults to primary)' }
        },
        required: ['summary', 'start', 'end']
      },
      capabilities: ['Event creation', 'Attendee management', 'Location setting'],
      examples: [
        'Create a meeting with John at 2pm tomorrow',
        'Schedule team standup for Monday morning'
      ],
      estimatedExecutionTime: 5000,
      requiresConfirmation: true
    });

    // Calendar event listing tool
    this.registerTool({
      name: 'list_calendar_events',
      description: 'List calendar events within a specified time range',
      parameters: {
        type: 'object',
        properties: {
          timeMin: { type: 'string', description: 'Start time for listing events (ISO format)' },
          timeMax: { type: 'string', description: 'End time for listing events (ISO format)' },
          maxResults: { type: 'number', description: 'Maximum number of events to return' },
          calendarId: { type: 'string', description: 'Calendar ID (defaults to primary)' }
        }
      },
      capabilities: ['Event listing', 'Time range filtering'],
      examples: [
        'Show my events for today',
        'List next week\'s meetings'
      ],
      estimatedExecutionTime: 3000,
      requiresConfirmation: false
    });

    // Calendar event update tool
    this.registerTool({
      name: 'update_calendar_event',
      description: 'Update an existing calendar event',
      parameters: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'Event ID to update' },
          summary: { type: 'string', description: 'New event title' },
          description: { type: 'string', description: 'New event description' },
          start: { type: 'string', description: 'New start time (ISO format)' },
          end: { type: 'string', description: 'New end time (ISO format)' },
          attendees: { type: 'array', items: { type: 'string' }, description: 'New attendee list' },
          location: { type: 'string', description: 'New event location' },
          calendarId: { type: 'string', description: 'Calendar ID (defaults to primary)' }
        },
        required: ['eventId']
      },
      capabilities: ['Event modification', 'Attendee updates'],
      examples: [
        'Move the 3pm meeting to 4pm',
        'Add Sarah to the team meeting'
      ],
      estimatedExecutionTime: 4000,
      requiresConfirmation: true
    });

    // Calendar event deletion tool
    this.registerTool({
      name: 'delete_calendar_event',
      description: 'Delete a calendar event permanently',
      parameters: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'Event ID to delete' },
          calendarId: { type: 'string', description: 'Calendar ID (defaults to primary)' }
        },
        required: ['eventId']
      },
      capabilities: ['Event deletion'],
      examples: [
        'Cancel the 2pm meeting',
        'Delete tomorrow\'s standup'
      ],
      estimatedExecutionTime: 2000,
      requiresConfirmation: true
    });

    // Availability checking tool
    this.registerTool({
      name: 'check_availability',
      description: 'Check if a user is available during a specific time slot',
      parameters: {
        type: 'object',
        properties: {
          start: { type: 'string', description: 'Start time to check (ISO format)' },
          end: { type: 'string', description: 'End time to check (ISO format)' },
          calendarIds: { type: 'array', items: { type: 'string' }, description: 'Calendar IDs to check (defaults to primary)' }
        },
        required: ['start', 'end']
      },
      capabilities: ['Availability checking', 'Conflict detection'],
      examples: [
        'Am I free Thursday at 2pm?',
        'Check if I have conflicts next Monday morning'
      ],
      estimatedExecutionTime: 3000,
      requiresConfirmation: false
    });

    // Available time slot finding tool
    this.registerTool({
      name: 'find_time_slots',
      description: 'Find available time slots for meeting scheduling',
      parameters: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'Start of search range (ISO format)' },
          endDate: { type: 'string', description: 'End of search range (ISO format)' },
          duration: { type: 'number', description: 'Duration in minutes' },
          calendarIds: { type: 'array', items: { type: 'string' }, description: 'Calendar IDs to consider (defaults to primary)' }
        },
        required: ['startDate', 'endDate', 'duration']
      },
      capabilities: ['Time slot discovery', 'Meeting scheduling optimization'],
      examples: [
        'Find a 1-hour slot next week for team meeting',
        'When can I schedule a 30-minute call this week?'
      ],
      estimatedExecutionTime: 4000,
      requiresConfirmation: false
    });

    // General calendar agent tool (for backward compatibility)
    this.registerTool({
      name: 'calendarAgent',
      description: 'General calendar operations agent for creating, updating, and managing calendar events',
      parameters: {
        type: 'object',
        properties: {
          action: { 
            type: 'string', 
            enum: ['create', 'list', 'update', 'delete', 'check_availability', 'find_slots'],
            description: 'Calendar action to perform'
          },
          summary: { type: 'string', description: 'Event title for create/update actions' },
          description: { type: 'string', description: 'Event description' },
          start: { type: 'string', description: 'Event start time (ISO format)' },
          end: { type: 'string', description: 'Event end time (ISO format)' },
          attendees: { type: 'array', items: { type: 'string' }, description: 'Attendee email addresses' },
          location: { type: 'string', description: 'Event location' },
          eventId: { type: 'string', description: 'Event ID for update/delete actions' },
          duration: { type: 'number', description: 'Duration in minutes for find_slots' },
          calendarId: { type: 'string', description: 'Calendar ID (optional)' }
        },
        required: ['action']
      },
      capabilities: ['All calendar operations', 'Intelligent action routing'],
      examples: [
        'Schedule a meeting with the team',
        'Cancel my 3pm appointment'
      ],
      estimatedExecutionTime: 5000,
      requiresConfirmation: true
    });
  }

  /**
   * Generate OpenAI function calling schema for this agent
   */
  static getOpenAIFunctionSchema(): any {
    return {
      name: 'manage_calendar',
      description: 'Create, update, delete, and manage calendar events and scheduling. Supports natural language event creation and conflict detection.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The calendar request in natural language (e.g., "Schedule a meeting with John tomorrow at 2pm", "Create event for team standup")'
          },
          action: {
            type: 'string',
            description: 'The calendar action to perform',
            enum: ['create', 'list', 'update', 'delete', 'check_availability', 'find_slots'],
            nullable: true
          },
          summary: {
            type: 'string',
            description: 'Event title or summary',
            nullable: true
          },
          description: {
            type: 'string',
            description: 'Event description',
            nullable: true
          },
          start: {
            type: 'string',
            description: 'Event start time in ISO format',
            nullable: true
          },
          end: {
            type: 'string',
            description: 'Event end time in ISO format',
            nullable: true
          },
          attendees: {
            type: 'array',
            description: 'List of attendee email addresses',
            items: { type: 'string' },
            nullable: true
          },
          location: {
            type: 'string',
            description: 'Event location',
            nullable: true
          },
          eventId: {
            type: 'string',
            description: 'Event ID for updates/deletes',
            nullable: true
          },
          timeMin: {
            type: 'string',
            description: 'Start time for listing events',
            nullable: true
          },
          timeMax: {
            type: 'string',
            description: 'End time for listing events',
            nullable: true
          },
          duration: {
            type: 'number',
            description: 'Duration in minutes for finding available slots',
            nullable: true
          },
          calendarId: {
            type: 'string',
            description: 'Calendar ID (defaults to primary)',
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
      'Create calendar events with natural language',
      'Update existing calendar events',
      'Delete calendar events',
      'List upcoming events',
      'Check availability for time slots',
      'Find available meeting slots',
      'Handle multiple attendees',
      'Detect scheduling conflicts',
      'Support recurring events',
      'Manage event locations and descriptions'
    ];
  }

  /**
   * Get agent specialties for capability-based routing
   */
  static getSpecialties(): string[] {
    return [
      'Calendar event management',
      'Meeting scheduling and coordination',
      'Availability checking and conflict resolution',
      'Multi-attendee event coordination',
      'Recurring event management',
      'Time zone handling and conversion'
    ];
  }

  /**
   * Get agent description for AI routing
   */
  static getDescription(): string {
    return 'Specialized agent for Google Calendar operations including event creation, scheduling, availability checking, and meeting management with intelligent conflict detection.';
  }

  /**
   * Get agent limitations for OpenAI function calling
   */
  static getLimitations(): string[] {
    return [
      'Requires Google Calendar API access token',
      'Limited to Google Calendar accounts',
      'Cannot access calendars from other providers',
      'Event creation requires valid time information',
      'Attendee management depends on calendar permissions',
      'Cannot modify events created by others without permission'
    ];
  }

  private readonly systemPrompt = `# Calendar Agent
You are a specialized calendar agent that handles all calendar and scheduling operations.

## Capabilities
- Create calendar events and meetings with attendees
- Schedule appointments and check availability
- Update and delete existing calendar events
- Search for available time slots
- List upcoming calendar events
- Manage meeting locations and descriptions

## Input Processing
You receive structured requests for calendar operations and execute them using Google Calendar API.

## Response Format
Always return structured execution status with event details and confirmation.`;

  /**
   * Execute calendar-specific tools during AI planning
   */
  protected async executeCustomTool(toolName: string, parameters: ToolParameters, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    this.logger.debug(`Executing calendar tool: ${toolName}`, {
      toolName,
      parametersKeys: Object.keys(parameters),
      sessionId: context.sessionId
    });

    // Get CalendarService from service manager
    const calendarService = getService<CalendarService>('calendarService');
    if (!calendarService) {
      return {
        success: false,
        error: 'Calendar service not available'
      };
    }

    // Check if calendar service is ready
    if (!calendarService.isReady()) {
      return {
        success: false,
        error: `Calendar service not ready - current state: ${calendarService.state}`
      };
    }

    // Ensure we have access token
    if (!parameters.accessToken) {
      this.logger.warn('Calendar operation called without access token', {
        toolName,
        sessionId: context.sessionId,
        hasParameters: !!parameters,
        parametersKeys: Object.keys(parameters || {})
      });

      // Only check for tokens via TokenManager if no access token provided
      const needsAuth = ['create_calendar_event', 'update_calendar_event', 'delete_calendar_event', 'list_calendar_events', 'calendaragent', 'manage_calendar', 'calendarAgent'].includes(toolName.toLowerCase()) || toolName.toLowerCase().includes('calendar');

      if (needsAuth) {
        // Extract team/user info from context for token validation
        const teamId = context.metadata?.teamId || context.sessionId?.split(':')[1];
        const userId = context.metadata?.userId || context.sessionId?.split(':')[2];

        if (!teamId || !userId) {
          return {
            success: false,
            error: 'Unable to identify user for authentication',
            needsReauth: true,
            reauth_reason: 'missing_user_context'
          };
        }

        // Check if user has valid calendar tokens using TokenManager
        const tokenManager = getService<TokenManager>('tokenManager');
        if (tokenManager) {
          try {
            const calendarToken = await tokenManager.getValidTokensForCalendar(teamId, userId);
            if (!calendarToken) {
              // Check specific reason for lack of tokens
              const authStatus = await tokenManager.needsCalendarReauth(teamId, userId);
              return {
                success: false,
                error: 'Calendar authentication required',
                needsReauth: true,
                reauth_reason: authStatus.reason || 'missing_calendar_permissions',
                message: '🔐 Your Google account needs calendar permissions to create events. Please re-authenticate by typing `/assistant auth` in Slack to grant calendar access.'
              };
            }
            // Update parameters with validated token
            parameters.accessToken = calendarToken;
          } catch (error) {
            this.logger.error('Failed to validate calendar tokens', { error, teamId, userId });
            return {
              success: false,
              error: 'Authentication validation failed',
              needsReauth: true,
              reauth_reason: 'token_validation_error'
            };
          }
        }
      }

      if (!parameters.accessToken) {
        return {
          success: false,
          error: 'Access token required for calendar operations',
          needsReauth: true,
          reauth_reason: 'missing_access_token'
        };
      }
    }

    this.logger.debug('Calendar tool execution starting', {
      toolName,
      hasAccessToken: !!parameters.accessToken,
      action: parameters.action,
      sessionId: context.sessionId
    });

    try {
      // Handle specific calendar tools
      switch (toolName.toLowerCase()) {
        case 'create_calendar_event':
          this.logger.debug('Routing to handleCreateEvent');
          const createResult = await this.handleCreateEvent(parameters as CreateEventActionParams, calendarService);
          return { success: createResult.success, result: createResult, error: createResult.error };

        case 'list_calendar_events':
          this.logger.debug('Routing to handleListEvents');
          const listResult = await this.handleListEvents(parameters, calendarService);
          return { success: listResult.success, result: listResult, error: listResult.error };

        case 'update_calendar_event':
          this.logger.debug('Routing to handleUpdateEvent');
          const updateResult = await this.handleUpdateEvent(parameters, calendarService);
          return { success: updateResult.success, result: updateResult, error: updateResult.error };

        case 'delete_calendar_event':
          this.logger.debug('Routing to handleDeleteEvent');
          const deleteResult = await this.handleDeleteEvent(parameters, calendarService);
          return { success: deleteResult.success, result: deleteResult, error: deleteResult.error };

        case 'check_availability':
          this.logger.debug('Routing to handleCheckAvailability');
          return await this.handleCheckAvailability(parameters, calendarService);

        case 'find_time_slots':
          this.logger.debug('Routing to handleFindTimeSlots');
          return await this.handleFindTimeSlots(parameters, calendarService);

        case 'calendaragent':
        case 'manage_calendar':
          // General calendar agent tool - route based on action parameter
          this.logger.debug('Routing to handleGeneralCalendarOperation', { action: parameters.action });
          return await this.handleGeneralCalendarOperation(parameters, calendarService);

        default:
          this.logger.warn('Unknown calendar tool, calling parent implementation', { toolName });
          // Call parent implementation for unknown tools
          return super.executeCustomTool(toolName, parameters, context);
      }
    } catch (error) {
      this.logger.error('Calendar tool execution failed', {
        toolName,
        error: error instanceof Error ? error.message : error,
        errorStack: error instanceof Error ? error.stack : undefined,
        sessionId: context.sessionId,
        hasAccessToken: !!parameters.accessToken,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorCode: (error as any).code,
        errorStatus: (error as any).response?.status,
        errorData: (error as any).response?.data
      });

      // Check if this is an auth-related error
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('401') || errorMessage.includes('unauthorized') || errorMessage.includes('invalid_grant')) {
        return {
          success: false,
          error: 'Calendar authentication required',
          needsReauth: true,
          reauth_reason: 'api_auth_error',
          message: '🔐 Your Google account needs calendar permissions to create events. Please re-authenticate by typing `/assistant auth` in Slack to grant calendar access.'
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Calendar tool execution failed'
      };
    }
  }

  /**
   * Enhanced parameter validation for calendar operations
   */
  protected validateParams(params: CalendarAgentRequest): void {
    super.validateParams(params);

    if (!params.accessToken || typeof params.accessToken !== 'string') {
      throw this.createError('Access token is required for calendar operations', 'MISSING_ACCESS_TOKEN');
    }

    if (params.action === 'create' && (!params.summary || !params.start || !params.end)) {
      throw this.createError('Summary, start time, and end time are required to create an event', 'MISSING_REQUIRED_FIELDS');
    }
  }

  /**
   * Check if the current access token has calendar scopes
   */
  private async validateCalendarScopes(accessToken: string): Promise<{ hasScopes: boolean; scopes?: string[] }> {
    try {
      // Call Google's tokeninfo API to get token details including scopes
      const axios = (await import('axios')).default;
      const response = await axios.get(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`);

      if (response.data && response.data.scope) {
        const scopes = response.data.scope.split(' ');
        const hasCalendarScopes = scopes.some((scope: string) =>
          scope.includes('calendar') ||
          scope === 'https://www.googleapis.com/auth/calendar' ||
          scope === 'https://www.googleapis.com/auth/calendar.events'
        );

        return { hasScopes: hasCalendarScopes, scopes };
      }

      return { hasScopes: false };
    } catch (error) {
      this.logger.warn('Failed to validate token scopes', { error: error instanceof Error ? error.message : error });
      return { hasScopes: false };
    }
  }

  /**
   * Create user-friendly error messages for calendar operations
   */
  protected createUserFriendlyErrorMessage(error: Error, params: CalendarAgentRequest): string {
    const errorCode = (error as any).code;

    switch (errorCode) {
      case 'MISSING_ACCESS_TOKEN':
        return 'I need access to your Google Calendar to manage events. Please check your Google authentication settings.';

      case 'MISSING_REQUIRED_FIELDS':
        return 'I need more information to create this calendar event. Please provide the event title, start time, and end time.';

      case 'MISSING_EVENT_ID':
        return 'I need the event ID to update or delete this calendar event. Please specify which event you want to modify.';

      case 'MISSING_TIME_RANGE':
        return 'I need start and end times to check availability. Please specify the time range you want to check.';

      case 'SERVICE_UNAVAILABLE':
        return 'Google Calendar service is temporarily unavailable. Please try again in a few moments.';

      case 'SERVICE_NOT_READY':
        return 'Google Calendar service is still starting up. Please try again in a few moments.';

      case 'INVALID_ACTION':
        return 'I don\'t understand this calendar action. Please try creating, updating, deleting, or listing events.';

      case 'INSUFFICIENT_CALENDAR_PERMISSIONS':
        return '🔐 Your Google account needs additional calendar permissions to create events. Please re-authenticate by typing `/assistant auth` in Slack to grant calendar access.';

      default:
        return super.createUserFriendlyErrorMessage(error, params);
    }
  }

  /**
   * Build final result from AI planning execution
   */
  protected buildFinalResult(
    summary: AgentExecutionSummary,
    successfulResults: ToolExecutionResult[],
    failedResults: ToolExecutionResult[],
    params: CalendarAgentRequest,
    _context: ToolExecutionContext
  ): CalendarAgentResponse {
    // For calendar operations, we typically want the first successful result
    if (successfulResults.length > 0) {
      const firstResult = successfulResults[0];
      if (firstResult && firstResult.result && typeof firstResult.result === 'object') {
        const calendarResult = firstResult.result as CalendarEventResult;
        return {
          success: calendarResult.success,
          message: calendarResult.success ? 'Calendar operation completed successfully' : 'Calendar operation failed',
          data: { events: [] }, // Simplified for now to avoid type conflicts
          error: calendarResult.error
        };
      }
    }

    // If no successful results, create a summary result
    return {
      success: failedResults.length === 0,
      message: failedResults.length > 0 ? 'Some calendar operations failed' : 'Calendar operations completed',
      data: { events: [] }
    };
  }


  /**
   * Generate detailed calendar action preview with conflict detection
   */
  protected async generatePreview(params: CalendarAgentRequest, context: ToolExecutionContext): Promise<PreviewGenerationResult> {
    try {
      const { query } = params;

      // First check authentication before generating preview
      this.logger.debug('Calendar preview generation - checking auth', {
        hasAccessToken: !!params.accessToken,
        sessionId: context.sessionId
      });

      if (!params.accessToken) {
        // Extract team/user info from context for token validation
        const teamId = context.metadata?.teamId || context.sessionId?.split(':')[1];
        const userId = context.metadata?.userId || context.sessionId?.split(':')[2];

        this.logger.debug('No access token in preview, checking TokenManager', {
          teamId,
          userId,
          sessionIdParts: context.sessionId?.split(':')
        });

        if (teamId && userId) {
          // Check if user has valid calendar tokens using TokenManager
          const tokenManager = getService<TokenManager>('tokenManager');
          if (tokenManager) {
            try {
              const calendarToken = await tokenManager.getValidTokensForCalendar(teamId, userId);
              if (!calendarToken) {
                // Check specific reason for lack of tokens
                const authStatus = await tokenManager.needsCalendarReauth(teamId, userId);

                this.logger.info('Calendar preview auth check failed', {
                  teamId,
                  userId,
                  reason: authStatus.reason
                });

                return {
                  success: false,
                  error: 'Calendar authentication required for preview',
                  fallbackMessage: '🔐 Your Google account needs calendar permissions to create events. Please re-authenticate by typing `/assistant auth` in Slack to grant calendar access.',
                  authRequired: true,
                  authReason: authStatus.reason || 'missing_calendar_permissions'
                };
              }
              // Update parameters with validated token for preview generation
              params.accessToken = calendarToken;
              this.logger.debug('Calendar preview auth successful, proceeding with preview');
            } catch (error) {
              this.logger.error('Failed to validate calendar tokens during preview', { error, teamId, userId });
              return {
                success: false,
                error: 'Authentication validation failed',
                fallbackMessage: '🔐 Unable to verify calendar permissions. Please re-authenticate by typing `/assistant auth` in Slack.',
                authRequired: true,
                authReason: 'token_validation_error'
              };
            }
          }
        }

        if (!params.accessToken) {
          this.logger.warn('Calendar preview requires authentication but no tokens available');
          return {
            success: false,
            error: 'Calendar authentication required',
            fallbackMessage: '🔐 Your Google account needs calendar permissions to create events. Please re-authenticate by typing `/assistant auth` in Slack to grant calendar access.',
            authRequired: true,
            authReason: 'missing_access_token'
          };
        }
      }

      // Use AI-powered operation detection from base class
      const operation = await this.detectOperation(params);

      // Check if this operation actually needs confirmation
      const needsConfirmation = this.operationRequiresConfirmation(operation);
      
      if (!needsConfirmation) {
        this.logger.info('Calendar operation does not require confirmation', {
          operation,
          reason: await this.getOperationConfirmationReason(operation)
        });
        return {
          success: true,
          fallbackMessage: `${operation} operation does not require confirmation`
        };
      }
      
      // Generate action ID
      const actionId = `calendar-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      let previewData: CalendarPreviewData;
      let riskAssessment: ActionRiskAssessment;
      let title: string;
      let description: string;
      
      switch (operation) {
        case 'create':
          previewData = await this.generateCreateEventPreview(params);
          riskAssessment = this.assessCalendarRisk(params, previewData);
          title = `Create Event: ${params.summary || 'New Meeting'}`;
          description = `Create calendar event "${params.summary}" on ${this.formatDate(params.start)}`;
          break;
          
        case 'update':
          previewData = await this.generateUpdateEventPreview(params);
          riskAssessment = this.assessCalendarRisk(params, previewData);
          title = `Update Event: ${params.summary || 'Meeting'}`;
          description = `Update calendar event "${params.summary}"`;
          break;
          
        case 'delete':
          previewData = await this.generateDeleteEventPreview(params);
          riskAssessment = { level: 'high', factors: ['Event deletion is irreversible'] };
          title = `Delete Event`;
          description = `Delete calendar event`;
          break;
          
        default:
          // This should not happen since we check needsConfirmation above
          return {
            success: true,
            fallbackMessage: `${operation} operation does not require confirmation`
          };
      }
      
      const preview: ActionPreview = {
        actionId,
        actionType: 'calendar',
        title,
        description,
        riskAssessment,
        estimatedExecutionTime: this.estimateExecutionTime(operation),
        reversible: operation === 'create', // Only creation is somewhat reversible (can be deleted)
        requiresConfirmation: true,
        awaitingConfirmation: true,
        previewData,
        originalQuery: query || `${operation} calendar event`,
        parameters: params as unknown as Record<string, unknown>
      };
      
      this.logger.info('Calendar preview generated', {
        actionId,
        operation,
        eventTitle: params.summary,
        attendeeCount: previewData.attendeeCount || 0,
        riskLevel: riskAssessment.level,
        conflicts: previewData.conflicts?.length || 0
      });
      
      return {
        success: true,
        preview
      };
      
    } catch (error) {
      this.logger.error('Failed to generate calendar preview', {
        error: error instanceof Error ? error.message : error,
        action: params.action,
        sessionId: context.sessionId
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate calendar preview',
        fallbackMessage: `Calendar operation requires confirmation: ${params.action}`
      };
    }
  }

  /**
   * Generate preview data for event creation
   */
  private async generateCreateEventPreview(params: CalendarAgentRequest): Promise<CalendarPreviewData> {
    // Use local times instead of UTC times
    const now = new Date();
    const startTime = params.start || now.toISOString();
    const endTime = params.end || new Date(now.getTime() + 3600000).toISOString(); // Default 1 hour
    
    const conflicts = await this.detectSchedulingConflicts(params);
    const duration = this.calculateDuration(startTime, endTime);
    
    return {
      title: params.summary || 'New Meeting',
      startTime,
      endTime,
      duration,
      attendees: params.attendees,
      location: params.location,
      timeZone: APP_CONSTANTS.DEFAULT_TIMEZONE,
      attendeeCount: params.attendees?.length || 0,
      conflicts: conflicts.length > 0 ? conflicts : undefined
    };
  }

  /**
   * Generate preview data for event update
   */
  private async generateUpdateEventPreview(params: CalendarAgentRequest): Promise<CalendarPreviewData> {
    // For updates, we use the provided data or existing event data
    const startTime = params.start || new Date().toISOString();
    const endTime = params.end || new Date(Date.now() + 3600000).toISOString();
    
    const conflicts = await this.detectSchedulingConflicts(params);
    const duration = this.calculateDuration(startTime, endTime);
    
    return {
      title: params.summary || 'Updated Meeting',
      startTime,
      endTime,
      duration,
      attendees: params.attendees,
      location: params.location,
      timeZone: 'America/Los_Angeles',
      attendeeCount: params.attendees?.length || 0,
      conflicts: conflicts.length > 0 ? conflicts : undefined
    };
  }

  /**
   * Generate preview data for event deletion
   */
  private async generateDeleteEventPreview(params: CalendarAgentRequest): Promise<CalendarPreviewData> {
    return {
      title: 'Event to be deleted',
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      duration: '0 minutes',
      attendeeCount: 0,
      conflicts: [{
        conflictType: 'time_overlap',
        details: 'This action will permanently delete the event',
        severity: 'high'
      }]
    };
  }

  /**
   * Detect potential scheduling conflicts
   */
  private async detectSchedulingConflicts(params: CalendarAgentRequest): Promise<Array<{
    conflictType: 'time_overlap' | 'busy_attendee' | 'resource_conflict';
    details: string;
    severity: 'low' | 'medium' | 'high';
  }>> {
    const conflicts: Array<{
      conflictType: 'time_overlap' | 'busy_attendee' | 'resource_conflict';
      details: string;
      severity: 'low' | 'medium' | 'high';
    }> = [];
    
    // Check for weekend scheduling
    if (params.start) {
      const startDate = new Date(params.start);
      const dayOfWeek = startDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        conflicts.push({
          conflictType: 'time_overlap',
          details: 'Event is scheduled for weekend',
          severity: 'low'
        });
      }
    }
    
    // Check for late hours
    if (params.start) {
      const startDate = new Date(params.start);
      const hour = startDate.getHours();
      if (hour < 8 || hour > 18) {
        conflicts.push({
          conflictType: 'time_overlap',
          details: 'Event is scheduled outside business hours',
          severity: 'medium'
        });
      }
    }
    
    // Check for large attendee list
    if (params.attendees && params.attendees.length > 10) {
      conflicts.push({
        conflictType: 'busy_attendee',
        details: `Large number of attendees (${params.attendees.length})`,
        severity: 'medium'
      });
    }
    
    // Check for missing location for in-person meetings
    if (params.attendees && params.attendees.length > 1 && !params.location) {
      conflicts.push({
        conflictType: 'resource_conflict',
        details: 'No location specified for multi-attendee meeting',
        severity: 'low'
      });
    }
    
    return conflicts;
  }

  /**
   * Assess risk level for calendar operation
   */
  private assessCalendarRisk(params: CalendarAgentRequest, previewData: CalendarPreviewData): ActionRiskAssessment {
    const factors: string[] = [];
    const warnings: string[] = [];
    let level: 'low' | 'medium' | 'high' = 'low';
    
    // Check for conflicts
    if (previewData.conflicts && previewData.conflicts.length > 0) {
      factors.push('Scheduling conflicts detected');
      const highSeverityConflicts = previewData.conflicts.filter(c => c.severity === 'high');
      const mediumSeverityConflicts = previewData.conflicts.filter(c => c.severity === 'medium');
      
      if (highSeverityConflicts.length > 0) {
        level = 'high';
        warnings.push(...highSeverityConflicts.map(c => c.details));
      } else if (mediumSeverityConflicts.length > 0) {
        level = 'medium';
        warnings.push(...mediumSeverityConflicts.map(c => c.details));
      }
    }
    
    // Check attendee count
    if (previewData.attendeeCount && previewData.attendeeCount > 20) {
      factors.push('Large attendee count');
      level = 'high';
      warnings.push(`Event has ${previewData.attendeeCount} attendees`);
    } else if (previewData.attendeeCount && previewData.attendeeCount > 5) {
      factors.push('Multiple attendees');
      if (level === 'low') level = 'medium';
    }
    
    // Check for deletion action
    if (params.action === 'delete') {
      factors.push('Irreversible deletion');
      level = 'high';
      warnings.push('Event deletion cannot be undone');
    }
    
    // Check duration
    const duration = previewData.duration;
    if (duration.includes('hour') && parseInt(duration) > 4) {
      factors.push('Long duration meeting');
      if (level === 'low') level = 'medium';
    }
    
    // If no risk factors, ensure we have at least basic factors
    if (factors.length === 0) {
      factors.push('Standard calendar operation');
    }
    
    return {
      level,
      factors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Calculate duration between two times
   */
  private calculateDuration(startTime: string, endTime: string): string {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end.getTime() - start.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes} minutes`;
    }
    
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    
    if (minutes === 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    }
    
    return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minutes`;
  }

  /**
   * Format date for display
   */
  private formatDate(dateString?: string): string {
    if (!dateString) return 'unspecified time';
    
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  }

  /**
   * Estimate execution time for different operations
   */
  private estimateExecutionTime(action: string): string {
    switch (action) {
      case 'create':
        return '3-7 seconds';
      case 'update':
        return '2-5 seconds';
      case 'delete':
        return '1-3 seconds';
      default:
        return '1-5 seconds';
    }
  }

  /**
   * Create a new calendar event
   */
  private async createEvent(
    parameters: CalendarAgentRequest
  ): Promise<CalendarAgentResponse> {
    const calendarService = getService<CalendarService>('calendarService');
    if (!calendarService) {
      throw this.createError('Calendar service not available', 'SERVICE_UNAVAILABLE');
    }
    if (!calendarService.isReady()) {
      throw this.createError(`Calendar service not ready - current state: ${calendarService.state}`, 'SERVICE_NOT_READY');
    }
    if (!parameters.summary || !parameters.start || !parameters.end) {
      throw this.createError('Summary, start time, and end time are required to create an event', 'MISSING_REQUIRED_FIELDS');
    }

    // Check if the access token has calendar scopes
    const scopeValidation = await this.validateCalendarScopes(parameters.accessToken);
    if (!scopeValidation.hasScopes) {
      this.logger.warn('Calendar operation attempted with insufficient scopes', {
        hasScopes: scopeValidation.hasScopes,
        scopes: scopeValidation.scopes,
        action: 'create_event'
      });
      return {
        success: false,
        error: 'Calendar authentication required',
        needsReauth: true,
        reauth_reason: 'missing_calendar_scopes',
        message: '🔐 Your Google account needs calendar permissions to create events. Please re-authenticate by typing `/assistant auth` in Slack to grant calendar access.'
      };
    }

    this.logger.debug('Creating calendar event with parameters', {
      summary: parameters.summary,
      start: parameters.start,
      end: parameters.end,
      description: parameters.description,
      location: parameters.location,
      attendees: parameters.attendees
    });

    // Simple fix: Use the times as-is but ensure proper timezone handling
    // The Google Calendar API will interpret the times in the specified timezone
    const calendarEvent: CalendarEvent = {
      summary: parameters.summary,
      description: parameters.description,
      start: {
        dateTime: parameters.start.replace('Z', ''), // Remove Z suffix for local time
        timeZone: 'America/Los_Angeles'
      },
      end: {
        dateTime: parameters.end.replace('Z', ''), // Remove Z suffix for local time
        timeZone: 'America/Los_Angeles'
      },
      location: parameters.location
    };

    // Add attendees if provided and valid
    if (parameters.attendees && parameters.attendees.length > 0) {
      // Filter out invalid email addresses
      const validAttendees = parameters.attendees.filter(email => {
        if (!email || typeof email !== 'string') return false;
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email.trim());
      });

      if (validAttendees.length > 0) {
        calendarEvent.attendees = validAttendees.map(email => ({
          email: email.trim(),
          responseStatus: 'needsAction'
        }));
      }
    }

    try {
      const event = await calendarService.createEvent(
        calendarEvent, 
        parameters.accessToken,
        parameters.calendarId
      );

      this.logger.info('Calendar event created successfully', {
        eventId: event.id,
        summary: event.summary,
        start: event.start?.dateTime,
        end: event.end?.dateTime,
        calendarId: parameters.calendarId || 'primary'
      });

      return {
        success: true,
        message: `Event "${parameters.summary}" created successfully`,
        data: { event }
      };
    } catch (error) {
      this.logger.error('Failed to create calendar event', {
        error: error instanceof Error ? error.message : error,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorCode: (error as any).code,
        errorStatus: (error as any).response?.status,
        errorData: (error as any).response?.data,
        calendarEvent: JSON.stringify(calendarEvent, null, 2)
      });
      throw error; // Re-throw to trigger retry logic
    }
  }

  /**
   * List calendar events
   */
  private async listEvents(
    parameters: CalendarAgentRequest
  ): Promise<CalendarAgentResponse> {
    const calendarService = getService<CalendarService>('calendarService');
    if (!calendarService) {
      throw this.createError('Calendar service not available', 'SERVICE_UNAVAILABLE');
    }
    if (!calendarService.isReady()) {
      throw this.createError(`Calendar service not ready - current state: ${calendarService.state}`, 'SERVICE_NOT_READY');
    }
    const options = {
      timeMin: parameters.timeMin,
      timeMax: parameters.timeMax,
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime' as const
    };

    const events = await calendarService.getEvents(
      parameters.accessToken,
      options,
      parameters.calendarId
    );

    return {
      success: true,
      message: `Found ${events.length} events`,
      data: { events }
    };
  }

  /**
   * Update an existing calendar event
   */
  private async updateEvent(
    parameters: CalendarAgentRequest
  ): Promise<CalendarAgentResponse> {
    const calendarService = getService<CalendarService>('calendarService');
    if (!calendarService) {
      throw this.createError('Calendar service not available', 'SERVICE_UNAVAILABLE');
    }
    if (!calendarService.isReady()) {
      throw this.createError(`Calendar service not ready - current state: ${calendarService.state}`, 'SERVICE_NOT_READY');
    }
    if (!parameters.eventId) {
      throw this.createError('Event ID is required to update an event', 'MISSING_EVENT_ID');
    }

    const updateData: Partial<CalendarEvent> = {};
    
    if (parameters.summary) updateData.summary = parameters.summary;
    if (parameters.description) updateData.description = parameters.description;
    if (parameters.location) updateData.location = parameters.location;
    
    if (parameters.start) {
      updateData.start = {
        dateTime: parameters.start,
        timeZone: 'America/Los_Angeles'
      };
    }
    
    if (parameters.end) {
      updateData.end = {
        dateTime: parameters.end,
        timeZone: 'America/Los_Angeles'
      };
    }

    if (parameters.attendees) {
      // Filter out invalid email addresses
      const validAttendees = parameters.attendees.filter(email => {
        if (!email || typeof email !== 'string') return false;
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email.trim());
      });

      if (validAttendees.length > 0) {
        updateData.attendees = validAttendees.map(email => ({
          email: email.trim(),
          responseStatus: 'needsAction'
        }));
      }
    }

    const event = await calendarService.updateEvent(
      parameters.eventId,
      updateData,
      parameters.accessToken,
      parameters.calendarId
    );

    return {
      success: true,
      message: `Event updated successfully`,
      data: { event }
    };
  }

  /**
   * Delete a calendar event
   */
  private async deleteEvent(
    parameters: CalendarAgentRequest
  ): Promise<CalendarAgentResponse> {
    const calendarService = getService<CalendarService>('calendarService');
    if (!calendarService) {
      throw this.createError('Calendar service not available', 'SERVICE_UNAVAILABLE');
    }
    if (!calendarService.isReady()) {
      throw this.createError(`Calendar service not ready - current state: ${calendarService.state}`, 'SERVICE_NOT_READY');
    }
    if (!parameters.eventId) {
      throw this.createError('Event ID is required to delete an event', 'MISSING_EVENT_ID');
    }

    await calendarService.deleteEvent(
      parameters.eventId,
      parameters.accessToken,
      parameters.calendarId
    );

    return {
      success: true,
      message: `Event deleted successfully`,
      data: {}
    };
  }

  /**
   * Check availability for a specific time slot
   */
  private async checkAvailability(
    parameters: CalendarAgentRequest
  ): Promise<CalendarAgentResponse> {
    const calendarService = getService<CalendarService>('calendarService');
    if (!calendarService) {
      throw this.createError('Calendar service not available', 'SERVICE_UNAVAILABLE');
    }
    if (!calendarService.isReady()) {
      throw this.createError(`Calendar service not ready - current state: ${calendarService.state}`, 'SERVICE_NOT_READY');
    }
    if (!parameters.start || !parameters.end) {
      throw this.createError('Start and end times are required to check availability', 'MISSING_TIME_RANGE');
    }

    const availability = await calendarService.checkAvailability(
      parameters.accessToken,
      parameters.start,
      parameters.end,
      parameters.calendarId ? [parameters.calendarId] : ['primary']
    );

    const message = availability.busy 
      ? `Time slot is busy with ${availability.conflicts.length} conflict(s)`
      : 'Time slot is available';

    return {
      success: true,
      message,
      data: { availability }
    };
  }

  /**
   * Find available time slots
   */
  private async findAvailableSlots(
    parameters: CalendarAgentRequest
  ): Promise<CalendarAgentResponse> {
    const calendarService = getService<CalendarService>('calendarService');
    if (!calendarService) {
      throw this.createError('Calendar service not available', 'SERVICE_UNAVAILABLE');
    }
    if (!calendarService.isReady()) {
      throw this.createError(`Calendar service not ready - current state: ${calendarService.state}`, 'SERVICE_NOT_READY');
    }
    if (!parameters.start || !parameters.end || !parameters.duration) {
      throw this.createError('Start time, end time, and duration are required to find available slots', 'MISSING_PARAMETERS');
    }

    const slots = await calendarService.findAvailableSlots(
      parameters.accessToken,
      parameters.start,
      parameters.end,
      parameters.duration,
      parameters.calendarId ? [parameters.calendarId] : ['primary']
    );

    return {
      success: true,
      message: `Found ${slots.length} available time slot(s)`,
      data: { slots }
    };
  }

  // HANDLER METHODS FOR TOOL EXECUTION

  /**
   * Handle create calendar event tool execution
   */
  private async handleCreateEvent(parameters: CreateEventActionParams, calendarService: CalendarService): Promise<CalendarEventResult> {
    this.logger.debug('Creating calendar event', {
      title: parameters.title,
      startTime: parameters.startTime,
      endTime: parameters.endTime,
      hasAccessToken: !!(parameters as any).accessToken
    });

    const calendarParams: CalendarAgentRequest = {
      action: 'create',
      summary: parameters.title,
      description: parameters.description || undefined,
      start: parameters.startTime,
      end: parameters.endTime,
      attendees: Array.isArray(parameters.attendees) ? parameters.attendees : parameters.attendees ? [parameters.attendees] : undefined,
      location: parameters.location || undefined,
      accessToken: (parameters as any).accessToken,
      calendarId: (parameters as any).calendarId || 'primary'
    };

    const result = await this.withRetries(async () => {
      return await this.createEvent(calendarParams);
    });

    // Transform CalendarEvent to expected format
    const transformedEvent = result.data?.event ? {
      id: result.data.event.id || '',
      title: result.data.event.summary || '',
      startTime: result.data.event.start?.dateTime || '',
      endTime: result.data.event.end?.dateTime || '',
      location: result.data.event.location || undefined,
      attendees: result.data.event.attendees?.map(a => a.email).filter((email): email is string => email !== null && email !== undefined) || undefined
    } : undefined;

    return {
      success: result.success,
      event: transformedEvent,
      error: result.error || undefined
    };
  }

  /**
   * Handle list calendar events tool execution
   */
  private async handleListEvents(parameters: ListEventsActionParams, calendarService: CalendarService): Promise<{ success: boolean; events?: CalendarEvent[]; error?: string; }> {
    const calendarParams: CalendarAgentRequest = {
      action: 'list',
      timeMin: parameters.timeMin || undefined,
      timeMax: parameters.timeMax || undefined,
      accessToken: (parameters as any).accessToken,
      calendarId: (parameters as any).calendarId || 'primary'
    };

    const result = await this.withRetries(async () => {
      return await this.listEvents(calendarParams);
    });

    return {
      success: result.success,
      events: result.data?.events || undefined,
      error: result.error || undefined || undefined
    };
  }

  /**
   * Handle update calendar event tool execution
   */
  private async handleUpdateEvent(parameters: ToolParameters, calendarService: CalendarService): Promise<CalendarEventResult> {
    const updateParams = parameters as any; // Cast to access properties
    const calendarParams: CalendarAgentRequest = {
      action: 'update',
      eventId: updateParams.eventId,
      summary: updateParams.title,
      description: updateParams.description,
      start: updateParams.startTime,
      end: updateParams.endTime,
      attendees: updateParams.attendees,
      location: updateParams.location,
      accessToken: updateParams.accessToken,
      calendarId: updateParams.calendarId || 'primary'
    };

    const result = await this.withRetries(async () => {
      return await this.updateEvent(calendarParams);
    });

    // Transform CalendarEvent to expected format
    const transformedEvent = result.data?.event ? {
      id: result.data.event.id || '',
      title: result.data.event.summary || '',
      startTime: result.data.event.start?.dateTime || '',
      endTime: result.data.event.end?.dateTime || '',
      location: result.data.event.location || undefined,
      attendees: result.data.event.attendees?.map(a => a.email).filter((email): email is string => email !== null && email !== undefined) || undefined
    } : undefined;

    return {
      success: result.success,
      event: transformedEvent,
      error: result.error || undefined
    };
  }

  /**
   * Handle delete calendar event tool execution
   */
  private async handleDeleteEvent(parameters: ToolParameters, calendarService: CalendarService): Promise<{ success: boolean; error?: string; }> {
    const deleteParams = parameters as any; // Cast to access properties
    const calendarParams: CalendarAgentRequest = {
      action: 'delete',
      eventId: deleteParams.eventId,
      accessToken: deleteParams.accessToken,
      calendarId: deleteParams.calendarId || 'primary'
    };

    const result = await this.withRetries(async () => {
      return await this.deleteEvent(calendarParams);
    });

    return {
      success: result.success,
      error: result.error || undefined || undefined
    };
  }

  /**
   * Handle check availability tool execution
   */
  private async handleCheckAvailability(parameters: ToolParameters, calendarService: CalendarService): Promise<{ success: boolean; available?: boolean; conflicts?: CalendarEvent[]; error?: string; }> {
    const calendarParams: CalendarAgentRequest = {
      action: 'check_availability',
      start: parameters.start as string,
      end: parameters.end as string,
      accessToken: parameters.accessToken as string,
      calendarId: parameters.calendarId as string
    };

    const result = await this.withRetries(async () => {
      return await this.checkAvailability(calendarParams);
    });

    return {
      success: result.success,
      available: result.data?.availability?.busy || undefined,
      conflicts: result.data?.availability?.conflicts || undefined,
      error: result.error || undefined || undefined
    };
  }

  /**
   * Handle find time slots tool execution
   */
  private async handleFindTimeSlots(parameters: ToolParameters, calendarService: CalendarService): Promise<{ success: boolean; slots?: Array<{ start: string; end: string; }>; error?: string; }> {
    const calendarParams: CalendarAgentRequest = {
      action: 'find_slots',
      start: parameters.startDate as string,
      end: parameters.endDate as string,
      duration: parameters.duration as number,
      accessToken: parameters.accessToken as string,
      calendarId: parameters.calendarId as string
    };

    const result = await this.withRetries(async () => {
      return await this.findAvailableSlots(calendarParams);
    });

    return {
      success: result.success,
      slots: result.data?.slots || undefined,
      error: result.error || undefined || undefined
    };
  }

  /**
   * Handle general calendar operation tool execution
   */
  private async handleGeneralCalendarOperation(parameters: ToolParameters, calendarService: CalendarService): Promise<{ success: boolean; result?: unknown; error?: string; }> {
    const action = parameters.action as 'create' | 'list' | 'update' | 'delete' | 'check_availability' | 'find_slots';
    
    // Route to specific handler based on action
    switch (action) {
      case 'create':
        return await this.handleCreateEvent(parameters as CreateEventActionParams, calendarService);
      case 'list':
        return await this.handleListEvents(parameters, calendarService);
      case 'update':
        return await this.handleUpdateEvent(parameters, calendarService);
      case 'delete':
        return await this.handleDeleteEvent(parameters, calendarService);
      case 'check_availability':
        return await this.handleCheckAvailability(parameters, calendarService);
      case 'find_slots':
        return await this.handleFindTimeSlots(parameters, calendarService);
      default:
        return {
          success: false,
          error: `Unknown calendar action: ${action}`
        };
    }
  }

  /**
   * Get action type for preview generation - required by AIAgent base class
   */
  protected getActionType(params: CalendarAgentRequest): string {
    return 'calendar';
  }
}