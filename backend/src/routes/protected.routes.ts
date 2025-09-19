import express, { Response } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/enhanced-validation.middleware';
import { 
  authenticateToken, 
  optionalAuth, 
  requirePermissions, 
  requireOwnership,
  rateLimitAuth,
  AuthenticatedRequest 
} from '../middleware/auth.middleware';
import { Permission } from '../types/auth.types';
import { ProfileResponseSchema, AdminUsersResponseSchema, SuccessResponseSchema, ErrorResponseSchema } from '../schemas/api.schemas';
import { validateAndSendResponse, sendSuccessResponse, sendErrorResponse } from '../utils/response-validation.util';

const router = express.Router();

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
  (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!; // TypeScript knows this exists due to authenticateToken middleware
    
    
    
    res.json({
      success: true,
      data: {
        user: {
          id: user.userId,
          email: user.email,
          name: user.name,
          picture: user.picture
        },
        metadata: {
          lastAccess: new Date().toISOString(),
          tokenValid: true
        }
      }
    });
  } catch (error) {
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
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
  (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { name, picture } = req.validatedBody as z.infer<typeof profileUpdateSchema>;
    
    // Validation is now handled by Zod schema
    
    res.json({
      success: true,
      data: {
        user: {
          id: user.userId,
          email: user.email,
          name: name || user.name,
          picture: picture || user.picture
        },
        message: 'Profile updated successfully'
      }
    });
  } catch (error) {
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
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
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { userId } = req.params;
      
      
      
      res.json({
        success: true,
        data: {
          user: {
            id: user.userId,
            email: user.email,
            name: user.name,
            picture: user.picture
          },
          permissions: ['READ_PROFILE', 'UPDATE_PROFILE'],
          settings: {
            notifications: true,
            privacy: 'private'
          }
        }
      });
    } catch (error) {
      
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

/**
 * GET /protected/admin/users
 * Admin endpoint - requires authentication and admin permissions
 */
router.get('/admin/users', 
  authenticateToken,
  requirePermissions([Permission.ADMIN_ACCESS]),
  validateRequest({ query: adminUsersQuerySchema }),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      
      
      
      // In a real app, you'd fetch users from database
      res.json({
        success: true,
        data: {
          users: [
            {
              id: user.userId,
              email: user.email,
              name: user.name,
              role: 'admin',
              lastLogin: new Date().toISOString()
            }
          ],
          total: 1,
          page: 1,
          limit: 10
        }
      });
    } catch (error) {
      
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

/**
 * GET /protected/dashboard
 * Dashboard with optional authentication - shows different content for authenticated users
 */
router.get('/dashboard', 
  optionalAuth, 
  validateRequest({ query: dashboardQuerySchema }),
  (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    
    if (user) {
      
      
      res.json({
        success: true,
        data: {
          welcome: `Welcome back, ${user.name}!`,
          user: {
            id: user.userId,
            email: user.email,
            name: user.name,
            picture: user.picture
          },
          personalizedContent: [
            'Your recent activity',
            'Recommended for you',
            'Your calendar events'
          ],
          authenticated: true
        }
      });
    } else {
      
      
      res.json({
        success: true,
        data: {
          welcome: 'Welcome to our platform!',
          publicContent: [
            'Getting started guide',
            'Feature overview',
            'Sign up benefits'
          ],
          authenticated: false,
          callToAction: 'Sign in to see personalized content'
        }
      });
    }
  } catch (error) {
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
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
  rateLimitAuth(10, 60 * 1000), // 10 requests per minute
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { operation, parameters } = req.validatedBody as z.infer<typeof apiHeavyRequestSchema>;
      
      
      // Simulate heavy processing
      (globalThis as any).setTimeout(() => {
        const responseData = {
          success: true,
          data: {
            result: 'Heavy operation completed',
            processedBy: user.userId,
            timestamp: new Date().toISOString()
          }
        };
        
        // ✅ Validate response with Zod schema
        validateAndSendResponse(res, SuccessResponseSchema, responseData);
      }, 1000);
      
    } catch (error) {
      
      const errorData = {
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      };
      validateAndSendResponse(res, ErrorResponseSchema, errorData, 500);
    }
  }
);

/**
 * GET /protected/health
 * Health check for protected routes - requires authentication
 */
router.get('/health', 
  authenticateToken, 
  validateRequest({ query: emptyQuerySchema }),
  (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  
  res.json({
    success: true,
    data: {
      status: 'Protected routes are healthy',
      authenticatedUser: user.userId,
      timestamp: new Date().toISOString(),
      middleware: {
        authentication: 'working',
        logging: 'working'
      }
    }
  });
});

export default router;