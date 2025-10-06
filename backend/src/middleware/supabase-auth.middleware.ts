/**
 * Supabase Authentication Middleware
 *
 * Verifies JWT tokens issued by Supabase Auth.
 * Extracts user information and attaches to request object.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';
import { createLogContext } from '../utils/log-context';
import { ErrorFactory } from '../errors';

/**
 * Supabase JWT payload structure
 */
export interface SupabaseJWTPayload {
  sub: string; // User ID
  email?: string;
  phone?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  role?: string;
  aal?: string;
  amr?: Array<{ method: string; timestamp: number }>;
  session_id?: string;
  iss?: string;
  aud?: string;
  exp?: number;
  iat?: number;
}

/**
 * Extended Express request with Supabase user
 */
export interface SupabaseAuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    phone?: string;
    metadata?: Record<string, unknown>;
  };
  supabaseToken?: string;
  supabasePayload?: SupabaseJWTPayload;
}

/**
 * Create Supabase authentication middleware
 *
 * @param jwtSecret - Supabase JWT secret from project settings
 * @returns Express middleware function
 */
export function createSupabaseAuth(jwtSecret: string) {
  if (!jwtSecret) {
    logger.error('Supabase JWT secret not provided', new Error('Supabase JWT secret not provided'), {
      correlationId: 'supabase-auth-init',
      operation: 'supabase_auth_middleware_init',
    });
    throw ErrorFactory.api.unauthorized('Supabase JWT secret is required');
  }

  return (req: SupabaseAuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        const logContext = createLogContext(req, { operation: 'supabase_auth_failed_no_header' });
        logger.warn('Supabase authentication failed: No authorization header', {
          correlationId: logContext.correlationId,
          operation: 'supabase_auth_middleware',
          metadata: {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path,
            reason: 'no_authorization_header',
          },
        });

        res.status(401).json({
          error: 'Authentication required',
          message: 'Authorization header is missing',
        });
        return;
      }

      if (!authHeader.startsWith('Bearer ')) {
        const logContext = createLogContext(req, { operation: 'supabase_auth_failed_invalid_format' });
        logger.warn('Supabase authentication failed: Invalid authorization header format', {
          correlationId: logContext.correlationId,
          operation: 'supabase_auth_middleware',
          metadata: {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path,
            reason: 'invalid_header_format',
          },
        });

        res.status(401).json({
          error: 'Authentication required',
          message: 'Authorization header must start with "Bearer "',
        });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      if (!token) {
        const logContext = createLogContext(req, { operation: 'supabase_auth_failed_empty_token' });
        logger.warn('Supabase authentication failed: Empty token', {
          correlationId: logContext.correlationId,
          operation: 'supabase_auth_middleware',
          metadata: {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path,
            reason: 'empty_token',
          },
        });

        res.status(401).json({
          error: 'Authentication required',
          message: 'Token is missing',
        });
        return;
      }

      // Verify Supabase JWT token
      let payload: SupabaseJWTPayload;
      try {
        payload = jwt.verify(token, jwtSecret, {
          algorithms: ['HS256'],
        }) as SupabaseJWTPayload;
      } catch (error) {
        const logContext = createLogContext(req, { operation: 'supabase_auth_failed_invalid_token' });
        logger.warn('Supabase JWT verification failed', {
          correlationId: logContext.correlationId,
          operation: 'supabase_auth_middleware',
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error',
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path,
            reason: 'invalid_or_expired_token',
          },
        });

        res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid or expired token',
        });
        return;
      }

      // Validate payload
      if (!payload.sub) {
        const logContext = createLogContext(req, { operation: 'supabase_auth_failed_invalid_payload' });
        logger.warn('Supabase authentication failed: Invalid token payload', {
          correlationId: logContext.correlationId,
          operation: 'supabase_auth_middleware',
          metadata: {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path,
            reason: 'missing_user_id',
          },
        });

        res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid token payload',
        });
        return;
      }

      // Attach user information to request
      req.user = {
        id: payload.sub,
        email: payload.email,
        phone: payload.phone,
        metadata: payload.user_metadata,
      };
      req.supabaseToken = token;
      req.supabasePayload = payload;

      const logContext = createLogContext(req, { operation: 'supabase_auth_success' });
      logger.debug('Supabase user authenticated successfully', {
        correlationId: logContext.correlationId,
        operation: 'supabase_auth_middleware',
        metadata: {
          userId: payload.sub,
          email: payload.email,
          path: req.path,
        },
      });

      next();
    } catch (error) {
      const logContext = createLogContext(req, { operation: 'supabase_auth_error' });
      logger.error('Supabase authentication middleware error', error as Error, {
        correlationId: logContext.correlationId,
        operation: 'supabase_auth_middleware',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
        },
      });

      res.status(500).json({
        error: 'Authentication error',
        message: 'Internal server error during authentication',
      });
    }
  };
}

/**
 * Optional Supabase authentication middleware
 * Doesn't fail if no token is provided
 *
 * @param jwtSecret - Supabase JWT secret from project settings
 * @returns Express middleware function
 */
export function createOptionalSupabaseAuth(jwtSecret: string) {
  if (!jwtSecret) {
    logger.warn('Supabase JWT secret not provided for optional auth', {
      correlationId: 'supabase-optional-auth-init',
      operation: 'supabase_optional_auth_middleware_init',
    });
    // Return a no-op middleware
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  return (req: SupabaseAuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader?.startsWith('Bearer ')) {
        // No token provided, continue without authentication
        next();
        return;
      }

      const token = authHeader.substring(7);

      if (!token) {
        next();
        return;
      }

      // Try to verify the JWT token
      try {
        const payload = jwt.verify(token, jwtSecret, {
          algorithms: ['HS256'],
        }) as SupabaseJWTPayload;

        if (payload.sub) {
          req.user = {
            id: payload.sub,
            email: payload.email,
            phone: payload.phone,
            metadata: payload.user_metadata,
          };
          req.supabaseToken = token;
          req.supabasePayload = payload;

          const logContext = createLogContext(req, { operation: 'supabase_optional_auth_success' });
          logger.debug('Supabase optional authentication successful', {
            correlationId: logContext.correlationId,
            operation: 'supabase_optional_auth_middleware',
            metadata: {
              userId: payload.sub,
              email: payload.email,
              path: req.path,
            },
          });
        }
      } catch (error) {
        // Token validation failed, but that's okay for optional auth
        const logContext = createLogContext(req, { operation: 'supabase_optional_auth_failed' });
        logger.debug('Supabase optional authentication failed', {
          correlationId: logContext.correlationId,
          operation: 'supabase_optional_auth_middleware',
          metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
        });
      }

      next();
    } catch (error) {
      const logContext = createLogContext(req, { operation: 'supabase_optional_auth_error' });
      logger.error('Supabase optional authentication middleware error', error as Error, {
        correlationId: logContext.correlationId,
        operation: 'supabase_optional_auth_middleware',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          path: req.path,
        },
      });

      // Don't fail on optional auth errors, just continue
      next();
    }
  };
}
