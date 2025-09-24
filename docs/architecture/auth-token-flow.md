# Auth Token Flow - From HTTP Request to Service APIs

## The Question

**"Where do agents get the auth tokens they pass to services?"**

---

## The Complete Flow

### 1. User Makes HTTP Request

**Example:** Send an email via API

```http
POST /api/chat
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "message": "Send email to john@example.com about project update",
  "sessionId": "session-123"
}
```

---

### 2. Auth Middleware Extracts JWT

**File:** `src/middleware/auth.middleware.ts`

```typescript
export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  // Extract JWT from Authorization header
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Verify JWT and extract user info
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    // Attach user to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture
    };

    next();
  });
};
```

**Result:** `req.user` now contains:
```typescript
{
  userId: "user-123",
  email: "alice@example.com",
  name: "Alice",
  picture: "https://..."
}
```

---

### 3. Route Handler Retrieves OAuth Tokens

**File:** `src/routes/protected.routes.ts` (or wherever MasterAgent is called)

```typescript
router.post('/chat', authenticateToken, async (req, res) => {
  const user = req.user!; // TypeScript knows this exists due to middleware
  const { message, sessionId } = req.body;

  // ========================================
  // KEY STEP: Fetch OAuth tokens from storage
  // ========================================
  const tokenStorage = serviceManager.getService('tokenStorage');

  // Get Google OAuth access token for this user
  const googleAccessToken = await tokenStorage.getGoogleAccessToken(user.userId);

  // Get Slack OAuth access token (if needed)
  const slackAccessToken = await tokenStorage.getSlackAccessToken(user.userId);

  // Call MasterAgent with tokens
  const result = await masterAgent.processRequest({
    userInput: message,
    sessionId,
    userId: user.userId,
    accessToken: googleAccessToken,  // ← OAuth token
    slackContext: { token: slackAccessToken }
  });

  res.json(result);
});
```

---

### 4. TokenStorageService Fetches Tokens

**File:** `src/services/token-storage.service.ts`

**How tokens are stored:**
- User completes OAuth flow (Google, Slack, etc.)
- Tokens stored in database with user ID
- Includes: `access_token`, `refresh_token`, `expires_at`

**Token retrieval:**
```typescript
async getGoogleAccessToken(userId: string): Promise<string | null> {
  // Fetch from database
  const tokens = await this.getUserTokens(userId);

  if (!tokens?.googleTokens?.access_token) {
    return null;
  }

  const googleTokens = tokens.googleTokens;

  // ========================================
  // AUTO-REFRESH if expired
  // ========================================
  if (googleTokens.expires_at && new Date() > googleTokens.expires_at) {
    const refreshedTokens = await this.refreshGoogleAccessToken(
      userId,
      googleTokens.refresh_token
    );

    if (refreshedTokens) {
      return refreshedTokens.access_token; // ← Fresh token
    }

    return null; // Refresh failed
  }

  return googleTokens.access_token; // ← Valid token
}
```

**Database schema (simplified):**
```json
{
  "userId": "user-123",
  "googleTokens": {
    "access_token": "ya29.a0AfH6SMB...",
    "refresh_token": "1//0gHW5Z...",
    "expires_at": "2024-10-24T16:00:00Z"
  },
  "slackTokens": {
    "access_token": "xoxp-123...",
    "expires_at": "2024-12-01T00:00:00Z"
  }
}
```

---

### 5. MasterAgent Passes Token to AgentFactory

**File:** `src/agents/master.agent.ts`

```typescript
// MasterAgent determines which agent to use
const agentName = 'emailAgent';
const request = "Send email to john@example.com...";

// Calls AgentFactory with token
const result = await AgentFactory.executeAgentWithNaturalLanguage(
  agentName,
  request,
  {
    sessionId,
    userId,
    accessToken: googleAccessToken,  // ← Token passed down
    slackContext,
    correlationId
  }
);
```

---

### 6. AgentFactory Creates Execution Context

**File:** `src/framework/agent-factory.ts`

```typescript
static async executeAgentWithNaturalLanguage(
  agentName: string,
  request: string,
  context: {
    sessionId: string;
    userId?: string;
    accessToken?: string;  // ← Token received
    slackContext?: any;
    correlationId?: string;
  }
) {
  const agent = this.getAgent(agentName);

  // Build AgentExecutionContext
  const result = await agent.processNaturalLanguageRequest(request, {
    sessionId: context.sessionId,
    userId: context.userId,
    accessToken: context.accessToken,  // ← Token in context
    slackContext: context.slackContext,
    correlationId: context.correlationId || `agent-${agentName}-${Date.now()}`,
    timestamp: new Date()
  });

  return result;
}
```

---

### 7. NaturalLanguageAgent Extracts Token

**File:** `src/framework/natural-language-agent.ts`

```typescript
async processNaturalLanguageRequest(
  request: string,
  context: AgentExecutionContext  // ← Contains accessToken
): Promise<NaturalLanguageResponse> {

  // 1. Analyze intent (LLM extracts operation + parameters)
  const intent = await this.analyzeIntent(request, context, config);

  // 2. Check if draft needed
  const shouldDraft = await this.shouldCreateDraft(intent, context, config);
  if (shouldDraft.shouldCreateDraft) {
    return await this.createDraft(intent, request, context, config, shouldDraft);
  }

  // ========================================
  // 3. AUTHENTICATE - Extract token from context
  // ========================================
  const authToken = await this.authenticate(context, config);

  // 4. Execute operation with token
  const result = await this.executeOperation(
    intent.operation,
    intent.parameters,
    authToken  // ← Token passed to agent's executeOperation()
  );

  // 5. Format response
  const responseText = await this.formatResponse(request, result, intent, config);

  return { response: responseText, reasoning: intent.reasoning, metadata: {...} };
}
```

**Authenticate method:**
```typescript
private async authenticate(
  context: AgentExecutionContext,
  config: AgentConfig
): Promise<any> {
  if (config.auth.type === 'oauth') {
    return context.accessToken;  // ← Extract from context
  }

  if (config.auth.type === 'api-key') {
    return context.accessToken || null;
  }

  return null; // No auth needed
}
```

---

### 8. Agent Maps Token to Service

**File:** `src/agents/email-v2.agent.ts`

```typescript
protected async executeOperation(
  operation: string,
  parameters: any,
  authToken: string  // ← Token received from base class
): Promise<any> {
  const gmailService = this.getService('gmailService');

  switch (operation) {
    case 'send': {
      const { to, subject, body } = parameters;

      // ========================================
      // Pass token to service
      // ========================================
      return await gmailService.sendEmail(
        authToken,  // ← Token goes to service
        to,
        subject,
        body,
        {}
      );
    }
  }
}
```

---

### 9. Service Uses Token for API Call

**File:** `src/services/email/gmail.service.ts`

```typescript
async sendEmail(
  accessToken: string,  // ← OAuth token
  to: string,
  subject: string,
  body: string,
  options: { cc?, bcc? }
) {
  this.assertReady();

  try {
    // ========================================
    // Use token to call Gmail API
    // ========================================
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    // Set credentials with access token
    this.oauth2Client.setCredentials({
      access_token: accessToken  // ← Token used here!
    });

    // Make Gmail API request
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: this.createRawEmail(to, subject, body, options)
      }
    });

    return {
      messageId: response.data.id,
      threadId: response.data.threadId
    };

  } catch (error) {
    this.handleError(error, 'sendEmail');
  }
}
```

---

## Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ 1. HTTP Request                                         │
│    POST /api/chat                                       │
│    Authorization: Bearer JWT_TOKEN                      │
│    Body: { message: "Send email...", sessionId: "..." }│
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Auth Middleware (auth.middleware.ts)                 │
│    - Verifies JWT                                       │
│    - Extracts user: { userId, email, name }            │
│    - Attaches to req.user                              │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Route Handler (protected.routes.ts)                  │
│    const user = req.user!;                             │
│                                                          │
│    // Fetch OAuth tokens                               │
│    const tokenStorage = getService('tokenStorage');    │
│    const googleToken = await tokenStorage              │
│      .getGoogleAccessToken(user.userId);               │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 4. TokenStorageService (token-storage.service.ts)       │
│    - Fetches from database: tokens[userId]             │
│    - Auto-refreshes if expired                         │
│    - Returns: "ya29.a0AfH6SMB..."                      │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 5. MasterAgent (master.agent.ts)                        │
│    await AgentFactory.executeAgentWithNaturalLanguage( │
│      'emailAgent',                                      │
│      request,                                           │
│      { sessionId, userId, accessToken: googleToken }   │
│    );                                                   │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 6. AgentFactory (agent-factory.ts)                      │
│    agent.processNaturalLanguageRequest(request, {      │
│      sessionId,                                         │
│      userId,                                            │
│      accessToken: context.accessToken  ← Token here    │
│    });                                                  │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 7. NaturalLanguageAgent (natural-language-agent.ts)     │
│    const authToken = await this.authenticate(context); │
│    // Returns: context.accessToken                     │
│                                                          │
│    await this.executeOperation(                        │
│      operation,                                         │
│      parameters,                                        │
│      authToken  ← Token passed to agent                │
│    );                                                   │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 8. EmailAgentV2 (email-v2.agent.ts)                     │
│    await gmailService.sendEmail(                       │
│      authToken,  ← Token passed to service             │
│      to, subject, body, options                        │
│    );                                                   │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 9. GmailService (gmail.service.ts)                      │
│    this.oauth2Client.setCredentials({                  │
│      access_token: accessToken  ← Token used!          │
│    });                                                  │
│                                                          │
│    await gmail.users.messages.send({...});             │
│    // Makes actual Gmail API call                      │
└─────────────────────────────────────────────────────────┘
```

---

## Key Points

### 1. **JWT vs OAuth Tokens**
- **JWT Token:** Proves user identity (from `Authorization` header)
- **OAuth Tokens:** Access user's Google/Slack/etc. data (from database)

### 2. **Token Storage**
- OAuth tokens stored in database, keyed by `userId`
- Auto-refresh when expired using refresh token
- Each provider (Google, Slack) has separate tokens

### 3. **Token Flow**
```
HTTP Request (JWT)
  → Auth Middleware (extract userId)
    → Route Handler (fetch OAuth token from DB)
      → MasterAgent (pass token in context)
        → AgentFactory (wrap in AgentExecutionContext)
          → NaturalLanguageAgent (extract via authenticate())
            → Agent (pass to executeOperation)
              → Service (use for API call)
```

### 4. **Auto-Refresh**
`TokenStorageService` automatically refreshes expired tokens:
```typescript
if (expires_at < now) {
  const fresh = await refresh(refresh_token);
  return fresh.access_token;
}
```

### 5. **Multiple Providers**
Different agents need different tokens:
- **EmailAgent** → Google OAuth token
- **CalendarAgent** → Google OAuth token
- **SlackAgent** → Slack OAuth token
- **ContactAgent** → Google OAuth token

All sourced from `tokenStorage.getUserTokens(userId)`.

---

## AgentExecutionContext Interface

```typescript
interface AgentExecutionContext {
  sessionId: string;          // Chat session ID
  userId?: string;            // User ID (from JWT)
  accessToken?: string;       // OAuth access token (from DB)
  refreshToken?: string;      // OAuth refresh token
  tokenExpiry?: number;       // Token expiration timestamp
  slackContext?: any;         // Slack-specific context
  correlationId: string;      // Request tracing ID
  timestamp: Date;            // Request timestamp
}
```

**The `accessToken` field carries the OAuth token through the entire flow.**

---

## Summary

**Question:** Where do agents get auth tokens?

**Answer:**
1. HTTP request includes **JWT** (proves identity)
2. Auth middleware extracts **userId** from JWT
3. Route handler fetches **OAuth tokens** from database using userId
4. OAuth token passed through:
   - MasterAgent → AgentFactory → NaturalLanguageAgent → Agent → Service
5. Service uses OAuth token to call external APIs (Gmail, Google Calendar, Slack, etc.)

**The token flows from database → context → agent → service as a simple string parameter.** 🔐