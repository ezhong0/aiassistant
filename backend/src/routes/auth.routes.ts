import express, { Request, Response } from 'express';
import { getService } from '../services/service-registry';
import { AuthService } from '../services/auth.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import {
  GoogleTokens,
  GoogleUserInfo,
  AuthSuccessResponse,
  OAuthCallbackQuery,
  LogoutRequest,
  TokenRefreshRequest
} from '../types/auth.types';
import {
  AuthenticationError,
  formatAuthErrorResponse,
  handleOAuthError
} from '../utils/auth-errors';
import {
  validateGoogleCallback,
  validateTokenRefresh,
  validateMobileTokenExchange,
} from '../middleware/validation.middleware';
import { authRateLimit } from '../middleware/rate-limiting.middleware';
import logger from '../utils/logger';

const router = express.Router();


/**
 * GET /auth/google
 * Initiate Google OAuth flow
 */
router.get('/google', authRateLimit, (req: Request, res: Response) => {
  try {
    const scopes = [
      'openid', 
      'email', 
      'profile',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/contacts.readonly'
    ];
    const authService = getService<AuthService>('authService');
    if (!authService) {
      throw new Error('Auth service not available');
    }
    const authUrl = authService.generateAuthUrl(scopes);
    
    logger.info('Generated Google OAuth URL for user authentication');
    
    res.redirect(authUrl);
  } catch (error) {
    logger.error('Error generating Google auth URL:', error);
    res.status(500).json({
      error: 'Failed to initiate authentication',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /auth/callback
 * Handle OAuth callback from Google
 */
router.get('/callback', authRateLimit, validateGoogleCallback, async (req: Request, res: Response) => {
  try {
    const { code, error, error_description }: OAuthCallbackQuery = req.query;

    if (error) {
      logger.error('OAuth callback error:', { error, error_description });
      const authError = handleOAuthError('token_exchange', new Error(error), { error_description });
      const errorResponse = formatAuthErrorResponse(authError);
      return res.status(authError.statusCode).json(errorResponse);
    }

    if (!code || typeof code !== 'string') {
      logger.error('No authorization code received in callback');
      const authError = new AuthenticationError(
        'INVALID_GRANT' as any,
        'Missing authorization code',
        400
      );
      const errorResponse = formatAuthErrorResponse(authError);
      return res.status(400).json(errorResponse);
    }

    // Exchange code for tokens
    const authService = getService<AuthService>('authService');
    if (!authService) {
      throw new Error('Auth service not available');
    }
    const tokens: GoogleTokens = await authService.exchangeCodeForTokens(code);
    
    // Get user info
    const userInfo: GoogleUserInfo = await authService.getGoogleUserInfo(tokens.access_token);
    
    // Generate internal JWT token
    const jwtToken = authService.generateJWT(userInfo.sub, userInfo.email, {
      name: userInfo.name,
      picture: userInfo.picture
    });

    logger.info(`User authenticated successfully: ${userInfo.email}`);

    // Return tokens and user info
    const successResponse: AuthSuccessResponse = {
      success: true,
      user: userInfo,
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        id_token: tokens.id_token,
        token_type: tokens.token_type,
        expires_in: tokens.expires_in,
        scope: tokens.scope,
        expiry_date: tokens.expiry_date
      },
      jwt: jwtToken
    };
    
    return res.json(successResponse);

  } catch (error) {
    logger.error('OAuth callback processing error:', error);
    const authError = error instanceof AuthenticationError 
      ? error 
      : handleOAuthError('token_exchange', error);
    const errorResponse = formatAuthErrorResponse(authError);
    return res.status(authError.statusCode || 500).json(errorResponse);
  }
});

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', authRateLimit, validateTokenRefresh, async (req: Request, res: Response) => {
  try {
    const { refresh_token }: TokenRefreshRequest = req.body;

    if (!refresh_token || typeof refresh_token !== 'string') {
      const authError = new AuthenticationError(
        'MISSING_TOKEN' as any,
        'Missing or invalid refresh token',
        400
      );
      const errorResponse = formatAuthErrorResponse(authError);
      return res.status(400).json(errorResponse);
    }

    // Refresh the access token
    const authService = getService<AuthService>('authService');
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

    logger.info(`Token refreshed successfully for user: ${userInfo.email}`);

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
    logger.error('Token refresh error:', error);
    const authError = error instanceof AuthenticationError 
      ? error 
      : handleOAuthError('token_refresh', error);
    const errorResponse = formatAuthErrorResponse(authError);
    return res.status(authError.statusCode || 401).json(errorResponse);
  }
});

/**
 * POST /auth/logout
 * Revoke tokens and logout user
 */
router.post('/logout', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { access_token, everywhere }: LogoutRequest = req.body;
    
    // Try to revoke the provided token or use the one from the request
    const tokenToRevoke = access_token || req.token;
    
    if (tokenToRevoke) {
      try {
        const authService = getService<AuthService>('authService');
        if (!authService) {
          throw new Error('Auth service not available');
        }
        await authService.revokeGoogleTokens(tokenToRevoke);
        logger.info('User tokens revoked successfully', { 
          userId: req.user?.userId,
          everywhere 
        });
      } catch (revokeError) {
        // Log the error but don't fail the logout
        logger.warn('Token revocation failed, but continuing with logout', { 
          error: revokeError,
          userId: req.user?.userId 
        });
      }
    }

    return res.json({
      success: true,
      message: everywhere ? 'Logged out from all devices successfully' : 'Logged out successfully'
    });

  } catch (error) {
    logger.error('Logout error:', error);
    const authError = error instanceof AuthenticationError 
      ? error 
      : new AuthenticationError('UNKNOWN_ERROR' as any, 'Logout failed', 500);
    const errorResponse = formatAuthErrorResponse(authError);
    return res.status(authError.statusCode || 500).json(errorResponse);
  }
});

/**
 * GET /auth/validate
 * Validate JWT token
 */
router.get('/validate', (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        valid: false,
        error: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const authService = getService<AuthService>('authService');
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
    logger.error('Token validation error:', error);
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
router.post('/exchange-mobile-tokens', authRateLimit, validateMobileTokenExchange, async (req: Request, res: Response) => {
  try {
    const { access_token, platform }: {
      access_token: string;
      platform: string;
    } = req.body;

    if (!access_token || typeof access_token !== 'string') {
      const authError = new AuthenticationError(
        'MISSING_TOKEN' as any,
        'Missing or invalid access token',
        400
      );
      const errorResponse = formatAuthErrorResponse(authError);
      return res.status(400).json(errorResponse);
    }

    // Validate the access token with Google
    const authService = getService<AuthService>('authService');
    if (!authService) {
      throw new Error('Auth service not available');
    }
    
    const tokenValidation = await authService.validateGoogleToken(access_token);
    if (!tokenValidation.valid) {
      const authError = new AuthenticationError(
        'INVALID_TOKEN' as any,
        'Invalid access token',
        401
      );
      const errorResponse = formatAuthErrorResponse(authError);
      return res.status(401).json(errorResponse);
    }

    // Get user info from Google
    const userInfo: GoogleUserInfo = await authService.getGoogleUserInfo(access_token);
    
    // Generate internal JWT token
    const jwtToken = authService.generateJWT(userInfo.sub, userInfo.email, {
      name: userInfo.name,
      picture: userInfo.picture
    });

    logger.info(`Mobile token exchange successful for user: ${userInfo.email}`, {
      platform,
      userId: userInfo.sub
    });

    return res.json({
      success: true,
      user: userInfo,
      jwt: jwtToken,
      platform,
      message: 'Mobile authentication successful'
    });

  } catch (error) {
    logger.error('Mobile token exchange error:', error);
    const authError = error instanceof AuthenticationError 
      ? error 
      : handleOAuthError('token_exchange', error);
    const errorResponse = formatAuthErrorResponse(authError);
    return res.status(authError.statusCode || 500).json(errorResponse);
  }
});

export default router;