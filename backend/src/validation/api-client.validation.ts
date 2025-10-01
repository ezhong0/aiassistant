import { z } from 'zod';
import { ErrorFactory } from '../errors/error-factory';

/**
 * API Client Validation Schemas
 * 
 * This module defines validation schemas for all API client operations,
 * ensuring type safety and data integrity across the application.
 */

// Base validation schemas
export const BaseValidationSchemas = {
  // Common field validations
  email: z.string().email('Invalid email format'),
  url: z.string().url('Invalid URL format'),
  dateTime: z.string().datetime('Invalid datetime format'),
  timeZone: z.string().min(1, 'Timezone is required'),
  
  // ID validations
  messageId: z.string().min(1, 'Message ID is required'),
  threadId: z.string().min(1, 'Thread ID is required'),
  eventId: z.string().min(1, 'Event ID is required'),
  contactId: z.string().min(1, 'Contact ID is required'),
  channelId: z.string().min(1, 'Channel ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  
  // Pagination
  pagination: z.object({
    pageSize: z.number().int().min(1).max(1000).optional(),
    pageToken: z.string().optional(),
    cursor: z.string().optional(),
  }),
  
  // Time range
  timeRange: z.object({
    timeMin: z.string().datetime().optional(),
    timeMax: z.string().datetime().optional(),
  }),
};

// Email validation schemas
export const EmailValidationSchemas = {
  sendEmail: z.object({
    to: BaseValidationSchemas.email,
    subject: z.string().min(1, 'Subject is required').max(1000, 'Subject too long'),
    body: z.string().min(1, 'Body is required'),
    from: BaseValidationSchemas.email.optional(),
    cc: z.array(BaseValidationSchemas.email).optional(),
    bcc: z.array(BaseValidationSchemas.email).optional(),
    replyTo: BaseValidationSchemas.email.optional(),
    attachments: z.array(z.object({
      filename: z.string().min(1, 'Filename is required'),
      content: z.string().min(1, 'Content is required'),
      contentType: z.string().min(1, 'Content type is required'),
    })).optional(),
  }),
  
  searchEmails: z.object({
    query: z.string().min(1, 'Search query is required'),
    maxResults: z.number().int().min(1).max(500).optional(),
    includeSpamTrash: z.boolean().optional(),
  }),
  
  getEmail: z.object({
    messageId: BaseValidationSchemas.messageId,
  }),
  
  replyToEmail: z.object({
    messageId: BaseValidationSchemas.messageId,
    replyBody: z.string().min(1, 'Reply body is required'),
    attachments: z.array(z.object({
      filename: z.string().min(1, 'Filename is required'),
      content: z.string().min(1, 'Content is required'),
      contentType: z.string().min(1, 'Content type is required'),
    })).optional(),
  }),
  
  getEmailThread: z.object({
    threadId: BaseValidationSchemas.threadId,
  }),
};

// Calendar validation schemas
export const CalendarValidationSchemas = {
  createEvent: z.object({
    summary: z.string().min(1, 'Event summary is required').max(1000, 'Summary too long'),
    description: z.string().max(5000, 'Description too long').optional(),
    start: z.object({
      dateTime: BaseValidationSchemas.dateTime,
      timeZone: BaseValidationSchemas.timeZone.optional(),
    }),
    end: z.object({
      dateTime: BaseValidationSchemas.dateTime,
      timeZone: BaseValidationSchemas.timeZone.optional(),
    }),
    attendees: z.array(z.object({
      email: BaseValidationSchemas.email,
      responseStatus: z.enum(['accepted', 'declined', 'tentative', 'needsAction']).optional(),
    })).optional(),
    location: z.string().max(1000, 'Location too long').optional(),
    recurrence: z.array(z.string()).optional(),
    conferenceData: z.object({
      createRequest: z.object({
        requestId: z.string().min(1, 'Request ID is required'),
        conferenceSolutionKey: z.object({
          type: z.string().min(1, 'Conference solution type is required'),
        }),
      }),
    }).optional(),
    calendarId: z.string().optional(),
  }),
  
  listEvents: z.object({
    calendarId: z.string().optional(),
    ...BaseValidationSchemas.timeRange.shape,
    maxResults: z.number().int().min(1).max(2500).optional(),
    singleEvents: z.boolean().optional(),
    orderBy: z.enum(['startTime', 'updated']).optional(),
    q: z.string().optional(),
  }),
  
  getEvent: z.object({
    eventId: BaseValidationSchemas.eventId,
    calendarId: z.string().optional(),
  }),
  
  updateEvent: z.object({
    eventId: BaseValidationSchemas.eventId,
    calendarId: z.string().optional(),
    summary: z.string().min(1, 'Event summary is required').max(1000, 'Summary too long').optional(),
    description: z.string().max(5000, 'Description too long').optional(),
    start: z.object({
      dateTime: BaseValidationSchemas.dateTime,
      timeZone: BaseValidationSchemas.timeZone.optional(),
    }).optional(),
    end: z.object({
      dateTime: BaseValidationSchemas.dateTime,
      timeZone: BaseValidationSchemas.timeZone.optional(),
    }).optional(),
    attendees: z.array(z.object({
      email: BaseValidationSchemas.email,
      responseStatus: z.enum(['accepted', 'declined', 'tentative', 'needsAction']).optional(),
    })).optional(),
    location: z.string().max(1000, 'Location too long').optional(),
  }),
  
  deleteEvent: z.object({
    eventId: BaseValidationSchemas.eventId,
    calendarId: z.string().optional(),
  }),
  
  checkAvailability: z.object({
    timeMin: BaseValidationSchemas.dateTime,
    timeMax: BaseValidationSchemas.dateTime,
    calendarIds: z.array(z.string()).optional(),
  }),
  
  findAvailableSlots: z.object({
    startDate: BaseValidationSchemas.dateTime,
    endDate: BaseValidationSchemas.dateTime,
    durationMinutes: z.number().int().min(1).max(1440, 'Duration cannot exceed 24 hours'),
    calendarIds: z.array(z.string()).optional(),
  }),
};

// Contacts validation schemas
export const ContactsValidationSchemas = {
  listContacts: z.object({
    ...BaseValidationSchemas.pagination.shape,
    personFields: z.array(z.string()).optional(),
    sortOrder: z.enum(['LAST_NAME_ASCENDING', 'LAST_NAME_DESCENDING', 'FIRST_NAME_ASCENDING', 'FIRST_NAME_DESCENDING']).optional(),
  }),
  
  createContact: z.object({
    names: z.array(z.object({
      givenName: z.string().max(100, 'Given name too long').optional(),
      familyName: z.string().max(100, 'Family name too long').optional(),
      middleName: z.string().max(100, 'Middle name too long').optional(),
    })).optional(),
    emailAddresses: z.array(z.object({
      value: BaseValidationSchemas.email,
      type: z.string().optional(),
      displayName: z.string().max(100, 'Display name too long').optional(),
    })).optional(),
    phoneNumbers: z.array(z.object({
      value: z.string().min(1, 'Phone number is required'),
      type: z.string().optional(),
    })).optional(),
    addresses: z.array(z.object({
      streetAddress: z.string().max(200, 'Street address too long').optional(),
      city: z.string().max(100, 'City too long').optional(),
      region: z.string().max(100, 'Region too long').optional(),
      postalCode: z.string().max(20, 'Postal code too long').optional(),
      country: z.string().max(100, 'Country too long').optional(),
      type: z.string().optional(),
    })).optional(),
    organizations: z.array(z.object({
      name: z.string().max(200, 'Organization name too long').optional(),
      title: z.string().max(200, 'Title too long').optional(),
      type: z.string().optional(),
    })).optional(),
    birthdays: z.array(z.object({
      date: z.object({
        year: z.number().int().min(1900).max(2100).optional(),
        month: z.number().int().min(1).max(12).optional(),
        day: z.number().int().min(1).max(31).optional(),
      }).optional(),
    })).optional(),
  }),
  
  getContact: z.object({
    resourceName: z.string().min(1, 'Resource name is required'),
    personFields: z.array(z.string()).optional(),
  }),
  
  updateContact: z.object({
    resourceName: z.string().min(1, 'Resource name is required'),
    names: z.array(z.object({
      givenName: z.string().max(100, 'Given name too long').optional(),
      familyName: z.string().max(100, 'Family name too long').optional(),
      middleName: z.string().max(100, 'Middle name too long').optional(),
    })).optional(),
    emailAddresses: z.array(z.object({
      value: BaseValidationSchemas.email,
      type: z.string().optional(),
      displayName: z.string().max(100, 'Display name too long').optional(),
    })).optional(),
    phoneNumbers: z.array(z.object({
      value: z.string().min(1, 'Phone number is required'),
      type: z.string().optional(),
    })).optional(),
    addresses: z.array(z.object({
      streetAddress: z.string().max(200, 'Street address too long').optional(),
      city: z.string().max(100, 'City too long').optional(),
      region: z.string().max(100, 'Region too long').optional(),
      postalCode: z.string().max(20, 'Postal code too long').optional(),
      country: z.string().max(100, 'Country too long').optional(),
      type: z.string().optional(),
    })).optional(),
    organizations: z.array(z.object({
      name: z.string().max(200, 'Organization name too long').optional(),
      title: z.string().max(200, 'Title too long').optional(),
      type: z.string().optional(),
    })).optional(),
    birthdays: z.array(z.object({
      date: z.object({
        year: z.number().int().min(1900).max(2100).optional(),
        month: z.number().int().min(1).max(12).optional(),
        day: z.number().int().min(1).max(31).optional(),
      }).optional(),
    })).optional(),
  }),
  
  deleteContact: z.object({
    resourceName: z.string().min(1, 'Resource name is required'),
  }),
  
  searchContacts: z.object({
    query: z.string().min(1, 'Search query is required'),
    ...BaseValidationSchemas.pagination.shape,
    personFields: z.array(z.string()).optional(),
  }),
};

// Slack validation schemas
export const SlackValidationSchemas = {
  sendMessage: z.object({
    channel: BaseValidationSchemas.channelId,
    text: z.string().max(4000, 'Message text too long').optional(),
    blocks: z.array(z.any()).optional(),
    attachments: z.array(z.any()).optional(),
    threadTs: z.string().optional(),
    replyBroadcast: z.boolean().optional(),
    unfurlLinks: z.boolean().optional(),
    unfurlMedia: z.boolean().optional(),
  }),
  
  updateMessage: z.object({
    channel: BaseValidationSchemas.channelId,
    ts: z.string().min(1, 'Timestamp is required'),
    text: z.string().max(4000, 'Message text too long').optional(),
    blocks: z.array(z.any()).optional(),
    attachments: z.array(z.any()).optional(),
  }),
  
  deleteMessage: z.object({
    channel: BaseValidationSchemas.channelId,
    ts: z.string().min(1, 'Timestamp is required'),
  }),
  
  getChannelHistory: z.object({
    channel: BaseValidationSchemas.channelId,
    ...BaseValidationSchemas.pagination.shape,
    oldest: z.string().optional(),
    latest: z.string().optional(),
    inclusive: z.boolean().optional(),
  }),
  
  getThreadReplies: z.object({
    channel: BaseValidationSchemas.channelId,
    ts: z.string().min(1, 'Timestamp is required'),
    ...BaseValidationSchemas.pagination.shape,
    oldest: z.string().optional(),
    latest: z.string().optional(),
    inclusive: z.boolean().optional(),
  }),
  
  getUserInfo: z.object({
    userId: BaseValidationSchemas.userId,
  }),
  
  listUsers: z.object({
    ...BaseValidationSchemas.pagination.shape,
    includeLocale: z.boolean().optional(),
  }),
  
  uploadFile: z.object({
    channels: z.string().optional(),
    content: z.string().optional(),
    file: z.instanceof(Buffer).optional(),
    filename: z.string().min(1, 'Filename is required').optional(),
    title: z.string().max(200, 'Title too long').optional(),
    initialComment: z.string().max(4000, 'Comment too long').optional(),
    threadTs: z.string().optional(),
  }),
};

// AI validation schemas
export const AIValidationSchemas = {
  generateChatCompletion: z.object({
    messages: z.array(z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string().min(1, 'Message content is required'),
    })).min(1, 'At least one message is required'),
    model: z.string().min(1, 'Model is required').optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().min(1).max(4096).optional(),
    topP: z.number().min(0).max(1).optional(),
    frequencyPenalty: z.number().min(-2).max(2).optional(),
    presencePenalty: z.number().min(-2).max(2).optional(),
    stop: z.array(z.string()).optional(),
  }),
  
  generateTextCompletion: z.object({
    prompt: z.string().min(1, 'Prompt is required'),
    model: z.string().min(1, 'Model is required').optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().min(1).max(4096).optional(),
    topP: z.number().min(0).max(1).optional(),
    frequencyPenalty: z.number().min(-2).max(2).optional(),
    presencePenalty: z.number().min(-2).max(2).optional(),
    stop: z.array(z.string()).optional(),
  }),
  
  generateEmbeddings: z.object({
    input: z.union([z.string().min(1, 'Input is required'), z.array(z.string()).min(1, 'Input is required')]),
    model: z.string().min(1, 'Model is required').optional(),
  }),
  
  generateImages: z.object({
    prompt: z.string().min(1, 'Prompt is required').max(1000, 'Prompt too long'),
    n: z.number().int().min(1).max(10).optional(),
    size: z.enum(['256x256', '512x512', '1024x1024']).optional(),
    responseFormat: z.enum(['url', 'b64_json']).optional(),
    user: z.string().optional(),
  }),
  
  transcribeAudio: z.object({
    file: z.instanceof(Buffer).refine(data => data.length > 0, 'Audio file is required'),
    model: z.string().min(1, 'Model is required').optional(),
    language: z.string().min(2, 'Language code is required').optional(),
    prompt: z.string().max(1000, 'Prompt too long').optional(),
    responseFormat: z.enum(['json', 'text', 'srt', 'verbose_json', 'vtt']).optional(),
    temperature: z.number().min(0).max(1).optional(),
  }),
  
  translateAudio: z.object({
    file: z.instanceof(Buffer).refine(data => data.length > 0, 'Audio file is required'),
    model: z.string().min(1, 'Model is required').optional(),
    prompt: z.string().max(1000, 'Prompt too long').optional(),
    responseFormat: z.enum(['json', 'text', 'srt', 'verbose_json', 'vtt']).optional(),
    temperature: z.number().min(0).max(1).optional(),
  }),
};

// Combined validation schemas
export const ValidationSchemas = {
  email: EmailValidationSchemas,
  calendar: CalendarValidationSchemas,
  contacts: ContactsValidationSchemas,
  slack: SlackValidationSchemas,
  ai: AIValidationSchemas,
  base: BaseValidationSchemas,
};

// Validation helper functions
export class ValidationHelper {
  /**
   * Validate data against a schema
   */
  static validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        throw ErrorFactory.api.badRequest(`Validation failed: ${errorMessages.join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Validate data against a schema with custom error handling
   */
  static validateWithError<T>(schema: z.ZodSchema<T>, data: unknown, errorMessage?: string): T {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        const message = errorMessage || `Validation failed: ${errorMessages.join(', ')}`;
        throw ErrorFactory.api.badRequest(message);
      }
      throw error;
    }
  }

  /**
   * Safe validation that returns a result instead of throwing
   */
  static safeValidate<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
    try {
      const result = schema.parse(data);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        return { success: false, error: `Validation failed: ${errorMessages.join(', ')}` };
      }
      return { success: false, error: 'Unknown validation error' };
    }
  }
}
