import { BaseService } from '../base-service';
import { getAPIClient } from '../api';
import { GoogleAPIClient } from '../api/clients/google-api-client';
import { AuthCredentials } from '../../types/api/api-client.types';
import { ErrorFactory, DomainError } from '../../errors';
import { ValidationHelper, CalendarValidationSchemas } from '../../validation/api-client.validation';
import { ICalendarDomainService } from './interfaces/calendar-domain.interface';
import { GoogleOAuthManager } from '../oauth/google-oauth-manager';
import { SlackContext } from '../../types/slack/slack.types';

/**
 * Calendar Domain Service - High-level calendar operations using standardized API client
 * 
 * This service provides domain-specific calendar operations that wrap the Google Calendar API.
 * It handles event creation, management, availability checking, and calendar operations
 * with a clean interface that's easy to use from agents and other services.
 * 
 * Features:
 * - Create, update, and delete calendar events
 * - List events with filtering and pagination
 * - Check availability and find free time slots
 * - Manage multiple calendars
 * - Handle recurring events and conference data
 * - OAuth2 authentication management
 */
export class CalendarDomainService extends BaseService implements Partial<ICalendarDomainService> {
  private googleClient: GoogleAPIClient | null = null;

  constructor(private readonly googleOAuthManager: GoogleOAuthManager) {
    super('CalendarDomainService');
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing Calendar Domain Service');
      
      // Get Google API client
      this.googleClient = await getAPIClient<GoogleAPIClient>('google');
      
      this.logInfo('Calendar Domain Service initialized successfully');
    } catch (error) {
      this.logError('Failed to initialize Calendar Domain Service', error);
      throw error;
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.googleClient = null;
      this.logInfo('Calendar Domain Service destroyed');
    } catch (error) {
      this.logError('Error destroying Calendar Domain Service', error);
    }
  }

  /**
   * OAuth management methods
   */
  async initializeOAuth(userId: string, context: SlackContext): Promise<{ authUrl: string; state: string }> {
    this.assertReady();

    if (!this.googleOAuthManager) {
      throw ErrorFactory.domain.serviceError(
        this.name,
        'GoogleOAuthManager not available'
      );
    }

    const { authUrl, state } = await this.googleOAuthManager.generateAuthUrl(context);
    return { authUrl, state };
  }

  async completeOAuth(userId: string, code: string, state: string): Promise<void> {
    this.assertReady();

    if (!this.googleOAuthManager) {
      throw ErrorFactory.domain.serviceError(this.name, 'GoogleOAuthManager not available');
    }

    const result = await this.googleOAuthManager.exchangeCodeForTokens(code, state);
    if (!result.success) {
      throw ErrorFactory.external.google.authFailed(result.error || 'OAuth completion failed');
    }
  }

  async refreshTokens(userId: string): Promise<void> {
    this.assertReady();

    if (!this.googleOAuthManager) {
      throw ErrorFactory.domain.serviceError(this.name, 'GoogleOAuthManager not available');
    }

    const success = await this.googleOAuthManager.refreshTokens(userId);
    if (!success) {
      throw ErrorFactory.external.google.authFailed('Token refresh failed');
    }
  }

  async revokeTokens(userId: string): Promise<void> {
    this.assertReady();

    if (!this.googleOAuthManager) {
      throw ErrorFactory.domain.serviceError(this.name, 'GoogleOAuthManager not available');
    }

    const success = await this.googleOAuthManager.revokeTokens(userId);
    if (!success) {
      throw ErrorFactory.external.google.authFailed('Token revocation failed');
    }
  }

  async requiresOAuth(userId: string): Promise<boolean> {
    this.assertReady();
    
    if (!this.googleOAuthManager) {
      return true; // Assume OAuth required if manager not available
    }
    
    return await this.googleOAuthManager.requiresOAuth(userId);
  }


  /**
   * Create a calendar event (with automatic authentication)
   */
  async createEvent(userId: string, event: {
    summary: string;
    description?: string;
    start: Date;
    end: Date;
    attendees?: Array<{
      email: string;
      responseStatus?: string;
    }>;
    location?: string;
    recurrence?: {
      frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
      interval?: number;
      daysOfWeek?: string[];
      until?: Date;
      count?: number;
    };
    reminders?: {
      useDefault?: boolean;
      overrides?: Array<{
        method: 'email' | 'popup';
        minutes: number;
      }>;
    };
    visibility?: 'default' | 'public' | 'private' | 'confidential';
    transparency?: 'opaque' | 'transparent';
    conferenceData?: {
      createRequest?: {
        requestId: string;
        conferenceSolutionKey: {
          type: string;
        };
      };
    };
    calendarId?: string;
  }): Promise<{
    id: string;
    summary: string;
    description?: string;
    start: Date;
    end: Date;
    location?: string;
    attendees?: Array<{
      email: string;
      displayName?: string;
      responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
      optional?: boolean;
      organizer?: boolean;
    }>;
    organizer?: {
      email: string;
      displayName?: string;
    };
    created: Date;
    updated: Date;
    status: 'tentative' | 'confirmed' | 'cancelled';
    visibility: 'default' | 'public' | 'private' | 'confidential';
    transparency: 'opaque' | 'transparent';
    recurrence?: {
      frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
      interval?: number;
      daysOfWeek?: string[];
      until?: Date;
      count?: number;
    };
    recurringEventId?: string;
    htmlLink?: string;
    hangoutLink?: string;
    conferenceData?: {
      conferenceId: string;
      conferenceSolution: {
        key: { type: string };
        name: string;
      };
      entryPoints?: Array<{
        entryPointType: string;
        uri: string;
        label?: string;
      }>;
    };
  }> {
    this.assertReady();
    
    if (!this.googleClient) {
      throw ErrorFactory.domain.serviceError(
        this.name,
        'Google client not available'
      );
    }

    try {
      // Get valid tokens for user
      const token = await this.googleOAuthManager!.getValidTokens(userId);
      if (!token) {
        throw ErrorFactory.api.unauthorized('Google OAuth authentication required. Please call initializeOAuth first.');
      }
      
      // Authenticate with valid token
      // Authentication handled automatically by OAuth manager
      
      // Validate input parameters
      const validatedParams = ValidationHelper.validate(CalendarValidationSchemas.createEvent, event);

      this.logInfo('Creating calendar event', {
        summary: validatedParams.summary,
        start: validatedParams.start,
        end: validatedParams.end,
        calendarId: validatedParams.calendarId || 'primary'
      });

      const eventData = {
        summary: validatedParams.summary,
        description: validatedParams.description,
        start: validatedParams.start,
        end: validatedParams.end,
        attendees: validatedParams.attendees,
        location: validatedParams.location,
        recurrence: validatedParams.recurrence,
        conferenceData: validatedParams.conferenceData
      };

      const response = await this.googleClient.makeRequest({
        method: 'POST',
        endpoint: '/calendar/v3/calendars/primary/events/insert',
        query: {
          calendarId: validatedParams.calendarId || 'primary',
          sendUpdates: 'all'
        },
        data: eventData
      });

      const result = {
        id: response.data.id,
        summary: response.data.summary,
        description: response.data.description,
        start: new Date(response.data.start.dateTime || response.data.start.date),
        end: new Date(response.data.end.dateTime || response.data.end.date),
        location: response.data.location,
        attendees: response.data.attendees,
        organizer: response.data.organizer,
        created: new Date(response.data.created),
        updated: new Date(response.data.updated),
        status: response.data.status,
        visibility: response.data.visibility,
        transparency: response.data.transparency,
        recurrence: response.data.recurrence,
        recurringEventId: response.data.recurringEventId,
        htmlLink: response.data.htmlLink,
        hangoutLink: response.data.hangoutLink,
        conferenceData: response.data.conferenceData
      };

      this.logInfo('Calendar event created successfully', {
        eventId: result.id,
        summary: result.summary
      });

      return result;
    } catch (error) {
      // Re-throw if already properly formatted
      if (error instanceof DomainError) {
        throw error;
      }
      throw ErrorFactory.domain.serviceError(
        this.name,
        error instanceof Error ? error.message : 'Failed to create calendar event'
      );
    }
  }

  /**
   * List calendar events
   */
  async listEvents(userId: string, params: {
    calendarId?: string;
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
    singleEvents?: boolean;
    orderBy?: 'startTime' | 'updated';
    q?: string;
  }): Promise<Array<{
    id: string;
    summary: string;
    description?: string;
    start: { dateTime?: string; date?: string; timeZone?: string };
    end: { dateTime?: string; date?: string; timeZone?: string };
    attendees?: Array<{ email: string; responseStatus?: string }>;
    location?: string;
    htmlLink: string;
    status: string;
  }>> {
    this.assertReady();
    
    if (!this.googleClient) {
      throw ErrorFactory.domain.serviceUnavailable('google-api-client', {
        service: 'CalendarDomainService',
        operation: 'calendar-operation'
      });
    }

    try {
      // Get valid tokens for user
      const token = await this.googleOAuthManager!.getValidTokens(userId);
      if (!token) {
        throw ErrorFactory.api.unauthorized('Google OAuth authentication required. Please call initializeOAuth first.');
      }
      
      // Authenticate with valid token
      // Authentication handled automatically by OAuth manager
      
      this.logInfo('Listing calendar events', {
        calendarId: params.calendarId || 'primary',
        timeMin: params.timeMin,
        timeMax: params.timeMax,
        maxResults: params.maxResults || 10
      });

      const response = await this.googleClient.makeRequest({
        method: 'GET',
        endpoint: '/calendar/v3/calendars/primary/events/list',
        query: {
          calendarId: params.calendarId || 'primary',
          timeMin: params.timeMin || new Date().toISOString(),
          timeMax: params.timeMax,
          maxResults: params.maxResults || 10,
          singleEvents: params.singleEvents !== false,
          orderBy: params.orderBy || 'startTime',
          q: params.q
        }
      });

      const events = response.data.items?.map((event: any) => ({
        id: event.id,
        summary: event.summary,
        description: event.description,
        start: event.start,
        end: event.end,
        attendees: event.attendees,
        location: event.location,
        htmlLink: event.htmlLink,
        status: event.status
      })) || [];

      this.logInfo('Calendar events listed successfully', {
        count: events.length,
        calendarId: params.calendarId || 'primary'
      });

      return events;
    } catch (error) {
      this.logError('Failed to list calendar events', error);
      throw error;
    }
  }

  /**
   * Get a specific calendar event
   */
  async getEvent(eventId: string, calendarId: string = 'primary'): Promise<{
    id: string;
    summary: string;
    description?: string;
    start: Date;
    end: Date;
    location?: string;
    attendees?: Array<{
      email: string;
      displayName?: string;
      responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
      optional?: boolean;
      organizer?: boolean;
    }>;
    organizer?: {
      email: string;
      displayName?: string;
    };
    created: Date;
    updated: Date;
    status: 'tentative' | 'confirmed' | 'cancelled';
    visibility: 'default' | 'public' | 'private' | 'confidential';
    transparency: 'opaque' | 'transparent';
    recurrence?: {
      frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
      interval?: number;
      daysOfWeek?: string[];
      until?: Date;
      count?: number;
    };
    recurringEventId?: string;
    htmlLink?: string;
    hangoutLink?: string;
    conferenceData?: {
      conferenceId: string;
      conferenceSolution: {
        key: { type: string };
        name: string;
      };
      entryPoints?: Array<{
        entryPointType: string;
        uri: string;
        label?: string;
      }>;
    };
  }> {
    this.assertReady();
    
    if (!this.googleClient) {
      throw ErrorFactory.domain.serviceUnavailable('google-api-client', {
        service: 'CalendarDomainService',
        operation: 'calendar-operation'
      });
    }

    try {
      this.logInfo('Getting calendar event', { eventId, calendarId });

      const response = await this.googleClient.makeRequest({
        method: 'GET',
        endpoint: '/calendar/v3/calendars/primary/events/get',
        query: {
          calendarId,
          eventId
        }
      });

      const result = {
        id: response.data.id,
        summary: response.data.summary,
        description: response.data.description,
        start: new Date(response.data.start.dateTime || response.data.start.date),
        end: new Date(response.data.end.dateTime || response.data.end.date),
        location: response.data.location,
        attendees: response.data.attendees,
        organizer: response.data.organizer,
        created: new Date(response.data.created),
        updated: new Date(response.data.updated),
        status: response.data.status,
        visibility: response.data.visibility,
        transparency: response.data.transparency,
        recurrence: response.data.recurrence,
        recurringEventId: response.data.recurringEventId,
        htmlLink: response.data.htmlLink,
        hangoutLink: response.data.hangoutLink,
        conferenceData: response.data.conferenceData
      };

      this.logInfo('Calendar event retrieved successfully', {
        eventId: result.id,
        summary: result.summary
      });

      return result;
    } catch (error) {
      this.logError('Failed to get calendar event', error, { eventId, calendarId });
      throw error;
    }
  }

  /**
   * Update a calendar event
   */
  async updateEvent(userId: string, eventId: string, updates: {
    summary?: string;
    description?: string;
    start?: Date;
    end?: Date;
    location?: string;
    attendees?: Array<{
      email: string;
      displayName?: string;
      responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
      optional?: boolean;
      organizer?: boolean;
    }>;
    recurrence?: {
      frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
      interval?: number;
      daysOfWeek?: string[];
      until?: Date;
      count?: number;
    };
    reminders?: {
      useDefault?: boolean;
      overrides?: Array<{
        method: 'email' | 'popup';
        minutes: number;
      }>;
    };
    visibility?: 'default' | 'public' | 'private' | 'confidential';
    transparency?: 'opaque' | 'transparent';
  }, calendarId?: string): Promise<{
    id: string;
    summary: string;
    description?: string;
    start: Date;
    end: Date;
    location?: string;
    attendees?: Array<{
      email: string;
      displayName?: string;
      responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
      optional?: boolean;
      organizer?: boolean;
    }>;
    organizer?: {
      email: string;
      displayName?: string;
    };
    created: Date;
    updated: Date;
    status: 'tentative' | 'confirmed' | 'cancelled';
    visibility: 'default' | 'public' | 'private' | 'confidential';
    transparency: 'opaque' | 'transparent';
    recurrence?: {
      frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
      interval?: number;
      daysOfWeek?: string[];
      until?: Date;
      count?: number;
    };
    recurringEventId?: string;
    htmlLink?: string;
    hangoutLink?: string;
    conferenceData?: {
      conferenceId: string;
      conferenceSolution: {
        key: { type: string };
        name: string;
      };
      entryPoints?: Array<{
        entryPointType: string;
        uri: string;
        label?: string;
      }>;
    };
  }> {
    this.assertReady();
    
    if (!this.googleClient) {
      throw ErrorFactory.domain.serviceUnavailable('google-api-client', {
        service: 'CalendarDomainService',
        operation: 'calendar-operation'
      });
    }

    try {
      // Get valid tokens for user
      const token = await this.googleOAuthManager!.getValidTokens(userId);
      if (!token) {
        throw ErrorFactory.api.unauthorized('Google OAuth authentication required. Please call initializeOAuth first.');
      }
      
      // Authenticate with valid token
      // Authentication handled automatically by OAuth manager
      
      this.logInfo('Updating calendar event', {
        eventId: eventId,
        calendarId: calendarId || 'primary'
      });

      const eventData = {
        summary: updates.summary,
        description: updates.description,
        start: updates.start,
        end: updates.end,
        attendees: updates.attendees,
        location: updates.location
      };

      const response = await this.googleClient.makeRequest({
        method: 'PATCH',
        endpoint: '/calendar/v3/calendars/primary/events/patch',
        query: {
          calendarId: calendarId || 'primary',
          eventId: eventId,
          sendUpdates: 'all'
        },
        data: eventData
      });

      const result = {
        id: response.data.id,
        summary: response.data.summary,
        description: response.data.description,
        start: new Date(response.data.start.dateTime || response.data.start.date),
        end: new Date(response.data.end.dateTime || response.data.end.date),
        location: response.data.location,
        attendees: response.data.attendees,
        organizer: response.data.organizer,
        created: new Date(response.data.created),
        updated: new Date(response.data.updated),
        status: response.data.status,
        visibility: response.data.visibility,
        transparency: response.data.transparency,
        recurrence: response.data.recurrence,
        recurringEventId: response.data.recurringEventId,
        htmlLink: response.data.htmlLink,
        hangoutLink: response.data.hangoutLink,
        conferenceData: response.data.conferenceData
      };

      this.logInfo('Calendar event updated successfully', {
        eventId: result.id,
        summary: result.summary
      });

      return result;
    } catch (error) {
      this.logError('Failed to update calendar event', error, { eventId: eventId });
      throw error;
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(userId: string, eventId: string, calendarId: string = 'primary'): Promise<void> {
    this.assertReady();
    
    if (!this.googleClient) {
      throw ErrorFactory.domain.serviceUnavailable('google-api-client', {
        service: 'CalendarDomainService',
        operation: 'calendar-operation'
      });
    }

    try {
      this.logInfo('Deleting calendar event', { eventId, calendarId });

      await this.googleClient.makeRequest({
        method: 'DELETE',
        endpoint: '/calendar/v3/calendars/primary/events/delete',
        query: {
          calendarId,
          eventId,
          sendUpdates: 'all'
        }
      });

      this.logInfo('Calendar event deleted successfully', { eventId });
    } catch (error) {
      this.logError('Failed to delete calendar event', error, { eventId, calendarId });
      throw error;
    }
  }

  /**
   * Check availability
   */
  async checkAvailability(userId: string, params: {
    timeMin: string;
    timeMax: string;
    calendarIds?: string[];
  }): Promise<{
    busy: boolean;
    conflicts: Array<{
      start: string;
      end: string;
    }>;
  }> {
    this.assertReady();
    
    if (!this.googleClient) {
      throw ErrorFactory.domain.serviceUnavailable('google-api-client', {
        service: 'CalendarDomainService',
        operation: 'calendar-operation'
      });
    }

    try {
      // Get valid tokens for user
      const token = await this.googleOAuthManager!.getValidTokens(userId);
      if (!token) {
        throw ErrorFactory.api.unauthorized('Google OAuth authentication required. Please call initializeOAuth first.');
      }
      
      // Authenticate with valid token
      // Authentication handled automatically by OAuth manager
      
      this.logInfo('Checking availability', {
        timeMin: params.timeMin,
        timeMax: params.timeMax,
        calendarIds: params.calendarIds || ['primary']
      });

      const response = await this.googleClient.makeRequest({
        method: 'POST',
        endpoint: '/calendar/v3/freebusy/query',
        data: {
          timeMin: params.timeMin,
          timeMax: params.timeMax,
          items: (params.calendarIds || ['primary']).map(id => ({ id }))
        }
      });

      const busyTimes = response.data.calendars || {};
      const conflicts: Array<{ start: string; end: string }> = [];
      let busy = false;

      // Check if any calendar has busy times
      for (const calendarId of params.calendarIds || ['primary']) {
        const calendarBusy = busyTimes[calendarId]?.busy || [];
        if (calendarBusy.length > 0) {
          busy = true;
          conflicts.push(...calendarBusy);
        }
      }

      this.logInfo('Availability check completed', {
        busy,
        conflictCount: conflicts.length
      });

      return { busy, conflicts };
    } catch (error) {
      this.logError('Failed to check availability', error);
      throw error;
    }
  }

  /**
   * Find available time slots
   */
  async findAvailableSlots(userId: string, params: {
    startDate: string;
    endDate: string;
    durationMinutes: number;
    calendarIds?: string[];
  }): Promise<Array<{
    start: string;
    end: string;
  }>> {
    this.assertReady();
    
    if (!this.googleClient) {
      throw ErrorFactory.domain.serviceUnavailable('google-api-client', {
        service: 'CalendarDomainService',
        operation: 'calendar-operation'
      });
    }

    try {
      // Get valid tokens for user
      const token = await this.googleOAuthManager!.getValidTokens(userId);
      if (!token) {
        throw ErrorFactory.api.unauthorized('Google OAuth authentication required. Please call initializeOAuth first.');
      }
      
      // Authenticate with valid token
      // Authentication handled automatically by OAuth manager
      
      this.logInfo('Finding available time slots', {
        startDate: params.startDate,
        endDate: params.endDate,
        durationMinutes: params.durationMinutes
      });

      const response = await this.googleClient.makeRequest({
        method: 'POST',
        endpoint: '/calendar/v3/freebusy/query',
        data: {
          timeMin: params.startDate,
          timeMax: params.endDate,
          items: (params.calendarIds || ['primary']).map(id => ({ id }))
        }
      });

      const busyTimes = response.data.calendars || {};
      const allBusySlots: Array<{ start: string; end: string }> = [];

      // Collect all busy times from all calendars
      for (const calendarId of params.calendarIds || ['primary']) {
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
      const startTime = new Date(params.startDate);
      const endTime = new Date(params.endDate);
      const durationMs = params.durationMinutes * 60 * 1000;

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
        duration: params.durationMinutes
      });

      return availableSlots;
    } catch (error) {
      this.logError('Failed to find available time slots', error);
      throw error;
    }
  }

  /**
   * List user's calendars
   */
  async listCalendars(userId: string): Promise<Array<{
    id: string;
    summary: string;
    description?: string;
    primary: boolean;
    accessRole: 'none' | 'freeBusyReader' | 'reader' | 'writer' | 'owner';
    backgroundColor?: string;
    foregroundColor?: string;
    timeZone: string;
    selected?: boolean;
    hidden?: boolean;
    deleted?: boolean;
    conferenceProperties?: {
      allowedConferenceSolutionTypes: string[];
    };
  }>> {
    this.assertReady();
    
    if (!this.googleClient) {
      throw ErrorFactory.domain.serviceUnavailable('google-api-client', {
        service: 'CalendarDomainService',
        operation: 'calendar-operation'
      });
    }

    try {
      // Get valid tokens for user
      const token = await this.googleOAuthManager!.getValidTokens(userId);
      if (!token) {
        throw ErrorFactory.api.unauthorized('Google OAuth authentication required. Please call initializeOAuth first.');
      }
      
      // Authenticate with valid token
      // Authentication handled automatically by OAuth manager
      
      this.logInfo('Listing user calendars');

      const response = await this.googleClient.makeRequest({
        method: 'GET',
        endpoint: '/calendar/v3/calendarList/list'
      });

      const calendars = response.data.items?.map((calendar: any) => ({
        id: calendar.id,
        summary: calendar.summary,
        description: calendar.description,
        primary: calendar.primary || false,
        accessRole: calendar.accessRole,
        backgroundColor: calendar.backgroundColor,
        foregroundColor: calendar.foregroundColor
      })) || [];

      this.logInfo('User calendars listed successfully', {
        count: calendars.length
      });

      return calendars;
    } catch (error) {
      this.logError('Failed to list calendars', error);
      throw error;
    }
  }

  /**
   * Get service health information
   */
  getHealth(): { healthy: boolean; details?: Record<string, unknown> } {
    try {
      const healthy = this.isReady() && this.initialized && !!this.googleClient;
      const details = {
        initialized: this.initialized,
        hasGoogleClient: !!this.googleClient,
        authenticated: this.googleClient?.isAuthenticated() || false
      };

      return { healthy, details };
    } catch (error) {
      return { 
        healthy: false, 
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}
