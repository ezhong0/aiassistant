/**
 * Validation middleware using Zod schemas
 */

import { Request, Response, NextFunction } from 'express';
// import { createLogContext } from '../utils/log-context';
import { z, ZodSchema, ZodError } from 'zod';
import logger from '../utils/logger';
import { createErrorContext } from '../utils/app-error';
import { ErrorFactory } from '../errors/error-factory';

export interface ValidationOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: unknown;
}

export interface ValidationResult {
  success: boolean;
  errors: ValidationError[];
  data?: Record<string, unknown>;
}

/**
 * Transform Zod errors to our validation error format
 */
function transformZodErrors(error: ZodError): ValidationError[] {
  return error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
    value: undefined as unknown, // ZodIssue doesn't have input property
  }));
}

/**
 * Validate request data against Zod schemas
 */
export function validateRequest(options: ValidationOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validationResult: ValidationResult = {
        success: true,
        errors: [],
      };

      // Validate body
      if (options.body) {
        try {
          req.body = options.body.parse(req.body);
        } catch (error) {
          if (error instanceof ZodError) {
            validationResult.errors.push(...transformZodErrors(error));
            validationResult.success = false;
          }
        }
      }

      // Validate query parameters
      if (options.query) {
        try {
          req.query = options.query.parse(req.query);
        } catch (error) {
          if (error instanceof ZodError) {
            validationResult.errors.push(...transformZodErrors(error));
            validationResult.success = false;
          }
        }
      }

      // Validate route parameters
      if (options.params) {
        try {
          req.params = options.params.parse(req.params);
        } catch (error) {
          if (error instanceof ZodError) {
            validationResult.errors.push(...transformZodErrors(error));
            validationResult.success = false;
          }
        }
      }

      // Validate headers
      if (options.headers) {
        try {
          req.headers = options.headers.parse(req.headers);
        } catch (error) {
          if (error instanceof ZodError) {
            validationResult.errors.push(...transformZodErrors(error));
            validationResult.success = false;
          }
        }
      }

      if (!validationResult.success) {
        const errorContext = createErrorContext(req, { operation: 'validation_failed' });
        
        logger.warn('Validation failed', {
          correlationId: errorContext.correlationId,
          operation: 'validation_middleware',
          metadata: {
            errors: JSON.stringify(validationResult.errors),
            path: req.path,
            method: req.method,
            body: JSON.stringify(req.body),
            query: JSON.stringify(req.query),
            params: JSON.stringify(req.params),
            headers: JSON.stringify(req.headers),
            timestamp: new Date().toISOString(),
          },
        });

        // Throw AppError instead of sending response directly
        // Transform ValidationError[] to Record<string, string>
        const errorRecord = validationResult.errors.reduce((acc, err) => {
          acc[err.field] = err.message;
          return acc;
        }, {} as Record<string, string>);
        throw ErrorFactory.validation.multipleErrors(errorRecord);
      }

      next();
    } catch (error) {
      const errorContext = createErrorContext(req, { operation: 'validation_error' });
      
      logger.error('Validation middleware error', error as Error, {
        correlationId: errorContext.correlationId,
        operation: 'validation_middleware',
        metadata: { 
          error: error instanceof Error ? error.message : JSON.stringify(error),
          stack: error instanceof Error ? error.stack : undefined,
          path: req.path,
          method: req.method,
          body: JSON.stringify(req.body),
          timestamp: new Date().toISOString(),
        },
      });
      
      // Throw AppError instead of sending response directly
      throw ErrorFactory.domain.serviceError('ValidationMiddleware', 'Internal validation error', {
        path: req.path,
        method: req.method,
      });
    }
  };
}

/**
 * Sanitize input data to prevent XSS and other attacks
 * Note: Main sanitization is handled by security.middleware.ts
 */
export function sanitizeInput(data: unknown): unknown {
  if (typeof data === 'string') {
    return data
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .trim();
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeInput);
  }
  
  if (data && typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return data;
}

/**
 * Type guard functions for runtime type checking
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isEmail(value: unknown): value is string {
  return isString(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isUUID(value: unknown): value is string {
  return isString(value) && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Validate and transform response data
 */
export function validateResponse<T>(schema: ZodSchema<T>) {
  return (data: unknown): T => {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof ZodError) {
        logger.error('Response validation failed', error as Error, {
          correlationId: `response-validation-${Date.now()}`,
          operation: 'response_validation',
          metadata: {
            errors: transformZodErrors(error),
            data,
          },
        });
        throw ErrorFactory.validation.invalidInput('response', data, 'valid response schema');
      }
      throw error;
    }
  };
}

/**
 * Create a validation middleware factory for common patterns
 */
export function createValidationMiddleware<T extends ValidationOptions>(
  schemas: T,
) {
  return validateRequest(schemas);
}

/**
 * Async validation for complex operations
 */
export async function validateAsync<T>(
  schema: ZodSchema<T>,
  data: unknown,
): Promise<{ success: boolean; data?: T; errors?: ValidationError[] }> {
  try {
    const validatedData = await schema.parseAsync(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        errors: transformZodErrors(error),
      };
    }
    throw error;
  }
}

/**
 * Auth-specific validation schemas and functions
 */
export const authSchemas = {
  googleCallback: z.object({
    code: z.string().min(1, 'Authorization code is required'),
    state: z.string().optional(),
    error: z.string().optional(),
    error_description: z.string().optional(),
  }),
  
  tokenRefresh: z.object({
    refresh_token: z.string().min(1, 'Refresh token is required'),
  }),
  
  mobileTokenExchange: z.object({
    access_token: z.string().min(1, 'Access token is required'),
    refresh_token: z.string().optional(),
    id_token: z.string().optional(),
    platform: z.enum(['web', 'slack']),
  }),
  
  logout: z.object({
    access_token: z.string().optional(),
    everywhere: z.boolean().optional().default(false),
  }),
  
  userId: z.object({
    userId: z.string().min(1, 'User ID is required'),
  }),
  
  profileUpdate: z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    preferences: z.record(z.any()).optional(),
  }),
  
  pagination: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(10),
  }),
};

/**
 * Auth validation middleware functions
 */
export const validateGoogleCallback = validateRequest({ query: authSchemas.googleCallback });
export const validateTokenRefresh = validateRequest({ body: authSchemas.tokenRefresh });
export const validateMobileTokenExchange = validateRequest({ body: authSchemas.mobileTokenExchange });
export const validateLogout = validateRequest({ body: authSchemas.logout });
export const validateUserId = validateRequest({ params: authSchemas.userId });
export const validateProfileUpdate = validateRequest({ body: authSchemas.profileUpdate });
export const validatePagination = validateRequest({ query: authSchemas.pagination });
