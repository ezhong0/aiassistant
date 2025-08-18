import express, { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import logger from '../utils/logger';

const router = express.Router();

interface AuthRequest extends Request {
  session?: {
    state?: string;
  };
}

/**
 * GET /auth/google
 * Initiate Google OAuth flow
 */
router.get('/google', (req: AuthRequest, res: Response) => {
  try {
    const scopes = ['openid', 'email', 'profile'];
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
router.get('/callback', async (req: AuthRequest, res: Response) => {
  try {
    const { code, error } = req.query;

    if (error) {
      logger.error('OAuth callback error:', error);
      return res.status(400).json({
        error: 'Authentication failed',
        details: error
      });
    }

    if (!code || typeof code !== 'string') {
      logger.error('No authorization code received in callback');
      return res.status(400).json({
        error: 'Missing authorization code'
      });
    }

    // Exchange code for tokens
    const tokens = await authService.exchangeCodeForTokens(code);
    
    // Get user info
    const userInfo = await authService.getUserInfo(tokens.access_token);
    
    // Generate internal JWT token
    const jwtToken = authService.generateJWT({
      userId: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture
    });

    logger.info(`User authenticated successfully: ${userInfo.email}`);

    // Return tokens and user info
    return res.json({
      success: true,
      user: userInfo,
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        id_token: tokens.id_token,
        expires_in: tokens.expires_in
      },
      jwt: jwtToken
    });

  } catch (error) {
    logger.error('OAuth callback processing error:', error);
    return res.status(500).json({
      error: 'Authentication failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token || typeof refresh_token !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid refresh token'
      });
    }

    // Refresh the access token
    const newTokens = await authService.refreshAccessToken(refresh_token);
    
    // Get updated user info with new access token
    const userInfo = await authService.getUserInfo(newTokens.access_token);
    
    // Generate new JWT token
    const jwtToken = authService.generateJWT({
      userId: userInfo.id,
      email: userInfo.email,
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
        expires_in: newTokens.expires_in
      },
      jwt: jwtToken
    });

  } catch (error) {
    logger.error('Token refresh error:', error);
    return res.status(401).json({
      error: 'Token refresh failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /auth/logout
 * Revoke tokens and logout user
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { access_token } = req.body;

    if (access_token) {
      await authService.revokeTokens(access_token);
      logger.info('User tokens revoked successfully');
    }

    return res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    logger.error('Logout error:', error);
    return res.status(500).json({
      error: 'Logout failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
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
    const validation = authService.validateJWT(token);

    if (validation.valid) {
      return res.json({
        valid: true,
        payload: validation.payload
      });
    } else {
      return res.status(401).json({
        valid: false,
        error: validation.error
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

export default router;