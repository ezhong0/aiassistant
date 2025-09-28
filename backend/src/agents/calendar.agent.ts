/**
 * Calendar Agent - Clean Natural Language Agent
 *
 * Google Calendar integration using the new NaturalLanguageAgent pattern.
 *
 * This agent only implements 2 methods:
 * 1. getAgentConfig() - Configuration and metadata
 * 2. executeOperation() - Internal calendar operations
 *
 * Everything else (LLM analysis, drafts, auth, response formatting) is handled by the base class.
 *
 * @example
 * ```typescript
 * const agent = new CalendarAgent();
 * const response = await agent.execute(
 *   "Schedule a meeting with John tomorrow at 2pm",
 *   { userId, sessionId, accessToken }
 * );
 * // "I've scheduled your meeting with John for tomorrow at 2pm"
 * ```
 */

import { NaturalLanguageAgent, AgentConfig } from '../framework/natural-language-agent';
import { DomainServiceResolver } from '../services/domain';
import { ICalendarDomainService } from '../services/domain/interfaces/domain-service.interfaces';

/**
 * Calendar Agent - Microservice for Google Calendar operations
 */
export class CalendarAgent extends NaturalLanguageAgent {

  // ============================================================================
  // AGENT IMPLEMENTATION - Only 2 Methods
  // ============================================================================

  /**
   * Get agent configuration
   */
  protected getAgentConfig(): AgentConfig {
    return {
      name: 'calendarAgent',

      systemPrompt: `You are a Google Calendar management agent that helps users manage their schedules.

You can:
- Create calendar events with attendees, locations, and details
- List events in date ranges
- Update existing events
- Delete events
- Check availability for time slots
- Find available meeting times

You understand natural time references like "tomorrow", "next week", "in 2 hours".
You're helpful, efficient, and respect users' time.`,

      operations: [
        'create',
        'list',
        'update',
        'delete',
        'check_availability',
        'find_slots'
      ],

      services: ['calendarService'],

      auth: {
        type: 'oauth',
        provider: 'google'
      },

      // Removed draft rules - no longer needed

      description: 'Comprehensive calendar management using Google Calendar API',

      capabilities: [
        'Create calendar events with attendees',
        'List events in date ranges',
        'Update existing events',
        'Delete calendar events',
        'Check time slot availability',
        'Find available meeting slots'
      ],

      limitations: [
        'Requires Google OAuth authentication',
        'Limited to primary calendar or specified calendar ID',
        'Cannot access calendars without proper permissions'
      ]
    };
  }

  /**
   * Execute calendar operation
   *
   * This is the "black box" - internal logic that calls CalendarService
   */
  protected async executeOperation(
    operation: string,
    parameters: Record<string, any>,
    authToken: any
  ): Promise<any> {
    const calendarService = DomainServiceResolver.getCalendarService();
    await calendarService.initialize();
    
    // Authenticate with the provided access token
    if (authToken) {
      await calendarService.authenticate(authToken.accessToken, authToken.refreshToken);
    }
    
    const calendarId = parameters.calendarId || 'primary';

    switch (operation) {
      case 'create':
        return await this.createEvent(calendarService, parameters, authToken, calendarId);

      case 'list':
        return await this.listEvents(calendarService, parameters, authToken, calendarId);

      case 'update':
        return await this.updateEvent(calendarService, parameters, authToken, calendarId);

      case 'delete':
        return await this.deleteEvent(calendarService, parameters, authToken, calendarId);

      case 'check_availability':
        return await this.checkAvailability(calendarService, parameters, authToken, calendarId);

      case 'find_slots':
        return await this.findAvailableSlots(calendarService, parameters, authToken, calendarId);

      default:
        throw new Error(`Unknown calendar operation: ${operation}`);
    }
  }

  // ============================================================================
  // PRIVATE HELPERS - Calendar Operations
  // ============================================================================

  private async createEvent(
    service: ICalendarDomainService,
    params: Record<string, any>,
    token: string,
    calendarId: string
  ) {
    if (!params.summary || !params.start || !params.end) {
      throw new Error('Required fields: summary, start, end');
    }

    const event = await service.createEvent({
      summary: params.summary,
      description: params.description,
      start: { dateTime: params.start },
      end: { dateTime: params.end },
      attendees: params.attendees?.map((email: string) => ({ email })),
      location: params.location,
      calendarId
    });

    return {
      action: 'created',
      event,
      summary: event.summary,
      start: event.start?.dateTime,
      end: event.end?.dateTime
    };
  }

  private async listEvents(
    service: ICalendarDomainService,
    params: Record<string, any>,
    token: string,
    calendarId: string
  ) {
    const events = await service.listEvents({
      calendarId,
      timeMin: params.timeMin,
      timeMax: params.timeMax
    });

    return {
      action: 'listed',
      events,
      count: events.length
    };
  }

  private async updateEvent(
    service: ICalendarDomainService,
    params: Record<string, any>,
    token: string,
    calendarId: string
  ) {
    if (!params.eventId) {
      throw new Error('Event ID required for update');
    }

    const event = await service.updateEvent({
      eventId: params.eventId,
      calendarId,
      summary: params.summary,
      description: params.description,
      start: params.start ? { dateTime: params.start } : undefined,
      end: params.end ? { dateTime: params.end } : undefined,
      attendees: params.attendees?.map((email: string) => ({ email })),
      location: params.location
    });

    return {
      action: 'updated',
      event,
      eventId: params.eventId
    };
  }

  private async deleteEvent(
    service: ICalendarDomainService,
    params: Record<string, any>,
    token: string,
    calendarId: string
  ) {
    if (!params.eventId) {
      throw new Error('Event ID required for delete');
    }

    await service.deleteEvent(params.eventId, calendarId);

    return {
      action: 'deleted',
      eventId: params.eventId,
      success: true
    };
  }

  private async checkAvailability(
    service: ICalendarDomainService,
    params: Record<string, any>,
    token: string,
    calendarId: string
  ) {
    if (!params.start || !params.end) {
      throw new Error('Start and end times required for availability check');
    }

    const events = await service.listEvents({
      calendarId,
      timeMin: params.start,
      timeMax: params.end
    });

    const isAvailable = events.length === 0;
    const conflictingEvents = events;

    return {
      action: 'checked_availability',
      isAvailable,
      conflictingEvents,
      start: params.start,
      end: params.end,
      count: events.length
    };
  }

  private async findAvailableSlots(
    service: ICalendarDomainService,
    params: Record<string, any>,
    token: string,
    calendarId: string
  ) {
    if (!params.timeMin || !params.timeMax) {
      throw new Error('Time range required (timeMin, timeMax)');
    }

    const duration = params.duration || 30; // Default 30 minutes

    const events = await service.listEvents({
      calendarId,
      timeMin: params.timeMin,
      timeMax: params.timeMax
    });

    // Find gaps between events
    const availableSlots: Array<{ start: string; end: string }> = [];

    const startTime = new Date(params.timeMin);
    const endTime = new Date(params.timeMax);

    // Sort events by start time
    const sortedEvents = events
      .filter(e => e.start?.dateTime)
      .sort((a, b) => new Date(a.start!.dateTime!).getTime() - new Date(b.start!.dateTime!).getTime());

    let currentTime = startTime;

    for (const event of sortedEvents) {
      const eventStart = new Date(event.start!.dateTime!);

      // Check if there's a gap before this event
      const gap = eventStart.getTime() - currentTime.getTime();
      const requiredGap = duration * 60 * 1000; // Convert minutes to milliseconds

      if (gap >= requiredGap) {
        availableSlots.push({
          start: currentTime.toISOString(),
          end: new Date(currentTime.getTime() + requiredGap).toISOString()
        });
      }

      // Move current time to end of this event
      const eventEnd = new Date(event.end?.dateTime || eventStart);
      if (eventEnd > currentTime) {
        currentTime = eventEnd;
      }
    }

    // Check if there's a slot at the end
    const finalGap = endTime.getTime() - currentTime.getTime();
    const requiredGap = duration * 60 * 1000;
    if (finalGap >= requiredGap) {
      availableSlots.push({
        start: currentTime.toISOString(),
        end: new Date(currentTime.getTime() + requiredGap).toISOString()
      });
    }

    return {
      action: 'found_slots',
      availableSlots,
      count: availableSlots.length,
      duration
    };
  }
}