# Quick Reference Guide

## Common Tasks

### Adding a New Tool

```typescript
// 1. Register in tool-registry.ts
ToolRegistry.registerTool({
  name: 'my_new_tool',
  description: 'What it does',
  parameters: {
    userId: { type: 'string', description: 'User ID', required: true },
    param1: { type: 'string', description: 'Parameter description' }
  },
  requiredParameters: ['userId', 'param1'],
  domain: 'email',  // or 'calendar', 'contacts', 'slack'
  serviceMethod: 'myNewMethod',  // Method name in domain service
  requiresAuth: true,
  requiresConfirmation: false,
  isCritical: false,
  examples: ['Example usage']
})

// 2. Implement in domain service
class EmailDomainService {
  async myNewMethod(userId: string, params: any): Promise<Result> {
    // Implementation
  }
}

// 3. Tool is automatically available to agents!
```

### Adding a New Route

```typescript
// 1. Create route file: routes/my-feature.routes.ts
import express from 'express'
const router = express.Router()

router.get('/endpoint', middleware, async (req, res) => {
  // Handler
})

export default router

// 2. Mount in index.ts
import myFeatureRoutes from './routes/my-feature.routes'
app.use('/api/my-feature', myFeatureRoutes)
```

### Adding a New Service

```typescript
// 1. Create service: services/my-service.ts
import { BaseService } from './base-service'

export class MyService extends BaseService {
  constructor() {
    super('MyService')
  }

  protected async onInitialize(): Promise<void> {
    // Setup
  }

  protected async onDestroy(): Promise<void> {
    // Cleanup
  }

  // Your methods
  async doSomething(): Promise<Result> {
    this.assertReady()
    // Implementation
  }
}

// 2. Register in service-initialization.ts
const myService = new MyService()
serviceManager.registerService('myService', myService, ['dependencyService'])

// 3. Use anywhere
const service = serviceManager.getService<MyService>('myService')
```

### Adding a New Agent

```typescript
// 1. Create agent: agents/my-feature.agent.ts
import { BaseSubAgent } from '../framework/base-subagent'

export class MyFeatureAgent extends BaseSubAgent {
  constructor() {
    super('myFeature', {
      name: 'MyFeatureAgent',
      description: 'What it does',
      enabled: true,
      timeout: 30000,
      retryCount: 3
    })

    this.service = DomainServiceResolver.getMyFeatureService()
  }

  protected getAvailableTools(): string[] {
    return ToolRegistry.getToolNamesForDomain('myFeature')
  }

  protected async executeToolCall(toolName: string, params: any) {
    const serviceMethod = this.getToolToServiceMap()[toolName]
    return await this.service[serviceMethod](params.userId, params)
  }

  getCapabilityDescription(): AgentCapabilities {
    return {
      name: 'myFeature',
      description: 'What it does',
      operations: ToolRegistry.getToolNamesForDomain('myFeature'),
      requiresAuth: true,
      requiresConfirmation: false,
      isCritical: false
    }
  }
}

// 2. Register in agent-factory.ts
import { MyFeatureAgent } from '../agents/my-feature.agent'

static async initialize() {
  // ... existing agents ...
  this.registerAgentClass('myFeatureAgent', MyFeatureAgent)
}
```

---

## Architecture Quick Reference

### Service Layers

```
User Request
    ↓
Express Routes (presentation)
    ↓
Master Agent (orchestration)
    ↓
SubAgents (domain logic)
    ↓
Domain Services (business operations)
    ↓
API Clients (external APIs)
    ↓
External Services (Gmail, Slack, etc.)
```

### Service Management

```
ServiceManager        → Core infrastructure (DB, cache, auth)
DomainServiceContainer → Business logic (email, calendar)
AgentFactory          → Agents (EmailAgent, CalendarAgent)
```

### Agent Workflow

```
Phase 1: Intent Assessment
  ↓ "What does user want?"
Phase 2: Tool Execution
  ↓ "Execute the plan"
Phase 3: Response Formatting
  ↓ "Format results"
Return to Master Agent
```

---

## File Locations

### Core Files
- **Service Manager**: `services/service-manager.ts`
- **Service Init**: `services/service-initialization.ts`
- **Master Agent**: `agents/master.agent.ts`
- **Base SubAgent**: `framework/base-subagent.ts`
- **Tool Registry**: `framework/tool-registry.ts`
- **Workflow Executor**: `services/workflow-executor.service.ts`

### Domain Services
- **Email**: `services/domain/email-domain.service.ts`
- **Calendar**: `services/domain/calendar-domain.service.ts`
- **Contacts**: `services/domain/contacts-domain.service.ts`
- **Slack**: `services/domain/slack-domain.service.ts`
- **AI**: `services/domain/ai-domain.service.ts`

### Routes
- **Auth**: `routes/auth/` (OAuth, tokens, debug)
- **Slack**: `routes/slack.routes.ts`
- **Protected**: `routes/protected.routes.ts`

### Configuration
- **Unified Config**: `config/unified-config.ts`
- **OAuth Scopes**: `constants/oauth-scopes.ts`

---

## Common Patterns

### Get a Service
```typescript
// Infrastructure service
const authService = serviceManager.getService<AuthService>('authService')

// Domain service
const emailService = DomainServiceResolver.getEmailService()

// Agent
const emailAgent = AgentFactory.getAgent('emailAgent')
```

### Execute Tool
```typescript
// 1. Get tool definition
const tool = ToolRegistry.getTool('send_email')

// 2. Validate parameters
const validation = ToolRegistry.validateToolParameters('send_email', params)

// 3. Execute via agent
const result = await emailAgent.processNaturalLanguageRequest(
  'Send email to john@example.com',
  userId
)
```

### Handle OAuth
```typescript
// 1. Get valid tokens (auto-refresh)
const tokens = await tokenManager.getValidTokens(userId, 'google')

// 2. Use in API call
const response = await apiClient.makeRequest({
  method: 'GET',
  endpoint: '/gmail/messages',
  headers: {
    Authorization: `Bearer ${tokens.access_token}`
  }
})
```

### Log with Context
```typescript
logger.info('Operation started', {
  correlationId: 'unique-id',
  operation: 'operation_name',
  metadata: { key: 'value' }
})
```

---

## Debugging

### Check Service Health
```typescript
const health = await getServiceHealthReport()
console.log(health.overall)  // 'healthy' | 'degraded' | 'unhealthy'
console.log(health.services)  // Status of each service
```

### Check Agent Health
```typescript
const health = AgentFactory.getAgentHealth('emailAgent')
console.log(health)  // { healthy: true, details: {...} }
```

### View Agent Capabilities
```typescript
const capabilities = AgentFactory.getAgentCapabilities()
console.log(capabilities.emailAgent.operations)  // List of tools
```

### Test Tool Execution
```typescript
// Development only
GET /auth/debug/test-oauth-url
GET /auth/debug/current-config
```

---

## Environment Variables

### Required
```bash
# Database
DATABASE_URL=postgresql://...

# Redis (or disable)
REDIS_URL=redis://...
DISABLE_REDIS=false

# OpenAI
OPENAI_API_KEY=sk-...

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
```

### Optional
```bash
# Environment
NODE_ENV=development|production

# Server
PORT=3000
BASE_URL=http://localhost:3000

# Logging
LOG_LEVEL=info|debug|warn|error
```

---

## Testing

### TypeScript Check
```bash
npm run typecheck
```

### Run Tests
```bash
npm test
```

### Start Dev Server
```bash
npm run dev
```

### Start Production
```bash
npm start
```

---

## Common Issues

### "Service not initialized"
```
Check: Service is registered in service-initialization.ts
Check: Dependencies are initialized first
Fix: Add to registerCoreServices()
```

### "Agent not found"
```
Check: Agent registered in AgentFactory.initialize()
Check: Agent extends BaseSubAgent
Fix: Import and register in agent-factory.ts
```

### "Tool not found"
```
Check: Tool registered in ToolRegistry
Check: Domain matches (email, calendar, contacts, slack)
Fix: Add ToolRegistry.registerTool() call
```

### "OAuth token expired"
```
Check: TokenManager is refreshing automatically
Check: refresh_token is valid
Fix: Re-authenticate user
```

### "Circular dependency"
```
Check: Services importing each other
Fix: Use DomainServiceResolver or ServiceManager
Never: Direct imports between services
```

---

## Best Practices

### Do ✅
- Use TypeScript strict mode
- Validate inputs with Zod
- Log with correlation IDs
- Handle errors with AppError
- Use BaseService for services
- Use BaseSubAgent for agents
- Register tools in ToolRegistry
- Use environment variables
- Write tests

### Don't ❌
- Import services directly (use resolver)
- Create circular dependencies
- Skip input validation
- Ignore TypeScript errors
- Hard-code configuration
- Mix concerns in routes
- Duplicate tool definitions
- Commit .env files
- Skip error handling

---

## Performance Tips

### Caching
```typescript
// Use Redis for frequently accessed data
await cacheService.set('key', value, ttl)
const cached = await cacheService.get('key')
```

### Batch Operations
```typescript
// Group multiple API calls
const [emails, contacts, events] = await Promise.all([
  emailService.getEmails(userId),
  contactService.getContacts(userId),
  calendarService.getEvents(userId)
])
```

### Streaming
```typescript
// Use streaming for long responses
const stream = await aiService.generateChatCompletion({
  ...params,
  stream: true
})
```

---

## Security Checklist

- [ ] Input validation on all routes
- [ ] OAuth tokens encrypted at rest
- [ ] Rate limiting enabled
- [ ] CORS configured properly
- [ ] Environment variables not committed
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS protection (sanitized inputs)
- [ ] CSRF protection (state parameter)
- [ ] HTTPS in production
- [ ] Secrets in secure storage

---

## Getting Help

### Documentation
- **Architecture**: `docs/ARCHITECTURE.md`
- **Refactoring**: `docs/REFACTORING_SUMMARY.md`
- **This Guide**: `docs/QUICK_REFERENCE.md`

### Code Examples
- **Routes**: Check `routes/auth/` for patterns
- **Services**: Check `services/domain/` for patterns
- **Agents**: Check `agents/` for patterns

### Logging
- Check logs with correlation IDs
- Use `logger.info/warn/error` consistently
- Add context to all log entries

---

*Last Updated: September 2025*