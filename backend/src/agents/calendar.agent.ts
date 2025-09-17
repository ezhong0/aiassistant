import { ToolExecutionContext } from '../types/tools';
import { AIAgent } from '../framework/ai-agent';
import { ActionPreview, PreviewGenerationResult, CalendarPreviewData, ActionRiskAssessment } from '../types/api/api.types';
import { CalendarService, CalendarEvent } from '../services/calendar/calendar.service';
import { resolveCalendarService } from '../services/service-resolver';
import { getService, serviceManager } from '../services/service-manager';
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

// Import focused services
import { CalendarEventManager, CalendarEventManagementResult } from '../services/calendar/calendar-event-manager.service';
import { CalendarAvailabilityChecker, AvailabilityCheckResult } from '../services/calendar/calendar-availability-checker.service';
import { CalendarFormatter, CalendarFormattingResult, CalendarResult } from '../services/calendar/calendar-formatter.service';
import { CalendarValidator, CalendarValidationResult } from '../services/calendar/calendar-validator.service';

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
 * Calendar Agent - Manages calendar events and scheduling
 * Integrates with Google Calendar API for comprehensive calendar management with AI planning
 * Refactored to use focused services for better separation of concerns
 */
export class CalendarAgent extends AIAgent<CalendarAgentRequest, CalendarAgentResponse> {
  
  // Focused service dependencies
  private calendarEventManager: CalendarEventManager | null = null;
  private calendarAvailabilityChecker: CalendarAvailabilityChecker | null = null;
  private calendarFormatter: CalendarFormatter | null = null;
  private calendarValidator: CalendarValidator | null = null;

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
   * Lazy initialization of calendar services
   */
  private ensureServices(): void {
    if (!this.calendarEventManager) {
      this.calendarEventManager = serviceManager.getService(CALENDAR_SERVICE_CONSTANTS.SERVICE_NAMES.CALENDAR_EVENT_MANAGER) as CalendarEventManager;
    }
    if (!this.calendarAvailabilityChecker) {
      this.calendarAvailabilityChecker = serviceManager.getService(CALENDAR_SERVICE_CONSTANTS.SERVICE_NAMES.CALENDAR_AVAILABILITY_CHECKER) as CalendarAvailabilityChecker;
    }
    if (!this.calendarFormatter) {
      this.calendarFormatter = serviceManager.getService(CALENDAR_SERVICE_CONSTANTS.SERVICE_NAMES.CALENDAR_FORMATTER) as CalendarFormatter;
    }
    if (!this.calendarValidator) {
      this.calendarValidator = serviceManager.getService(CALENDAR_SERVICE_CONSTANTS.SERVICE_NAMES.CALENDAR_VALIDATOR) as CalendarValidator;
    }
  }

  /**
   * Cleanup focused service dependencies
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.logger.info('Destroying CalendarAgent...');
      this.calendarEventManager = null;
      this.calendarAvailabilityChecker = null;
      this.calendarFormatter = null;
      this.calendarValidator = null;
      this.logger.info('CalendarAgent destroyed successfully');
    } catch (error) {
      this.logger.error('Error during CalendarAgent destruction', error);
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
    this.logger.debug(`Executing calendar tool: ${toolName}`, {
      toolName,
      parametersKeys: Object.keys(parameters),
      sessionId: context.sessionId
    });

    // Ensure we have access token
    if (!parameters.accessToken) {
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
      
      if (operation === CALENDAR_SERVICE_CONSTANTS.CALENDAR_OPERATIONS.CREATE) {
        return await this.handleCreateEvent(parameters, context);
      } else if (operation === CALENDAR_SERVICE_CONSTANTS.CALENDAR_OPERATIONS.LIST) {
        return await this.handleListEvents(parameters, context);
      } else if (operation === CALENDAR_SERVICE_CONSTANTS.CALENDAR_OPERATIONS.UPDATE) {
        return await this.handleUpdateEvent(parameters, context);
      } else if (operation === CALENDAR_SERVICE_CONSTANTS.CALENDAR_OPERATIONS.DELETE) {
        return await this.handleDeleteEvent(parameters, context);
      } else if (operation === CALENDAR_SERVICE_CONSTANTS.CALENDAR_OPERATIONS.CHECK_AVAILABILITY) {
        return await this.handleCheckAvailability(parameters, context);
      } else if (operation === CALENDAR_SERVICE_CONSTANTS.CALENDAR_OPERATIONS.FIND_SLOTS) {
        return await this.handleFindSlots(parameters, context);
      } else {
        throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      this.logger.error(`Error executing calendar tool ${toolName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : CALENDAR_SERVICE_CONSTANTS.ERRORS.UNKNOWN_ERROR
      };
    }
  }

  /**
   * Handle create event operation
   */
  private async handleCreateEvent(parameters: ToolParameters, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      // Validate event data
      const validationResult = this.calendarValidator!.validateEventData({
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
          error: validationResult.errors.join(', ')
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

      const result = await this.calendarEventManager!.createEvent(
        event,
        parameters.accessToken as string,
        (parameters.calendarId as string) || CALENDAR_SERVICE_CONSTANTS.DEFAULTS.DEFAULT_CALENDAR_ID
      );

      if (result.success) {
        // Format the result
        const calendarResult: CalendarResult = {
          event: result.event,
          summary: result.event?.summary,
          start: result.event?.start,
          end: result.event?.end,
          location: result.event?.location,
          attendees: result.event?.attendees?.map((att: any) => att.email)
        };

        const formattingResult = this.calendarFormatter!.formatCalendarResult(calendarResult);
        
        return {
          success: true,
          data: {
            event: result.event,
            message: formattingResult.formattedText
          }
        };
      } else {
        return {
          success: false,
          error: result.error || CALENDAR_SERVICE_CONSTANTS.ERRORS.EVENT_CREATION_FAILED
        };
      }
    } catch (error) {
      this.logger.error('Error handling create event:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : CALENDAR_SERVICE_CONSTANTS.ERRORS.EVENT_CREATION_FAILED
      };
    }
  }

  /**
   * Handle list events operation
   */
  private async handleListEvents(parameters: ToolParameters, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      // Validate query options
      const validationResult = this.calendarValidator!.validateQueryOptions({
        timeMin: parameters.timeMin as string,
        timeMax: parameters.timeMax as string,
        maxResults: parameters.maxResults as number
      });

      if (!validationResult.isValid) {
        return {
          success: false,
          error: validationResult.errors.join(', ')
        };
      }

      // List events
      const result = await this.calendarEventManager!.listEvents(
        parameters.accessToken as string,
        {
          timeMin: parameters.timeMin as string,
          timeMax: parameters.timeMax as string,
          maxResults: (parameters.maxResults as number) || 10
        },
        (parameters.calendarId as string) || CALENDAR_SERVICE_CONSTANTS.DEFAULTS.DEFAULT_CALENDAR_ID
      );

      if (result.success) {
        // Format the result
        const calendarResult: CalendarResult = {
          events: result.events,
          count: result.count
        };

        const formattingResult = this.calendarFormatter!.formatCalendarResult(calendarResult);
        
        return {
          success: true,
          data: {
            events: result.events,
            count: result.count,
            message: formattingResult.formattedText
          }
        };
      } else {
        return {
          success: false,
          error: result.error || CALENDAR_SERVICE_CONSTANTS.ERRORS.EVENT_LISTING_FAILED
        };
      }
    } catch (error) {
      this.logger.error('Error handling list events:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : CALENDAR_SERVICE_CONSTANTS.ERRORS.EVENT_LISTING_FAILED
      };
    }
  }

  /**
   * Handle update event operation
   */
  private async handleUpdateEvent(parameters: ToolParameters, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      // Validate event ID
      const eventIdValidation = this.calendarValidator!.validateEventId(parameters.eventId as string);
      if (!eventIdValidation.isValid) {
        return {
          success: false,
          error: eventIdValidation.errors.join(', ')
        };
      }

      // Validate event data
      const validationResult = this.calendarValidator!.validateEventData({
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
          error: validationResult.errors.join(', ')
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

      const result = await this.calendarEventManager!.updateEvent(
        parameters.eventId as string,
        eventUpdate,
        parameters.accessToken as string,
        (parameters.calendarId as string) || CALENDAR_SERVICE_CONSTANTS.DEFAULTS.DEFAULT_CALENDAR_ID
      );

      if (result.success) {
        // Format the result
        const calendarResult: CalendarResult = {
          event: result.event,
          summary: result.event?.summary,
          start: result.event?.start,
          end: result.event?.end,
          location: result.event?.location,
          attendees: result.event?.attendees?.map((att: any) => att.email)
        };

        const formattingResult = this.calendarFormatter!.formatCalendarResult(calendarResult);
        
        return {
          success: true,
          data: {
            event: result.event,
            message: formattingResult.formattedText
          }
        };
      } else {
        return {
          success: false,
          error: result.error || CALENDAR_SERVICE_CONSTANTS.ERRORS.EVENT_UPDATE_FAILED
        };
      }
    } catch (error) {
      this.logger.error('Error handling update event:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : CALENDAR_SERVICE_CONSTANTS.ERRORS.EVENT_UPDATE_FAILED
      };
    }
  }

  /**
   * Handle delete event operation
   */
  private async handleDeleteEvent(parameters: ToolParameters, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      // Validate event ID
      const eventIdValidation = this.calendarValidator!.validateEventId(parameters.eventId as string);
      if (!eventIdValidation.isValid) {
        return {
          success: false,
          error: eventIdValidation.errors.join(', ')
        };
      }

      // Delete event
      const result = await this.calendarEventManager!.deleteEvent(
        parameters.eventId as string,
        parameters.accessToken as string,
        (parameters.calendarId as string) || CALENDAR_SERVICE_CONSTANTS.DEFAULTS.DEFAULT_CALENDAR_ID
      );

      if (result.success) {
        return {
          success: true,
          data: {
            message: CALENDAR_SERVICE_CONSTANTS.SUCCESS.EVENT_DELETED
          }
        };
      } else {
        return {
          success: false,
          error: result.error || CALENDAR_SERVICE_CONSTANTS.ERRORS.EVENT_DELETION_FAILED
        };
      }
    } catch (error) {
      this.logger.error('Error handling delete event:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : CALENDAR_SERVICE_CONSTANTS.ERRORS.EVENT_DELETION_FAILED
      };
    }
  }

  /**
   * Handle check availability operation
   */
  private async handleCheckAvailability(parameters: ToolParameters, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      // Check availability
      const result = await this.calendarAvailabilityChecker!.checkAvailability(
        parameters.startTime as string,
        parameters.endTime as string,
        parameters.accessToken as string,
        (parameters.calendarId as string) || CALENDAR_SERVICE_CONSTANTS.DEFAULTS.DEFAULT_CALENDAR_ID
      );

      if (result.success) {
        // Format the result
        const calendarResult: CalendarResult = {
          isAvailable: result.isAvailable,
          conflictingEvents: result.conflictingEvents
        };

        const formattingResult = this.calendarFormatter!.formatCalendarResult(calendarResult);
        
        return {
          success: true,
          data: {
            isAvailable: result.isAvailable,
            conflictingEvents: result.conflictingEvents,
            message: formattingResult.formattedText
          }
        };
      } else {
        return {
          success: false,
          error: result.error || CALENDAR_SERVICE_CONSTANTS.ERRORS.AVAILABILITY_CHECK_FAILED
        };
      }
    } catch (error) {
      this.logger.error('Error handling check availability:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : CALENDAR_SERVICE_CONSTANTS.ERRORS.AVAILABILITY_CHECK_FAILED
      };
    }
  }

  /**
   * Handle find slots operation
   */
  private async handleFindSlots(parameters: ToolParameters, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      // Find available slots
      const result = await this.calendarAvailabilityChecker!.findAvailableSlots(
        parameters.startDate as string,
        parameters.endDate as string,
        parameters.durationMinutes as number,
        parameters.accessToken as string,
        (parameters.calendarId as string) || CALENDAR_SERVICE_CONSTANTS.DEFAULTS.DEFAULT_CALENDAR_ID
      );

      if (result.success) {
        // Format the result
        const calendarResult: CalendarResult = {
          availableSlots: result.availableSlots
        };

        const formattingResult = this.calendarFormatter!.formatCalendarResult(calendarResult);
        
        return {
          success: true,
          data: {
            availableSlots: result.availableSlots,
            message: formattingResult.formattedText
          }
        };
      } else {
        return {
          success: false,
          error: result.error || CALENDAR_SERVICE_CONSTANTS.ERRORS.TIME_SLOT_SEARCH_FAILED
        };
      }
    } catch (error) {
      this.logger.error('Error handling find slots:', error);
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
      name: 'manage_calendar',
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
      message: data.message || 'Calendar operation completed successfully',
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
}
