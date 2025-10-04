/**
 * Calendar Domain Service Interface
 * Focused interface for calendar-related operations
 */

import { IDomainService } from './base-domain.interface';

/**
 * Calendar event recurrence pattern
 */
export interface CalendarRecurrence {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;
  daysOfWeek?: string[];
  until?: Date;
  count?: number;
}

/**
 * Calendar event attendee
 */
export interface CalendarAttendee {
  email: string;
  displayName?: string;
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  optional?: boolean;
  organizer?: boolean;
}

/**
 * Calendar event input for creation
 */
export interface CalendarEventInput {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  attendees?: CalendarAttendee[];
  recurrence?: CalendarRecurrence;
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
  visibility?: 'default' | 'public' | 'private' | 'confidential';
  transparency?: 'opaque' | 'transparent';
}

/**
 * Calendar event details
 */
export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  attendees?: CalendarAttendee[];
  organizer?: {
    email: string;
    displayName?: string;
  };
  created: Date;
  updated: Date;
  status: 'tentative' | 'confirmed' | 'cancelled';
  visibility: 'default' | 'public' | 'private' | 'confidential';
  transparency: 'opaque' | 'transparent';
  recurrence?: CalendarRecurrence;
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
}

/**
 * Parameters for getting calendar events
 */
export interface GetEventsParams {
  calendarId?: string;
  timeMin?: Date;
  timeMax?: Date;
  maxResults?: number;
  singleEvents?: boolean;
  orderBy?: 'startTime' | 'updated';
  query?: string;
  showDeleted?: boolean;
  showHiddenInvitations?: boolean;
}

/**
 * Calendar information
 */
export interface Calendar {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  timeZone: string;
  colorId?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  accessRole: 'none' | 'freeBusyReader' | 'reader' | 'writer' | 'owner';
  defaultReminders?: Array<{
    method: 'email' | 'popup';
    minutes: number;
  }>;
  primary?: boolean;
  selected?: boolean;
}

/**
 * Free/busy query parameters
 */
export interface FreeBusyQueryParams {
  timeMin: Date;
  timeMax: Date;
  items: Array<{ id: string }>;
  timeZone?: string;
}

/**
 * Free/busy information
 */
export interface FreeBusyInfo {
  calendars: Record<string, {
    busy: Array<{
      start: Date;
      end: Date;
    }>;
    errors?: Array<{
      domain: string;
      reason: string;
    }>;
  }>;
  timeMin: Date;
  timeMax: Date;
}

/**
 * Calendar event update parameters
 */
export interface CalendarEventUpdate {
  summary?: string;
  description?: string;
  start?: Date;
  end?: Date;
  location?: string;
  attendees?: CalendarAttendee[];
  recurrence?: CalendarRecurrence;
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
  visibility?: 'default' | 'public' | 'private' | 'confidential';
  transparency?: 'opaque' | 'transparent';
}

/**
 * Quick add event parameters
 */
export interface QuickAddEventParams {
  text: string;
  calendarId?: string;
  sendUpdates?: 'all' | 'externalOnly' | 'none';
}

/**
 * Calendar Domain Service Interface
 * Handles all calendar-related operations with automatic OAuth management
 */
export interface ICalendarDomainService extends IDomainService {
  // ===== Event Operations =====

  /**
   * Create a calendar event
   */
  createEvent(userId: string, event: CalendarEventInput): Promise<CalendarEvent>;

  /**
   * Get calendar events
   */
  getEvents(userId: string, params: GetEventsParams): Promise<CalendarEvent[]>;

  /**
   * Get a specific event by ID
   */
  getEvent(eventId: string, calendarId?: string): Promise<CalendarEvent>;

  /**
   * Update a calendar event
   */
  updateEvent(userId: string, eventId: string, updates: CalendarEventUpdate, calendarId?: string): Promise<CalendarEvent>;

  /**
   * Delete a calendar event
   */
  deleteEvent(eventId: string, calendarId?: string, sendUpdates?: 'all' | 'externalOnly' | 'none'): Promise<void>;

  /**
   * Quick add event from natural language
   */
  quickAddEvent(userId: string, params: QuickAddEventParams): Promise<CalendarEvent>;

  // ===== Calendar Management =====

  /**
   * List user's calendars
   */
  listCalendars(userId: string): Promise<Calendar[]>;

  /**
   * Get calendar details
   */
  getCalendar(calendarId: string): Promise<Calendar>;

  /**
   * Create a new calendar
   */
  createCalendar(userId: string, calendar: {
    summary: string;
    description?: string;
    location?: string;
    timeZone?: string;
  }): Promise<Calendar>;

  /**
   * Update calendar settings
   */
  updateCalendar(calendarId: string, updates: {
    summary?: string;
    description?: string;
    location?: string;
    timeZone?: string;
  }): Promise<Calendar>;

  /**
   * Delete a calendar
   */
  deleteCalendar(calendarId: string): Promise<void>;

  // ===== Availability & Scheduling =====

  /**
   * Query free/busy information
   */
  queryFreeBusy(userId: string, params: FreeBusyQueryParams): Promise<FreeBusyInfo>;

  /**
   * Find available meeting times
   */
  findAvailableTimes(userId: string, params: {
    attendees: string[];
    duration: number; // in minutes
    timeMin: Date;
    timeMax: Date;
    workingHours?: {
      start: string; // "09:00"
      end: string;   // "17:00"
      daysOfWeek?: number[]; // 1-7, Monday-Sunday
    };
    preferredTimes?: Array<{ start: string; end: string }>;
  }): Promise<Array<{
    start: Date;
    end: Date;
    score?: number; // how good this time slot is (0-1)
  }>>;

  // ===== Event Response Management =====

  /**
   * Respond to calendar invitation
   */
  respondToEvent(userId: string, params: { eventId: string; response: 'accepted' | 'declined' | 'tentative'; calendarId?: string }): Promise<void>;

  /**
   * Get event instances (for recurring events)
   */
  getEventInstances(eventId: string, params: {
    timeMin?: Date;
    timeMax?: Date;
    maxResults?: number;
    calendarId?: string;
  }): Promise<CalendarEvent[]>;

  // ===== Import/Export =====

  /**
   * Import events from ICS
   */
  importEvents(userId: string, icsData: string, calendarId?: string): Promise<{
    imported: number;
    updated: number;
    errors: string[];
  }>;

  /**
   * Export calendar to ICS
   */
  exportCalendar(calendarId: string, params?: {
    timeMin?: Date;
    timeMax?: Date;
  }): Promise<string>;

  // ===== Notifications =====

  /**
   * Set up calendar notifications
   */
  setupNotifications(userId: string, params: {
    calendarId: string;
    webhookUrl: string;
    events?: string[]; // types of events to watch
  }): Promise<{
    channelId: string;
    resourceId: string;
    expiration: Date;
  }>;

  /**
   * Stop calendar notifications
   */
  stopNotifications(channelId: string, resourceId: string): Promise<void>;

  // ===== Utility Methods =====

  /**
   * Get user's timezone
   */
  getUserTimezone(userId: string): Promise<string>;

  /**
   * Get calendar colors
   */
  getColors(): Promise<{
    calendar: Record<string, { background: string; foreground: string }>;
    event: Record<string, { background: string; foreground: string }>;
  }>;

  /**
   * Move event to different calendar
   */
  moveEvent(eventId: string, fromCalendarId: string, toCalendarId: string): Promise<CalendarEvent>;
}