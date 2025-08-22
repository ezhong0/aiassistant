import { Request, Response, NextFunction } from 'express';
import { getService } from '../services/service-manager';
import { AuthService } from '../services/auth.service';
import logger from '../utils/logger';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  name: string;
  picture?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  token?: string;
}

/**
 * Middleware to authenticate JWT tokens from Authorization header
 */
export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      logger.warn('Authentication failed: No authorization header provided', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      });
      
      res.status(401).json({
        error: 'Authentication required',
        message: 'Authorization header is missing'
      });
      return;
    }

    if (!authHeader.startsWith('Bearer ')) {
      logger.warn('Authentication failed: Invalid authorization header format', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      });
      
      res.status(401).json({
        error: 'Authentication required',
        message: 'Authorization header must start with "Bearer "'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      logger.warn('Authentication failed: Empty token', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      });
      
      res.status(401).json({
        error: 'Authentication required',
        message: 'Token is missing'
      });
      return;
    }

    // Validate the JWT token
    const authService = getService<AuthService>('authService');
    if (!authService) {
      throw new Error('Auth service not available');
    }
    const validation = authService.verifyJWT(token);
    
    // Extract user information from the token payload
    const payload = validation;
    
    if (!payload.sub || !payload.email) {
      logger.warn('Authentication failed: Invalid token payload', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
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
      picture: undefined
    };
    req.token = token;

    logger.info('User authenticated successfully', {
      userId: payload.sub,
      email: payload.email,
      path: req.path
    });

    next();
  } catch (error) {
    logger.error('Authentication middleware error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    
    res.status(500).json({
      error: 'Authentication error',
      message: 'Internal server error during authentication'
    });
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
export const optionalAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
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

    // Validate the JWT token
    const authService = getService<AuthService>('authService');
    if (!authService) {
      // Don't fail on service unavailability for optional auth
      next();
      return;
    }
    
    try {
      const payload = authService.verifyJWT(token);
      
      if (payload.sub && payload.email) {
        req.user = {
          userId: payload.sub,
          email: payload.email,
          name: payload.email,
          picture: undefined
        };
        req.token = token;
        
        logger.info('Optional authentication successful', {
          userId: payload.sub,
          email: payload.email,
          path: req.path
        });
      }
    } catch (error) {
      // Token validation failed, but that's okay for optional auth
      logger.debug('Optional authentication failed', { error });
    }

    next();
  } catch (error) {
    logger.error('Optional authentication middleware error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: req.path
    });
    
    // Don't fail on optional auth errors, just continue
    next();
  }
};

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
    logger.info('Permission check passed', {
      userId: req.user.userId,
      requiredPermissions: permissions,
      path: req.path
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
      logger.warn('Ownership check failed', {
        authenticatedUserId: req.user.userId,
        requestedUserId: resourceUserId,
        path: req.path
      });
      
      res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own resources'
      });
      return;
    }

    logger.info('Ownership check passed', {
      userId: req.user.userId,
      path: req.path
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
      logger.warn('Rate limit exceeded', {
        userId: req.user.userId,
        count: userRequests.count,
        maxRequests,
        path: req.path
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