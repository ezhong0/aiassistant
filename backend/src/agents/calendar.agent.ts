/**
 * Calendar SubAgent - Calendar management using BaseSubAgent architecture
 * 
 * Implements the Generic SubAgent design pattern for calendar operations:
 * - 3-phase workflow (Intent Assessment, Tool Execution, Response Formatting)
 * - Direct integration with CalendarDomainService
 * - Natural language interface
 * - Tool-to-service mapping
 */

import { BaseSubAgent, AgentCapabilities } from '../framework/base-subagent';
import { DomainServiceResolver } from '../services/domain/dependency-injection/domain-service-container';
import { IDomainService } from '../services/domain/interfaces/base-domain.interface';
import { ICalendarDomainService } from '../services/domain/interfaces/calendar-domain.interface';

export class CalendarAgent extends BaseSubAgent {
  private calendarService: ICalendarDomainService;

  constructor() {
    super('calendar', {
      name: 'CalendarSubAgent',
      description: 'Calendar management sub-agent for creating, updating, and managing calendar events',
      enabled: true,
      timeout: 30000,
      retryCount: 3
    });

    // Get existing domain service from container
    this.calendarService = DomainServiceResolver.getCalendarService();
  }

  /**
   * Get domain-specific system prompt
   */
  protected getSystemPrompt(): string {
    return `
You are a calendar management sub-agent specialized in Google Calendar operations.

Available tools:
- create_event: Create new calendar events with attendees, location, and conference details
- list_events: List events within a date range with filtering options
- get_event: Retrieve detailed information about a specific event
- update_event: Modify existing calendar events
- delete_event: Remove calendar events
- check_availability: Check if time slots are available
- find_available_slots: Find available time slots for scheduling
- list_calendars: List all available calendars

Your job is to help users manage their calendar effectively by:
1. Creating well-structured events with proper time zones
2. Finding available meeting times
3. Managing event attendees and invitations
4. Handling recurring events and conference calls
5. Providing clear summaries of calendar operations

Always extract userId from parameters and use proper date/time formatting.
Focus on creating user-friendly calendar experiences.
    `;
  }

  /**
   * Tool-to-service method mapping
   */
  protected getToolToServiceMap(): Record<string, string> {
    return {
      'create_event': 'createEvent',
      'list_events': 'listEvents',
      'get_event': 'getEvent',
      'update_event': 'updateEvent',
      'delete_event': 'deleteEvent',
      'check_availability': 'checkAvailability',
      'find_available_slots': 'findAvailableSlots',
      'list_calendars': 'listCalendars'
    };
  }

  /**
   * Get the calendar domain service
   */
  protected getService(): IDomainService {
    return this.calendarService;
  }

  /**
   * Execute tool call by mapping to calendar service method
   */
  protected async executeToolCall(toolName: string, params: any): Promise<any> {
    const serviceMethod = this.getToolToServiceMap()[toolName];
    if (!serviceMethod) {
      throw new Error(`Unknown calendar tool: ${toolName}`);
    }

    const { userId, ...serviceParams } = params;
    if (!userId) {
      throw new Error('userId is required for calendar operations');
    }

    // TypeScript will enforce that service[serviceMethod] exists
    const service = this.getService() as ICalendarDomainService;
    
    try {
      // Handle different method signatures
      switch (toolName) {
        case 'get_event':
          return await service.getEvent(serviceParams.eventId, serviceParams.calendarId);
        case 'delete_event':
          return await service.deleteEvent(userId, serviceParams.eventId, serviceParams.calendarId);
        case 'list_calendars':
          return await service.listCalendars(userId);
        default:
          // Most methods follow the pattern: method(userId, params)
          return await (service as any)[serviceMethod](userId, serviceParams);
      }
    } catch (error) {
      throw new Error(`Calendar ${toolName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get agent capabilities for discovery
   */
  getCapabilityDescription(): AgentCapabilities {
    return {
      name: 'CalendarSubAgent',
      description: 'Comprehensive calendar management including event creation, scheduling, and availability checking',
      operations: [
        'create_event',
        'list_events', 
        'get_event',
        'update_event',
        'delete_event',
        'check_availability',
        'find_available_slots',
        'list_calendars'
      ],
      requiresAuth: true,
      requiresConfirmation: true, // Calendar operations often need confirmation
      isCritical: false,
      examples: [
        'Create a meeting with John tomorrow at 2pm',
        'Find available time slots for a 1-hour meeting this week',
        'List all my events for next Monday',
        'Check if I\'m available Friday afternoon',
        'Update the project meeting to include Sarah'
      ]
    };
  }

}