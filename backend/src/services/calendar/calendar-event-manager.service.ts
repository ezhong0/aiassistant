import { BaseService } from '../base-service';
import { ServiceManager } from '../service-manager';
import { CalendarService, CalendarEvent, CalendarQueryOptions } from './calendar.service';
import { CALENDAR_SERVICE_CONSTANTS } from '../../config/calendar-service-constants';

/**
 * Calendar event management result
 */
export interface CalendarEventManagementResult {
  success: boolean;
  event?: any;
  events?: any[];
  count?: number;
  error?: string;
}

/**
 * CalendarEventManager - Focused service for calendar event operations
 * Handles all Google Calendar API operations (create, update, delete, list)
 */
export class CalendarEventManager extends BaseService {
  private calendarService: CalendarService | null = null;

  constructor() {
    super(CALENDAR_SERVICE_CONSTANTS.SERVICE_NAMES.CALENDAR_EVENT_MANAGER);
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing CalendarEventManager...');
      const serviceManager = ServiceManager.getInstance();
      this.calendarService = serviceManager.getService(CALENDAR_SERVICE_CONSTANTS.SERVICE_NAMES.CALENDAR_SERVICE) as CalendarService;
      if (!this.calendarService) {
        throw new Error(CALENDAR_SERVICE_CONSTANTS.ERRORS.CALENDAR_SERVICE_NOT_AVAILABLE);
      }
      this.logInfo('CalendarEventManager initialized successfully');
    } catch (error) {
      this.handleError(error, 'onInitialize');
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.logInfo('Destroying CalendarEventManager...');
      this.calendarService = null;
      this.logInfo('CalendarEventManager destroyed successfully');
    } catch (error) {
      this.logError('Error during CalendarEventManager destruction', error);
    }
  }

  /**
   * Create a new calendar event
   */
  async createEvent(
    event: CalendarEvent,
    accessToken: string,
    calendarId: string = 'primary'
  ): Promise<CalendarEventManagementResult> {
    try {
      if (!this.calendarService) {
        throw new Error(CALENDAR_SERVICE_CONSTANTS.ERRORS.CALENDAR_SERVICE_NOT_AVAILABLE);
      }

      this.logInfo('Creating calendar event', {
        summary: event.summary,
        start: event.start,
        end: event.end
      });

      const createdEvent = await this.calendarService.createEvent(event, accessToken, calendarId);

      this.logInfo('Calendar event created successfully', {
        eventId: createdEvent.id,
        summary: createdEvent.summary
      });

      return {
        success: true,
        event: createdEvent
      };
    } catch (error) {
      this.logError('Error creating calendar event', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : CALENDAR_SERVICE_CONSTANTS.ERRORS.EVENT_CREATION_FAILED
      };
    }
  }

  /**
   * Update an existing calendar event
   */
  async updateEvent(
    eventId: string,
    event: Partial<CalendarEvent>,
    accessToken: string,
    calendarId: string = 'primary'
  ): Promise<CalendarEventManagementResult> {
    try {
      if (!this.calendarService) {
        throw new Error(CALENDAR_SERVICE_CONSTANTS.ERRORS.CALENDAR_SERVICE_NOT_AVAILABLE);
      }

      this.logInfo('Updating calendar event', {
        eventId,
        summary: event.summary
      });

      const updatedEvent = await this.calendarService.updateEvent(eventId, event, accessToken, calendarId);

      this.logInfo('Calendar event updated successfully', {
        eventId: updatedEvent.id,
        summary: updatedEvent.summary
      });

      return {
        success: true,
        event: updatedEvent
      };
    } catch (error) {
      this.logError('Error updating calendar event', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : CALENDAR_SERVICE_CONSTANTS.ERRORS.EVENT_UPDATE_FAILED
      };
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(
    eventId: string,
    accessToken: string,
    calendarId: string = 'primary'
  ): Promise<CalendarEventManagementResult> {
    try {
      if (!this.calendarService) {
        throw new Error(CALENDAR_SERVICE_CONSTANTS.ERRORS.CALENDAR_SERVICE_NOT_AVAILABLE);
      }

      this.logInfo('Deleting calendar event', { eventId });

      await this.calendarService.deleteEvent(eventId, accessToken, calendarId);

      this.logInfo('Calendar event deleted successfully', { eventId });

      return {
        success: true
      };
    } catch (error) {
      this.logError('Error deleting calendar event', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : CALENDAR_SERVICE_CONSTANTS.ERRORS.EVENT_DELETION_FAILED
      };
    }
  }

  /**
   * List calendar events
   */
  async listEvents(
    accessToken: string,
    options: CalendarQueryOptions = {},
    calendarId: string = 'primary'
  ): Promise<CalendarEventManagementResult> {
    try {
      if (!this.calendarService) {
        throw new Error(CALENDAR_SERVICE_CONSTANTS.ERRORS.CALENDAR_SERVICE_NOT_AVAILABLE);
      }

      console.log('📅 CALENDAR EVENT MANAGER: Starting calendar query');
      console.log('📅 CALENDAR EVENT MANAGER: Access token length:', accessToken.length);
      console.log('📅 CALENDAR EVENT MANAGER: Query options:', JSON.stringify(options, null, 2));
      console.log('📅 CALENDAR EVENT MANAGER: Calendar ID:', calendarId);

      this.logInfo('Listing calendar events', {
        timeMin: options.timeMin,
        timeMax: options.timeMax,
        maxResults: options.maxResults
      });

      const events = await this.calendarService.getEvents(accessToken, options, calendarId);

      console.log('📅 CALENDAR EVENT MANAGER: Query completed');
      console.log('📅 CALENDAR EVENT MANAGER: Events found:', events.length);
      console.log('📅 CALENDAR EVENT MANAGER: Events details:', JSON.stringify(events, null, 2));

      this.logInfo('Calendar events listed successfully', {
        count: events.length
      });

      return {
        success: true,
        events,
        count: events.length
      };
    } catch (error) {
      this.logError('Error listing calendar events', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : CALENDAR_SERVICE_CONSTANTS.ERRORS.EVENT_LISTING_FAILED
      };
    }
  }

  /**
   * Get a specific calendar event
   */
  async getEvent(
    eventId: string,
    accessToken: string,
    calendarId: string = 'primary'
  ): Promise<CalendarEventManagementResult> {
    try {
      if (!this.calendarService) {
        throw new Error(CALENDAR_SERVICE_CONSTANTS.ERRORS.CALENDAR_SERVICE_NOT_AVAILABLE);
      }

      this.logInfo('Getting calendar event', { eventId });

      // Note: CalendarService doesn't have getEvent method, using getEvents with single result
      const events = await this.calendarService.getEvents(accessToken, { maxResults: 1 }, calendarId);
      const event = events.find(e => e.id === eventId);

      if (!event) {
        throw new Error('Event not found');
      }

      this.logInfo('Calendar event retrieved successfully', {
        eventId: event.id,
        summary: event.summary
      });

      return {
        success: true,
        event
      };
    } catch (error) {
      this.logError('Error getting calendar event', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : CALENDAR_SERVICE_CONSTANTS.ERRORS.EVENT_RETRIEVAL_FAILED
      };
    }
  }

  /**
   * Get service statistics
   */
  getManagerStats(): {
    serviceName: string;
    supportedOperations: string[];
  } {
    return {
      serviceName: CALENDAR_SERVICE_CONSTANTS.SERVICE_NAMES.CALENDAR_EVENT_MANAGER,
      supportedOperations: Object.values(CALENDAR_SERVICE_CONSTANTS.CALENDAR_OPERATIONS)
    };
  }
}
