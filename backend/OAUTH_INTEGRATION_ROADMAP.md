# OAuth Integration & System Cleanup Roadmap

## Overview
This roadmap outlines the complete migration from the current OAuth architecture to a unified domain service approach with shared OAuth managers, including cleanup of replaced systems.

## Current State Analysis

### ✅ **Completed Components**
- **Domain Services**: Email, Calendar, Contacts, Slack, AI domain services
- **API Client Layer**: Standardized API clients with circuit breakers
- **Core Services**: Config, Database, Cache, Auth, Token management
- **Shared OAuth Managers**: GoogleOAuthManager, SlackOAuthManager (just created)

### 🔄 **In Progress**
- Domain services using shared OAuth managers
- Service initialization updates

### ❌ **Needs Cleanup**
- Old service references in agents
- Removed service files (marked as deleted in git)
- Legacy OAuth service usage
- Outdated service type definitions

## Phase 1: OAuth Manager Integration (Week 1)

### 1.1 Register OAuth Managers in Service Initialization
**File**: `backend/src/services/service-initialization.ts`

```typescript
// Add after existing OAuth services
const googleOAuthManager = new GoogleOAuthManager({
  clientId: ENVIRONMENT.google.clientId,
  clientSecret: ENVIRONMENT.google.clientSecret,
  redirectUri: ENVIRONMENT.google.redirectUri,
  scopes: [
    'openid', 'email', 'profile',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/contacts.readonly'
  ]
});
serviceManager.registerService('googleOAuthManager', googleOAuthManager, ['authService', 'tokenManager', 'oauthStateService']);

const slackOAuthManager = new SlackOAuthManager({
  clientId: ENVIRONMENT.slack.clientId,
  clientSecret: ENVIRONMENT.slack.clientSecret,
  redirectUri: ENVIRONMENT.slack.redirectUri,
  scopes: ['chat:write', 'channels:read', 'users:read']
});
serviceManager.registerService('slackOAuthManager', slackOAuthManager, ['tokenManager', 'oauthStateService']);
```

### 1.2 Update Domain Services to Use OAuth Managers
**Files to Update**:
- `backend/src/services/domain/email-domain.service.ts`
- `backend/src/services/domain/calendar-domain.service.ts`
- `backend/src/services/domain/contacts-domain.service.ts`
- `backend/src/services/domain/slack-domain.service.ts`

**Changes**:
```typescript
// Add OAuth manager dependency
private googleOAuthManager: GoogleOAuthManager | null = null;

// In onInitialize()
this.googleOAuthManager = serviceManager.getService<GoogleOAuthManager>('googleOAuthManager');

// Add OAuth methods
async initializeOAuth(userId: string, context: SlackContext): Promise<{ authUrl: string; state: string }> {
  return await this.googleOAuthManager!.generateAuthUrl(context);
}

async completeOAuth(userId: string, code: string, state: string): Promise<void> {
  const result = await this.googleOAuthManager!.exchangeCodeForTokens(code, state);
  if (!result.success) {
    throw new Error(result.error);
  }
}

// Update existing methods to auto-authenticate
async sendEmail(userId: string, params: SendEmailParams): Promise<EmailResult> {
  const token = await this.googleOAuthManager!.getValidTokens(userId);
  if (!token) {
    throw new Error('OAuth required - call initializeOAuth first');
  }
  await this.authenticate(token);
  return this.gmailClient.sendEmail(params);
}
```

### 1.3 Update Domain Service Interfaces
**File**: `backend/src/services/domain/interfaces/domain-service.interfaces.ts`

```typescript
// Add OAuth methods to all domain service interfaces
export interface IEmailDomainService extends IDomainService {
  // OAuth management
  initializeOAuth(userId: string, context: SlackContext): Promise<{ authUrl: string; state: string }>;
  completeOAuth(userId: string, code: string, state: string): Promise<void>;
  refreshTokens(userId: string): Promise<void>;
  revokeTokens(userId: string): Promise<void>;
  
  // Existing methods (now with automatic auth)
  sendEmail(userId: string, params: SendEmailParams): Promise<EmailResult>;
  // ... other methods
}
```

## Phase 2: Agent Migration (Week 2)

### 2.1 Update Agents to Use Domain Services
**Files to Update**:
- `backend/src/agents/email.agent.ts`
- `backend/src/agents/calendar.agent.ts`
- `backend/src/agents/contact.agent.ts`
- `backend/src/agents/slack.agent.ts`

**Changes**:
```typescript
// Remove direct OAuth service usage
// OLD: private slackOAuthService: SlackOAuthService
// NEW: Use domain service OAuth methods

// Update executeOperation method
protected async executeOperation(operation: string, parameters: any, authToken: any): Promise<EmailResult> {
  const userId = parameters.userId;
  
  // Check if OAuth is required
  if (await this.emailDomainService.requiresOAuth(userId)) {
    // Return OAuth URL for user to complete
    const { authUrl, state } = await this.emailDomainService.initializeOAuth(userId, parameters.context);
    return {
      success: false,
      requiresOAuth: true,
      authUrl,
      state
    };
  }
  
  // Execute operation with automatic authentication
  switch (operation) {
    case 'send':
      return await this.emailDomainService.sendEmail(userId, parameters);
    // ... other operations
  }
}
```

### 2.2 Update Agent Factory
**File**: `backend/src/framework/agent-factory.ts`

```typescript
// Remove OAuth service dependencies from agent creation
// Agents now get OAuth through domain services
```

## Phase 3: Route Updates (Week 2)

### 3.1 Update OAuth Routes
**File**: `backend/src/routes/auth.routes.ts`

```typescript
// Update OAuth callback to use domain services
// Instead of direct OAuth service calls, use domain service OAuth methods
```

### 3.2 Update Slack Routes
**File**: `backend/src/routes/slack.routes.ts`

```typescript
// Remove direct OAuth service usage
// Use domain service OAuth methods instead
```

## Phase 4: System Cleanup (Week 3)

### 4.1 Remove Old Service Files
**Files to Delete** (marked as deleted in git):
- `backend/src/services/calendar/calendar.service.ts`
- `backend/src/services/contact.service.ts`
- `backend/src/services/email/gmail.service.ts`
- `backend/src/services/openai.service.ts`
- `backend/src/framework/workflow-orchestrator.ts`

### 4.2 Update Service Type Definitions
**File**: `backend/src/types/workflow/service-types.ts`

```typescript
// Remove old service types
export enum ServiceType {
  // Remove: GOOGLE_CALENDAR, GMAIL, GOOGLE_CONTACTS, SLACK
  // Add: GOOGLE_OAUTH_MANAGER, SLACK_OAUTH_MANAGER
  GOOGLE_OAUTH_MANAGER = 'googleOAuthManager',
  SLACK_OAUTH_MANAGER = 'slackOAuthManager',
  // ... keep existing core services
}
```

### 4.3 Clean Up Service Initialization
**File**: `backend/src/services/service-initialization.ts`

```typescript
// Remove old service registrations
// Remove: SlackOAuthService (replaced by SlackOAuthManager)
// Remove: Old service comments and dead code
```

### 4.4 Update Documentation
**Files to Update**:
- `backend/src/services/domain/DOMAIN_SERVICES_README.md`
- `README.md`
- `backend/src/services/api/README.md`

## Phase 5: Testing & Validation (Week 3)

### 5.1 Update Tests
**Files to Update**:
- `backend/tests/unit/agents/`
- `backend/tests/integration/`
- `backend/tests/setup.ts`

### 5.2 Create OAuth Integration Tests
**New Files**:
- `backend/tests/integration/oauth-integration.test.ts`
- `backend/tests/unit/services/oauth-managers.test.ts`

### 5.3 Update Test Setup
**File**: `backend/tests/setup.ts`

```typescript
// Add OAuth manager initialization to test setup
// Mock OAuth flows for testing
```

## Phase 6: Performance & Monitoring (Week 4)

### 6.1 Add OAuth Metrics
**Files to Update**:
- `backend/src/services/oauth/google-oauth-manager.ts`
- `backend/src/services/oauth/slack-oauth-manager.ts`

```typescript
// Add metrics for OAuth operations
// Track success rates, token refresh frequency, etc.
```

### 6.2 Update Health Checks
**Files to Update**:
- All domain services
- OAuth managers

```typescript
// Add OAuth status to health checks
getHealth(): { healthy: boolean; details?: any } {
  return {
    healthy: this.isReady(),
    oauthStatus: this.oauthManager?.getHealth(),
    // ... other health details
  };
}
```

## Migration Checklist

### ✅ **Phase 1: OAuth Manager Integration**
- [ ] Register OAuth managers in service initialization
- [ ] Update domain services to use OAuth managers
- [ ] Add OAuth methods to domain service interfaces
- [ ] Test OAuth manager functionality

### ✅ **Phase 2: Agent Migration**
- [ ] Update email agent to use domain service OAuth
- [ ] Update calendar agent to use domain service OAuth
- [ ] Update contact agent to use domain service OAuth
- [ ] Update slack agent to use domain service OAuth
- [ ] Update agent factory

### ✅ **Phase 3: Route Updates**
- [ ] Update OAuth callback routes
- [ ] Update Slack routes
- [ ] Test OAuth flows end-to-end

### ✅ **Phase 4: System Cleanup**
- [ ] Delete old service files
- [ ] Update service type definitions
- [ ] Clean up service initialization
- [ ] Update documentation

### ✅ **Phase 5: Testing & Validation**
- [ ] Update existing tests
- [ ] Create OAuth integration tests
- [ ] Update test setup
- [ ] Run full test suite

### ✅ **Phase 6: Performance & Monitoring**
- [ ] Add OAuth metrics
- [ ] Update health checks
- [ ] Monitor OAuth performance
- [ ] Document OAuth troubleshooting

## Benefits After Migration

### **For Agents**
- **Simplified Code**: No direct OAuth management
- **Automatic Auth**: Domain services handle authentication
- **Consistent Interface**: Same pattern across all services
- **Better Error Handling**: Unified OAuth error handling

### **For Domain Services**
- **Shared OAuth Logic**: One OAuth manager per provider
- **Automatic Token Refresh**: Transparent token management
- **Better Encapsulation**: OAuth logic contained within services
- **Easier Testing**: Mock OAuth managers for tests

### **For System Architecture**
- **Cleaner Separation**: OAuth in infrastructure layer
- **Reduced Complexity**: Fewer service dependencies
- **Better Maintainability**: Centralized OAuth logic
- **Improved Performance**: Shared token caching

## Risk Mitigation

### **Backward Compatibility**
- Keep old OAuth services during transition
- Gradual migration with feature flags
- Comprehensive testing before removal

### **Error Handling**
- Graceful fallbacks for OAuth failures
- Clear error messages for users
- Comprehensive logging for debugging

### **Performance**
- Monitor OAuth operation latency
- Optimize token caching strategies
- Load test OAuth flows

## Success Metrics

### **Code Quality**
- Reduced lines of code in agents
- Fewer service dependencies
- Improved test coverage

### **Performance**
- Faster OAuth operations
- Reduced memory usage
- Better error recovery

### **Maintainability**
- Easier to add new OAuth providers
- Simplified debugging
- Better documentation

## Timeline Summary

- **Week 1**: OAuth Manager Integration
- **Week 2**: Agent Migration & Route Updates
- **Week 3**: System Cleanup & Testing
- **Week 4**: Performance & Monitoring

**Total Estimated Time**: 4 weeks
**Risk Level**: Medium (well-defined migration path)
**Impact**: High (significant architectural improvement)
