import { OAuth2Client } from 'google-auth-library';
import jwt, { SignOptions } from 'jsonwebtoken';
import axios from 'axios';
import {
  GoogleTokens,
  GoogleUserInfo,
  TokenValidationResult,
  JWTPayload,
} from '../types/auth.types';
import { ErrorFactory } from '../errors/error-factory';
import { config as unifiedConfig } from '../config/unified-config';
import { BaseService } from './base-service';
import { ScopeManager, OAUTH_SCOPES } from '../constants/oauth-scopes';

export class AuthService extends BaseService {
  private oauth2Client!: OAuth2Client;

  constructor(private readonly config: typeof unifiedConfig) {
    super('AuthService');
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    // Initialize OAuth2Client using environment variables to avoid Awilix proxy
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    
    if (clientId && clientSecret && redirectUri) {
      this.oauth2Client = new OAuth2Client(
        clientId,
        clientSecret,
        redirectUri,
      );
    } else {
      this.logWarn('Google OAuth not configured - OAuth functionality will be disabled');
    }

    this.logInfo('Auth service initialized successfully', {
      environment: process.env.NODE_ENV || 'development',
      jwtIssuer: process.env.JWT_ISSUER || 'ai-assistant',
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
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
  generateAuthUrl(scopes: string[] = ScopeManager.getGoogleScopes('full'), state?: string): string {
    this.assertReady();

    if (!this.oauth2Client) {
      throw ErrorFactory.domain.serviceUnavailable('GoogleAuthService', { reason: 'OAuth not configured' });
    }
    
    try {
      const authOptions: any = {
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent',
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
   * Generate Google OAuth URL for Slack integration
   */
  generateGoogleAuthURL(state: string, scopes?: string[]): string {
    const slackScopes = scopes || ScopeManager.getGoogleScopes('slack');
    return this.generateAuthUrl(slackScopes, state);
  }

  /**
   * Generate Slack OAuth URL
   */
  generateSlackAuthURL(state: string): string {
    const clientId = this.config.slackAuth?.clientId;
    const redirectUri = this.config.slackAuth?.redirectUri;

    if (!clientId || !redirectUri) {
      throw ErrorFactory.domain.serviceUnavailable('SlackAuthService', { reason: 'OAuth not configured' });
    }

    const userScopes = [...OAUTH_SCOPES.SLACK.USER].join(',');
    const params = new (globalThis.URLSearchParams || globalThis.require('url').URLSearchParams)({
      client_id: clientId,
      scope: userScopes,
      redirect_uri: redirectUri,
      state: state,
      user_scope: userScopes,
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  /**
   * Generate Google OAuth URL for minimal permissions
   */
  generateMinimalGoogleAuthURL(state: string): string {
    const minimalScopes = ScopeManager.getGoogleScopes('minimal');
    return this.generateAuthUrl(minimalScopes, state);
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
    this.assertReady();

    if (!this.oauth2Client) {
      throw ErrorFactory.domain.serviceUnavailable('GoogleAuthService', { reason: 'OAuth not configured' });
    }
    
    try {
      this.logDebug('Exchanging authorization code for tokens', {
        codeLength: code.length,
        clientConfig: {
          hasClientId: !!this.config.googleAuth?.clientId,
          redirectUri: this.config.googleAuth?.redirectUri || 'not_set',
          hasClientSecret: !!this.config.googleAuth?.clientSecret,
        },
      });
      
      const { tokens } = await this.oauth2Client.getToken(code);

      if (!tokens.access_token) {
        throw ErrorFactory.external.google.serverError('No access token received');
      }

      const googleTokens: GoogleTokens = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || undefined,
        expires_in: 3600, // Default to 1 hour (Google converts expires_in to expiry_date)
        token_type: tokens.token_type || 'Bearer',
        scope: tokens.scope || '',
        expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + (3600 * 1000)), // Use Google's actual expiry_date or default to 1 hour
      };

      this.logInfo('Successfully exchanged code for tokens', {
        hasRefreshToken: !!googleTokens.refresh_token,
        expiresIn: googleTokens.expires_in,
        hasScope: !!googleTokens.scope,
      });

      return googleTokens;
    } catch (error: any) {
      this.logError('Token exchange failed with detailed error', {
        error: error.message,
        errorCode: error.code,
        errorDetails: error.response?.data,
        status: error.response?.status,
        clientConfig: {
          clientId: `${this.config.googleAuth?.clientId?.substring(0, 20)  }...` || 'unknown',
          redirectUri: this.config.googleAuth?.redirectUri || 'unknown',
        },
      });
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
      
      if (!userInfo?.sub) {
        return { valid: false, error: 'Unable to fetch user info with provided access token' };
      }

      // Validate user info
      if (!userInfo.sub || !userInfo.email || !userInfo.name) {
        return { valid: false, error: 'Missing required user info fields' };
      }

      this.logDebug('Google token validated successfully', { email: userInfo.email });
      
      return {
        valid: true,
        userInfo,
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
        iss: this.config.auth.jwt.issuer,
        aud: this.config.auth.jwt.audience,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + this.parseJWTExpiration(this.config.auth.jwt.expiresIn),
        ...additionalClaims,
      };

      const options: SignOptions = {
        algorithm: 'HS256',
      };

      const token = jwt.sign(payload, this.config.jwtSecret, options);
      
      this.logDebug('Generated JWT token', { 
        userId, 
        expiresIn: this.config.auth.jwt.expiresIn, 
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
      if (!token || typeof token !== 'string' || token.trim().length === 0) {
        throw ErrorFactory.validation.invalidInput('token', token, 'non-empty string');
      }

      const decoded = jwt.verify(token, this.config.jwtSecret, {
        issuer: this.config.auth.jwt.issuer,
        audience: this.config.auth.jwt.audience,
      }) as JWTPayload;

      this.logDebug('JWT token verified successfully', { 
        userId: decoded.sub,
      });
      
      return decoded;
    } catch (error) {
      this.logWarn('JWT token verification failed', { error });
      throw ErrorFactory.api.unauthorized('Invalid or expired token');
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
        refresh_token: refreshToken,
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw ErrorFactory.external.google.serverError('No access token received during refresh');
      }

      const googleTokens: GoogleTokens = {
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token || refreshToken,
        expires_in: 3600, // Default to 1 hour (Google converts expires_in to expiry_date)
        token_type: credentials.token_type || 'Bearer',
        scope: credentials.scope || '',
        expires_at: credentials.expiry_date ? new Date(credentials.expiry_date) : new Date(Date.now() + (3600 * 1000)), // Use Google's actual expiry_date or default to 1 hour
      };

      this.logInfo('Successfully refreshed Google tokens', {
        expiresIn: googleTokens.expires_in,
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
      this.logInfo('Fetching user info from Google', { 
        tokenLength: accessToken.length,
        tokenPrefix: `${accessToken.substring(0, 20)  }...`,
      });
      
      // Try the OpenID Connect userinfo endpoint first (more reliable)
      let response;
      let userInfo: GoogleUserInfo;
      
      try {
        this.logInfo('Trying OpenID Connect userinfo endpoint');
        response = await axios.get('https://openidconnect.googleapis.com/v1/userinfo', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        
        this.logInfo('OpenID Connect userinfo successful', {
          hasSub: !!response.data.sub,
          hasEmail: !!response.data.email,
          email: response.data.email,
        });
        
        userInfo = {
          sub: response.data.sub,
          email: response.data.email,
          name: response.data.name || '',
          picture: response.data.picture || '',
          email_verified: response.data.email_verified || false,
        };
      } catch (oidcError: any) {
        this.logWarn('OpenID Connect endpoint failed, trying OAuth2 v2 endpoint', { 
          status: oidcError.response?.status,
          statusText: oidcError.response?.statusText,
          data: oidcError.response?.data,
          message: oidcError.message, 
        });
        
        // Fallback to OAuth2 v2 userinfo endpoint
        this.logInfo('Trying OAuth2 v2 userinfo endpoint');
        response = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        this.logInfo('OAuth2 v2 userinfo successful', {
          hasId: !!response.data.id,
          hasEmail: !!response.data.email,
          email: response.data.email,
        });

        userInfo = {
          sub: response.data.id,
          email: response.data.email,
          name: response.data.name || '',
          picture: response.data.picture || '',
          email_verified: response.data.verified_email || false,
        };
      }

      // Validate user info
      if (!userInfo.sub || !userInfo.email || !userInfo.name) {
        throw ErrorFactory.validation.invalidInput('userInfo', userInfo, 'complete user information with sub, email, and name');
      }

      this.logDebug('Successfully fetched Google user info', { email: userInfo.email });
      
      return userInfo;
    } catch (error: any) {
      // Add more detailed error logging
      if (error.response) {
        this.logError('Google userinfo API error', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          tokenPrefix: `${accessToken.substring(0, 20)  }...`,
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
          hasGoogleClientId: !!this.config.googleAuth?.clientId,
          hasGoogleClientSecret: !!this.config.googleAuth?.clientSecret,
          hasGoogleRedirectUri: !!this.config.googleAuth?.redirectUri,
          hasJWTSecret: !!this.config.jwtSecret,
        },
      };

      return { healthy, details };
    } catch (error) {
      return { 
        healthy: false, 
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }
}

// Export the class for registration with ServiceManager
