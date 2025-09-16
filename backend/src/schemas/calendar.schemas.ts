/**
 * Calendar validation schemas
 */

import { z } from 'zod';
import { OptionalStringSchema, OptionalNumberSchema } from './common.schemas';

// Calendar event schemas
export const CalendarEventSchema = z.object({
  id: z.string(),
  summary: z.string(),
  description: OptionalStringSchema,
  start: z.object({
    dateTime: z.string(),
    timeZone: OptionalStringSchema,
  }),
  end: z.object({
    dateTime: z.string(),
    timeZone: OptionalStringSchema,
  }),
  location: OptionalStringSchema,
  attendees: z.array(z.object({
    email: z.string().email(),
    displayName: OptionalStringSchema,
    responseStatus: z.enum(['needsAction', 'declined', 'tentative', 'accepted']).optional(),
  })).optional(),
  recurrence: z.array(z.string()).optional(),
  reminders: z.object({
    useDefault: z.boolean().optional(),
    overrides: z.array(z.object({
      method: z.enum(['email', 'popup']),
      minutes: z.number(),
    })).optional(),
  }).optional(),
});

// Create event request schema
export const CreateEventRequestSchema = z.object({
  summary: z.string().min(1),
  description: OptionalStringSchema,
  start: z.object({
    dateTime: z.string(),
    timeZone: OptionalStringSchema,
  }),
  end: z.object({
    dateTime: z.string(),
    timeZone: OptionalStringSchema,
  }),
  location: OptionalStringSchema,
  attendees: z.array(z.object({
    email: z.string().email(),
    displayName: OptionalStringSchema,
  })).optional(),
  recurrence: z.array(z.string()).optional(),
  reminders: z.object({
    useDefault: z.boolean().optional(),
    overrides: z.array(z.object({
      method: z.enum(['email', 'popup']),
      minutes: z.number(),
    })).optional(),
  }).optional(),
});

// Update event request schema
export const UpdateEventRequestSchema = z.object({
  eventId: z.string(),
  summary: OptionalStringSchema,
  description: OptionalStringSchema,
  start: z.object({
    dateTime: z.string(),
    timeZone: OptionalStringSchema,
  }).optional(),
  end: z.object({
    dateTime: z.string(),
    timeZone: OptionalStringSchema,
  }).optional(),
  location: OptionalStringSchema,
  attendees: z.array(z.object({
    email: z.string().email(),
    displayName: OptionalStringSchema,
  })).optional(),
  recurrence: z.array(z.string()).optional(),
  reminders: z.object({
    useDefault: z.boolean().optional(),
    overrides: z.array(z.object({
      method: z.enum(['email', 'popup']),
      minutes: z.number(),
    })).optional(),
  }).optional(),
});

// List events request schema
export const ListEventsRequestSchema = z.object({
  calendarId: z.string().default('primary'),
  timeMin: z.string().optional(),
  timeMax: z.string().optional(),
  maxResults: z.number().min(1).max(250).optional(),
  singleEvents: z.boolean().optional(),
  orderBy: z.enum(['startTime', 'updated']).optional(),
});

// Calendar list schema
export const CalendarListSchema = z.object({
  id: z.string(),
  summary: z.string(),
  description: OptionalStringSchema,
  timeZone: z.string(),
  accessRole: z.enum(['freeBusyReader', 'reader', 'writer', 'owner']),
  primary: z.boolean().optional(),
  selected: z.boolean().optional(),
});

// Free/busy request schema
export const FreeBusyRequestSchema = z.object({
  timeMin: z.string(),
  timeMax: z.string(),
  items: z.array(z.object({
    id: z.string(),
  })),
});
