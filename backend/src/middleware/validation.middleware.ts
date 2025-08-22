import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import logger from '../utils/logger';

export interface ValidationRequest extends Request {
  validatedBody?: unknown;
  validatedQuery?: unknown;
  validatedParams?: unknown;
}

interface ValidationOptions {
  abortEarly?: boolean;
  stripUnknown?: boolean;
}

/**
 * Generic validation middleware factory
 */
export const validate = (schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}, options: ValidationOptions = {}) => {
  return (req: ValidationRequest, res: Response, next: NextFunction): void => {
    try {
      const { body = z.any(), query = z.any(), params = z.any() } = schemas;
      const { abortEarly = true } = options;
      
      const validationResults: { body?: unknown; query?: unknown; params?: unknown } = {};
      const errors: string[] = [];
      
      // Validate body
      if (schemas.body) {
        const bodyResult = body.safeParse(req.body);
        if (bodyResult.success) {
          validationResults.body = bodyResult.data;
          req.validatedBody = bodyResult.data;
        } else {
          const bodyErrors = formatZodError(bodyResult.error, 'body');
          errors.push(...bodyErrors);
          if (abortEarly) {
            return handleValidationError(res, errors, req);
          }
        }
      }
      
      // Validate query
      if (schemas.query) {
        const queryResult = query.safeParse(req.query);
        if (queryResult.success) {
          validationResults.query = queryResult.data;
          req.validatedQuery = queryResult.data;
        } else {
          const queryErrors = formatZodError(queryResult.error, 'query');
          errors.push(...queryErrors);
          if (abortEarly) {
            return handleValidationError(res, errors, req);
          }
        }
      }
      
      // Validate params
      if (schemas.params) {
        const paramsResult = params.safeParse(req.params);
        if (paramsResult.success) {
          validationResults.params = paramsResult.data;
          req.validatedParams = paramsResult.data;
        } else {
          const paramsErrors = formatZodError(paramsResult.error, 'params');
          errors.push(...paramsErrors);
          if (abortEarly) {
            return handleValidationError(res, errors, req);
          }
        }
      }
      
      if (errors.length > 0) {
        return handleValidationError(res, errors, req);
      }
      
      logger.debug('Request validation successful', {
        path: req.path,
        method: req.method,
        validatedFields: Object.keys(validationResults)
      });
      
      next();
    } catch (error) {
      logger.error('Validation middleware error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Internal validation error'
        }
      });
    }
  };
};

/**
 * Format Zod validation errors
 */
const formatZodError = (error: ZodError, source: string): string[] => {
  return error.issues.map((err: any) => {
    const path = err.path.length > 0 ? err.path.join('.') : 'root';
    return `${source}.${path}: ${err.message}`;
  });
}

/**
 * Handle validation errors consistently
 */
const handleValidationError = (res: Response, errors: string[], req: Request): void => {
  logger.warn('Request validation failed', {
    path: req.path,
    method: req.method,
    errors,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  res.status(400).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: errors
    }
  });
}

// Common validation schemas
export const commonSchemas = {
  // Authentication schemas
  googleCallback: z.object({
    code: z.string().min(1, 'Authorization code is required'),
    state: z.string().optional(),
    error: z.string().optional(),
    error_description: z.string().optional()
  }),
  
  tokenRefresh: z.object({
    refresh_token: z.string().min(1, 'Refresh token is required')
  }),
  
  mobileTokenExchange: z.object({
    access_token: z.string().min(1, 'Access token is required'),
    refresh_token: z.string().optional(),
    id_token: z.string().optional(),
    platform: z.enum(['ios', 'android'])
  }),
  
  logout: z.object({
    access_token: z.string().optional(),
    everywhere: z.boolean().optional().default(false)
  }),
  
  // User schemas
  userId: z.object({
    userId: z.string().uuid('User ID must be a valid UUID').or(
      z.string().min(1, 'User ID is required')
    )
  }),
  
  profileUpdate: z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
    picture: z.string().url('Picture must be a valid URL').optional(),
    preferences: z.object({
      language: z.string().optional(),
      timezone: z.string().optional(),
      notifications: z.boolean().optional()
    }).optional()
  }),
  
  // Pagination schemas
  pagination: z.object({
    page: z.string().regex(/^\d+$/, 'Page must be a number').transform(Number).optional().default(() => 1),
    limit: z.string().regex(/^\d+$/, 'Limit must be a number').transform(Number).optional().default(() => 10),
    sort: z.enum(['asc', 'desc']).optional().default('desc'),
    sortBy: z.string().optional().default('createdAt')
  })
};

// Validation middleware for common use cases
export const validateBody = (schema: ZodSchema) => validate({ body: schema });
export const validateQuery = (schema: ZodSchema) => validate({ query: schema });
export const validateParams = (schema: ZodSchema) => validate({ params: schema });

// Pre-configured validation middleware
export const validateGoogleCallback = validate({ query: commonSchemas.googleCallback });
export const validateTokenRefresh = validateBody(commonSchemas.tokenRefresh);
export const validateMobileTokenExchange = validateBody(commonSchemas.mobileTokenExchange);
export const validateLogout = validateBody(commonSchemas.logout);
export const validateUserId = validateParams(commonSchemas.userId);
export const validateProfileUpdate = validateBody(commonSchemas.profileUpdate);
export const validatePagination = validateQuery(commonSchemas.pagination);

// Security validation helpers
export const sanitizeString = (str: string, maxLength: number = 1000): string => {
  return str
    .trim()
    .slice(0, maxLength)
    .replace(/[<>"'&]/g, ''); // Remove potentially dangerous characters
};

export const validateEmailFormat = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254; // RFC 5321 limit
};

export const validatePasswordStrength = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};