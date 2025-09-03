# 🔧 Service Layer Architecture - AI Development Guide

## 🎯 **Service Architecture Overview**

This document defines the **service layer architecture** that provides business logic, external API integration, and data persistence. All services follow the **BaseService pattern** with dependency injection and lifecycle management.

## 🏗️ **Service Architecture**

### **Service Hierarchy**
```
ServiceManager (Lifecycle Management)
├── DatabaseService (Priority: 5) - Data persistence
├── SessionService (Priority: 10) - Session management
├── SessionMigrationService (Priority: 12) - Session data migration
├── TokenManager (Priority: 13) - Centralized token management
├── SlackSessionManager (Priority: 14) - Slack session management
├── AuthService (Priority: 15) - Authentication & OAuth
├── Google Services (Priority: 20)
│   ├── GmailService - Email operations
│   ├── CalendarService - Calendar operations
│   └── ContactService - Contact operations
├── OpenAIService (Priority: 25) - AI capabilities
├── Agent Services (Priority: 30)
│   ├── MasterAgent - Intelligent routing
│   ├── EmailAgent - Email workflows
│   ├── ContactAgent - Contact workflows
│   ├── CalendarAgent - Calendar workflows
│   ├── ThinkAgent - Reasoning & verification
│   ├── ContentCreatorAgent - Content generation
│   └── TavilyAgent - Web search
└── ToolExecutorService (Priority: 35) - Tool execution
```

### **Service Lifecycle**
```typescript
export interface IService {
  readonly name: string;
  readonly state: ServiceState;
  
  initialize(): Promise<void>;
  destroy(): Promise<void>;
  getHealth(): ServiceHealth;
}

export enum ServiceState {
  INITIALIZING = 'initializing',
  READY = 'ready',
  ERROR = 'error',
  SHUTTING_DOWN = 'shutting_down',
  DESTROYED = 'destroyed'
}
```

## 🔧 **Core Services**

### **1. DatabaseService**

#### **Purpose**
- **Primary**: PostgreSQL database connection and management
- **Responsibility**: Data persistence for sessions, OAuth tokens, and Slack data
- **Priority**: 5 (highest - initializes first)

#### **Key Features**
```typescript
export class DatabaseService extends BaseService {
  private pool: Pool;
  
  // Session management
  async createSession(sessionData: SessionData): Promise<void>
  async getSession(sessionId: string): Promise<SessionData | null>
  async updateSessionActivity(sessionId: string): Promise<void>
  async deleteSession(sessionId: string): Promise<boolean>
  async cleanupExpiredSessions(): Promise<number>
  
  // OAuth token storage
  async storeOAuthTokens(tokenData: OAuthTokenData): Promise<void>
  async getOAuthTokens(sessionId: string): Promise<OAuthTokenData | null>
  async deleteOAuthTokens(sessionId: string): Promise<boolean>
  async cleanupExpiredTokens(): Promise<number>
  
  // Slack data storage
  async storeSlackWorkspace(workspaceData: SlackWorkspaceData): Promise<void>
  async getSlackWorkspace(teamId: string): Promise<SlackWorkspaceData | null>
  async storeSlackUser(userData: SlackUserData): Promise<void>
  async getSlackUser(slackUserId: string, teamId: string): Promise<SlackUserData | null>
  async getSlackUserByGoogleId(googleUserId: string): Promise<SlackUserData | null>
}
```

#### **Database Schema**
```sql
-- Sessions table
CREATE TABLE sessions (
  session_id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255),
  conversation_history JSONB,
  tool_calls JSONB,
  tool_results JSONB,
  pending_actions JSONB,
  oauth_tokens JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);

-- OAuth tokens table
CREATE TABLE oauth_tokens (
  session_id VARCHAR(255) PRIMARY KEY,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  token_type VARCHAR(50),
  scope TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Slack workspaces table
CREATE TABLE slack_workspaces (
  team_id VARCHAR(255) PRIMARY KEY,
  team_name VARCHAR(255),
  access_token TEXT,
  bot_user_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Slack users table
CREATE TABLE slack_users (
  slack_user_id VARCHAR(255),
  team_id VARCHAR(255),
  google_user_id VARCHAR(255),
  access_token TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (slack_user_id, team_id)
);
```

### **2. SessionService**

#### **Purpose**
- **Primary**: Session management and conversation context
- **Responsibility**: User session lifecycle, conversation history, OAuth token management
- **Priority**: 10 (depends on DatabaseService)

### **3. SessionMigrationService**

#### **Purpose**
- **Primary**: Migration of session data to simplified format
- **Responsibility**: Convert existing session data structures, handle legacy data
- **Priority**: 12 (depends on DatabaseService)
- **Documentation**: See `docs/SESSION_SIMPLIFICATION.md` for complete implementation details

#### **Key Features**
```typescript
export class SessionMigrationService extends BaseService {
  // Session migration operations
  async migrateSession(sessionId: string): Promise<boolean>
  async migrateAllSessions(): Promise<number>
  async checkMigrationStatus(): Promise<MigrationStatus>
  
  // Data validation
  async validateSessionData(sessionId: string): Promise<ValidationResult>
  private isLegacySession(session: any): boolean
  private convertToSimplifiedFormat(session: any): SimplifiedSession
}
```

### **4. TokenManager**

#### **Purpose**
- **Primary**: Centralized OAuth token management
- **Responsibility**: Token storage, refresh, validation, and cleanup
- **Priority**: 13

#### **Key Features**
```typescript
export class TokenManager {
  // Token management
  async storeTokens(sessionId: string, tokens: OAuthTokens): Promise<void>
  async getTokens(sessionId: string): Promise<OAuthTokens | null>
  async refreshTokens(sessionId: string): Promise<OAuthTokens | null>
  async deleteTokens(sessionId: string): Promise<boolean>
  
  // Token validation
  async validateTokens(tokens: OAuthTokens): Promise<boolean>
  async isTokenExpired(tokens: OAuthTokens): boolean
  
  // Cleanup operations
  async cleanupExpiredTokens(): Promise<number>
}
```

### **5. SlackSessionManager**

#### **Purpose**
- **Primary**: Slack-specific session context management
- **Responsibility**: Slack user sessions, team context, workspace integration
- **Priority**: 14

#### **Key Features**
```typescript
export class SlackSessionManager {
  // Slack session management
  async createSlackSession(teamId: string, userId: string): Promise<string>
  async getSlackSession(sessionId: string): Promise<SlackSessionContext | null>
  async updateSlackSession(sessionId: string, updates: Partial<SlackSessionContext>): Promise<void>
  
  // Slack context
  async getSlackContext(sessionId: string): Promise<SlackContext>
  async linkGoogleAccount(sessionId: string, googleUserId: string): Promise<void>
  
  // Session cleanup
  async cleanupSlackSessions(): Promise<number>
}
```

#### **Key Features**
```typescript
export class SessionService extends BaseService {
  private databaseService: DatabaseService | null = null;
  private sessions: Map<string, SessionContext> | null = null; // Fallback storage
  
  // Session management
  async getOrCreateSession(sessionId: string, userId?: string): Promise<SessionContext>
  async getSession(sessionId: string): Promise<SessionContext | undefined>
  async deleteSession(sessionId: string): Promise<boolean>
  async cleanupExpiredSessions(): Promise<number>
  
  // Conversation management
  async addConversationEntry(sessionId: string, entry: ConversationEntry): Promise<void>
  async getConversationContext(sessionId: string): Promise<string | null>
  
  // Tool management
  async addToolCalls(sessionId: string, toolCalls: ToolCall[]): Promise<void>
  async addToolResults(sessionId: string, toolResults: ToolResult[]): Promise<void>
  
  // OAuth token management
  async storeOAuthTokens(sessionId: string, tokens: OAuthTokens): Promise<void>
  async getOAuthTokens(sessionId: string): Promise<OAuthTokens | null>
  async getGoogleAccessToken(sessionId: string): Promise<string | null>
}
```

### **6. AuthService**

#### **Purpose**
- **Primary**: Authentication and OAuth token management
- **Responsibility**: Google OAuth flow, token validation, user authentication
- **Priority**: 15

#### **Key Features**
```typescript
export class AuthService extends BaseService {
  // OAuth flow management
  async generateAuthUrl(redirectUri: string, state?: string): Promise<string>
  async handleOAuthCallback(code: string, redirectUri: string): Promise<OAuthTokens>
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens>
  
  // Token validation
  async validateToken(accessToken: string): Promise<UserInfo>
  async revokeToken(accessToken: string): Promise<void>
  
  // JWT management
  generateJWT(userId: string, sessionId: string): string
  validateJWT(token: string): JWTPayload
}
```

### **7. Google Services**

#### **GmailService**
```typescript
export class GmailService extends BaseService {
  // Email operations
  async sendEmail(params: SendEmailParams, accessToken: string): Promise<EmailResult>
  async searchEmails(query: string, accessToken: string): Promise<EmailSearchResult>
  async getEmail(emailId: string, accessToken: string): Promise<EmailDetail>
  async listEmails(params: ListEmailsParams, accessToken: string): Promise<EmailListResult>
  
  // Email management
  async markAsRead(emailId: string, accessToken: string): Promise<void>
  async archiveEmail(emailId: string, accessToken: string): Promise<void>
  async deleteEmail(emailId: string, accessToken: string): Promise<void>
}
```

#### **CalendarService**
```typescript
export class CalendarService extends BaseService {
  // Calendar operations
  async createEvent(params: CreateEventParams, accessToken: string): Promise<CalendarEvent>
  async updateEvent(eventId: string, params: UpdateEventParams, accessToken: string): Promise<CalendarEvent>
  async deleteEvent(eventId: string, accessToken: string): Promise<void>
  async getEvent(eventId: string, accessToken: string): Promise<CalendarEvent>
  
  // Calendar queries
  async listEvents(params: ListEventsParams, accessToken: string): Promise<EventListResult>
  async checkAvailability(params: AvailabilityParams, accessToken: string): Promise<AvailabilityResult>
  async getCalendars(accessToken: string): Promise<CalendarListResult>
}
```

#### **ContactService**
```typescript
export class ContactService extends BaseService {
  // Contact operations
  async createContact(params: CreateContactParams, accessToken: string): Promise<Contact>
  async updateContact(contactId: string, params: UpdateContactParams, accessToken: string): Promise<Contact>
  async deleteContact(contactId: string, accessToken: string): Promise<void>
  async getContact(contactId: string, accessToken: string): Promise<Contact>
  
  // Contact search
  async searchContacts(query: string, accessToken: string): Promise<ContactSearchResult>
  async listContacts(params: ListContactsParams, accessToken: string): Promise<ContactListResult>
  async findContactByEmail(email: string, accessToken: string): Promise<Contact | null>
}
```

### **8. OpenAIService**

#### **Purpose**
- **Primary**: OpenAI API integration for AI capabilities
- **Responsibility**: GPT-4o-mini integration, tool call generation, content creation
- **Priority**: 25

#### **Key Features**
```typescript
export class OpenAIService extends BaseService {
  // Chat completion
  async generateToolCalls(
    userInput: string, 
    systemPrompt: string, 
    sessionId: string
  ): Promise<ToolCallResponse>
  
  // Content generation
  async generateContent(prompt: string, options: ContentOptions): Promise<string>
  
  // Function calling
  async callFunction(
    functionName: string, 
    arguments: any, 
    systemPrompt: string
  ): Promise<FunctionCallResult>
  
  // Rate limiting and error handling
  private handleRateLimit(): Promise<void>
  private handleAPIError(error: any): void
}
```

### **9. Agent Services**

#### **MasterAgent**
```typescript
export class MasterAgent extends BaseAgent {
  // Intelligent routing
  async processUserInput(
    input: string, 
    sessionId: string, 
    userId: string
  ): Promise<AgentResponse>
  
  // Tool call generation
  private async generateToolCallsWithOpenAI(input: string, context: string): Promise<ToolCall[]>
  private determineToolCalls(userInput: string): ToolCall[]
  
  // Response generation
  private generateResponse(userInput: string, toolCalls: ToolCall[]): string
}
```

#### **Specialized Agents**
- **EmailAgent**: Gmail workflows with natural language processing
- **ContactAgent**: Contact management with fuzzy matching
- **CalendarAgent**: Calendar operations with intelligent scheduling
- **ThinkAgent**: Reasoning and verification for quality assurance
- **ContentCreatorAgent**: Content generation using OpenAI
- **TavilyAgent**: Web search and information retrieval

### **10. ToolExecutorService**

#### **Purpose**
- **Primary**: Tool execution and workflow orchestration
- **Responsibility**: Execute agent tool calls, manage execution context, handle results
- **Priority**: 35 (lowest - depends on all other services)

#### **Key Features**
```typescript
export class ToolExecutorService extends BaseService {
  // Tool execution
  async executeTool(
    toolCall: ToolCall, 
    context: ToolExecutionContext,
    accessToken?: string,
    mode: ExecutionMode = { preview: false }
  ): Promise<ToolResult>
  
  async executeTools(
    toolCalls: ToolCall[], 
    context: ToolExecutionContext,
    accessToken?: string,
    mode: ExecutionMode = { preview: false }
  ): Promise<ToolResult[]>
  
  // Execution context
  createExecutionContext(sessionId: string, userId: string): ToolExecutionContext
  getExecutionStats(results: ToolResult[]): ExecutionStats
  
  // Tool management
  private toolNeedsConfirmation(toolName: string): boolean
  private isCriticalTool(toolName: string): boolean
}
```

## 🔄 **Service Dependencies**

### **Dependency Graph**
```
DatabaseService (5)
    ↓
SessionService (10)
    ↓
SessionMigrationService (12) ← DatabaseService
    ↓
TokenManager (13) ← SessionService
    ↓
SlackSessionManager (14) ← SessionService, TokenManager
    ↓
AuthService (15)
    ↓
Google Services (20)
    ↓
OpenAIService (25)
    ↓
Agent Services (30)
    ↓
ToolExecutorService (35)
```

### **Service Registration**
```typescript
// Service initialization order
serviceManager.registerService('databaseService', databaseService, {
  dependencies: [],
  priority: 5,
  autoStart: true
});

serviceManager.registerService('sessionService', sessionService, {
  dependencies: ['databaseService'],
  priority: 10,
  autoStart: true
});

serviceManager.registerService('authService', authService, {
  dependencies: ['sessionService'],
  priority: 15,
  autoStart: true
});

// Continue with other services...
```

## 🔒 **Service Security**

### **Authentication Flow**
1. **Slack OAuth**: Workspace installation
2. **Google OAuth**: User account access
3. **Token Storage**: Secure storage in PostgreSQL
4. **Session Management**: JWT-based session tokens
5. **API Access**: Token-based API calls

### **Data Protection**
- **OAuth Tokens**: Encrypted storage in database
- **Session Data**: Secure session management
- **API Keys**: Environment variable protection
- **Rate Limiting**: Service-level rate limiting

## 📊 **Service Performance**

### **Database Optimization**
- **Connection Pooling**: Efficient database connections
- **Query Optimization**: Indexed queries for performance
- **Caching**: Session and token caching
- **Cleanup**: Automatic cleanup of expired data

### **Service Performance**
- **Async Operations**: Non-blocking service operations
- **Timeout Management**: Request timeout handling
- **Error Recovery**: Graceful degradation
- **Resource Management**: Efficient resource utilization

## 🧪 **Service Testing**

### **Testing Patterns**
```typescript
// Service testing with dependency injection
describe('EmailService', () => {
  let service: EmailService;
  let mockGmailService: jest.Mocked<GmailService>;
  let mockSessionService: jest.Mocked<SessionService>;
  
  beforeEach(() => {
    mockGmailService = createMockGmailService();
    mockSessionService = createMockSessionService();
    service = new EmailService(mockGmailService, mockSessionService);
  });
  
  it('should send email successfully', async () => {
    // Test implementation
  });
});
```

### **Integration Testing**
```typescript
// Service integration testing
describe('Service Integration', () => {
  it('should handle complete email workflow', async () => {
    // Test complete workflow across multiple services
  });
});
```

## 🔧 **Service Development Guidelines**

### **1. Service Creation**
- **Extend BaseService**: All services must extend BaseService
- **Implement IService**: Follow the IService interface
- **Dependency Injection**: Use constructor injection for dependencies
- **Error Handling**: Implement comprehensive error handling

### **2. Service Registration**
- **Declare Dependencies**: List all required dependencies
- **Set Priority**: Use appropriate initialization priority
- **Auto Start**: Configure automatic startup if needed
- **Health Checks**: Implement health check methods

### **3. Service Testing**
- **Unit Tests**: Test individual service methods
- **Integration Tests**: Test service interactions
- **Mock Dependencies**: Use mocks for external dependencies
- **Error Scenarios**: Test error handling and recovery

### **4. Service Documentation**
- **Purpose**: Document service purpose and responsibilities
- **API**: Document public methods and interfaces
- **Dependencies**: Document service dependencies
- **Configuration**: Document configuration requirements

This service architecture provides a solid foundation for building scalable, maintainable applications with clear separation of concerns and proper dependency management.
