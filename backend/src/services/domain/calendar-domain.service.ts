import { BaseService } from '../base-service';
import { getAPIClient } from '../api';
import { GoogleAPIClient } from '../api/clients/google-api-client';
import { AuthCredentials } from '../../types/api/api-client.types';
import { APIClientError, APIClientErrorCode } from '../../errors/api-client.errors';
import { ValidationHelper, CalendarValidationSchemas } from '../../validation/api-client.validation';
import { ICalendarDomainService } from './interfaces/domain-service.interfaces';
import { GoogleOAuthManager } from '../oauth/google-oauth-manager';
import { serviceManager } from '../service-manager';
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
export class CalendarDomainService extends BaseService implements ICalendarDomainService {
  private googleClient: GoogleAPIClient | null = null;
  private googleOAuthManager: GoogleOAuthManager | null = null;

  constructor() {
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
      
      // Get OAuth manager
      this.googleOAuthManager = serviceManager.getService<GoogleOAuthManager>('googleOAuthManager') || null;
      
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
      throw new Error('GoogleOAuthManager not available');
    }
    
    const authUrl = await this.googleOAuthManager.generateAuthUrl(context);
    return { authUrl, state: 'generated' }; // TODO: Return actual state from OAuth manager
  }

  async completeOAuth(userId: string, code: string, state: string): Promise<void> {
    this.assertReady();
    
    if (!this.googleOAuthManager) {
      throw new Error('GoogleOAuthManager not available');
    }
    
    const result = await this.googleOAuthManager.exchangeCodeForTokens(code, state);
    if (!result.success) {
      throw new Error(result.error || 'OAuth completion failed');
    }
  }

  async refreshTokens(userId: string): Promise<void> {
    this.assertReady();
    
    if (!this.googleOAuthManager) {
      throw new Error('GoogleOAuthManager not available');
    }
    
    const success = await this.googleOAuthManager.refreshTokens(userId);
    if (!success) {
      throw new Error('Token refresh failed');
    }
  }

  async revokeTokens(userId: string): Promise<void> {
    this.assertReady();
    
    if (!this.googleOAuthManager) {
      throw new Error('GoogleOAuthManager not available');
    }
    
    const success = await this.googleOAuthManager.revokeTokens(userId);
    if (!success) {
      throw new Error('Token revocation failed');
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
   * Legacy authentication method (to be removed)
   */
  async authenticate(accessToken: string, refreshToken?: string): Promise<void> {
    this.assertReady();
    
    if (!this.googleClient) {
      throw APIClientError.nonRetryable(
        APIClientErrorCode.CLIENT_NOT_INITIALIZED,
        'Google client not available',
        { serviceName: 'CalendarDomainService' }
      );
    }

    try {
      const credentials: AuthCredentials = {
        type: 'oauth2',
        accessToken,
        refreshToken
      };

      await this.googleClient.authenticate(credentials);
      this.logInfo('Calendar service authenticated successfully');
    } catch (error) {
      throw APIClientError.fromError(error, {
        serviceName: 'CalendarDomainService',
        endpoint: 'authenticate'
      });
    }
  }

  /**
   * Create a calendar event (with automatic authentication)
   */
  async createEvent(userId: string, params: {
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
    recurrence?: string[];
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
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
    attendees?: Array<{ email: string; responseStatus?: string }>;
    location?: string;
    htmlLink: string;
  }> {
    this.assertReady();
    
    if (!this.googleClient) {
      throw APIClientError.nonRetryable(
        APIClientErrorCode.CLIENT_NOT_INITIALIZED,
        'Google client not available',
        { serviceName: 'CalendarDomainService' }
      );
    }

    try {
      // Get valid tokens for user
      const token = await this.googleOAuthManager!.getValidTokens(userId);
      if (!token) {
        throw new Error('OAuth required - call initializeOAuth first');
      }
      
      // Authenticate with valid token
      await this.authenticate(token);
      
      // Validate input parameters
      const validatedParams = ValidationHelper.validate(CalendarValidationSchemas.createEvent, params);

      this.logInfo('Creating calendar event', {
        summary: validatedParams.summary,
        start: validatedParams.start.dateTime,
        end: validatedParams.end.dateTime,
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
        start: response.data.start,
        end: response.data.end,
        attendees: response.data.attendees,
        location: response.data.location,
        htmlLink: response.data.htmlLink
      };

      this.logInfo('Calendar event created successfully', {
        eventId: result.id,
        summary: result.summary
      });

      return result;
    } catch (error) {
      if (error instanceof APIClientError) {
        throw error;
      }
      throw APIClientError.fromError(error, {
        serviceName: 'CalendarDomainService',
        endpoint: 'createEvent',
        method: 'POST'
      });
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
      throw new Error('Google client not available');
    }

    try {
      // Get valid tokens for user
      const token = await this.googleOAuthManager!.getValidTokens(userId);
      if (!token) {
        throw new Error('OAuth required - call initializeOAuth first');
      }
      
      // Authenticate with valid token
      await this.authenticate(token);
      
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
    start: { dateTime?: string; date?: string; timeZone?: string };
    end: { dateTime?: string; date?: string; timeZone?: string };
    attendees?: Array<{ email: string; responseStatus?: string }>;
    location?: string;
    htmlLink: string;
    status: string;
    recurrence?: string[];
  }> {
    this.assertReady();
    
    if (!this.googleClient) {
      throw new Error('Google client not available');
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
        start: response.data.start,
        end: response.data.end,
        attendees: response.data.attendees,
        location: response.data.location,
        htmlLink: response.data.htmlLink,
        status: response.data.status,
        recurrence: response.data.recurrence
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
  async updateEvent(userId: string, params: {
    eventId: string;
    calendarId?: string;
    summary?: string;
    description?: string;
    start?: {
      dateTime: string;
      timeZone?: string;
    };
    end?: {
      dateTime: string;
      timeZone?: string;
    };
    attendees?: Array<{
      email: string;
      responseStatus?: string;
    }>;
    location?: string;
  }): Promise<{
    id: string;
    summary: string;
    start: { dateTime?: string; date?: string; timeZone?: string };
    end: { dateTime?: string; date?: string; timeZone?: string };
    attendees?: Array<{ email: string; responseStatus?: string }>;
    location?: string;
    htmlLink: string;
  }> {
    this.assertReady();
    
    if (!this.googleClient) {
      throw new Error('Google client not available');
    }

    try {
      // Get valid tokens for user
      const token = await this.googleOAuthManager!.getValidTokens(userId);
      if (!token) {
        throw new Error('OAuth required - call initializeOAuth first');
      }
      
      // Authenticate with valid token
      await this.authenticate(token);
      
      this.logInfo('Updating calendar event', {
        eventId: params.eventId,
        calendarId: params.calendarId || 'primary'
      });

      const eventData = {
        summary: params.summary,
        description: params.description,
        start: params.start,
        end: params.end,
        attendees: params.attendees,
        location: params.location
      };

      const response = await this.googleClient.makeRequest({
        method: 'PATCH',
        endpoint: '/calendar/v3/calendars/primary/events/patch',
        query: {
          calendarId: params.calendarId || 'primary',
          eventId: params.eventId,
          sendUpdates: 'all'
        },
        data: eventData
      });

      const result = {
        id: response.data.id,
        summary: response.data.summary,
        start: response.data.start,
        end: response.data.end,
        attendees: response.data.attendees,
        location: response.data.location,
        htmlLink: response.data.htmlLink
      };

      this.logInfo('Calendar event updated successfully', {
        eventId: result.id,
        summary: result.summary
      });

      return result;
    } catch (error) {
      this.logError('Failed to update calendar event', error, { eventId: params.eventId });
      throw error;
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(userId: string, eventId: string, calendarId: string = 'primary'): Promise<void> {
    this.assertReady();
    
    if (!this.googleClient) {
      throw new Error('Google client not available');
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
      throw new Error('Google client not available');
    }

    try {
      // Get valid tokens for user
      const token = await this.googleOAuthManager!.getValidTokens(userId);
      if (!token) {
        throw new Error('OAuth required - call initializeOAuth first');
      }
      
      // Authenticate with valid token
      await this.authenticate(token);
      
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
      throw new Error('Google client not available');
    }

    try {
      // Get valid tokens for user
      const token = await this.googleOAuthManager!.getValidTokens(userId);
      if (!token) {
        throw new Error('OAuth required - call initializeOAuth first');
      }
      
      // Authenticate with valid token
      await this.authenticate(token);
      
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
    accessRole: string;
    backgroundColor?: string;
    foregroundColor?: string;
  }>> {
    this.assertReady();
    
    if (!this.googleClient) {
      throw new Error('Google client not available');
    }

    try {
      // Get valid tokens for user
      const token = await this.googleOAuthManager!.getValidTokens(userId);
      if (!token) {
        throw new Error('OAuth required - call initializeOAuth first');
      }
      
      // Authenticate with valid token
      await this.authenticate(token);
      
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
