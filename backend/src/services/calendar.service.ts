import { google, calendar_v3 } from 'googleapis';
import { BaseService } from './base-service';
import logger from '../utils/logger';

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    responseStatus?: string;
  }>;
  location?: string;
  conferenceData?: any;
}

export interface CalendarQueryOptions {
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
  singleEvents?: boolean;
  orderBy?: 'startTime' | 'updated';
}

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

    try {
      this.logDebug('Creating calendar event', { 
        summary: calendarEvent.summary,
        start: calendarEvent.start.dateTime,
        calendarId 
      });

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const response = await this.calendarService.events.insert({
        auth,
        calendarId,
        requestBody: calendarEvent,
        sendUpdates: 'all' // Send updates to attendees
      });

      this.logInfo('Calendar event created successfully', { 
        eventId: response.data.id,
        summary: response.data.summary 
      });

      return response.data;
    } catch (error) {
      this.handleCalendarError(error, 'createEvent');
    }
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

      this.logDebug('Fetching calendar events', { 
        timeMin, 
        timeMax, 
        maxResults, 
        calendarId 
      });

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const response = await this.calendarService.events.list({
        auth,
        calendarId,
        timeMin,
        timeMax,
        maxResults,
        singleEvents,
        orderBy
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
  protected handleCalendarError(error: any, operation: string): never {
    const calendarError = error as CalendarServiceError;
    
    this.logError(`Calendar service error in ${operation}`, error);
    
    // Transform common Google Calendar API errors
    if (error.response?.status === 404) {
      calendarError.message = 'Calendar or event not found';
      calendarError.code = 'CALENDAR_NOT_FOUND';
    } else if (error.response?.status === 403) {
      calendarError.message = 'Insufficient permissions for calendar access';
      calendarError.code = 'CALENDAR_PERMISSION_DENIED';
    } else if (error.response?.status === 401) {
      calendarError.message = 'Calendar authentication failed - please reconnect your Google account';
      calendarError.code = 'CALENDAR_AUTH_FAILED';
    } else if (error.response?.status === 429) {
      calendarError.message = 'Calendar API rate limit exceeded - please try again in a moment';
      calendarError.code = 'CALENDAR_RATE_LIMIT';
    } else if (!calendarError.message) {
      calendarError.message = `Calendar service error: ${error.message || 'Unknown error'}`;
      calendarError.code = 'CALENDAR_ERROR';
    }

    calendarError.status = error.response?.status;
    
    throw calendarError;
  }
}