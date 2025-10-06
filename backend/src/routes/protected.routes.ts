/* eslint-disable @typescript-eslint/no-unused-vars */
import express, { Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation.middleware';
import {
  createSupabaseAuth,
  createOptionalSupabaseAuth,
  SupabaseAuthenticatedRequest,
} from '../middleware/supabase-auth.middleware';
import { createRateLimit } from '../middleware/rate-limiting.middleware';
import { Permission } from '../types/auth.types';
import { SuccessResponseSchema, ErrorResponseSchema } from '../schemas/api.schemas';
import { validateAndSendResponse } from '../utils/response-validation.util';
import type { AppContainer } from '../di';

/**
 * Create protected routes with DI container
 */
export function createProtectedRoutes(container: AppContainer) {
  const router = express.Router();

  // Create Supabase auth middleware using config from container
  const config = container.resolve('config');
  const supabaseJwtSecret = config.supabaseJwtSecret;
  if (!supabaseJwtSecret) {
    throw new Error('SUPABASE_JWT_SECRET is required for protected routes');
  }

  const authenticateToken = createSupabaseAuth(supabaseJwtSecret);
  const optionalAuth = createOptionalSupabaseAuth(supabaseJwtSecret);

  // Rate limiting middleware for heavy operations
  const rateLimitStore = container.resolve('rateLimitStore');
  const heavyOperationRateLimit = createRateLimit(rateLimitStore, {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    message: 'Too many heavy operations. Maximum 10 requests per minute.',
    keyGenerator: (req) => (req as SupabaseAuthenticatedRequest).user?.id || req.ip || 'unknown',
  });

  // Simple ownership middleware - checks if userId param matches authenticated user
  const requireOwnership = (paramName: string) => {
    return (req: SupabaseAuthenticatedRequest, res: Response, next: NextFunction) => {
      const userId = req.params[paramName];
      if (req.user?.id !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'You can only access your own resources',
        });
        return;
      }
      next();
    };
  };

  // Simple permissions middleware - checks user permissions in app_metadata
  const requirePermissions = (permissions: Permission[]) => {
    return (req: SupabaseAuthenticatedRequest, res: Response, next: NextFunction) => {
      const userPermissions = (req.supabasePayload?.app_metadata?.permissions || []) as Permission[];

      const hasAllPermissions = permissions.every(p => userPermissions.includes(p));

      if (!hasAllPermissions) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          message: `Required permissions: ${permissions.join(', ')}`,
        });
        return;
      }
      next();
    };
  };

// Validation schemas
const profileUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  picture: z.string().url().optional(),
});

const userIdParamSchema = z.object({
  userId: z.string().uuid().or(z.string().min(1)),
});

const apiHeavyRequestSchema = z.object({
  operation: z.string().min(1).max(100).optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
});

const emptyQuerySchema = z.object({});
const emptyBodySchema = z.object({});

// Admin users query schema with pagination
const adminUsersQuerySchema = z.object({
  page: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1)).optional(),
  limit: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1).max(100)).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'email', 'lastLogin', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// Dashboard query schema with optional parameters
const dashboardQuerySchema = z.object({
  view: z.enum(['overview', 'detailed', 'compact']).optional(),
  refresh: z.string().transform(val => val === 'true').pipe(z.boolean()).optional(),
});

/**
 * GET /protected/profile
 * Get user profile - requires authentication
 */
router.get('/profile',
  authenticateToken,
  validateRequest({ query: emptyQuerySchema }),
  (req: SupabaseAuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!; // TypeScript knows this exists due to authenticateToken middleware



    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.metadata?.name,
          picture: user.metadata?.picture,
        },
        metadata: {
          lastAccess: new Date().toISOString(),
          tokenValid: true,
        },
      },
    });
  } catch (error) {

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * PUT /protected/profile
 * Update user profile - requires authentication
 */
router.put('/profile',
  authenticateToken,
  validateRequest({ body: profileUpdateSchema }),
  (req: SupabaseAuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { name, picture } = req.body as z.infer<typeof profileUpdateSchema>;

    // Validation is now handled by Zod schema

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: name || user.metadata?.name,
          picture: picture || user.metadata?.picture,
        },
        message: 'Profile updated successfully',
      },
    });
  } catch (error) {

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /protected/users/:userId
 * Get specific user data - requires authentication and ownership
 */
router.get('/users/:userId',
  authenticateToken,
  validateRequest({ params: userIdParamSchema }),
  requireOwnership('userId'),
  (req: SupabaseAuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { userId } = req.params;



      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.metadata?.name,
            picture: user.metadata?.picture,
          },
          permissions: ['READ_PROFILE', 'UPDATE_PROFILE'],
          settings: {
            notifications: true,
            privacy: 'private',
          },
        },
      });
    } catch (error) {

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },
);

/**
 * GET /protected/admin/users
 * Admin endpoint - requires authentication and admin permissions
 */
router.get('/admin/users',
  authenticateToken,
  requirePermissions([Permission.ADMIN_ACCESS]),
  validateRequest({ query: adminUsersQuerySchema }),
  (req: SupabaseAuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;



      // In a real app, you'd fetch users from database
      res.json({
        success: true,
        data: {
          users: [
            {
              id: user.id,
              email: user.email,
              name: user.metadata?.name,
              role: 'admin',
              lastLogin: new Date().toISOString(),
            },
          ],
          total: 1,
          page: 1,
          limit: 10,
        },
      });
    } catch (error) {

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },
);

/**
 * GET /protected/dashboard
 * Dashboard with optional authentication - shows different content for authenticated users
 */
router.get('/dashboard',
  optionalAuth,
  validateRequest({ query: dashboardQuerySchema }),
  (req: SupabaseAuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;

    if (user) {


      res.json({
        success: true,
        data: {
          welcome: `Welcome back, ${user.metadata?.name || user.email}!`,
          user: {
            id: user.id,
            email: user.email,
            name: user.metadata?.name,
            picture: user.metadata?.picture,
          },
          personalizedContent: [
            'Your recent activity',
            'Recommended for you',
            'Your calendar events',
          ],
          authenticated: true,
        },
      });
    } else {


      res.json({
        success: true,
        data: {
          welcome: 'Welcome to our platform!',
          publicContent: [
            'Getting started guide',
            'Feature overview',
            'Sign up benefits',
          ],
          authenticated: false,
          callToAction: 'Sign in to see personalized content',
        },
      });
    }
  } catch (error) {

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /protected/api-heavy
 * Rate-limited endpoint for heavy API operations
 */
router.post('/api-heavy',
  authenticateToken,
  validateRequest({ body: apiHeavyRequestSchema }),
  heavyOperationRateLimit, // 10 requests per minute
  (req: SupabaseAuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { operation, parameters } = req.body as z.infer<typeof apiHeavyRequestSchema>;


      // Simulate heavy processing
      (globalThis as any).setTimeout(() => {
        const responseData = {
          success: true,
          data: {
            result: 'Heavy operation completed',
            processedBy: user.id,
            timestamp: new Date().toISOString(),
          },
        };

        // ✅ Validate response with Zod schema
        validateAndSendResponse(res, SuccessResponseSchema, responseData);
      }, 1000);

    } catch (error) {

      const errorData = {
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      };
      validateAndSendResponse(res, ErrorResponseSchema, errorData, 500);
    }
  },
);

/**
 * GET /protected/health
 * Health check for protected routes - requires authentication
 */
router.get('/health',
  authenticateToken,
  validateRequest({ query: emptyQuerySchema }),
  (req: SupabaseAuthenticatedRequest, res: Response) => {
  const user = req.user!;

  res.json({
    success: true,
    data: {
      status: 'Protected routes are healthy',
      authenticatedUser: user.id,
      timestamp: new Date().toISOString(),
      middleware: {
        authentication: 'working',
        logging: 'working',
      },
    },
  });
});

  return router;
}