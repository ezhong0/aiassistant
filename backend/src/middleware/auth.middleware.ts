import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { AuthService } from '../services/auth.service';
import { createLogContext } from '../utils/log-context';
import type { AppContainer } from '../di';

/**
 * Authenticated user interface for request context
 */
export interface AuthenticatedUser {
  /** Unique user identifier */
  userId: string;
  /** User's email address */
  email: string;
  /** User's display name */
  name: string;
  /** Optional user profile picture URL */
  picture?: string;
}

/**
 * Extended Express request interface with authentication context
 */
export interface AuthenticatedRequest extends Request {
  /** Authenticated user information */
  user?: AuthenticatedUser;
  /** JWT token used for authentication */
  token?: string;
  /** Validated request body from validation middleware */
  validatedBody?: any;
}

/**
 * Create authentication middleware for JWT token validation
 * 
 * Factory function that creates middleware with injected AuthService.
 * This middleware validates JWT tokens from the Authorization header and
 * attaches user information to the request object.
 * 
 * @param authService - AuthService instance for token validation
 * @returns Express middleware function
 * 
 * @example
 * ```typescript
 * // Create middleware with service
 * const authMiddleware = createAuthenticateToken(authService);
 * app.get('/protected', authMiddleware, (req: AuthenticatedRequest, res) => {
 *   // req.user?.email contains the user's email
 *   res.json({ message: 'Access granted' });
 * });
 * ```
 */
export function createAuthenticateToken(authService: AuthService) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      const logContext = createLogContext(req, { operation: 'auth_failed_no_header' });
      logger.warn('Authentication failed: No authorization header provided', {
        correlationId: logContext.correlationId,
        operation: 'auth_middleware',
        metadata: {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          reason: 'no_authorization_header'
        }
      });
      
      res.status(401).json({
        error: 'Authentication required',
        message: 'Authorization header is missing'
      });
      return;
    }

    if (!authHeader.startsWith('Bearer ')) {
      const logContext = createLogContext(req, { operation: 'auth_failed_invalid_format' });
      logger.warn('Authentication failed: Invalid authorization header format', {
        correlationId: logContext.correlationId,
        operation: 'auth_middleware',
        metadata: {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          reason: 'invalid_header_format'
        }
      });
      
      res.status(401).json({
        error: 'Authentication required',
        message: 'Authorization header must start with "Bearer "'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      const logContext = createLogContext(req, { operation: 'auth_failed_empty_token' });
      logger.warn('Authentication failed: Empty token', {
        correlationId: logContext.correlationId,
        operation: 'auth_middleware',
        metadata: {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          reason: 'empty_token'
        }
      });
      
      res.status(401).json({
        error: 'Authentication required',
        message: 'Token is missing'
      });
      return;
    }

    // Validate the JWT token using injected authService
    const validation = authService.verifyJWT(token);
    
    // Extract user information from the token payload
    const payload = validation;
    
    if (!payload.sub || !payload.email) {
      const logContext = createLogContext(req, { operation: 'auth_failed_invalid_payload' });
      logger.warn('Authentication failed: Invalid token payload', {
        correlationId: logContext.correlationId,
        operation: 'auth_middleware',
        metadata: {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          reason: 'invalid_token_payload'
        }
      });
      
      res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid token payload'
      });
      return;
    }

    // Attach user information to the request
    req.user = {
      userId: payload.sub,
      email: payload.email,
      name: payload.email,
      picture: undefined as any
    };
    req.token = token;

    const logContext = createLogContext(req, { operation: 'auth_success' });
    logger.debug('User authenticated successfully', {
      correlationId: logContext.correlationId,
      operation: 'auth_middleware',
      metadata: {
        userId: payload.sub,
        email: payload.email,
        path: req.path
      }
    });

    next();
  } catch (error) {
    const logContext = createLogContext(req, { operation: 'auth_error' });
    logger.error('Authentication middleware error', error as Error, {
      correlationId: logContext.correlationId,
      operation: 'auth_middleware',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      }
    });
    
    res.status(500).json({
      error: 'Authentication error',
      message: 'Internal server error during authentication'
    });
  }
  };
}

/**
 * Create optional authentication middleware - doesn't fail if no token provided
 * 
 * Factory function that creates middleware with injected AuthService.
 * 
 * @param authService - AuthService instance for token validation
 * @returns Express middleware function
 */
export function createOptionalAuth(authService: AuthService) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without authentication
      next();
      return;
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      next();
      return;
    }

    // Validate the JWT token using injected authService
    
    try {
      const payload = authService.verifyJWT(token);
      
      if (payload.sub && payload.email) {
        req.user = {
          userId: payload.sub,
          email: payload.email,
          name: payload.email,
          picture: undefined as any
        };
        req.token = token;
        
        const logContext = createLogContext(req, { operation: 'optional_auth_success' });
        logger.debug('Optional authentication successful', {
          correlationId: logContext.correlationId,
          operation: 'optional_auth_middleware',
          metadata: {
            userId: payload.sub,
            email: payload.email,
            path: req.path
          }
        });
      }
    } catch (error) {
      // Token validation failed, but that's okay for optional auth
      const logContext = createLogContext(req, { operation: 'optional_auth_failed' });
      logger.debug('Optional authentication failed', {
        correlationId: logContext.correlationId,
        operation: 'optional_auth_middleware',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }

    next();
  } catch (error) {
    const logContext = createLogContext(req, { operation: 'optional_auth_error' });
    logger.error('Optional authentication middleware error', error as Error, {
      correlationId: logContext.correlationId,
      operation: 'optional_auth_middleware',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: req.path
      }
    });
    
    // Don't fail on optional auth errors, just continue
    next();
  }
  };
}

/**
 * Middleware to check if user has specific permissions
 */
export const requirePermissions = (permissions: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
      return;
    }

    // For now, we'll implement basic permission checking
    // In a real app, you'd check against user roles/permissions from database
    const logContext = createLogContext(req, { operation: 'permission_check_passed' });
    logger.debug('Permission check passed', {
      correlationId: logContext.correlationId,
      operation: 'permission_middleware',
      metadata: {
        userId: req.user.userId,
        requiredPermissions: permissions,
        path: req.path
      }
    });

    next();
  };
};

/**
 * Middleware to ensure user can only access their own resources
 */
export const requireOwnership = (userIdParam: string = 'userId') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
      return;
    }

    const resourceUserId = req.params[userIdParam];
    
    if (!resourceUserId) {
      res.status(400).json({
        error: 'Bad request',
        message: `Missing ${userIdParam} parameter`
      });
      return;
    }

    if (req.user.userId !== resourceUserId) {
      const logContext = createLogContext(req, { operation: 'ownership_check_failed' });
      logger.warn('Ownership check failed', {
        correlationId: logContext.correlationId,
        operation: 'ownership_middleware',
        metadata: {
          authenticatedUserId: req.user.userId,
          requestedUserId: resourceUserId,
          path: req.path
        }
      });
      
      res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own resources'
      });
      return;
    }

    const logContext = createLogContext(req, { operation: 'ownership_check_passed' });
    logger.debug('Ownership check passed', {
      correlationId: logContext.correlationId,
      operation: 'ownership_middleware',
      metadata: {
        userId: req.user.userId,
        path: req.path
      }
    });

    next();
  };
};

/**
 * Middleware to rate limit authenticated users
 */
export const rateLimitAuth = (maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) => {
  const requests = new Map<string, { count: number; resetTime: number }>();
  
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next();
      return;
    }

    const userId = req.user.userId;
    const now = Date.now();
    const userRequests = requests.get(userId);

    if (!userRequests || now > userRequests.resetTime) {
      requests.set(userId, {
        count: 1,
        resetTime: now + windowMs
      });
      next();
      return;
    }

    if (userRequests.count >= maxRequests) {
      const logContext = createLogContext(req, { operation: 'rate_limit_exceeded' });
      logger.warn('Rate limit exceeded', {
        correlationId: logContext.correlationId,
        operation: 'rate_limit_middleware',
        metadata: {
          userId: req.user.userId,
          count: userRequests.count,
          maxRequests,
          path: req.path
        }
      });
      
      res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMs / 1000 / 60} minutes.`,
        retryAfter: Math.ceil((userRequests.resetTime - now) / 1000)
      });
      return;
    }

    userRequests.count++;
    next();
  };
};