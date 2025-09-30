import express, { Request, Response } from 'express';
import logger from '../../utils/logger';
import { z } from 'zod';
import {
  TokenRefreshRequestSchema,
  LogoutRequestSchema,
  MobileTokenExchangeSchema
} from '../../schemas/auth.schemas';
import { validateRequest } from '../../middleware/validation.middleware';
import { serviceManager as serviceLocator } from '../../services/service-locator-compat';
import { AuthService } from '../../services/auth.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import {
  GoogleTokens,
  GoogleUserInfo,
  LogoutRequest,
  TokenRefreshRequest
} from '../../types/auth.types';
import {
  AppError,
  ErrorFactory
} from '../../utils/app-error';
import { authRateLimit } from '../../middleware/rate-limiting.middleware';

const router = express.Router();

const emptyQuerySchema = z.object({});

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh',
  authRateLimit,
  validateRequest({ body: TokenRefreshRequestSchema }),
  async (req: Request, res: Response) => {
  try {
    const { refresh_token }: TokenRefreshRequest = req.body;

    if (!refresh_token || typeof refresh_token !== 'string') {
      const authError = ErrorFactory.unauthorized('Missing or invalid refresh token');
      const errorResponse = { success: false, error: { code: authError.code, message: authError.message } };
      return res.status(400).json(errorResponse);
    }

    // Refresh the access token
    const authService = serviceLocator.getService<AuthService>('authService');
    if (!authService) {
      throw new Error('Auth service not available');
    }
    const newTokens: GoogleTokens = await authService.refreshGoogleToken(refresh_token);

    // Get updated user info with new access token
    const userInfo: GoogleUserInfo = await authService.getGoogleUserInfo(newTokens.access_token);

    // Generate new JWT token
    const jwtToken = authService.generateJWT(userInfo.sub, userInfo.email, {
      name: userInfo.name,
      picture: userInfo.picture
    });

    return res.json({
      success: true,
      tokens: {
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        id_token: newTokens.id_token,
        token_type: newTokens.token_type,
        expires_in: newTokens.expires_in,
        scope: newTokens.scope,
        expiry_date: newTokens.expiry_date
      },
      jwt: jwtToken
    });

  } catch (error) {
    const authError = error instanceof AppError
      ? error
      : ErrorFactory.unauthorized('Token refresh failed');
    const errorResponse = { success: false, error: { code: authError.code, message: authError.message } };
    return res.status(authError.statusCode || 401).json(errorResponse);
  }
});

/**
 * POST /auth/logout
 * Revoke tokens and logout user
 */
router.post('/logout',
  validateRequest({ body: LogoutRequestSchema }),
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { access_token, everywhere }: LogoutRequest = req.body;

    // Try to revoke the provided token or use the one from the request
    const tokenToRevoke = access_token || req.token;

    if (tokenToRevoke) {
      try {
        const authService = serviceLocator.getService<AuthService>('authService');
        if (!authService) {
          throw new Error('Auth service not available');
        }
        await authService.revokeGoogleTokens(tokenToRevoke);
      } catch (revokeError) {
        // Log the error but don't fail the logout
      }
    }

    return res.json({
      success: true,
      message: everywhere ? 'Logged out from all devices successfully' : 'Logged out successfully'
    });

  } catch (error) {
    const authError = error instanceof AppError
      ? error
      : ErrorFactory.unauthorized('Logout failed');
    const errorResponse = { success: false, error: { code: authError.code, message: authError.message } };
    return res.status(authError.statusCode || 500).json(errorResponse);
  }
});

/**
 * GET /auth/validate
 * Validate JWT token
 */
router.get('/validate',
  validateRequest({ query: emptyQuerySchema }),
  (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        valid: false,
        error: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const authService = serviceLocator.getService<AuthService>('authService');
    if (!authService) {
      throw new Error('Auth service not available');
    }

    try {
      const payload = authService.verifyJWT(token);
      return res.json({
        valid: true,
        payload
      });
    } catch (error) {
      return res.status(401).json({
        valid: false,
        error: 'Invalid or expired token'
      });
    }

  } catch (error) {
    return res.status(500).json({
      valid: false,
      error: 'Token validation failed'
    });
  }
});

/**
 * POST /auth/exchange-mobile-tokens
 * Exchange mobile OAuth tokens for JWT
 */
router.post('/exchange-mobile-tokens',
  authRateLimit,
  validateRequest({ body: MobileTokenExchangeSchema }),
  async (req: Request, res: Response) => {
  try {
    const { access_token, platform }: {
      access_token: string;
      platform: string;
    } = req.body;

    if (!access_token || typeof access_token !== 'string') {
      const authError = ErrorFactory.unauthorized('Missing or invalid access token');
      const errorResponse = { success: false, error: { code: authError.code, message: authError.message } };
      return res.status(400).json(errorResponse);
    }

    // Validate the access token with Google
    const authService = serviceLocator.getService<AuthService>('authService');
    if (!authService) {
      throw new Error('Auth service not available');
    }

    const tokenValidation = await authService.validateGoogleToken(access_token);
    if (!tokenValidation.valid) {
      const authError = ErrorFactory.unauthorized('Invalid access token');
      const errorResponse = { success: false, error: { code: authError.code, message: authError.message } };
      return res.status(401).json(errorResponse);
    }

    // Get user info from Google
    const userInfo: GoogleUserInfo = await authService.getGoogleUserInfo(access_token);

    // Generate internal JWT token
    const jwtToken = authService.generateJWT(userInfo.sub, userInfo.email, {
      name: userInfo.name,
      picture: userInfo.picture
    });

    return res.json({
      success: true,
      user: userInfo,
      jwt: jwtToken,
      platform,
      message: 'Mobile authentication successful'
    });

  } catch (error) {
    const authError = error instanceof AppError
      ? error
      : ErrorFactory.unauthorized('Token exchange failed');
    const errorResponse = { success: false, error: { code: authError.code, message: authError.message } };
    return res.status(authError.statusCode || 500).json(errorResponse);
  }
});

export default router;