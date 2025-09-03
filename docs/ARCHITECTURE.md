# 🏗️ System Architecture - AI Development Guide

## 🎯 **Architecture Vision**

This document establishes the **architectural boundaries** that AI development must respect. The system follows **Clean Architecture principles** with clear separation of concerns, dependency injection, and plugin-based extensibility.

## 🏗️ **System Architecture Overview**

### **High-Level Architecture**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Slack Client  │    │  Backend API    │    │ External APIs   │
│                 │    │                 │    │                 │
│ • Slack Bot     │◄──►│ • Express       │◄──►│ • Google APIs   │
│ • Events        │    │ • TypeScript    │    │ • OpenAI API    │
│ • Commands      │    │ • Middleware   │    │ • Tavily API    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │ Multi-Agent     │
                       │ Orchestration   │
                       │                 │
                       │ • Master Agent  │
                       │ • Specialized   │
                       │   Agents        │
                       │ • Tool Executor │
                       └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │ PostgreSQL      │
                       │ Database        │
                       │                 │
                       │ • Sessions      │
                       │ • OAuth Tokens  │
                       │ • Slack Data   │
                       └─────────────────┘
```

### **Core Architectural Layers**

#### **1. Interface Layer (Slack)**
- **Responsibility**: Input handling and request routing
- **Technology**: Slack Bolt SDK with Express integration
- **Boundaries**: Event handling, message routing, response formatting
- **Key Difference**: Stateless interface layer, not a service
- **Location**: `src/interfaces/slack.interface.ts`

#### **2. API Layer (Backend)**
- **Responsibility**: HTTP interface and request handling
- **Technology**: Express.js with TypeScript
- **Boundaries**: Request validation, routing, response formatting

#### **3. Business Logic Layer**
- **Responsibility**: Core application logic and workflows
- **Technology**: Service classes with dependency injection
- **Boundaries**: Business rules, external API integration

#### **4. Agent Layer**
- **Responsibility**: AI-powered task execution and routing
- **Technology**: Plugin-based agent system
- **Boundaries**: Tool execution, context management, workflow orchestration

#### **5. Data Layer**
- **Responsibility**: Persistent data storage and retrieval
- **Technology**: PostgreSQL with connection pooling
- **Boundaries**: Session management, OAuth token storage, Slack workspace data

## 🔧 **Core Components**

### **1. Service Registry & Dependency Injection**

#### **Service Manager Architecture**
```typescript
// Centralized service lifecycle management
export class ServiceManager {
  private services: Map<string, ServiceRegistration> = new Map();
  private serviceInstances: Map<string, IService> = new Map();
  
  // Dependency resolution and initialization
  async initializeAllServices(): Promise<void>
  
  // Service retrieval with type safety
  getService<T extends IService>(name: string): T | undefined
}
```

#### **Service Lifecycle States**
```typescript
export enum ServiceState {
  INITIALIZING = 'initializing',
  READY = 'ready',
  ERROR = 'error',
  SHUTTING_DOWN = 'shutting_down',
  DESTROYED = 'destroyed'
}
```

#### **Interface Layer Pattern**
```typescript
// Interface layers are initialized differently - they don't go through service manager
const slackInterface = new SlackInterface(serviceManager, slackConfig);
app.use('/slack', slackInterface.router);

// They receive the service manager to access services when needed
// But they don't maintain their own lifecycle state
```

#### **Dependency Injection Pattern**
```typescript
// Services declare their dependencies
serviceManager.registerService('databaseService', databaseService, {
  dependencies: [],           // No dependencies
  priority: 5,               // Highest priority (initialize first)
  autoStart: true            // Start automatically
});

serviceManager.registerService('sessionService', sessionService, {
  dependencies: ['databaseService'],  // Must initialize after databaseService
  priority: 10,                       // Lower number = higher priority
  autoStart: true                     // Start automatically
});
```

### **2. Multi-Agent System**

#### **Agent Architecture**
```typescript
// Base agent interface
export abstract class BaseAgent {
  abstract processUserInput(input: string, sessionId: string, userId: string): Promise<AgentResponse>;
  abstract getCapabilities(): string[];
  abstract getTools(): Tool[];
}

// Master agent for intelligent routing
export class MasterAgent extends BaseAgent {
  // Routes requests to appropriate specialized agents
  // Uses OpenAI for intent recognition
  // Falls back to rule-based routing
}
```

#### **Specialized Agents**
- **Email Agent**: Gmail API integration with natural language processing
- **Contact Agent**: Google Contacts with fuzzy matching and history analysis
- **Calendar Agent**: Google Calendar integration with event management
- **Think Agent**: Verification and reasoning for quality assurance
- **Content Creator**: OpenAI-powered content generation
- **Tavily Agent**: Web search and information retrieval

### **3. Database Layer**

#### **PostgreSQL Integration**
```typescript
// Database service for persistent storage
export class DatabaseService extends BaseService {
  private pool: Pool;
  
  // Session management
  async createSession(sessionData: SessionData): Promise<void>
  async getSession(sessionId: string): Promise<SessionData | null>
  async updateSessionActivity(sessionId: string): Promise<void>
  
  // OAuth token storage
  async storeOAuthTokens(tokenData: OAuthTokenData): Promise<void>
  async getOAuthTokens(sessionId: string): Promise<OAuthTokenData | null>
  
  // Slack data storage
  async storeSlackWorkspace(workspaceData: SlackWorkspaceData): Promise<void>
  async storeSlackUser(userData: SlackUserData): Promise<void>
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

## 🏗️ **Architectural Patterns**

### **1. Interface vs Service Pattern**

#### **Key Distinction**
- **Services**: Maintain state, provide business logic, go through service manager
- **Interfaces**: Handle input/output, route to services, don't maintain state

#### **Slack Interface Implementation**
```typescript
export class SlackInterface {
  private serviceManager: ServiceManager;
  private router: Router;
  
  constructor(serviceManager: ServiceManager, config: SlackConfig) {
    this.serviceManager = serviceManager;
    this.router = Router();
    this.setupRoutes();
  }
  
  // Routes Slack events to appropriate services
  // Doesn't maintain its own state
  // Delegates business logic to services
}
```

### **2. Dependency Injection Pattern**

#### **Service Registration Order**
1. **Database Service** (priority: 5) - Foundation for all data operations
2. **Session Service** (priority: 10) - Depends on database service
3. **Session Migration Service** (priority: 12) - Session data migration
4. **Token Manager** (priority: 13) - Centralized token management
5. **Slack Session Manager** (priority: 14) - Slack session management
6. **Auth Service** (priority: 15) - Authentication and OAuth
7. **Google Services** (priority: 20) - Gmail, Calendar, Contacts
8. **OpenAI Service** (priority: 25) - AI capabilities
9. **Agent Services** (priority: 30) - Multi-agent system
10. **Tool Executor** (priority: 35) - Tool execution framework

### **3. Error Handling Pattern**

#### **Layered Error Handling**
```typescript
// Service layer errors
try {
  const result = await service.performOperation();
  return result;
} catch (error) {
  this.logError('Service operation failed', error);
  throw new ServiceError('Operation failed', error);
}

// Interface layer error handling
try {
  const response = await service.performOperation();
  return formatResponse(response);
} catch (error) {
  return formatErrorResponse(error);
}
```

### **4. Logging and Monitoring Pattern**

#### **Structured Logging**
```typescript
// Consistent logging across all layers
logger.info('Operation started', {
  operation: 'sendEmail',
  sessionId: sessionId,
  userId: userId,
  metadata: { recipient: recipient }
});

logger.error('Operation failed', error, {
  operation: 'sendEmail',
  sessionId: sessionId,
  errorCode: error.code
});
```

## 🔒 **Security Architecture**

### **1. Authentication Flow**
```
Slack OAuth → Google OAuth → JWT Token → Session Management
     ↓              ↓              ↓              ↓
  Workspace    User Account    API Access    Persistent
  Installation   Access        Token        Storage
```

### **2. Data Protection**
- **OAuth Tokens**: Encrypted storage in PostgreSQL
- **Session Data**: Secure session management with expiration
- **API Keys**: Environment variable protection
- **Rate Limiting**: Request throttling and abuse prevention

### **3. Security Middleware**
- **Helmet**: Security headers
- **CORS**: Cross-origin request protection
- **Rate Limiting**: Request throttling
- **Input Validation**: Request sanitization

## 📊 **Performance Architecture**

### **1. Database Optimization**
- **Connection Pooling**: Efficient database connections
- **Indexing**: Optimized query performance
- **Caching**: Session and token caching
- **Cleanup**: Automatic cleanup of expired data

### **2. Service Performance**
- **Async Operations**: Non-blocking service operations
- **Timeout Management**: Request timeout handling
- **Error Recovery**: Graceful degradation
- **Resource Management**: Efficient resource utilization

## 🧪 **Testing Architecture**

### **1. Testing Layers**
- **Unit Tests**: Individual service and agent testing
- **Integration Tests**: Service interaction testing
- **End-to-End Tests**: Full workflow testing
- **AI Behavior Tests**: Agent behavior validation

### **2. Test Patterns**
```typescript
// Service testing pattern
describe('EmailService', () => {
  let service: EmailService;
  let mockGmailService: jest.Mocked<GmailService>;
  
  beforeEach(() => {
    mockGmailService = createMockGmailService();
    service = new EmailService(mockGmailService);
  });
  
  it('should send email successfully', async () => {
    // Test implementation
  });
});
```

## 🚀 **Deployment Architecture**

### **1. Environment Configuration**
- **Development**: Local PostgreSQL, development OAuth apps
- **Staging**: Staging database, staging OAuth apps
- **Production**: Production PostgreSQL, production OAuth apps

### **2. Deployment Strategy**
- **Railway**: Backend deployment with PostgreSQL
- **Slack App Directory**: Official distribution
- **Environment Variables**: Secure configuration management
- **Health Checks**: Automated health monitoring

## 📚 **Architecture Guidelines**

### **1. AI Development Boundaries**
- **Respect Service Boundaries**: Don't cross service boundaries
- **Follow Interface Pattern**: Use interfaces for input/output
- **Maintain Type Safety**: Use TypeScript interfaces
- **Error Handling**: Implement proper error handling at each layer

### **2. Code Quality Standards**
- **TypeScript Strict Mode**: Enable strict type checking
- **ESLint Rules**: Enforce architectural boundaries
- **Test Coverage**: Maintain high test coverage
- **Documentation**: Keep documentation updated

### **3. Performance Standards**
- **Response Time**: < 2 seconds for most operations
- **Database Queries**: Optimized and indexed
- **Memory Usage**: Efficient resource utilization
- **Error Rate**: < 1% error rate in production

This architecture provides a solid foundation for AI-assisted development while maintaining code quality, performance, and maintainability.
