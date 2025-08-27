import { ToolExecutionContext } from '../types/tools';
import { BaseAgent } from '../framework/base-agent';
import { CalendarService, CalendarEvent } from '../services/calendar.service';
import { getService } from '../services/service-manager';

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
    events?: any[];
    event?: any;
    availability?: {
      busy: boolean;
      conflicts: any[];
    };
    slots?: Array<{ start: string; end: string }>;
  };
  error?: string;
}

/**
 * Calendar Agent - Manages calendar events and scheduling
 * Integrates with Google Calendar API for comprehensive calendar management
 */
export class CalendarAgent extends BaseAgent<CalendarAgentRequest, CalendarAgentResponse> {
  
  constructor() {
    super({
      name: 'calendarAgent',
      description: 'Create, update, and manage calendar events and scheduling',
      enabled: true,
      timeout: 30000,
      retryCount: 2
    });
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
   * Core calendar processing logic - routes to appropriate calendar operations
   */
  protected async processQuery(parameters: CalendarAgentRequest, context: ToolExecutionContext): Promise<CalendarAgentResponse> {
    try {
      this.logger.info('Calendar agent execution', { 
        action: parameters.action,
        sessionId: context.sessionId
      });

      // Get calendar service from service registry
      const calendarService = getService<CalendarService>('calendarService');
      if (!calendarService) {
        throw this.createError('Calendar service not available', 'SERVICE_UNAVAILABLE');
      }

      // Route to appropriate action
      switch (parameters.action) {
        case 'create':
          return await this.createEvent(parameters, calendarService);
        case 'list':
          return await this.listEvents(parameters, calendarService);
        case 'update':
          return await this.updateEvent(parameters, calendarService);
        case 'delete':
          return await this.deleteEvent(parameters, calendarService);
        case 'check_availability':
          return await this.checkAvailability(parameters, calendarService);
        case 'find_slots':
          return await this.findAvailableSlots(parameters, calendarService);
        default:
          throw this.createError(`Unknown calendar action: ${parameters.action}`, 'INVALID_ACTION');
      }

    } catch (error) {
      this.logger.error('Calendar agent execution failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Calendar operation failed',
        error: error instanceof Error ? error.message : 'CALENDAR_ERROR'
      };
    }
  }

  /**
   * Create a new calendar event
   */
  private async createEvent(
    parameters: CalendarAgentRequest, 
    calendarService: CalendarService
  ): Promise<CalendarAgentResponse> {
    if (!parameters.summary || !parameters.start || !parameters.end) {
      throw this.createError('Summary, start time, and end time are required to create an event', 'MISSING_REQUIRED_FIELDS');
    }

    const calendarEvent: CalendarEvent = {
      summary: parameters.summary,
      description: parameters.description,
      start: {
        dateTime: parameters.start,
        timeZone: 'America/Los_Angeles' // TODO: Make timezone configurable
      },
      end: {
        dateTime: parameters.end,
        timeZone: 'America/Los_Angeles'
      },
      location: parameters.location
    };

    // Add attendees if provided
    if (parameters.attendees && parameters.attendees.length > 0) {
      calendarEvent.attendees = parameters.attendees.map(email => ({
        email,
        responseStatus: 'needsAction'
      }));
    }

    const event = await calendarService.createEvent(
      calendarEvent, 
      parameters.accessToken,
      parameters.calendarId
    );

    return {
      success: true,
      message: `Event "${parameters.summary}" created successfully`,
      data: { event }
    };
  }

  /**
   * List calendar events
   */
  private async listEvents(
    parameters: CalendarAgentRequest, 
    calendarService: CalendarService
  ): Promise<CalendarAgentResponse> {
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
    parameters: CalendarAgentRequest, 
    calendarService: CalendarService
  ): Promise<CalendarAgentResponse> {
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
      updateData.attendees = parameters.attendees.map(email => ({
        email,
        responseStatus: 'needsAction'
      }));
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
    parameters: CalendarAgentRequest, 
    calendarService: CalendarService
  ): Promise<CalendarAgentResponse> {
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
    parameters: CalendarAgentRequest, 
    calendarService: CalendarService
  ): Promise<CalendarAgentResponse> {
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
    parameters: CalendarAgentRequest, 
    calendarService: CalendarService
  ): Promise<CalendarAgentResponse> {
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
}