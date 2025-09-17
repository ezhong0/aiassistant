/**
 * Google Calendar Types with Zod validation
 */

import { z } from 'zod';

// ✅ Zod schemas for Calendar types
export const CalendarEventSchema = z.object({
  id: z.string(),
  summary: z.string(),
  description: z.string().optional(),
  start: z.object({
    dateTime: z.string().optional(),
    date: z.string().optional(),
    timeZone: z.string().optional()
  }),
  end: z.object({
    dateTime: z.string().optional(),
    date: z.string().optional(),
    timeZone: z.string().optional()
  }),
  attendees: z.array(z.object({
    email: z.string(),
    displayName: z.string().optional(),
    responseStatus: z.enum(['needsAction', 'declined', 'tentative', 'accepted']).optional(),
    optional: z.boolean().optional()
  })).optional(),
  location: z.string().optional(),
  recurrence: z.array(z.string()).optional(),
  status: z.enum(['confirmed', 'tentative', 'cancelled']).optional(),
  transparency: z.enum(['opaque', 'transparent']).optional(),
  visibility: z.enum(['default', 'public', 'private', 'confidential']).optional(),
  created: z.string().optional(),
  updated: z.string().optional(),
  creator: z.object({
    email: z.string(),
    displayName: z.string().optional()
  }).optional(),
  organizer: z.object({
    email: z.string(),
    displayName: z.string().optional()
  }).optional()
});

export const CreateEventRequestSchema = z.object({
  summary: z.string(),
  description: z.string().optional(),
  start: z.object({
    dateTime: z.string().optional(),
    date: z.string().optional(),
    timeZone: z.string().optional()
  }),
  end: z.object({
    dateTime: z.string().optional(),
    date: z.string().optional(),
    timeZone: z.string().optional()
  }),
  attendees: z.array(z.object({
    email: z.string(),
    displayName: z.string().optional(),
    optional: z.boolean().optional()
  })).optional(),
  location: z.string().optional(),
  recurrence: z.array(z.string()).optional(),
  reminders: z.object({
    useDefault: z.boolean().optional(),
    overrides: z.array(z.object({
      method: z.enum(['email', 'popup']),
      minutes: z.number()
    })).optional()
  }).optional()
});

export const UpdateEventRequestSchema = z.object({
  eventId: z.string(),
  summary: z.string().optional(),
  description: z.string().optional(),
  start: z.object({
    dateTime: z.string().optional(),
    date: z.string().optional(),
    timeZone: z.string().optional()
  }).optional(),
  end: z.object({
    dateTime: z.string().optional(),
    date: z.string().optional(),
    timeZone: z.string().optional()
  }).optional(),
  attendees: z.array(z.object({
    email: z.string(),
    displayName: z.string().optional(),
    optional: z.boolean().optional()
  })).optional(),
  location: z.string().optional(),
  recurrence: z.array(z.string()).optional(),
  reminders: z.object({
    useDefault: z.boolean().optional(),
    overrides: z.array(z.object({
      method: z.enum(['email', 'popup']),
      minutes: z.number()
    })).optional()
  }).optional()
});

export const ListEventsRequestSchema = z.object({
  calendarId: z.string().optional(),
  timeMin: z.string().optional(),
  timeMax: z.string().optional(),
  maxResults: z.number().optional(),
  singleEvents: z.boolean().optional(),
  orderBy: z.enum(['startTime', 'updated']).optional(),
  q: z.string().optional() // Search query
});

export const CalendarOperationResultSchema = z.object({
  success: z.boolean(),
  eventId: z.string().optional(),
  error: z.string().optional(),
  operation: z.string(),
  timestamp: z.string()
});

export const ListEventsResponseSchema = z.object({
  success: z.boolean(),
  events: z.array(CalendarEventSchema).optional(),
  nextPageToken: z.string().optional(),
  error: z.string().optional()
});

export const GetEventResponseSchema = z.object({
  success: z.boolean(),
  event: CalendarEventSchema.optional(),
  error: z.string().optional()
});

export const CreateEventResponseSchema = z.object({
  success: z.boolean(),
  event: CalendarEventSchema.optional(),
  error: z.string().optional()
});

export const UpdateEventResponseSchema = z.object({
  success: z.boolean(),
  event: CalendarEventSchema.optional(),
  error: z.string().optional()
});

// Type inference from schemas
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;
export type CreateEventRequest = z.infer<typeof CreateEventRequestSchema>;
export type UpdateEventRequest = z.infer<typeof UpdateEventRequestSchema>;
export type ListEventsRequest = z.infer<typeof ListEventsRequestSchema>;
export type CalendarOperationResult = z.infer<typeof CalendarOperationResultSchema>;
export type ListEventsResponse = z.infer<typeof ListEventsResponseSchema>;
export type GetEventResponse = z.infer<typeof GetEventResponseSchema>;
export type CreateEventResponse = z.infer<typeof CreateEventResponseSchema>;
export type UpdateEventResponse = z.infer<typeof UpdateEventResponseSchema>;

/**
 * Additional interfaces that don't need Zod validation yet
 */

export interface CalendarAvailability {
  calendarId: string;
  busy: Array<{
    start: string;
    end: string;
  }>;
  free: Array<{
    start: string;
    end: string;
  }>;
}

export interface TimeSlot {
  start: string;
  end: string;
  available: boolean;
  conflictingEvents?: CalendarEvent[];
}

export interface FindMeetingTimeRequest {
  attendees: string[];
  duration: number; // in minutes
  timeMin: string;
  timeMax: string;
  meetingRooms?: string[];
  excludeWeekends?: boolean;
  workingHours?: {
    start: string; // HH:MM format
    end: string;   // HH:MM format
    days: number[]; // 0-6, Sunday-Saturday
  };
}

export interface MeetingTimeSuggestion {
  start: string;
  end: string;
  attendees: Array<{
    email: string;
    available: boolean;
  }>;
  meetingRooms?: Array<{
    email: string;
    available: boolean;
  }>;
  confidence: number; // 0-1
}

export interface CalendarListEntry {
  id: string;
  summary: string;
  description?: string;
  timeZone: string;
  colorId: string;
  backgroundColor: string;
  foregroundColor: string;
  accessRole: 'none' | 'freeBusyReader' | 'reader' | 'writer' | 'owner';
  primary?: boolean;
  selected?: boolean;
  hidden?: boolean;
}

export interface CalendarSettings {
  timeZone: string;
  workingHours: {
    start: string;
    end: string;
    days: number[];
  };
  defaultReminders: Array<{
    method: 'email' | 'popup';
    minutes: number;
  }>;
  eventAttendeeOptions: {
    hideAttendeeDetails: boolean;
    showDeclinedEvents: boolean;
  };
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  count?: number;
  until?: string;
  byDay?: string[];
  byMonth?: number[];
  byMonthDay?: number[];
  byYearDay?: number[];
  byWeekNo?: number[];
  byHour?: number[];
  byMinute?: number[];
  bySecond?: number[];
  bySetPos?: number[];
  weekStart?: 'SU' | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA';
}

export interface EventConflict {
  eventId: string;
  summary: string;
  start: string;
  end: string;
  attendees: string[];
  conflictType: 'time' | 'attendee' | 'room';
}

export interface CalendarAnalytics {
  totalEvents: number;
  eventsByType: Record<string, number>;
  averageEventDuration: number;
  mostActiveDay: string;
  mostActiveHour: number;
  topAttendees: Array<{
    email: string;
    name?: string;
    eventCount: number;
  }>;
  eventsByMonth: Array<{
    month: string;
    count: number;
  }>;
}

export class CalendarServiceError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, code: string, statusCode: number = 500) {
    super(message);
    this.name = 'CalendarServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CalendarServiceError);
    }
  }
}

export enum CalendarErrorCode {
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NOT_FOUND = 'NOT_FOUND',
  CREATE_FAILED = 'CREATE_FAILED',
  UPDATE_FAILED = 'UPDATE_FAILED',
  DELETE_FAILED = 'DELETE_FAILED',
  LIST_FAILED = 'LIST_FAILED',
  INVALID_REQUEST = 'INVALID_REQUEST',
  RATE_LIMITED = 'RATE_LIMITED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  CONFLICT_DETECTED = 'CONFLICT_DETECTED'
}

// Type Guards
export const isCalendarEvent = (obj: any): obj is CalendarEvent => {
  return obj && typeof obj.id === 'string' && typeof obj.summary === 'string';
}

export const isCalendarServiceError = (error: any): error is CalendarServiceError => {
  return error instanceof CalendarServiceError;
}

// Utility Types
export type EventStatus = 'confirmed' | 'tentative' | 'cancelled';
export type EventVisibility = 'default' | 'public' | 'private' | 'confidential';
export type EventTransparency = 'opaque' | 'transparent';
export type AttendeeResponseStatus = 'needsAction' | 'declined' | 'tentative' | 'accepted';
export type ReminderMethod = 'email' | 'popup';
export type AccessRole = 'none' | 'freeBusyReader' | 'reader' | 'writer' | 'owner';
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type WeekStart = 'SU' | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA';
export type ConflictType = 'time' | 'attendee' | 'room';
