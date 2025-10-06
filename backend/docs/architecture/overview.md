# Architecture Overview

The AI Assistant Application uses a **3-layer stateless architecture** designed for horizontal scaling and maintainability.

## System Architecture

### 3-Layer Design

```
User Request
    ↓
Express Routes (presentation)
    ↓
Master Agent (orchestration)
    ↓
Layer 1: Query Decomposition (understanding intent)
    ↓
Layer 2: Execution Coordination (orchestrating services)
    ↓
Layer 3: Response Synthesis (natural language generation)
    ↓
Natural Language Response
```

### Stateless Design Principles

**✅ What's Stateless:**
- **Conversation Layer**: Client manages `conversationHistory`
- **Compute Layer**: Any server can handle any request
- **Mobile Apps**: Local conversation storage with sync

**✅ What Uses Persistent Storage:**
- **OAuth Tokens**: Required by OAuth specification
- **User Preferences**: Settings, timezone, email accounts
- **Cache Layer**: Redis for performance (optional)

**❌ What We Avoid:**
- Server-side conversation storage
- WebSocket persistent connections
- In-memory user state
- Sticky sessions

## Core Components

### Service Architecture

```
ServiceManager        → Core infrastructure (DB, cache, auth)
DomainServiceContainer → Business logic (email, calendar)
AgentFactory          → Agents (EmailAgent, CalendarAgent)
```

### Domain Services

- **EmailDomainService**: Email operations and search
- **CalendarDomainService**: Calendar management
- **ContactsDomainService**: Contact management
- **SlackDomainService**: Slack integration
- **AIDomainService**: AI operations and LLM calls

### Infrastructure Services

- **BaseService**: Abstract base class for all services
- **CacheService**: Redis caching (optional)
- **EncryptionService**: Token encryption
- **ErrorHandlingService**: Centralized error management
- **SentryService**: Error tracking and monitoring

## Data Flow

### Request Processing

1. **Client sends request** with conversation history
2. **Routes validate** and authenticate request
3. **Master Agent** orchestrates processing
4. **Layer 1** decomposes user intent
5. **Layer 2** executes domain operations
6. **Layer 3** synthesizes natural language response
7. **Client receives** response and updated context

### Stateless Benefits

- **Horizontal Scaling**: Any server can handle any request
- **No Session Affinity**: Load balancer can distribute freely
- **Multi-Device Support**: Client manages conversation state
- **Offline-First Mobile**: Local storage with sync
- **Simplified Deployment**: No state management complexity

## Technology Stack

### Backend
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with middleware
- **Database**: PostgreSQL with migrations
- **Cache**: Redis (optional, can be disabled)
- **AI**: OpenAI API with 3-layer processing
- **Auth**: OAuth 2.0 (Google, Slack)

### Frontend
- **Framework**: React Native
- **Language**: TypeScript
- **Storage**: AsyncStorage/SQLite for local data
- **Design**: Custom design system

### Infrastructure
- **Deployment**: Railway, Docker support
- **Monitoring**: Sentry error tracking
- **Logging**: Winston structured logging
- **Testing**: Jest with comprehensive test suite

## Scalability Design

### Horizontal Scaling

```
Load Balancer (Round Robin)
    ↓
┌─────────┬─────────┬─────────┐
│ Server 1│ Server 2│ Server 3│
└─────────┴─────────┴─────────┘
      ↓         ↓         ↓
┌──────────────────────────┐
│   Shared Redis Cache     │
└──────────────────────────┘
      ↓         ↓         ↓
┌──────────────────────────┐
│  Supabase PostgreSQL     │
└──────────────────────────┘
```

**No session affinity needed!** Any server can handle any request.

### Performance Optimizations

- **DataLoader Pattern**: 10x API call reduction through batching
- **Redis Caching**: User context cached for 30 minutes
- **Response Streaming**: SSE for perceived performance
- **Connection Pooling**: Efficient database usage

## Security Architecture

### Authentication Flow

1. **OAuth 2.0**: Google/Slack authentication
2. **JWT Tokens**: Short-lived access tokens
3. **Refresh Tokens**: Long-lived, encrypted storage
4. **Token Rotation**: Automatic refresh token rotation

### Data Protection

- **Encryption**: AES-256-GCM for sensitive data
- **Input Validation**: Zod schemas for all inputs
- **Rate Limiting**: Built-in request throttling
- **Security Headers**: Helmet.js protection
- **CORS**: Configured for cross-origin requests

## Error Handling

### Error Hierarchy

```
AppError (base)
├── ValidationError
├── AuthenticationError
├── AuthorizationError
├── ServiceError
├── ExternalAPIError
└── SystemError
```

### Error Flow

1. **Service throws** specific error type
2. **Error middleware** catches and transforms
3. **Sentry integration** logs and tracks
4. **Client receives** user-friendly message
5. **Monitoring** tracks error patterns

## Development Patterns

### Dependency Injection

```typescript
// Services registered in DI container
container.register({
  emailService: asClass(EmailDomainService).singleton(),
  cacheService: asClass(CacheService).singleton(),
});

// Resolved where needed
const emailService = container.resolve<EmailDomainService>('emailService');
```

### Service Lifecycle

```typescript
export class MyService extends BaseService {
  constructor() {
    super('myService');
  }

  protected async onInitialize(): Promise<void> {
    // Setup logic
  }

  protected async onDestroy(): Promise<void> {
    // Cleanup logic
  }
}
```

### Error Handling Pattern

```typescript
// Use ErrorFactory instead of raw errors
throw ErrorFactory.domain.serviceError(
  'myService',
  'Operation failed',
  { context: 'additional info' }
);
```

## Mobile Architecture

### Offline-First Design

```typescript
// Local conversation storage
await AsyncStorage.setItem('conversation:123', JSON.stringify(history));

// Send to server only when user messages
const response = await api.sendMessage(message, history);

// Update local storage
await AsyncStorage.setItem('conversation:123', JSON.stringify(response.context));
```

### Sync Strategy

- **Local First**: All data stored locally
- **Sync on Demand**: Send to server when needed
- **Optional Backup**: Multi-device sync available
- **Offline Support**: Works without connection

## Monitoring & Observability

### Health Checks

- **Service Health**: Individual service status
- **Database Connectivity**: Connection monitoring
- **Cache Status**: Redis availability
- **External APIs**: Third-party service health

### Logging Strategy

- **Structured Logging**: JSON format with Winston
- **Correlation IDs**: Track requests across services
- **Contextual Information**: User, operation, metadata
- **Log Levels**: Debug, Info, Warn, Error

### Metrics & Alerts

- **Response Times**: API endpoint performance
- **Error Rates**: Service error tracking
- **Usage Patterns**: Feature adoption
- **Resource Usage**: CPU, memory, database

## Deployment Architecture

### Environment Strategy

- **Development**: Local with hot reload
- **Staging**: Production-like testing
- **Production**: Optimized and monitored

### Container Strategy

```dockerfile
# Multi-stage build
FROM node:18-alpine AS builder
# Build TypeScript

FROM node:18-alpine AS runtime
# Copy built application
# Start with proper signal handling
```

### Configuration Management

- **Environment Variables**: 12-factor app compliance
- **Secrets Management**: Encrypted storage
- **Feature Flags**: Runtime configuration
- **Service Discovery**: Automatic service detection

## Future Considerations

### Planned Enhancements

- **Edge Deployment**: Cloudflare Workers for static routes
- **Read Replicas**: Database scaling for reads
- **Multi-Region**: Global deployment strategy
- **Advanced Caching**: CDN integration

### Scalability Limits

- **Current**: ~1000 concurrent users per instance
- **With Optimization**: ~10,000 concurrent users
- **With Scaling**: Unlimited (horizontal scaling)

## Related Documentation

- **[Folder Structure](folder-structure.md)** - Detailed directory organization
- **[Naming Conventions](naming-conventions.md)** - Code standards
- **[Types Organization](types-organization.md)** - TypeScript patterns
- **[Getting Started](../development/getting-started.md)** - Setup guide
