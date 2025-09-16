/**
 * Comprehensive API Route Validation Middleware
 * Applies Zod validation to all API routes with proper error handling
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateRequest, ValidationOptions } from './enhanced-validation.middleware';
import logger from '../utils/logger';

// Common validation schemas for API routes
export const CommonValidationSchemas = {
  // Pagination parameters
  pagination: z.object({
    limit: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
    offset: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
  }),

  // Sorting parameters
  sorting: z.object({
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),

  // Search parameters
  search: z.object({
    query: z.string().min(1).max(500).optional(),
    filters: z.record(z.string(), z.any()).optional(),
  }),

  // ID parameters
  idParam: z.object({
    id: z.string().uuid().or(z.string().min(1)),
  }),

  // Timestamp parameters
  timestamp: z.object({
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
  }),
};

/**
 * Apply validation to common route patterns
 */
export function validateCommonRoutes() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Apply common validations based on route patterns
    const validations: ValidationOptions = {};

    // Add query validation for pagination/sorting routes
    if (req.path.includes('/list') || req.path.includes('/search')) {
      validations.query = CommonValidationSchemas.pagination.merge(CommonValidationSchemas.sorting);
    }

    // Add ID validation for resource routes
    if (req.params.id) {
      validations.params = CommonValidationSchemas.idParam;
    }

    // Add timestamp validation for time-based routes
    if (req.path.includes('/events') || req.path.includes('/messages')) {
      const timestampSchema = CommonValidationSchemas.timestamp;
      if (validations.query) {
        // Type assertion for merging schemas
        validations.query = (validations.query as any).merge(timestampSchema);
      } else {
        validations.query = timestampSchema;
      }
    }

    if (Object.keys(validations).length > 0) {
      return validateRequest(validations)(req, res, next);
    }

    next();
  };
}

/**
 * Validation middleware for specific route types
 */
export const RouteValidation = {
  // Assistant API routes
  assistant: {
    textCommand: validateRequest({
      body: z.object({
        command: z.string().min(1).max(2000),
        sessionId: z.string().uuid().optional(),
        accessToken: z.string().optional(),
        context: z.object({
          conversationHistory: z.array(z.object({
            role: z.enum(['user', 'assistant']),
            content: z.string().max(5000),
            timestamp: z.string().datetime().optional(),
          })).optional(),
          pendingActions: z.array(z.object({
            actionId: z.string(),
            type: z.string(),
            parameters: z.record(z.string(), z.any()),
            awaitingConfirmation: z.boolean().optional(),
          })).optional(),
        }).optional(),
      }),
    }),

    confirmAction: validateRequest({
      body: z.object({
        actionId: z.string(),
        confirmed: z.boolean(),
        sessionId: z.string().uuid().optional(),
        parameters: z.record(z.string(), z.any()).optional(),
      }),
    }),
  },

  // Auth routes
  auth: {
    googleCallback: validateRequest({
      query: z.object({
        code: z.string(),
        state: z.string().optional(),
        error: z.string().optional(),
        error_description: z.string().optional(),
      }),
    }),

    slackCallback: validateRequest({
      query: z.object({
        code: z.string(),
        state: z.string().optional(),
        error: z.string().optional(),
      }),
    }),

    tokenRefresh: validateRequest({
      body: z.object({
        refresh_token: z.string(),
      }),
    }),
  },

  // Email routes
  email: {
    send: validateRequest({
      body: z.object({
        to: z.union([z.string().email(), z.array(z.string().email())]),
        cc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
        bcc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
        subject: z.string().min(1).max(500),
        body: z.string().min(1).max(50000),
        attachments: z.array(z.object({
          filename: z.string(),
          content: z.string(),
          contentType: z.string().optional(),
        })).optional(),
      }),
    }),

    search: validateRequest({
      query: z.object({
        query: z.string().min(1).max(500),
        maxResults: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
        includeSpamTrash: z.string().optional().transform(val => val === 'true'),
      }),
    }),
  },

  // Calendar routes
  calendar: {
    createEvent: validateRequest({
      body: z.object({
        summary: z.string().min(1).max(500),
        description: z.string().max(2000).optional(),
        start: z.object({
          dateTime: z.string().datetime(),
          timeZone: z.string().optional(),
        }),
        end: z.object({
          dateTime: z.string().datetime(),
          timeZone: z.string().optional(),
        }),
        attendees: z.array(z.string().email()).optional(),
        location: z.string().max(500).optional(),
      }),
    }),

    listEvents: validateRequest({
      query: z.object({
        timeMin: z.string().datetime().optional(),
        timeMax: z.string().datetime().optional(),
        maxResults: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
        calendarId: z.string().optional(),
      }),
    }),
  },

  // Contact routes
  contact: {
    search: validateRequest({
      query: z.object({
        query: z.string().min(1).max(200),
        maxResults: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
      }),
    }),
  },

  // Slack routes
  slack: {
    sendMessage: validateRequest({
      body: z.object({
        channel: z.string(),
        text: z.string().min(1).max(4000),
        threadTs: z.string().optional(),
        blocks: z.array(z.any()).optional(),
      }),
    }),

    searchMessages: validateRequest({
      query: z.object({
        query: z.string().min(1).max(200),
        channel: z.string().optional(),
        limit: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
      }),
    }),
  },
};

/**
 * Apply comprehensive validation to all routes
 */
export function applyComprehensiveValidation() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Log validation attempts in development
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Validating request', {
        method: req.method,
        path: req.path,
        hasBody: !!req.body,
        hasQuery: Object.keys(req.query).length > 0,
        hasParams: Object.keys(req.params).length > 0,
      });
    }

    // Apply common validations
    validateCommonRoutes()(req, res, next);
  };
}

/**
 * Error handling middleware for validation errors
 */
export function handleValidationErrors(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (error.name === 'ZodError') {
    logger.warn('Validation error', {
      path: req.path,
      method: req.method,
      errors: error.errors,
    });

    res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.errors.map((err: any) => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      })),
    });
    return;
  }

  next(error);
}
