# 🔧 Service Layer Architecture - AI Development Guide

## 🎯 **Service Layer Vision**

This document describes the **service layer architecture** that provides business logic, external integrations, and dependency management. The system uses a service registry pattern with lifecycle management and dependency injection for maintainable, testable code.

## 🏗️ **Service Architecture Overview**

### **Service Layer Structure**
```
┌─────────────────────────────────────────────────────────────┐
│                    Service Registry                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│  │ Session     │ │ Auth        │ │ Gmail       │         │
│  │ Service    │ │ Service     │ │ Service     │         │
│  └─────────────┘ └─────────────┘ └─────────────┘         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│  │ Contact     │ │ OpenAI      │ │ Tool        │         │
│  │ Service     │ │ Service     │ │ Executor    │         │
│  └─────────────┘ └─────────────┘ └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Dependency     │
                    │  Resolution     │
                    │  & Lifecycle    │
                    └─────────────────┘
```

### **Core Principles**
1. **Dependency Injection**: Services declare dependencies explicitly
2. **Lifecycle Management**: Centralized service initialization and shutdown
3. **Interface Contracts**: All services implement IService interface
4. **Error Isolation**: Service failures don't cascade to other services
5. **Health Monitoring**: Comprehensive health status tracking

## 🔧 **Service Registry System**

### **Service Manager Architecture**
```typescript
export class ServiceManager {
  private static instance: ServiceManager;
  private services: Map<string, ServiceRegistration> = new Map();
  private serviceInstances: Map<string, IService> = new Map();
  private isShuttingDown = false;
  private initializationOrder: string[] = [];

  // Singleton pattern with dependency injection
  static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  // Service registration with dependency management
  registerService(
    name: string, 
    service: IService, 
    options: {
      dependencies?: string[];
      priority?: number;
      autoStart?: boolean;
    } = {}
  ): void

  // Dependency resolution and initialization
  async initializeAllServices(): Promise<void>
  
  // Service retrieval with type safety
  getService<T extends IService>(name: string): T | undefined
  
  // Health monitoring
  getHealthStatus(): ServiceHealthStatus[]
}
```

### **Service Registration Pattern**
```typescript
// Services declare their dependencies and priorities
serviceManager.registerService('sessionService', sessionService, {
  priority: 10,        // Lower number = higher priority
  autoStart: true      // Start automatically
});

serviceManager.registerService('toolExecutorService', toolExecutorService, {
  dependencies: ['sessionService'],  // Must initialize after sessionService
  priority: 20,
  autoStart: true
});

serviceManager.registerService('gmailService', gmailService, {
  dependencies: ['authService'],     // Depends on authentication
  priority: 50,
  autoStart: true
});
```

### **Service Lifecycle States**
```typescript
export enum ServiceState {
  INITIALIZING = 'initializing',
  READY = 'ready',
  ERROR = 'error',
  SHUTTING_DOWN = 'shutting_down',
  DESTROYED = 'destroyed'
}

// Service interface that all services must implement
export interface IService {
  readonly name: string;
  readonly state: ServiceState;
  
  initialize(): Promise<void>;
  isReady(): boolean;
  destroy(): Promise<void>;
  getHealth(): { healthy: boolean; details?: any };
}
```

## 🏗️ **Core Service Implementations**

### **1. Session Service**
**File**: `backend/src/services/session.service.ts`

**Responsibility**: Conversation context and session management

**Key Features**:
- Session creation and management
- Conversation history tracking
- Context window management (30-minute rolling window)
- User session association

**Implementation**:
```typescript
export class SessionService implements IService {
  readonly name = 'sessionService';
  private state: ServiceState = ServiceState.INITIALIZING;
  private sessions = new Map<string, SessionData>();
  private readonly sessionTimeoutMinutes: number;

  constructor(sessionTimeoutMinutes: number = 30) {
    this.sessionTimeoutMinutes = sessionTimeoutMinutes;
  }

  async initialize(): Promise<void> {
    try {
      this.state = ServiceState.INITIALIZING;
      
      // Start cleanup timer for expired sessions
      this.startCleanupTimer();
      
      this.state = ServiceState.READY;
      logger.info('SessionService initialized successfully');
    } catch (error) {
      this.state = ServiceState.ERROR;
      logger.error('Failed to initialize SessionService:', error);
      throw error;
    }
  }

  getOrCreateSession(sessionId: string, userId?: string): SessionData {
    if (this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId)!;
      
      // Check if session is expired
      if (this.isSessionExpired(session)) {
        this.sessions.delete(sessionId);
      } else {
        return session;
      }
    }
    
    // Create new session
    const session: SessionData = {
      id: sessionId,
      userId,
      createdAt: new Date(),
      lastActivity: new Date(),
      conversationHistory: [],
      context: {}
    };
    
    this.sessions.set(sessionId, session);
    return session;
  }

  addConversationEntry(sessionId: string, entry: ConversationEntry): void {
    const session = this.getOrCreateSession(sessionId);
    
    session.conversationHistory.push(entry);
    session.lastActivity = new Date();
    
    // Maintain context window
    this.maintainContextWindow(session);
  }

  private maintainContextWindow(session: SessionData): void {
    const cutoffTime = new Date(Date.now() - (this.sessionTimeoutMinutes * 60 * 1000));
    
    // Remove entries older than context window
    session.conversationHistory = session.conversationHistory.filter(
      entry => entry.timestamp > cutoffTime
    );
  }

  getHealth(): { healthy: boolean; details?: any } {
    const activeSessions = Array.from(this.sessions.values()).filter(
      session => !this.isSessionExpired(session)
    ).length;
    
    return {
      healthy: this.state === ServiceState.READY,
      details: {
        state: this.state,
        activeSessions,
        totalSessions: this.sessions.size
      }
    };
  }
}
```

### **2. Authentication Service**
**File**: `backend/src/services/auth.service.ts`

**Responsibility**: Google OAuth 2.0 authentication and token management

**Key Features**:
- OAuth token exchange and validation
- Token refresh handling
- User permission validation
- Secure token storage

**Implementation**:
```typescript
export class AuthService implements IService {
  readonly name = 'authService';
  private state: ServiceState = ServiceState.INITIALIZING;
  private googleAuthClient: OAuth2Client;

  constructor() {
    this.googleAuthClient = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
  }

  async initialize(): Promise<void> {
    try {
      this.state = ServiceState.INITIALIZING;
      
      // Validate environment configuration
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        throw new Error('Google OAuth credentials not configured');
      }
      
      this.state = ServiceState.READY;
      logger.info('AuthService initialized successfully');
    } catch (error) {
      this.state = ServiceState.ERROR;
      logger.error('Failed to initialize AuthService:', error);
      throw error;
    }
  }

  async exchangeMobileTokens(mobileTokens: MobileTokenExchangeRequest): Promise<TokenExchangeResponse> {
    try {
      // Validate mobile tokens with Google
      const ticket = await this.googleAuthClient.verifyIdToken({
        idToken: mobileTokens.idToken,
        audience: process.env.GOOGLE_CLIENT_ID
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new Error('Invalid ID token payload');
      }

      // Exchange for access token
      const { tokens } = await this.googleAuthClient.getAccessToken();
      
      // Store tokens securely
      const sessionToken = await this.createSessionToken(payload.sub, tokens);
      
      return {
        sessionToken,
        user: {
          id: payload.sub,
          email: payload.email,
          name: payload.name,
          picture: payload.picture
        }
      };
    } catch (error) {
      logger.error('Token exchange failed:', error);
      throw new AuthenticationError('Token exchange failed');
    }
  }

  async validateSessionToken(sessionToken: string): Promise<User | null> {
    try {
      // Validate session token and return user
      const decoded = jwt.verify(sessionToken, process.env.JWT_SECRET!) as JwtPayload;
      return await this.getUserById(decoded.userId);
    } catch (error) {
      logger.warn('Invalid session token:', error);
      return null;
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    try {
      const { credentials } = await this.googleAuthClient.refreshToken(refreshToken);
      return credentials.access_token!;
    } catch (error) {
      logger.error('Token refresh failed:', error);
      throw new AuthenticationError('Token refresh failed');
    }
  }
}
```

### **3. Gmail Service**
**File**: `backend/src/services/gmail.service.ts`

**Responsibility**: Gmail API integration and email operations

**Key Features**:
- Email composition and sending
- Thread management
- Search and retrieval
- Draft management

**Implementation**:
```typescript
export class GmailService implements IService {
  readonly name = 'gmailService';
  private state: ServiceState = ServiceState.INITIALIZING;
  private authService: AuthService;

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  async initialize(): Promise<void> {
    try {
      this.state = ServiceState.INITIALIZING;
      
      // Verify Gmail API access
      if (!process.env.GOOGLE_CLIENT_ID) {
        throw new Error('Google OAuth not configured');
      }
      
      this.state = ServiceState.READY;
      logger.info('GmailService initialized successfully');
    } catch (error) {
      this.state = ServiceState.ERROR;
      logger.error('Failed to initialize GmailService:', error);
      throw error;
    }
  }

  async sendEmail(request: SendEmailRequest, accessToken: string): Promise<EmailResult> {
    try {
      // Validate user permissions
      const user = await this.authService.validateAccessToken(accessToken);
      if (!user.hasGmailScope) {
        throw new Error('Insufficient Gmail permissions');
      }

      // Create Gmail API client
      const gmail = google.gmail({ version: 'v1', headers: { Authorization: `Bearer ${accessToken}` } });

      // Compose email
      const email = this.composeEmail(request);
      
      // Send via Gmail API
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: email }
      });

      return {
        success: true,
        messageId: response.data.id,
        threadId: response.data.threadId
      };
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw new GmailServiceError('Email sending failed', error);
    }
  }

  async searchEmails(request: SearchEmailsRequest, accessToken: string): Promise<GmailMessage[]> {
    try {
      const gmail = google.gmail({ version: 'v1', headers: { Authorization: `Bearer ${accessToken}` } });
      
      // Build Gmail query
      const query = this.buildSearchQuery(request);
      
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: request.maxResults || 10
      });

      // Fetch full message details
      const messages = await Promise.all(
        (response.data.messages || []).map(async (msg) => {
          const fullMessage = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id!
          });
          return this.parseGmailMessage(fullMessage.data);
        })
      );

      return messages;
    } catch (error) {
      logger.error('Failed to search emails:', error);
      throw new GmailServiceError('Email search failed', error);
    }
  }

  private composeEmail(request: SendEmailRequest): string {
    // Build RFC 2822 compliant email
    const email = [
      `From: ${request.from}`,
      `To: ${request.to.join(', ')}`,
      `Subject: ${request.subject}`,
      `Content-Type: text/plain; charset=utf-8`,
      '',
      request.body
    ].join('\r\n');

    return Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  }

  private buildSearchQuery(request: SearchEmailsRequest): string {
    const parts: string[] = [];
    
    if (request.query) parts.push(request.query);
    if (request.from) parts.push(`from:${request.from}`);
    if (request.to) parts.push(`to:${request.to}`);
    if (request.subject) parts.push(`subject:${request.subject}`);
    if (request.hasAttachment) parts.push('has:attachment');
    
    return parts.join(' ');
  }
}
```

### **4. Contact Service**
**File**: `backend/src/services/contact.service.ts`

**Responsibility**: Google Contacts and People API integration

**Key Features**:
- Contact search and retrieval
- Fuzzy name matching
- Email history analysis
- Contact creation and updates

**Implementation**:
```typescript
export class ContactService implements IService {
  readonly name = 'contactService';
  private state: ServiceState = ServiceState.INITIALIZING;
  private authService: AuthService;

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  async initialize(): Promise<void> {
    try {
      this.state = ServiceState.INITIALIZING;
      
      // Verify Google APIs access
      if (!process.env.GOOGLE_CLIENT_ID) {
        throw new Error('Google OAuth not configured');
      }
      
      this.state = ServiceState.READY;
      logger.info('ContactService initialized successfully');
    } catch (error) {
      this.state = ServiceState.ERROR;
      logger.error('Failed to initialize ContactService:', error);
      throw error;
    }
  }

  async searchContacts(request: ContactSearchRequest, accessToken: string): Promise<Contact[]> {
    try {
      // Validate user permissions
      const user = await this.authService.validateAccessToken(accessToken);
      if (!user.hasContactsScope) {
        throw new Error('Insufficient Contacts permissions');
      }

      const contacts: Contact[] = [];
      
      // Search Google Contacts API
      const people = google.people({ version: 'v1', headers: { Authorization: `Bearer ${accessToken}` } });
      
      const response = await people.people.searchDirectoryPeople({
        query: request.query,
        readMask: 'names,emailAddresses,phoneNumbers,photos'
      });

      // Process and filter results
      for (const person of response.data.people || []) {
        if (this.matchesSearchCriteria(person, request)) {
          contacts.push(this.parseContact(person));
        }
      }

      // Add fuzzy matching for better results
      if (contacts.length < request.maxResults) {
        const fuzzyResults = await this.fuzzySearchContacts(request, accessToken);
        contacts.push(...fuzzyResults.slice(0, request.maxResults - contacts.length));
      }

      return contacts;
    } catch (error) {
      logger.error('Failed to search contacts:', error);
      throw new ContactServiceError('Contact search failed', error);
    }
  }

  private async fuzzySearchContacts(request: ContactSearchRequest, accessToken: string): Promise<Contact[]> {
    // Implement fuzzy matching using Levenshtein distance
    const allContacts = await this.getAllContacts(accessToken);
    
    return allContacts
      .filter(contact => this.calculateSimilarity(contact.name, request.query) > 0.7)
      .sort((a, b) => this.calculateSimilarity(b.name, request.query) - this.calculateSimilarity(a.name, request.query));
  }

  private calculateSimilarity(name: string, query: string): number {
    // Simple similarity calculation (can be enhanced with more sophisticated algorithms)
    const nameLower = name.toLowerCase();
    const queryLower = query.toLowerCase();
    
    if (nameLower.includes(queryLower)) return 1.0;
    if (queryLower.includes(nameLower)) return 0.8;
    
    // Calculate character overlap
    const nameChars = new Set(nameLower.split(''));
    const queryChars = new Set(queryLower.split(''));
    
    const intersection = new Set([...nameChars].filter(x => queryChars.has(x)));
    const union = new Set([...nameChars, ...queryChars]);
    
    return intersection.size / union.size;
  }

  private parseContact(person: any): Contact {
    return {
      id: person.resourceName!,
      name: person.names?.[0]?.displayName || 'Unknown',
      email: person.emailAddresses?.[0]?.value,
      phone: person.phoneNumbers?.[0]?.value,
      photo: person.photos?.[0]?.url
    };
  }
}
```

### **5. OpenAI Service**
**File**: `backend/src/services/openai.service.ts`

**Responsibility**: OpenAI API integration for AI-powered features

**Key Features**:
- GPT-4o-mini integration
- Tool call generation
- Natural language processing
- Cost optimization

**Implementation**:
```typescript
export class OpenAIService implements IService {
  readonly name = 'openaiService';
  private state: ServiceState = ServiceState.INITIALIZING;
  private openai: OpenAI;
  private model: string;

  constructor(config: { apiKey: string; model?: string }) {
    this.openai = new OpenAI({ apiKey: config.apiKey });
    this.model = config.model || 'gpt-4o-mini';
  }

  async initialize(): Promise<void> {
    try {
      this.state = ServiceState.INITIALIZING;
      
      // Test OpenAI connection
      await this.openai.models.list();
      
      this.state = ServiceState.READY;
      logger.info('OpenAI service initialized successfully');
    } catch (error) {
      this.state = ServiceState.ERROR;
      logger.error('Failed to initialize OpenAI service:', error);
      throw error;
    }
  }

  async generateToolCalls(
    userInput: string, 
    systemPrompt: string, 
    sessionId: string
  ): Promise<OpenAIResponse> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userInput }
        ],
        functions: this.getAvailableFunctions(),
        function_call: 'auto',
        temperature: 0.1, // Low temperature for consistent tool selection
        max_tokens: 1000
      });

      const message = response.choices[0]?.message;
      if (!message) {
        throw new Error('No response from OpenAI');
      }

      // Parse function calls
      const toolCalls = this.parseFunctionCalls(message.function_call);
      
      return {
        message: message.content || '',
        toolCalls
      };
    } catch (error) {
      logger.error('OpenAI API call failed:', error);
      throw new Error('AI processing failed');
    }
  }

  private getAvailableFunctions(): OpenAI.Function[] {
    // Generate functions from AgentFactory metadata
    return AgentFactory.generateOpenAIFunctions();
  }

  private parseFunctionCalls(functionCall: any): ToolCall[] {
    if (!functionCall) return [];
    
    try {
      const args = JSON.parse(functionCall.arguments);
      return [{
        name: functionCall.name,
        parameters: args
      }];
    } catch (error) {
      logger.error('Failed to parse function call:', error);
      return [];
    }
  }
}
```

## 🔄 **Service Initialization Flow**

### **Service Registration Order**
```typescript
export const initializeAllCoreServices = async (): Promise<void> => {
  try {
    logger.info('Registering and initializing core services...');

    // 1. SessionService - No dependencies, highest priority
    const sessionService = new SessionService();
    serviceManager.registerService('sessionService', sessionService, {
      priority: 10,
      autoStart: true
    });

    // 2. ToolExecutorService - Depends on sessionService
    const toolExecutorService = new ToolExecutorService();
    serviceManager.registerService('toolExecutorService', toolExecutorService, {
      dependencies: ['sessionService'],
      priority: 20,
      autoStart: true
    });

    // 3. AuthService - No external dependencies
    const authService = new AuthService();
    serviceManager.registerService('authService', authService, {
      priority: 30,
      autoStart: true
    });

    // 4. ContactService - Depends on authService
    const contactService = new ContactService(authService);
    serviceManager.registerService('contactService', contactService, {
      dependencies: ['authService'],
      priority: 40,
      autoStart: true
    });

    // 5. GmailService - Depends on authService
    const gmailService = new GmailService(authService);
    serviceManager.registerService('gmailService', gmailService, {
      dependencies: ['authService'],
      priority: 50,
      autoStart: true
    });

    // 6. OpenAIService - No external dependencies
    const openaiService = new OpenAIService({
      apiKey: process.env.OPENAI_API_KEY || 'dummy-key'
    });
    serviceManager.registerService('openaiService', openaiService, {
      priority: 60,
      autoStart: true
    });

    // Initialize all services in dependency order
    await serviceManager.initializeAllServices();

    logger.info('All core services registered and initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize core services:', error);
    throw error;
  }
};
```

### **Dependency Resolution**
```typescript
// ServiceManager resolves dependencies automatically
async initializeAllServices(): Promise<void> {
  // Sort services by priority and dependencies
  const sortedServices = this.sortServicesByDependencies();
  
  for (const serviceName of sortedServices) {
    const registration = this.services.get(serviceName)!;
    
    try {
      logger.info(`Initializing service: ${serviceName}`);
      await registration.service.initialize();
      
      // Mark as ready
      this.serviceInstances.set(serviceName, registration.service);
      
    } catch (error) {
      logger.error(`Failed to initialize service ${serviceName}:`, error);
      
      // Mark as error state
      registration.service.state = ServiceState.ERROR;
      
      // Continue with other services
    }
  }
}

private sortServicesByDependencies(): string[] {
  // Topological sort based on dependencies
  const visited = new Set<string>();
  const temp = new Set<string>();
  const order: string[] = [];
  
  const visit = (serviceName: string) => {
    if (temp.has(serviceName)) {
      throw new Error(`Circular dependency detected: ${serviceName}`);
    }
    
    if (visited.has(serviceName)) return;
    
    temp.add(serviceName);
    
    const registration = this.services.get(serviceName)!;
    for (const dep of registration.dependencies) {
      visit(dep);
    }
    
    temp.delete(serviceName);
    visited.add(serviceName);
    order.push(serviceName);
  };
  
  // Visit all services
  for (const serviceName of this.services.keys()) {
    if (!visited.has(serviceName)) {
      visit(serviceName);
    }
  }
  
  return order;
}
```

## 🧪 **Service Testing Patterns**

### **Service Unit Testing**
```typescript
describe('GmailService', () => {
  let gmailService: GmailService;
  let mockAuthService: jest.Mocked<AuthService>;
  
  beforeEach(() => {
    mockAuthService = createMockAuthService();
    gmailService = new GmailService(mockAuthService);
  });
  
  it('should send email with valid token', async () => {
    // Arrange
    const request: SendEmailRequest = {
      to: ['test@example.com'],
      subject: 'Test Subject',
      body: 'Test Body'
    };
    
    mockAuthService.validateAccessToken.mockResolvedValue({
      id: 'user123',
      hasGmailScope: true
    });
    
    // Mock Gmail API response
    jest.spyOn(google.gmail, 'v1').mockReturnValue({
      users: {
        messages: {
          send: jest.fn().mockResolvedValue({
            data: { id: 'msg123', threadId: 'thread123' }
          })
        }
      }
    } as any);
    
    // Act
    const result = await gmailService.sendEmail(request, 'valid-token');
    
    // Assert
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg123');
    expect(result.threadId).toBe('thread123');
  });
  
  it('should reject email with insufficient permissions', async () => {
    // Arrange
    mockAuthService.validateAccessToken.mockResolvedValue({
      id: 'user123',
      hasGmailScope: false
    });
    
    // Act & Assert
    await expect(
      gmailService.sendEmail({ to: ['test@example.com'], subject: 'Test', body: 'Test' }, 'token')
    ).rejects.toThrow('Insufficient Gmail permissions');
  });
});
```

### **Service Integration Testing**
```typescript
describe('Service Integration', () => {
  it('should handle complete email workflow', async () => {
    // Initialize services
    await initializeAllCoreServices();
    
    // Get services
    const authService = getService<AuthService>('authService')!;
    const gmailService = getService<GmailService>('gmailService')!;
    const sessionService = getService<SessionService>('sessionService')!;
    
    // Create test session
    const session = sessionService.getOrCreateSession('test-session');
    
    // Mock authentication
    const mockUser = { id: 'user123', hasGmailScope: true };
    jest.spyOn(authService, 'validateAccessToken').mockResolvedValue(mockUser);
    
    // Test email sending
    const result = await gmailService.sendEmail({
      to: ['test@example.com'],
      subject: 'Integration Test',
      body: 'Test email body'
    }, 'valid-token');
    
    expect(result.success).toBe(true);
  });
});
```

## 📊 **Service Health Monitoring**

### **Health Check Endpoint**
```typescript
app.get('/health', async (req: Request, res: Response) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: configService.nodeEnv,
    services: await serviceManager.getHealthStatus(),
    agents: AgentFactory.getStats()
  };
  
  const isHealthy = health.services.every(service => service.healthy);
  res.status(isHealthy ? 200 : 503).json(health);
});
```

### **Service Health Status**
```typescript
export interface ServiceHealthStatus {
  name: string;
  healthy: boolean;
  state: ServiceState;
  details?: any;
  lastCheck: string;
}

// ServiceManager provides health status
getHealthStatus(): ServiceHealthStatus[] {
  return Array.from(this.services.keys()).map(name => {
    const service = this.serviceInstances.get(name);
    const health = service?.getHealth() || { healthy: false };
    
    return {
      name,
      healthy: health.healthy,
      state: service?.state || ServiceState.ERROR,
      details: health.details,
      lastCheck: new Date().toISOString()
    };
  });
}
```

## 🔍 **Service Debugging and Troubleshooting**

### **Service State Monitoring**
```typescript
// Log service state changes
logger.info(`Service ${serviceName} state changed to ${newState}`, {
  serviceName,
  previousState: oldState,
  newState,
  timestamp: new Date().toISOString()
});

// Monitor service dependencies
logger.debug(`Service ${serviceName} dependencies:`, {
  serviceName,
  dependencies: registration.dependencies,
  priority: registration.priority
});
```

### **Service Error Handling**
```typescript
// Graceful service degradation
try {
  await service.initialize();
} catch (error) {
  logger.error(`Service ${service.name} failed to initialize:`, error);
  
  // Mark as error but continue with other services
  service.state = ServiceState.ERROR;
  
  // Notify monitoring systems
  this.notifyServiceFailure(service.name, error);
}
```

## 🚀 **Extending the Service Layer**

### **Adding New Services**
1. **Implement IService Interface**: Follow the established pattern
2. **Declare Dependencies**: Use the dependency injection system
3. **Register with ServiceManager**: Add to initialization flow
4. **Implement Health Monitoring**: Provide health status
5. **Write Comprehensive Tests**: Unit and integration tests

### **Example: New Calendar Service**
```typescript
export class CalendarService implements IService {
  readonly name = 'calendarService';
  private state: ServiceState = ServiceState.INITIALIZING;
  private authService: AuthService;

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  async initialize(): Promise<void> {
    try {
      this.state = ServiceState.INITIALIZING;
      
      // Verify Google Calendar API access
      if (!process.env.GOOGLE_CLIENT_ID) {
        throw new Error('Google OAuth not configured');
      }
      
      this.state = ServiceState.READY;
      logger.info('CalendarService initialized successfully');
    } catch (error) {
      this.state = ServiceState.ERROR;
      logger.error('Failed to initialize CalendarService:', error);
      throw error;
    }
  }

  async createEvent(request: CreateEventRequest, accessToken: string): Promise<CalendarEvent> {
    // Implementation for calendar event creation
  }

  async updateEvent(request: UpdateEventRequest, accessToken: string): Promise<CalendarEvent> {
    // Implementation for calendar event updates
  }

  getHealth(): { healthy: boolean; details?: any } {
    return {
      healthy: this.state === ServiceState.READY,
      details: {
        state: this.state,
        googleApiAccess: !!process.env.GOOGLE_CLIENT_ID
      }
    };
  }
}

// Register in service initialization
const calendarService = new CalendarService(authService);
serviceManager.registerService('calendarService', calendarService, {
  dependencies: ['authService'],
  priority: 55,
  autoStart: true
});
```

This service layer architecture provides a robust, maintainable foundation for business logic and external integrations with clear patterns for development and testing.
