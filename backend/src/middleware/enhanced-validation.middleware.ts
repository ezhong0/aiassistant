/**
 * Enhanced validation middleware using Zod schemas
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import logger from '../utils/logger';

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
    value: undefined, // ZodIssue doesn't have input property
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
        logger.warn('Validation failed', {
          errors: JSON.stringify(validationResult.errors),
          path: req.path,
          method: req.method,
          body: JSON.stringify(req.body),
          query: JSON.stringify(req.query),
          params: JSON.stringify(req.params),
          headers: JSON.stringify(req.headers),
          timestamp: new Date().toISOString()
        });

        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validationResult.errors,
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Validation middleware error', { 
        error: error instanceof Error ? error.message : JSON.stringify(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: req.path,
        method: req.method,
        body: JSON.stringify(req.body),
        timestamp: new Date().toISOString()
      });
      res.status(500).json({
        success: false,
        error: 'Internal validation error',
        code: 'INTERNAL_ERROR',
      });
      return;
    }
  };
}

/**
 * Sanitize input data to prevent XSS and other attacks
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
 * Sanitization middleware
 */
export function sanitizeRequest(req: Request, res: Response, next: NextFunction): void {
  try {
    req.body = sanitizeInput(req.body);
    req.query = sanitizeInput(req.query) as any;
    req.params = sanitizeInput(req.params) as any;
    next();
  } catch (error) {
    logger.error('Sanitization middleware error', { error });
    res.status(500).json({
      success: false,
      error: 'Internal sanitization error',
      code: 'INTERNAL_ERROR',
    });
    return;
  }
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
        logger.error('Response validation failed', {
          errors: transformZodErrors(error),
          data,
        });
        throw new Error('Response validation failed');
      }
      throw error;
    }
  };
}

/**
 * Create a validation middleware factory for common patterns
 */
export function createValidationMiddleware<T extends ValidationOptions>(
  schemas: T
) {
  return validateRequest(schemas);
}

/**
 * Async validation for complex operations
 */
export async function validateAsync<T>(
  schema: ZodSchema<T>,
  data: unknown
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
