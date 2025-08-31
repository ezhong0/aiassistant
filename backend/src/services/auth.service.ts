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
import { BaseService } from './base-service';
import logger from '../utils/logger';

export class AuthService extends BaseService {
  private oauth2Client!: OAuth2Client;
  private readonly config = configService;

  constructor() {
    super('AuthService');
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    // Validate configuration
    this.config.validate();
    
    this.oauth2Client = new OAuth2Client(
      this.config.googleClientId,
      this.config.googleClientSecret,
      this.config.googleRedirectUri
    );

    this.logInfo('Auth service initialized successfully', {
      environment: this.config.nodeEnv,
      jwtIssuer: this.config.jwtIssuer,
      jwtExpiresIn: this.config.jwtExpiresIn
    });
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    this.logInfo('Auth service destroyed');
  }

  /**
   * Generate Google OAuth authorization URL
   */
  generateAuthUrl(scopes: string[] = [
    'openid', 
    'email', 
    'profile',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/contacts.readonly'
  ], state?: string): string {
    this.assertReady();
    
    try {
      const authOptions: any = {
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent'
      };

      // Add state parameter if provided
      if (state) {
        authOptions.state = state;
      }

      const url = this.oauth2Client.generateAuthUrl(authOptions);
      
      this.logDebug('Generated OAuth URL', { scopes, state: !!state, urlLength: url.length });
      return url;
    } catch (error) {
      this.handleError(error, 'generateAuthUrl');
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
    this.assertReady();
    
    try {
      this.logDebug('Exchanging authorization code for tokens');
      
      const { tokens } = await this.oauth2Client.getToken(code);
      
      if (!tokens.access_token) {
        throw new Error('No access token received from Google');
      }

      const googleTokens: GoogleTokens = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || undefined,
        expires_in: 3600, // Default to 1 hour
        token_type: tokens.token_type || 'Bearer',
        scope: tokens.scope || ''
      };

      this.logInfo('Successfully exchanged code for tokens', {
        hasRefreshToken: !!googleTokens.refresh_token,
        expiresIn: googleTokens.expires_in
      });

      return googleTokens;
    } catch (error) {
      this.handleError(error, 'exchangeCodeForTokens');
    }
  }

  /**
   * Validate Google access token
   */
  async validateGoogleToken(accessToken: string): Promise<TokenValidationResult> {
    this.assertReady();
    
    try {
      this.logDebug('Validating Google access token via userinfo endpoint');
      
      // Validate access token by calling Google's userinfo endpoint
      const userInfo = await this.getGoogleUserInfo(accessToken);
      
      if (!userInfo || !userInfo.sub) {
        return { valid: false, error: 'Unable to fetch user info with provided access token' };
      }

      // Validate user info
      const validationResult = validateGoogleUserInfo(userInfo);
      if (!validationResult.valid) {
        return { valid: false, error: validationResult.errors.join(', ') };
      }

      this.logDebug('Google token validated successfully', { email: userInfo.email });
      
      return {
        valid: true,
        userInfo
      };
    } catch (error) {
      this.logWarn('Google token validation failed', { error });
      return { valid: false, error: 'Token validation failed' };
    }
  }

  /**
   * Generate JWT token for authenticated user
   */
  generateJWT(userId: string, email: string, additionalClaims: Record<string, any> = {}): string {
    this.assertReady();
    
    try {
      const payload: JWTPayload = {
        sub: userId,
        email,
        iss: this.config.jwtIssuer,
        aud: this.config.jwtAudience,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + this.parseJWTExpiration(this.config.jwtExpiresIn),
        ...additionalClaims
      };

      const options: SignOptions = {
        algorithm: 'HS256'
      };

      const token = jwt.sign(payload, this.config.jwtSecret, options);
      
      this.logDebug('Generated JWT token', { 
        userId, 
        email, 
        expiresIn: this.config.jwtExpiresIn 
      });
      
      return token;
    } catch (error) {
      this.handleError(error, 'generateJWT');
    }
  }

  /**
   * Verify JWT token
   */
  verifyJWT(token: string): JWTPayload {
    this.assertReady();
    
    try {
      // Validate token format first
      const formatValidation = validateTokenFormat(token);
      if (!formatValidation.valid) {
        throw new Error(`Invalid token format: ${formatValidation.error}`);
      }

      const decoded = jwt.verify(token, this.config.jwtSecret, {
        issuer: this.config.jwtIssuer,
        audience: this.config.jwtAudience
      }) as JWTPayload;

      this.logDebug('JWT token verified successfully', { 
        userId: decoded.sub, 
        email: decoded.email 
      });
      
      return decoded;
    } catch (error) {
      this.logWarn('JWT token verification failed', { error });
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Refresh Google access token
   */
  async refreshGoogleToken(refreshToken: string): Promise<GoogleTokens> {
    this.assertReady();
    
    try {
      this.logDebug('Refreshing Google access token');
      
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      if (!credentials.access_token) {
        throw new Error('No access token received during refresh');
      }

      const googleTokens: GoogleTokens = {
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token || refreshToken,
        expires_in: 3600, // Default to 1 hour
        token_type: credentials.token_type || 'Bearer',
        scope: credentials.scope || ''
      };

      this.logInfo('Successfully refreshed Google tokens', {
        expiresIn: googleTokens.expires_in
      });

      return googleTokens;
    } catch (error) {
      this.handleError(error, 'refreshGoogleToken');
    }
  }

  /**
   * Revoke Google tokens
   */
  async revokeGoogleTokens(accessToken: string): Promise<void> {
    this.assertReady();
    
    try {
      this.logDebug('Revoking Google tokens');
      
      await this.oauth2Client.revokeToken(accessToken);
      
      this.logInfo('Successfully revoked Google tokens');
    } catch (error) {
      this.logWarn('Failed to revoke Google tokens', { error });
      // Don't throw error for revocation failure
    }
  }

  /**
   * Get user info from Google
   */
  async getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    this.assertReady();
    
    try {
      this.logDebug('Fetching user info from Google', { tokenLength: accessToken.length });
      
      // Try the OpenID Connect userinfo endpoint first (more reliable)
      let response;
      let userInfo: GoogleUserInfo;
      
      try {
        this.logDebug('Trying OpenID Connect userinfo endpoint');
        response = await axios.get('https://openidconnect.googleapis.com/v1/userinfo', {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });
        
        userInfo = {
          sub: response.data.sub,
          email: response.data.email,
          name: response.data.name || '',
          picture: response.data.picture || '',
          email_verified: response.data.email_verified || false
        };
      } catch (oidcError) {
        this.logWarn('OpenID Connect endpoint failed, trying OAuth2 v2 endpoint', { 
          error: oidcError.response?.status,
          message: oidcError.message 
        });
        
        // Fallback to OAuth2 v2 userinfo endpoint
        response = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });

        userInfo = {
          sub: response.data.id,
          email: response.data.email,
          name: response.data.name || '',
          picture: response.data.picture || '',
          email_verified: response.data.verified_email || false
        };
      }

      // Validate user info
      const validationResult = validateGoogleUserInfo(userInfo);
      if (!validationResult.valid) {
        throw new Error(`Invalid user info: ${validationResult.errors.join(', ')}`);
      }

      this.logDebug('Successfully fetched Google user info', { email: userInfo.email });
      
      return userInfo;
    } catch (error) {
      // Add more detailed error logging
      if (error.response) {
        this.logError('Google userinfo API error', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          tokenPrefix: accessToken.substring(0, 20) + '...'
        });
      }
      this.handleError(error, 'getGoogleUserInfo');
    }
  }

  /**
   * Parse JWT expiration string to seconds
   */
  private parseJWTExpiration(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 24 * 60 * 60; // Default to 24 hours
    }

    const value = parseInt(match[1] || '0', 10);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return 24 * 60 * 60;
    }
  }

  /**
   * Get service health status
   */
  getHealth(): { healthy: boolean; details?: any } {
    try {
      const healthy = this.isReady() && !!this.oauth2Client;
      const details = {
        oauth2Client: !!this.oauth2Client,
        config: {
          hasGoogleClientId: !!this.config.googleClientId,
          hasGoogleClientSecret: !!this.config.googleClientSecret,
          hasGoogleRedirectUri: !!this.config.googleRedirectUri,
          hasJWTSecret: !!this.config.jwtSecret
        }
      };

      return { healthy, details };
    } catch (error) {
      return { 
        healthy: false, 
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}

// Export the class for registration with ServiceManager
