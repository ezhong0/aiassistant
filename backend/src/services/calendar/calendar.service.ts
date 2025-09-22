import { google, calendar_v3 } from 'googleapis';
import { BaseService } from '../base-service';
import { CreateEventRequestSchema, UpdateEventRequestSchema, ListEventsRequestSchema } from '../../types/calendar/index';
import { z } from 'zod';

interface ConferenceData {
  conferenceId?: string;
  conferenceSolutionKey?: {
    type?: string;
  };
  entryPoints?: Array<{
    entryPointType?: string;
    uri?: string;
    label?: string;
  }>;
  createRequest?: {
    requestId?: string;
    conferenceSolutionKey?: {
      type?: string;
    };
  };
}

/**
 * Calendar Event interface for Google Calendar API integration
 * 
 * Represents a calendar event with all standard Google Calendar fields
 * including timing, attendees, location, and conference data.
 * 
 * @interface CalendarEvent
 */
export interface CalendarEvent {
  id?: string | null | undefined;
  summary?: string | null | undefined;
  description?: string | null | undefined;
  start?: {
    dateTime?: string | null | undefined;
    date?: string | null | undefined;
    timeZone?: string | null | undefined;
  } | undefined;
  end?: {
    dateTime?: string | null | undefined;
    date?: string | null | undefined;
    timeZone?: string | null | undefined;
  } | undefined;
  attendees?: Array<{
    email?: string | null | undefined;
    responseStatus?: string | null | undefined;
  }> | undefined;
  location?: string | null | undefined;
  conferenceData?: ConferenceData | undefined;
}

/**
 * Calendar query options for filtering and pagination
 * 
 * Provides options for querying calendar events with time ranges,
 * result limits, and other filtering criteria.
 * 
 * @interface CalendarQueryOptions
 */
export interface CalendarQueryOptions {
  timeMin?: string | undefined;
  timeMax?: string | undefined;
  maxResults?: number | undefined;
  singleEvents?: boolean | undefined;
  orderBy?: 'startTime' | 'updated' | undefined;
}

/**
 * Calendar Service Error class for enhanced error handling
 * 
 * Extends the standard Error class to provide additional context
 * about calendar operation failures.
 * 
 * @class CalendarServiceError
 * @extends Error
 */
export interface CalendarServiceError extends Error {
  code?: string;
  status?: number;
}

/**
 * Google Calendar service for managing calendar events and scheduling
 */
export class CalendarService extends BaseService {
  private calendarService!: calendar_v3.Calendar;

  constructor() {
    super('CalendarService');
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      // Initialize Calendar API service
      this.calendarService = google.calendar('v3');
      
      this.logInfo('Calendar service initialized successfully');
    } catch (error) {
      this.logError('Failed to initialize Calendar service', error);
      throw error;
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.calendarService = null as any;
      this.logInfo('Calendar service destroyed');
    } catch (error) {
      this.logError('Error destroying Calendar service', error);
      // Don't throw in cleanup
    }
  }

  /**
   * Create a new calendar event
   */
  async createEvent(
    calendarEvent: CalendarEvent, 
    accessToken: string, 
    calendarId: string = 'primary'
  ): Promise<calendar_v3.Schema$Event> {
    this.assertReady();

    // ✅ Validate input parameters with Zod
    const validatedRequest = CreateEventRequestSchema.parse({
      summary: calendarEvent.summary,
      description: calendarEvent.description,
      start: calendarEvent.start,
      end: calendarEvent.end,
      attendees: calendarEvent.attendees,
      location: calendarEvent.location,
      recurrence: (calendarEvent as any).recurrence || undefined
    });

    try {
      // Additional access token validation
      if (!accessToken) {
        throw new Error('Access token is required');
      }

      this.logDebug('Creating calendar event', {
        summary: calendarEvent.summary,
        start: calendarEvent.start?.dateTime,
        end: calendarEvent.end?.dateTime,
        calendarId: calendarId
      });
      
      this.logInfo('Creating calendar event', { 
        summary: calendarEvent.summary,
        start: calendarEvent.start?.dateTime,
        end: calendarEvent.end?.dateTime,
        timeZone: calendarEvent.start?.timeZone,
        calendarId,
        hasAttendees: !!calendarEvent.attendees,
        attendeeCount: calendarEvent.attendees?.length || 0
      });

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const googleEvent = this.convertToGoogleEvent(calendarEvent);
      
      const response = await this.calendarService.events.insert({
        auth,
        calendarId,
        requestBody: googleEvent,
        sendUpdates: 'all' // Send updates to attendees
      });

      this.logInfo('Calendar event created successfully', { 
        eventId: response.data.id,
        summary: response.data.summary 
      });

      return response.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('Calendar event creation failed', {
        error: errorMessage,
        errorType: error instanceof Error ? error.constructor.name : typeof error
      });
      
      this.handleCalendarError(error, 'createEvent');
    }
  }

  /**
   * Convert CalendarEvent to Google Calendar API format
   */
  private convertToGoogleEvent(calendarEvent: CalendarEvent): calendar_v3.Schema$Event {
    return {
      summary: calendarEvent.summary || undefined,
      description: calendarEvent.description || undefined,
      start: calendarEvent.start ? {
        dateTime: calendarEvent.start.dateTime || undefined,
        timeZone: calendarEvent.start.timeZone || undefined
      } : undefined,
      end: calendarEvent.end ? {
        dateTime: calendarEvent.end.dateTime || undefined,
        timeZone: calendarEvent.end.timeZone || undefined
      } : undefined,
      attendees: calendarEvent.attendees?.map(attendee => ({
        email: attendee.email || undefined,
        responseStatus: attendee.responseStatus || undefined
      })) || undefined,
      location: calendarEvent.location || undefined,
      conferenceData: calendarEvent.conferenceData || undefined
    };
  }

  /**
   * Get calendar events within a time range
   */
  async getEvents(
    accessToken: string, 
    options: CalendarQueryOptions = {},
    calendarId: string = 'primary'
  ): Promise<calendar_v3.Schema$Event[]> {
    this.assertReady();

    try {
      const {
        timeMin = new Date().toISOString(),
        timeMax,
        maxResults = 10,
        singleEvents = true,
        orderBy = 'startTime'
      } = options;

      this.logDebug('Starting Google Calendar API call', {
        timeRange: { timeMin, timeMax },
        queryParams: { maxResults, calendarId, singleEvents, orderBy }
      });

      this.logDebug('Fetching calendar events', {
        timeMin,
        timeMax,
        maxResults,
        calendarId
      });

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const listOptions: calendar_v3.Params$Resource$Events$List = {
        auth,
        calendarId,
        timeMin,
        maxResults,
        singleEvents,
        orderBy
      };

      if (timeMax) {
        listOptions.timeMax = timeMax;
      }

      this.logDebug('Making Calendar API call', {
        options: {
          calendarId: listOptions.calendarId,
          timeMin: listOptions.timeMin,
          timeMax: listOptions.timeMax,
          maxResults: listOptions.maxResults,
          singleEvents: listOptions.singleEvents,
          orderBy: listOptions.orderBy
        }
      });

      const response = await this.calendarService.events.list(listOptions);

      this.logDebug('Calendar API call completed successfully', {
        status: response.status,
        eventCount: response.data.items?.length || 0
      });

      const events = response.data.items || [];
      
      this.logInfo('Calendar events retrieved successfully', { 
        count: events.length,
        calendarId 
      });

      return events;
    } catch (error) {
      this.handleCalendarError(error, 'getEvents');
    }
  }

  /**
   * Update an existing calendar event
   */
  async updateEvent(
    eventId: string,
    calendarEvent: Partial<CalendarEvent>,
    accessToken: string,
    calendarId: string = 'primary'
  ): Promise<calendar_v3.Schema$Event> {
    this.assertReady();

    try {
      this.logDebug('Updating calendar event', { 
        eventId, 
        summary: calendarEvent.summary,
        calendarId 
      });

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const response = await this.calendarService.events.patch({
        auth,
        calendarId,
        eventId,
        requestBody: calendarEvent as calendar_v3.Schema$Event,
        sendUpdates: 'all'
      });

      this.logInfo('Calendar event updated successfully', { 
        eventId: response.data.id,
        summary: response.data.summary 
      });

      return response.data;
    } catch (error) {
      this.handleCalendarError(error, 'updateEvent');
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(
    eventId: string,
    accessToken: string,
    calendarId: string = 'primary'
  ): Promise<void> {
    this.assertReady();

    try {
      this.logDebug('Deleting calendar event', { eventId, calendarId });

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      await this.calendarService.events.delete({
        auth,
        calendarId,
        eventId,
        sendUpdates: 'all'
      });

      this.logInfo('Calendar event deleted successfully', { eventId });
    } catch (error) {
      this.handleCalendarError(error, 'deleteEvent');
    }
  }

  /**
   * Check if a user is free during a specific time slot
   */
  async checkAvailability(
    accessToken: string,
    timeMin: string,
    timeMax: string,
    calendarIds: string[] = ['primary']
  ): Promise<{ busy: boolean; conflicts: calendar_v3.Schema$Event[] }> {
    this.assertReady();

    try {
      this.logDebug('Checking availability', { timeMin, timeMax, calendarIds });

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const response = await this.calendarService.freebusy.query({
        auth,
        requestBody: {
          timeMin,
          timeMax,
          items: calendarIds.map(id => ({ id }))
        }
      });

      const busyTimes = response.data.calendars || {};
      const conflicts: calendar_v3.Schema$Event[] = [];
      let busy = false;

      // Check if any calendar has busy times
      for (const calendarId of calendarIds) {
        const calendarBusy = busyTimes[calendarId]?.busy || [];
        if (calendarBusy.length > 0) {
          busy = true;
          // Get event details for conflicts
          for (const busyTime of calendarBusy) {
            if (busyTime.start && busyTime.end) {
              const events = await this.getEvents(accessToken, {
                timeMin: busyTime.start,
                timeMax: busyTime.end,
                maxResults: 1
              }, calendarId);
              conflicts.push(...events);
            }
          }
        }
      }

      this.logInfo('Availability check completed', { 
        busy, 
        conflictCount: conflicts.length 
      });

      return { busy, conflicts };
    } catch (error) {
      this.handleCalendarError(error, 'checkAvailability');
    }
  }

  /**
   * Find available time slots between start and end time
   */
  async findAvailableSlots(
    accessToken: string,
    startDate: string,
    endDate: string,
    durationMinutes: number,
    calendarIds: string[] = ['primary']
  ): Promise<Array<{ start: string; end: string }>> {
    this.assertReady();

    try {
      this.logDebug('Finding available time slots', { 
        startDate, 
        endDate, 
        durationMinutes 
      });

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const response = await this.calendarService.freebusy.query({
        auth,
        requestBody: {
          timeMin: startDate,
          timeMax: endDate,
          items: calendarIds.map(id => ({ id }))
        }
      });

      const busyTimes = response.data.calendars || {};
      const allBusySlots: Array<{ start: string; end: string }> = [];

      // Collect all busy times from all calendars
      for (const calendarId of calendarIds) {
        const calendarBusy = busyTimes[calendarId]?.busy || [];
        for (const busyTime of calendarBusy) {
          if (busyTime.start && busyTime.end) {
            allBusySlots.push({
              start: busyTime.start,
              end: busyTime.end
            });
          }
        }
      }

      // Sort busy times by start time
      allBusySlots.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

      // Find available slots between busy times
      const availableSlots: Array<{ start: string; end: string }> = [];
      const startTime = new Date(startDate);
      const endTime = new Date(endDate);
      const durationMs = durationMinutes * 60 * 1000;

      let currentTime = startTime;

      for (const busySlot of allBusySlots) {
        const busyStart = new Date(busySlot.start);
        const busyEnd = new Date(busySlot.end);

        // Check if there's enough time before this busy slot
        if (currentTime.getTime() + durationMs <= busyStart.getTime()) {
          availableSlots.push({
            start: currentTime.toISOString(),
            end: new Date(currentTime.getTime() + durationMs).toISOString()
          });
        }

        // Move current time to after this busy slot
        if (busyEnd > currentTime) {
          currentTime = busyEnd;
        }
      }

      // Check if there's time after all busy slots
      if (currentTime.getTime() + durationMs <= endTime.getTime()) {
        availableSlots.push({
          start: currentTime.toISOString(),
          end: new Date(currentTime.getTime() + durationMs).toISOString()
        });
      }

      this.logInfo('Available time slots found', { 
        count: availableSlots.length,
        duration: durationMinutes 
      });

      return availableSlots;
    } catch (error) {
      this.handleCalendarError(error, 'findAvailableSlots');
    }
  }

  /**
   * Get list of user's calendars
   */
  async getCalendars(accessToken: string): Promise<calendar_v3.Schema$CalendarListEntry[]> {
    this.assertReady();

    try {
      this.logDebug('Fetching user calendars');

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const response = await this.calendarService.calendarList.list({
        auth
      });

      const calendars = response.data.items || [];
      
      this.logInfo('User calendars retrieved successfully', { 
        count: calendars.length 
      });

      return calendars;
    } catch (error) {
      this.handleCalendarError(error, 'getCalendars');
    }
  }

  /**
   * Handle and transform calendar service errors
   */
  protected handleCalendarError(error: unknown, operation: string): never {
    const calendarError = error as CalendarServiceError;
    
    this.logError(`Calendar service error in ${operation}`, {
      error: error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorCode: error && typeof error === 'object' && 'code' in error ? (error as any).code : undefined,
      errorStatus: error && typeof error === 'object' && 'response' in error ? (error as any).response?.status : undefined,
      errorData: error && typeof error === 'object' && 'response' in error ? (error as any).response?.data : undefined,
      operation: operation
    });
    
    // Transform common Google Calendar API errors
    if (error && typeof error === 'object' && 'response' in error) {
      const apiError = error as any;
      if (apiError.response?.status === 404) {
        calendarError.message = 'Calendar or event not found';
        calendarError.code = 'CALENDAR_NOT_FOUND';
      } else if (apiError.response?.status === 403) {
        calendarError.message = 'Insufficient permissions for calendar access';
        calendarError.code = 'CALENDAR_PERMISSION_DENIED';
      } else if (apiError.response?.status === 401) {
        calendarError.message = 'Calendar authentication failed - please reconnect your Google account';
        calendarError.code = 'CALENDAR_AUTH_FAILED';
      } else if (apiError.response?.status === 429) {
        calendarError.message = 'Calendar API rate limit exceeded - please try again in a moment';
        calendarError.code = 'CALENDAR_RATE_LIMIT';
      } else if (!calendarError.message) {
        calendarError.message = `Calendar service error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        calendarError.code = 'CALENDAR_ERROR';
      }
    } else {
      calendarError.message = `Calendar service error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      calendarError.code = 'CALENDAR_ERROR';
    }

    calendarError.status = error && typeof error === 'object' && 'response' in error ? (error as any).response?.status : undefined;
    
    throw calendarError;
  }
}