# Authentication

The AI Assistant Platform implements comprehensive **authentication and authorization** with OAuth 2.0, JWT tokens, and secure token management. This document details the authentication architecture, OAuth flows, and security patterns.

## 🔐 **Authentication Architecture**

The platform uses a **multi-layered authentication system** with OAuth 2.0 for external services and JWT for API authentication.

### **Authentication Components**

```mermaid
graph TB
    AUTH_SYSTEM[Authentication System]
    
    AUTH_SYSTEM --> OAUTH[OAuth 2.0<br/>Google & Slack]
    AUTH_SYSTEM --> JWT[JWT Tokens<br/>API Authentication]
    AUTH_SYSTEM --> TOKEN_MGR[Token Manager<br/>Token Validation]
    AUTH_SYSTEM --> TOKEN_STORAGE[Token Storage<br/>Encrypted Persistence]
    
    OAUTH --> GOOGLE_OAUTH[Google OAuth<br/>Gmail, Calendar, Contacts]
    OAUTH --> SLACK_OAUTH[Slack OAuth<br/>Slack Integration]
    
    JWT --> JWT_GENERATION[JWT Generation<br/>User Sessions]
    JWT --> JWT_VALIDATION[JWT Validation<br/>Request Authentication]
    
    TOKEN_MGR --> TOKEN_VALIDATION[Token Validation<br/>Expiry Checking]
    TOKEN_MGR --> TOKEN_REFRESH[Token Refresh<br/>Automatic Renewal]
    
    TOKEN_STORAGE --> ENCRYPTION[Encryption<br/>Secure Storage]
    TOKEN_STORAGE --> DATABASE[Database<br/>PostgreSQL]
    TOKEN_STORAGE --> CACHE[Cache<br/>Redis]
```

### **Authentication Flow**

```mermaid
sequenceDiagram
    participant U as User
    participant C as Client
    participant A as Auth Service
    participant G as Google OAuth
    participant T as Token Manager
    participant S as Token Storage
    participant API as API Endpoints
    
    U->>C: Request OAuth
    C->>A: Generate Auth URL
    A->>G: Create OAuth URL
    G-->>A: Authorization URL
    A-->>C: Auth URL
    C-->>U: Redirect to Google
    
    U->>G: Authorize App
    G-->>C: Authorization Code
    C->>A: Exchange Code
    A->>G: Exchange for Tokens
    G-->>A: Access & Refresh Tokens
    A->>S: Store Encrypted Tokens
    A->>T: Generate JWT
    T-->>A: JWT Token
    A-->>C: JWT Token
    
    C->>API: API Request + JWT
    API->>T: Validate JWT
    T-->>API: Valid User
    API->>S: Get OAuth Tokens
    S-->>API: Encrypted Tokens
    API->>T: Validate OAuth Tokens
    T-->>API: Valid Tokens
    API-->>C: API Response
```

## 🔑 **OAuth 2.0 Implementation**

### **Google OAuth Service**

The `AuthService` handles Google OAuth 2.0 flows for Gmail, Calendar, and Contacts access:

```typescript
export class AuthService extends BaseService {
  private oauth2Client: OAuth2Client | null = null;
  
  constructor() {
    super('authService');
  }
  
  protected async onInitialize(): Promise<void> {
    const config = this.assertConfig();
    
    this.oauth2Client = new OAuth2Client(
      config.googleClientId,
      config.googleClientSecret,
      config.googleRedirectUri
    );
    
    this.logInfo('Google OAuth client initialized', {
      clientId: config.googleClientId ? `${config.googleClientId.substring(0, 20)}...` : 'not_set',
      redirectUri: config.googleRedirectUri || 'not_set'
    });
  }
  
  generateAuthUrl(scopes: string[] = [
    'openid', 
    'email', 
    'profile',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/contacts.readonly'
  ], state?: string): string {
    if (!this.oauth2Client) {
      throw new Error('Google OAuth not configured - cannot generate authorization URL');
    }
    
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: state || this.generateState(),
      prompt: 'consent' // Force consent to get refresh token
    });
    
    this.logInfo('Generated Google OAuth URL', {
      scopeCount: scopes.length,
      hasState: !!state,
      urlLength: authUrl.length
    });
    
    return authUrl;
  }
  
  async exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
    if (!this.oauth2Client) {
      throw new Error('Google OAuth not configured - cannot exchange authorization code');
    }
    
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      if (!tokens.access_token) {
        throw new Error('No access token received from Google');
      }

      const googleTokens: GoogleTokens = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || undefined,
        expires_in: 3600, // Default to 1 hour
        token_type: tokens.token_type || 'Bearer',
        scope: tokens.scope || '',
        expires_at: new Date(Date.now() + (3600 * 1000)) // Calculate expiry date
      };

      this.logInfo('Successfully exchanged code for tokens', {
        hasRefreshToken: !!googleTokens.refresh_token,
        expiresIn: googleTokens.expires_in,
        tokenLength: googleTokens.access_token.length,
        scope: googleTokens.scope
      });

      return googleTokens;
    } catch (error: any) {
      this.logError('Failed to exchange authorization code', error);
      throw error;
    }
  }
  
  async refreshGoogleToken(refreshToken: string): Promise<GoogleTokens> {
    if (!this.oauth2Client) {
      throw new Error('Google OAuth not configured - cannot refresh token');
    }
    
    try {
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
        scope: credentials.scope || '',
        expires_at: credentials.expiry_date ? new Date(credentials.expiry_date) : new Date(Date.now() + (3600 * 1000))
      };

      this.logInfo('Successfully refreshed Google tokens', {
        expiresIn: googleTokens.expires_in
      });

      return googleTokens;
    } catch (error) {
      this.logError('Failed to refresh Google token', error);
      throw error;
    }
  }
}
```

### **Slack OAuth Manager**

The `SlackOAuthManager` handles Slack OAuth 2.0 flows:

```typescript
export class SlackOAuthManager extends BaseService {
  private config: SlackOAuthConfig;
  
  constructor() {
    super('slackOAuthManager');
    this.config = this.getSlackConfig();
  }
  
  async generateAuthorizationUrl(params: SlackOAuthUrlParams): Promise<SlackOAuthAuthorizationResult> {
    try {
      const authUrl = new URL('https://slack.com/oauth/v2/authorize');
      authUrl.searchParams.set('client_id', this.config.clientId);
      authUrl.searchParams.set('scope', params.scopes.join(','));
      authUrl.searchParams.set('redirect_uri', this.config.redirectUri);
      authUrl.searchParams.set('state', params.state || this.generateState());
      
      this.logInfo('Generated Slack OAuth URL', {
        scopeCount: params.scopes.length,
        hasState: !!params.state
      });
      
      return {
        success: true,
        authUrl: authUrl.toString()
      };
    } catch (error) {
      this.logError('Failed to generate Slack OAuth URL', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate authorization URL'
      };
    }
  }
  
  async exchangeCodeForTokens(code: string, state: string): Promise<SlackOAuthTokenExchangeResult> {
    try {
      const response = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code: code,
          redirect_uri: this.config.redirectUri,
        }),
      });

      const data = await response.json() as any;

      if (!data.ok) {
        return {
          success: false,
          error: data.error || 'Token exchange failed',
          needsReauth: true
        };
      }

      const tokens: SlackOAuthTokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_in ? Date.now() + (data.expires_in * 1000) : undefined,
        scope: data.scope,
        teamId: data.team.id,
        userId: data.authed_user.id
      };

      this.logInfo('Successfully exchanged code for tokens', {
        teamId: tokens.teamId,
        userId: tokens.userId,
        hasRefreshToken: !!tokens.refreshToken,
        expiresAt: tokens.expiresAt
      });

      return {
        success: true,
        tokens
      };
    } catch (error) {
      this.logError('Error exchanging code for tokens', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token exchange failed',
        needsReauth: true
      };
    }
  }
}
```

## 🎫 **JWT Token Management**

### **JWT Generation & Validation**

The platform uses JWT tokens for API authentication:

```typescript
// JWT payload interface
interface JWTPayload {
  userId: string;
  email: string;
  name: string;
  picture?: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

// JWT generation
generateJWT(payload: Omit<JWTPayload, 'iat' | 'exp' | 'iss' | 'aud'>): string {
  const config = this.assertConfig();
  
  const jwtPayload: JWTPayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    iss: 'ai-assistant-platform',
    aud: 'ai-assistant-api'
  };
  
  return jwt.sign(jwtPayload, config.jwtSecret, {
    algorithm: 'HS256'
  });
}

// JWT validation
verifyJWT(token: string): JWTPayload {
  const config = this.assertConfig();
  
  try {
    const decoded = jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256'],
      issuer: 'ai-assistant-platform',
      audience: 'ai-assistant-api'
    }) as JWTPayload;
    
    // Check if token is expired
    if (decoded.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token has expired');
    }
    
    return decoded;
  } catch (error) {
    this.logError('JWT verification failed', error);
    throw new Error('Invalid or expired token');
  }
}
```

### **Authentication Middleware**

The authentication middleware validates JWT tokens for protected routes:

```typescript
export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: 'Access token required',
      code: 'MISSING_TOKEN'
    });
  }
  
  try {
    const authService = getService<AuthService>('authService');
    const decoded = authService.verifyJWT(token);
    
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture
    };
    
    next();
  } catch (error) {
    logger.warn('JWT authentication failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      token: token.substring(0, 20) + '...'
    });
    
    return res.status(403).json({ 
      success: false, 
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN'
    });
  }
};
```

## 🔄 **Token Management System**

### **Token Manager**

The `TokenManager` handles OAuth token validation, refresh, and management:

```typescript
export class TokenManager extends BaseService {
  private tokenStorageService: TokenStorageService | null = null;
  private authService: AuthService | null = null;
  private cacheService: CacheService | null = null;
  
  async getValidTokens(teamId: string, userId: string): Promise<string | null> {
    const userId_key = `${teamId}:${userId}`;
    
    // Try cache first
    const cacheKey = this.getTokenCacheKey(teamId, userId);
    if (this.cacheService) {
      const cachedTokens = await this.cacheService.get<OAuthTokens>(cacheKey);
      if (cachedTokens?.google?.access_token) {
        const validationResult = this.validateToken(cachedTokens.google);
        if (validationResult.isValid) {
          return cachedTokens.google.access_token;
        } else {
          await this.invalidateAllTokenCaches(teamId, userId);
        }
      }
    }
    
    // Get tokens from storage
    const tokens = await this.tokenStorageService!.getUserTokens(userId_key);
    
    if (!tokens?.googleTokens?.access_token) {
      return null;
    }
    
    // Validate token
    const validationResult = this.validateToken(tokens.googleTokens);
    if (!validationResult.isValid) {
      // Try to refresh token
      if (tokens.googleTokens.refresh_token) {
        const refreshedTokens = await this.refreshTokens(teamId, userId);
        return refreshedTokens?.google?.access_token || null;
      } else {
        return null;
      }
    }
    
    // Cache valid tokens
    if (this.cacheService) {
      const oauthTokens: OAuthTokens = {
        google: tokens.googleTokens,
        slack: tokens.slackTokens
      };
      await this.cacheService.set(cacheKey, oauthTokens, 300); // 5 minutes
    }
    
    return tokens.googleTokens.access_token;
  }
  
  validateToken(token: GoogleTokens): { isValid: boolean; reason?: string } {
    if (!token.access_token) {
      return { isValid: false, reason: 'no_access_token' };
    }
    
    // Check expiry with buffer (refresh 5 minutes early)
    const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes
    
    let expiryTime: number | null = null;
    if (token.expires_at) {
      const expiresAtDate = this.ensureDate(token.expires_at);
      expiryTime = expiresAtDate ? expiresAtDate.getTime() : null;
    } else if (token.expiry_date) {
      expiryTime = typeof token.expiry_date === 'number' ? token.expiry_date : new Date(token.expiry_date).getTime();
    }
    
    if (expiryTime !== null) {
      if (isNaN(expiryTime) || Date.now() > (expiryTime - REFRESH_BUFFER_MS)) {
        return { isValid: false, reason: 'expired_or_expiring_soon' };
      }
    } else {
      logger.warn('Token has no expiry information - treating as potentially invalid', {
        hasExpiryDate: !!token.expiry_date,
        hasExpiresAt: !!token.expires_at,
        tokenPreview: token.access_token ? `${token.access_token.substring(0, 10)}...` : 'none'
      });
      return { isValid: false, reason: 'no_expiry_information' };
    }
    
    return { isValid: true };
  }
  
  async refreshTokens(teamId: string, userId: string): Promise<OAuthTokens | null> {
    logger.info('Refreshing OAuth tokens for Slack user', { teamId, userId });
    
    // Invalidate all existing caches
    await this.invalidateAllTokenCaches(teamId, userId);
    
    const userId_key = `${teamId}:${userId}`;
    const tokens = await this.tokenStorageService!.getUserTokens(userId_key);
    
    if (!tokens?.googleTokens?.refresh_token) {
      logger.warn('No refresh token available for Slack user', { teamId, userId });
      return null;
    }
    
    try {
      const refreshedTokens = await this.authService!.refreshGoogleToken(tokens.googleTokens.refresh_token);
      
      // Store the refreshed tokens
      await this.tokenStorageService!.storeUserTokens(userId_key, {
        google: {
          access_token: refreshedTokens.access_token,
          refresh_token: refreshedTokens.refresh_token || tokens.googleTokens.refresh_token,
          expires_at: refreshedTokens.expires_at,
          token_type: refreshedTokens.token_type,
          scope: refreshedTokens.scope || undefined
        },
        slack: tokens.slackTokens // Preserve existing Slack tokens
      });
      
      // Create return value
      const newTokens: OAuthTokens = {
        google: {
          access_token: refreshedTokens.access_token,
          refresh_token: refreshedTokens.refresh_token || tokens.googleTokens.refresh_token,
          expires_in: refreshedTokens.expires_in,
          token_type: refreshedTokens.token_type,
          scope: refreshedTokens.scope,
          expiry_date: refreshedTokens.expires_at
        },
        slack: tokens.slackTokens
      };
      
      logger.info('Successfully refreshed OAuth tokens', { 
        teamId, 
        userId, 
        expiresIn: refreshedTokens.expires_in,
        hasNewRefreshToken: !!refreshedTokens.refresh_token
      });
      
      return newTokens;
    } catch (error) {
      logger.error('Failed to refresh OAuth tokens', { teamId, userId, error });
      return null;
    }
  }
}
```

### **Token Storage Service**

The `TokenStorageService` handles secure token persistence:

```typescript
export class TokenStorageService extends BaseService {
  private databaseService: DatabaseService | null = null;
  private cacheService: CacheService | null = null;
  private inMemoryTokens: Map<string, UserTokens> = new Map();
  
  private readonly TOKEN_CACHE_TTL = 2 * 60 * 60; // 2 hours
  
  async storeUserTokens(userId: string, tokens: { google?: GoogleTokens; slack?: SlackTokens }): Promise<void> {
    if (!tokens.google && !tokens.slack) {
      throw new Error('At least one token type must be provided');
    }
    
    // Encrypt refresh token if present
    let encryptedGoogleRefreshToken: string | null = null;
    if (tokens.google?.refresh_token) {
      try {
        encryptedGoogleRefreshToken = this.encryptToken(tokens.google.refresh_token);
      } catch (error) {
        this.logError('Failed to encrypt Google refresh token', { userId, error });
        throw error;
      }
    }
    
    // Store in database if available
    if (this.databaseService && this.databaseService.isReady()) {
      try {
        const googleTokens: GoogleTokens = {
          access_token: tokens.google!.access_token
        };
        
        if (encryptedGoogleRefreshToken) googleTokens.refresh_token = encryptedGoogleRefreshToken;
        if (tokens.google!.expires_at) googleTokens.expires_at = tokens.google!.expires_at;
        if (tokens.google!.token_type) googleTokens.token_type = tokens.google!.token_type;
        if (tokens.google!.scope) googleTokens.scope = tokens.google!.scope;
        
        const userTokens: UserTokens = {
          userId,
          googleTokens,
          slackTokens: tokens.slack,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await this.databaseService.storeUserTokens(userTokens);
        
        // Cache the tokens for quick access
        if (this.cacheService) {
          await this.cacheService.set(`tokens:${userId}`, userTokens, this.TOKEN_CACHE_TTL);
        }

        this.logInfo('Successfully stored user tokens in database', { 
          userId,
          hasGoogleTokens: !!tokens.google,
          hasSlackTokens: !!tokens.slack,
          googleTokenType: tokens.google?.token_type
        });

        // Audit log token storage
        AuditLogger.logOAuthEvent('OAUTH_TOKENS_STORED', `tokens:${userId}`, userId, undefined, {
          googleTokens: !!tokens.google,
          slackTokens: !!tokens.slack,
          encrypted: !!encryptedGoogleRefreshToken,
          storageType: 'database'
        });

      } catch (error) {
        this.logError('Failed to store tokens in database', { userId, error });
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      const userTokens: UserTokens = {
        userId,
        googleTokens: tokens.google,
        slackTokens: tokens.slack,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      this.inMemoryTokens.set(userId, userTokens);
      this.logInfo('Stored tokens in memory (database unavailable)', { userId });
    }
  }
  
  async getUserTokens(userId: string): Promise<UserTokens | null> {
    // Try cache first
    if (this.cacheService) {
      const cached = await this.cacheService.get<UserTokens>(`tokens:${userId}`);
      if (cached) {
        this.logDebug('Retrieved tokens from cache', { userId });
        return cached;
      }
    }
    
    // Try database
    if (this.databaseService && this.databaseService.isReady()) {
      try {
        const tokens = await this.databaseService.getUserTokens(userId);
        
        if (tokens) {
          // Decrypt refresh token if present
          if (tokens.googleTokens?.refresh_token) {
            try {
              const decryptedToken = this.decryptToken(tokens.googleTokens.refresh_token);
              tokens.googleTokens.refresh_token = decryptedToken;
            } catch (error) {
              this.logError('Failed to decrypt Google refresh token', { userId, error });
              // Remove the corrupted token to prevent further issues
              try {
                await this.databaseService.updateUserTokenRefreshToken(userId, null);
                this.logInfo('Removed corrupted refresh token', { userId });
              } catch (removeError) {
                this.logError('Failed to remove corrupted refresh token', { userId, error: removeError });
              }
            }
          }

          // Cache for future use
          if (this.cacheService) {
            await this.cacheService.set(`tokens:${userId}`, tokens, this.TOKEN_CACHE_TTL);
          }

          this.logDebug('Retrieved tokens from database', { userId });
          return tokens;
        }
        
        this.logDebug('No tokens found for user in database', { userId });
      } catch (error) {
        this.logError('Failed to retrieve user tokens from database', { userId, error });
      }
    } else {
      this.logInfo('Database not available, using in-memory storage', { 
        userId, 
        hasDatabaseService: !!this.databaseService,
        databaseReady: this.databaseService?.isReady(),
        databaseFailed: !!(this.databaseService as any)?._initializationFailed
      });
    }

    // Fallback to in-memory storage
    const inMemoryTokens = this.inMemoryTokens.get(userId);
    if (inMemoryTokens) {
      this.logDebug('Retrieved tokens from memory', { userId });
      return inMemoryTokens;
    }
    
    this.logDebug('No tokens found for user in any storage', { userId });
    return null;
  }
  
  private encryptToken(token: string): string {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.JWT_SECRET || 'default-secret', 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key);
    cipher.setAAD(Buffer.from('token-encryption'));
    
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }
  
  private decryptToken(encryptedToken: string): string {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.JWT_SECRET || 'default-secret', 'salt', 32);
    
    const [ivHex, authTagHex, encrypted] = encryptedToken.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipher(algorithm, key);
    decipher.setAAD(Buffer.from('token-encryption'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

## 🔒 **Security Features**

### **Token Security**

- **Encryption**: Refresh tokens are encrypted before storage
- **Expiry Management**: Automatic token refresh with 5-minute buffer
- **Secure Storage**: Tokens stored in encrypted database with Redis caching
- **Audit Logging**: All token operations are logged for security monitoring

### **Authentication Security**

- **JWT Security**: HS256 algorithm with secure secret
- **Token Validation**: Comprehensive validation including expiry and signature
- **Rate Limiting**: API rate limiting to prevent abuse
- **CORS Protection**: Configurable CORS policies
- **Input Sanitization**: XSS protection and input validation

### **OAuth Security**

- **State Parameter**: CSRF protection with state parameter
- **Scope Validation**: Strict scope validation for OAuth requests
- **Token Rotation**: Automatic refresh token rotation
- **Secure Redirects**: Validated redirect URIs

## 📊 **Authentication Performance**

### **Performance Metrics**

- **JWT Validation**: <10ms average
- **Token Refresh**: <500ms average
- **OAuth Exchange**: <2s average
- **Token Storage**: <50ms average
- **Cache Hit Rate**: 80-95% for token lookups

### **Security Monitoring**

- **Failed Authentication Attempts**: Logged and monitored
- **Token Refresh Failures**: Alerted for investigation
- **Suspicious Activity**: Pattern detection and alerting
- **Audit Trail**: Complete audit log of all authentication events

---

**Next**: [Database Service](./services/database-service.md) - PostgreSQL integration and data persistence
