import { OAuth2Client } from 'google-auth-library';
import jwt, { SignOptions } from 'jsonwebtoken';
import axios from 'axios';
import {
  GoogleTokens,
  GoogleUserInfo,
  TokenValidationResult,
  JWTPayload
} from '../types/auth.types';
import {
  AuthErrors,
  handleOAuthError,
  validateTokenFormat,
  validateGoogleUserInfo,
  retryOAuthOperation
} from '../utils/auth-errors';
import configService from '../config/config.service';
import logger from '../utils/logger';

export class AuthService {
  private oauth2Client: OAuth2Client;
  private readonly config = configService;

  constructor() {
    // Validate configuration
    this.config.validate();
    
    this.oauth2Client = new OAuth2Client(
      this.config.googleClientId,
      this.config.googleClientSecret,
      this.config.googleRedirectUri
    );

    logger.info('Auth service initialized successfully', {
      environment: this.config.nodeEnv,
      jwtIssuer: this.config.jwtIssuer,
      jwtExpiresIn: this.config.jwtExpiresIn
    });
  }

  /**
   * Generate Google OAuth authorization URL
   */
  generateAuthUrl(scopes: string[] = ['openid', 'email', 'profile']): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: this.generateState(),
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
    try {
      validateTokenFormat(code);
      
      logger.info('Exchanging authorization code for tokens');
      
      const result = await retryOAuthOperation(async () => {
        const { tokens } = await this.oauth2Client.getToken(code);
        
        if (!tokens.access_token) {
          throw AuthErrors.tokenExchangeFailed(new Error('No access token received from Google'));
        }

        return {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || undefined,
          id_token: tokens.id_token || undefined,
          token_type: tokens.token_type || 'Bearer',
          expires_in: tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600,
          scope: tokens.scope,
          expiry_date: tokens.expiry_date || undefined
        };
      });
      
      logger.info('Token exchange successful');
      return result;
    } catch (error) {
      throw handleOAuthError('token_exchange', error, { codeLength: code?.length });
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
    try {
      validateTokenFormat(refreshToken);
      
      logger.info('Refreshing access token');
      
      const result = await retryOAuthOperation(async () => {
        this.oauth2Client.setCredentials({
          refresh_token: refreshToken,
        });

        const { credentials } = await this.oauth2Client.refreshAccessToken();

        if (!credentials.access_token) {
          throw AuthErrors.tokenRefreshFailed(new Error('No access token received during refresh'));
        }

        return {
          access_token: credentials.access_token,
          refresh_token: credentials.refresh_token || refreshToken,
          id_token: credentials.id_token || undefined,
          token_type: credentials.token_type || 'Bearer',
          expires_in: credentials.expiry_date ? Math.floor((credentials.expiry_date - Date.now()) / 1000) : 3600,
          scope: credentials.scope,
          expiry_date: credentials.expiry_date || undefined
        };
      });
      
      logger.info('Token refresh successful');
      return result;
    } catch (error) {
      throw handleOAuthError('token_refresh', error, { refreshTokenLength: refreshToken?.length });
    }
  }

  /**
   * Validate Google access token
   */
  async validateGoogleToken(accessToken: string): Promise<TokenValidationResult> {
    try {
      // Verify token with Google
      this.oauth2Client.setCredentials({ access_token: accessToken });
      const tokenInfo = await this.oauth2Client.getTokenInfo(accessToken);

      return {
        valid: true,
        payload: tokenInfo,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Token validation failed',
      };
    }
  }

  /**
   * Validate Google ID token
   */
  async validateIdToken(idToken: string): Promise<TokenValidationResult> {
    try {
      const ticket = await this.oauth2Client.verifyIdToken({
        idToken,
        audience: this.config.googleClientId,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        return {
          valid: false,
          error: 'No payload in ID token',
        };
      }

      return {
        valid: true,
        payload,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'ID token validation failed',
      };
    }
  }

  /**
   * Get user information from Google using access token
   */
  async getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    try {
      validateTokenFormat(accessToken);
      
      logger.info('Fetching user information from Google');
      
      const result = await retryOAuthOperation(async () => {
        const response = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          timeout: 10000, // 10 second timeout
        });

        const userInfo = response.data as GoogleUserInfo;
        validateGoogleUserInfo(userInfo);
        
        return userInfo;
      });
      
      logger.info('User information retrieved successfully', { 
        userId: result.id, 
        email: result.email 
      });
      return result;
    } catch (error) {
      throw handleOAuthError('user_info', error, { accessTokenLength: accessToken?.length });
    }
  }

  /**
   * Generate JWT token for internal use
   */
  generateJWT(payload: JWTPayload, expiresIn?: string | number): string {
    try {
      const jwtPayload: JWTPayload = {
        ...payload,
        iat: Math.floor(Date.now() / 1000)
      };
      
      const token = jwt.sign(jwtPayload, this.config.jwtSecret, { 
        expiresIn: expiresIn || this.config.jwtExpiresIn,
        issuer: this.config.jwtIssuer,
        audience: this.config.jwtAudience,
        algorithm: 'HS256' // Explicitly set algorithm
      } as SignOptions);
      
      logger.info('JWT generated successfully', { 
        userId: payload.userId,
        expiresIn: expiresIn || this.config.jwtExpiresIn,
        issuer: this.config.jwtIssuer
      });
      
      return token;
    } catch (error) {
      logger.error('JWT generation failed', { error, payload: { userId: payload.userId } });
      throw new Error('Failed to generate JWT token');
    }
  }

  /**
   * Validate internal JWT token
   */
  validateJWT(token: string): TokenValidationResult {
    try {
      validateTokenFormat(token);
      
      const payload = jwt.verify(token, this.config.jwtSecret, {
        issuer: this.config.jwtIssuer,
        audience: this.config.jwtAudience,
        algorithms: ['HS256'] // Explicitly specify allowed algorithms
      }) as JWTPayload;
      
      // Additional payload validation
      if (!payload.userId || !payload.email) {
        return {
          valid: false,
          error: 'Invalid token payload: missing required fields'
        };
      }
      
      // Check token expiration more explicitly
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        return {
          valid: false,
          error: 'Token has expired'
        };
      }
      
      logger.debug('JWT validated successfully', { 
        userId: payload.userId,
        expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'never'
      });
      
      return {
        valid: true,
        payload,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'JWT validation failed';
      logger.warn('JWT validation failed', { 
        error: errorMessage,
        tokenLength: token?.length || 0
      });
      
      return {
        valid: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Revoke Google tokens
   */
  async revokeTokens(accessToken: string): Promise<void> {
    try {
      await this.oauth2Client.revokeToken(accessToken);
    } catch (error) {
      throw new Error(`Failed to revoke tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(expiryDate: number): boolean {
    return Date.now() >= expiryDate;
  }

  /**
   * Generate secure random state parameter
   */
  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Validate state parameter
   */
  validateState(state: string, expectedState: string): boolean {
    return state === expectedState;
  }

  /**
   * Get OAuth client instance (for advanced usage)
   */
  getOAuth2Client(): OAuth2Client {
    return this.oauth2Client;
  }
}

// Export singleton instance
export const authService = new AuthService();
