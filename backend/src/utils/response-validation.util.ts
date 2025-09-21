/**
import logger from '../utils/logger';
 * Response validation utilities using Zod schemas
 */

import { Response } from 'express';
import { z } from 'zod';

/**
 * Validate and send a response using a Zod schema
 */
export function validateAndSendResponse<T>(
  res: Response,
  schema: z.ZodSchema<T>,
  data: unknown,
  statusCode: number = 200
): void {
  try {
    const validatedData = schema.parse(data);
    res.status(statusCode).json(validatedData);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Response validation failed', error as Error, {
        correlationId: `response-validation-${Date.now()}`,
        operation: 'response_validation_error',
        metadata: {
          errors: error.errors,
          data: data
        }
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal server error - response validation failed',
        code: 'RESPONSE_VALIDATION_ERROR',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }))
      });
    } else {
      logger.error('Unexpected response validation error', error as Error, {
        correlationId: `response-validation-${Date.now()}`,
        operation: 'response_validation_unexpected_error'
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'UNKNOWN_ERROR'
      });
    }
  }
}

/**
 * Send a success response with validation
 */
export function sendSuccessResponse<T>(
  res: Response,
  schema: z.ZodSchema<T>,
  data: unknown,
  statusCode: number = 200
): void {
  validateAndSendResponse(res, schema, data, statusCode);
}

/**
 * Send an error response with validation
 */
export function sendErrorResponse(
  res: Response,
  error: string,
  code?: string,
  details?: Record<string, unknown>,
  statusCode: number = 400
): void {
  const errorData = {
    success: false,
    error,
    code,
    details,
    metadata: {
      timestamp: new Date().toISOString(),
    }
  };
  
  res.status(statusCode).json(errorData);
}

/**
 * Create a response builder with validation
 */
export function createValidatedResponse<T>(schema: z.ZodSchema<T>) {
  return {
    send: (res: Response, data: unknown, statusCode: number = 200) => {
      validateAndSendResponse(res, schema, data, statusCode);
    }
  };
}
