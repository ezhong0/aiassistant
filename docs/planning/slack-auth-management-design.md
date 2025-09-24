# Universal Authentication Management Design

## Executive Summary

A seamless, platform-native authentication management system that:
- **Automatically detects and handles auth errors** with one-click reconnection
- **Provides instant status visibility** through slash commands and interactive messages
- **Requires zero context switching** - everything happens in-platform (Slack, web UI, mobile)
- **Guides users proactively** when tokens expire or permissions are missing
- **Extensible architecture** - easily add new OAuth providers (Microsoft, Notion, GitHub, etc.)
- **Single source of truth** - unified token management across all integrations

---

## Design Philosophy

### Core Principles
1. **Zero Friction**: Authentication management should take <10 seconds
2. **Contextual Help**: Show auth prompts exactly when/where they're needed
3. **Visual Clarity**: Use Slack's visual language (emojis, colors, blocks)
4. **Fail Gracefully**: Never leave users confused about what went wrong

### User Mental Model
```
Auth Error → See Clear Message → Click Button → Done
```

Not:
```
Auth Error → Google error message → Confused → Contact support
```

---

## User Flows

### Flow 1: Automatic Auth Error Detection (Primary Flow)

**Trigger**: Agent detects authentication failure during any operation

**The agent continues the workflow and includes auth guidance in the final LLM-generated response:**

```
User: "Check my emails"

Bot: [LLM-generated natural language response explaining the auth issue]

     I wasn't able to check your emails because I couldn't connect to your Gmail account.
     This usually happens when your authentication token expires, which is completely normal
     for security reasons.

     To fix this, you'll need to reconnect your Gmail account. You can use the /auth command
     to manage all your connections, or use the button below for quick access.

     [🔄 Reconnect Gmail]
```

**Design Principle**:
- Agent workflow completes normally (no exceptions/stops)
- LLM generates the entire response including auth guidance
- System appends interactive buttons as actions
- User gets natural, conversational explanation + actionable button

**Click "Reconnect Gmail"**:
1. Opens minimal OAuth popup (or provides link)
2. User authorizes in Google
3. Returns to Slack with success message
4. User can then re-ask their question naturally

**Code Hook Points**:
```typescript
// In natural-language-agent.ts - when auth error detected
if (errorType.type === 'authentication') {
  // Let LLM generate the auth error message naturally
  const llmResponse = await this.formatErrorResponse(error, query, context);

  return {
    response: llmResponse, // Natural language from LLM
    metadata: {
      requiresAuth: true,
      service: this.detectServiceFromError(error),
      suggestedActions: [
        {
          type: 'button',
          action_id: `reconnect_${service}`,
          text: `🔄 Reconnect ${service}`,
          style: 'primary'
        }
      ]
    }
  };
}
```

---

### Flow 2: Manual Auth Management

**Trigger**: User types `/auth` or `/connections`

```
/auth

Bot: 📊 Your Connections

     Gmail      ✅ Connected (expires in 5 days)
     Calendar   ✅ Connected (expires in 12 days)

     [🔄 Refresh All]  [➕ Add Service]  [⚙️ Settings]
```

**Interactive Message with Status Cards**:
```
┌─────────────────────────────────────┐
│  📧 Gmail                           │
│  ✅ Connected                       │
│  Last used: 2 hours ago             │
│  Expires: Jan 25, 2025              │
│                                     │
│  [Test Connection]  [Disconnect]    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  📅 Calendar                        │
│  ✅ Connected                       │
│  Last used: 1 day ago               │
│  Expires: Feb 1, 2025               │
│                                     │
│  [Test Connection]  [Disconnect]    │
└─────────────────────────────────────┘
```

---

### Flow 3: Proactive Token Expiration Warning

**Trigger**: Token expires in < 3 days

```
Bot: 🔔 Heads up!

     Your Gmail connection expires in 2 days.
     Refresh now to avoid interruptions.

     [🔄 Refresh Now]  [Remind Me Tomorrow]
```

**Implementation**:
```typescript
// Daily cron job checks token expiration
// Sends proactive DM to users with expiring tokens
async function checkExpiringTokens() {
  const expiringUsers = await tokenManager.getUsersWithExpiringTokens(3); // 3 days

  for (const user of expiringUsers) {
    await slackService.sendDM(user.slackUserId, {
      text: 'Token expiring soon',
      blocks: [
        headerBlock('🔔 Heads up!'),
        sectionBlock(`Your ${user.service} connection expires in ${user.daysUntilExpiry} days.`),
        actionsBlock([
          buttonAction('refresh_token', `🔄 Refresh Now`, user.service),
          buttonAction('remind_later', 'Remind Me Tomorrow')
        ])
      ]
    });
  }
}
```

---

### Flow 4: First-Time Setup (Onboarding)

**Trigger**: User's first message after installing app

```
Bot: 👋 Welcome! Let's get you set up.

     I can help with emails, calendar, and more.
     First, I need to connect to your Google account.

     [🔐 Connect Google]  [⏭️ Skip for now]
```

**After clicking "Connect Google"**:
```
Bot: Great! I need permission to:

     ✉️ Read and send emails (Gmail)
     📅 Manage calendar events

     This is secure and you can disconnect anytime.

     [✅ Authorize]  [🔒 Privacy Policy]
```

---

## Technical Implementation

### 1. Slash Command Handler

```typescript
// src/routes/slack-commands.routes.ts
app.post('/slack/commands/auth', async (req, res) => {
  const { user_id, team_id } = req.body;

  // Immediate ack
  res.status(200).send();

  // Get user's connection status
  const connections = await authManager.getUserConnections(team_id, user_id);

  // Send rich interactive message
  await slackService.sendEphemeralMessage(user_id, {
    blocks: buildAuthStatusBlocks(connections)
  });
});
```

### 2. Auth Error Detection & Response

```typescript
// src/framework/natural-language-agent.ts
private async formatErrorResponse(error: Error, query: string): Promise<AgentResponse> {
  const errorType = await this.categorizeError(error);

  if (errorType.type === 'authentication') {
    const service = this.detectServiceFromError(error); // 'gmail', 'calendar', etc

    return {
      response: this.buildAuthErrorMessage(service),
      metadata: {
        requiresAuth: true,
        service,
        originalQuery: query,
        suggestedActions: [
          {
            type: 'button',
            action_id: `reconnect_${service}`,
            text: `🔄 Reconnect ${service}`,
            style: 'primary'
          },
          {
            type: 'button',
            action_id: 'auth_help',
            text: 'ℹ️ Why?'
          }
        ]
      }
    };
  }

  // ... other error types
}

private buildAuthErrorMessage(service: string): string {
  const messages = {
    gmail: "⚠️ I couldn't access your Gmail account\n\nYour Google connection needs to be refreshed.",
    calendar: "⚠️ I couldn't access your Calendar\n\nYour Google connection needs to be refreshed.",
  };

  return messages[service] || "⚠️ Authentication required\n\nPlease reconnect your account.";
}
```

### 3. Interactive Button Handler

```typescript
// src/services/slack/slack-interaction-handler.ts
async handleButtonClick(payload: SlackInteractionPayload) {
  const { action_id, user, team } = payload;

  if (action_id.startsWith('reconnect_')) {
    const service = action_id.replace('reconnect_', '');

    // Generate OAuth URL
    const oauthUrl = await oauthService.generateAuthUrl({
      teamId: team.id,
      userId: user.id,
      service,
      returnAction: 'retry_original_request' // After auth, retry what user asked
    });

    // Update message with OAuth link
    await slackService.updateMessage(payload.message_ts, {
      blocks: [
        sectionBlock('🔐 Click below to reconnect:'),
        actionsBlock([
          buttonAction('open_oauth', 'Authorize Google', oauthUrl, 'primary', true) // external link
        ]),
        contextBlock('This will open in a new window. Come back when done!')
      ]
    });

  } else if (action_id === 'auth_help') {
    // Show help modal
    await slackService.openModal({
      title: 'Why reconnect?',
      blocks: buildAuthHelpBlocks()
    });
  }
}
```

### 4. OAuth Completion Flow

```typescript
// src/routes/auth.routes.ts
app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  const { teamId, userId, returnAction, originalQuery } = parseState(state);

  try {
    // Exchange code for tokens
    const tokens = await oauthService.exchangeCodeForTokens(code);

    // Store tokens
    await tokenManager.storeTokens(teamId, userId, tokens);

    // Send success message to Slack
    await slackService.sendDM(userId, {
      text: '✅ Successfully connected!',
      blocks: [
        headerBlock('✅ All set!'),
        sectionBlock('Your Google account is now connected.'),
        ...(returnAction === 'retry_original_request' ? [
          dividerBlock(),
          sectionBlock(`Let me try your request again: "${originalQuery}"`)
        ] : [])
      ]
    });

    // If user had an original request, retry it now
    if (returnAction === 'retry_original_request' && originalQuery) {
      await masterAgent.processUserInput(originalQuery, {
        sessionId: `slack:${teamId}:${userId}`,
        userId,
        slackContext: { teamId, userId }
      });
    }

    // Show success page
    res.send(`
      <html>
        <body style="font-family: system-ui; text-align: center; padding: 50px;">
          <h1>✅ Connected!</h1>
          <p>You can close this window and return to Slack.</p>
          <script>
            setTimeout(() => window.close(), 2000);
          </script>
        </body>
      </html>
    `);

  } catch (error) {
    // Handle error
    await slackService.sendDM(userId, {
      text: '❌ Connection failed',
      blocks: [
        headerBlock('❌ Oops!'),
        sectionBlock('Something went wrong connecting your account.'),
        actionsBlock([
          buttonAction('try_again', '🔄 Try Again')
        ])
      ]
    });

    res.status(500).send('Connection failed. Please return to Slack and try again.');
  }
});
```

### 5. Connection Status Service

```typescript
// src/services/auth-status.service.ts
export class AuthStatusService {

  async getUserConnections(teamId: string, userId: string): Promise<ServiceConnection[]> {
    const tokenStatus = await tokenManager.getTokenStatus(teamId, userId);

    return [
      {
        service: 'gmail',
        emoji: '📧',
        status: tokenStatus.gmail?.isValid ? 'connected' : 'disconnected',
        lastUsed: tokenStatus.gmail?.lastActivity,
        expiresAt: tokenStatus.gmail?.expiresAt,
        expiresIn: tokenStatus.gmail?.expiresAt ?
          this.formatTimeUntil(tokenStatus.gmail.expiresAt) : null
      },
      {
        service: 'calendar',
        emoji: '📅',
        status: tokenStatus.calendar?.isValid ? 'connected' : 'disconnected',
        lastUsed: tokenStatus.calendar?.lastActivity,
        expiresAt: tokenStatus.calendar?.expiresAt,
        expiresIn: tokenStatus.calendar?.expiresAt ?
          this.formatTimeUntil(tokenStatus.calendar.expiresAt) : null
      }
    ];
  }

  buildStatusBlocks(connections: ServiceConnection[]): Block[] {
    return [
      headerBlock('📊 Your Connections'),
      dividerBlock(),
      ...connections.map(conn => [
        sectionBlock(
          `${conn.emoji} *${conn.service}*\n` +
          `${this.getStatusEmoji(conn.status)} ${conn.status}\n` +
          `${conn.lastUsed ? `Last used: ${this.formatRelativeTime(conn.lastUsed)}` : 'Never used'}\n` +
          `${conn.expiresIn ? `Expires: ${conn.expiresIn}` : ''}`
        ),
        actionsBlock([
          buttonAction(`test_${conn.service}`, 'Test Connection'),
          buttonAction(`refresh_${conn.service}`, '🔄 Refresh', null, 'default'),
          ...(conn.status === 'connected' ? [
            buttonAction(`disconnect_${conn.service}`, 'Disconnect', null, 'danger')
          ] : [
            buttonAction(`connect_${conn.service}`, 'Connect', null, 'primary')
          ])
        ]),
        dividerBlock()
      ]).flat(),
      contextBlock('💡 Tip: Connections refresh automatically, but you can manually refresh anytime.')
    ];
  }

  private getStatusEmoji(status: string): string {
    const emojis = {
      connected: '✅',
      disconnected: '❌',
      expiring: '⚠️',
      refreshing: '🔄'
    };
    return emojis[status] || '⚪';
  }
}
```

### 6. Master Agent Integration

Update the master agent to handle auth errors gracefully:

```typescript
// src/agents/master.agent.ts
private async executeStringStep(...) {
  try {
    // ... existing code

    const result = await AgentFactory.executeAgentWithNaturalLanguage(...);

    // Check for auth errors
    if (result.metadata?.requiresAuth) {
      logger.info('Auth error detected - stopping workflow and prompting user', {
        service: result.metadata.service,
        originalQuery: result.metadata.originalQuery
      });

      // Send interactive message with reconnect button
      await this.sendAuthPrompt(
        slackContext,
        result.metadata.service,
        result.metadata.originalQuery,
        result.response
      );

      // Stop workflow immediately
      throw new Error(`AUTH_REQUIRED:${result.response}`);
    }

    return result.response;

  } catch (error) {
    // ... existing error handling
  }
}

private async sendAuthPrompt(
  slackContext: SlackContext,
  service: string,
  originalQuery: string,
  errorMessage: string
) {
  await slackService.sendInteractiveMessage(slackContext.userId, {
    text: errorMessage,
    blocks: [
      sectionBlock(errorMessage),
      actionsBlock([
        buttonAction(
          `reconnect_${service}`,
          `🔄 Reconnect ${service}`,
          JSON.stringify({ originalQuery }), // Store in button value
          'primary'
        ),
        buttonAction('auth_help', 'ℹ️ Why?')
      ]),
      contextBlock(`Original request: "${originalQuery}"`)
    ]
  });
}
```

---

## Message Templates

### Auth Error Message
```typescript
const authErrorTemplate = (service: string) => ({
  blocks: [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `⚠️ *Authentication Required*\n\nI couldn't access your ${service} account. Your connection needs to be refreshed.`
      }
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '💡 This happens when tokens expire (usually every 7 days) - completely normal!'
        }
      ]
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: `🔄 Reconnect ${service}` },
          action_id: `reconnect_${service}`,
          style: 'primary'
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'ℹ️ Why?' },
          action_id: 'auth_help'
        }
      ]
    }
  ]
});
```

### Connection Status Message
```typescript
const connectionStatusTemplate = (connections: ServiceConnection[]) => ({
  blocks: [
    {
      type: 'header',
      text: { type: 'plain_text', text: '📊 Your Connections' }
    },
    { type: 'divider' },
    ...connections.map(conn => [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            `${conn.emoji} *${capitalize(conn.service)}*\n` +
            `${getStatusEmoji(conn.status)} ${capitalize(conn.status)}\n` +
            `${conn.lastUsed ? `Last used: ${formatRelative(conn.lastUsed)}` : 'Never used'}\n` +
            `${conn.expiresIn ? `⏰ Expires: ${conn.expiresIn}` : ''}`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Test' },
            action_id: `test_${conn.service}`
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '🔄 Refresh' },
            action_id: `refresh_${conn.service}`
          }
        ]
      },
      { type: 'divider' }
    ]).flat()
  ]
});
```

---

## Implementation Status

### ✅ Completed (Phase 1 & 2)

#### Phase 1: Core Auth Error Handling
- [✅] Auth error detection in natural-language-agent (categorizeError with 'authentication' type)
- [✅] Error metadata flow (isAuthError flag passed through agent responses)
- [✅] LLM-generated auth error messages with /auth command guidance
- [✅] Token validation in storeUserTokens (prevents storing invalid tokens)
- [✅] Comprehensive logging at all token layers (refresh, storage, retrieval)
- [✅] Master agent AUTH_ERROR detection and workflow control

#### Phase 2: Manual Management Dashboard
- [✅] `/auth` slash command handler (slack.routes.ts:307-345)
- [✅] AuthStatusService for connection status (auth-status.service.ts)
- [✅] Connection status dashboard with interactive blocks
- [✅] Test connection functionality (auth-status.service.ts:199-229)
- [✅] Reconnect button handlers (slack.routes.ts:391-468)
- [✅] OAuth callback with retry/dashboard support (auth.routes.ts:850-927)
- [✅] Slack notification after successful reconnection
- [✅] Auto-close success page after 3 seconds

### ❌ Not Yet Implemented (Phase 3-4)

#### Phase 3: Proactive Management
- [ ] Create token expiration checker (cron job)
- [ ] Implement expiration warning DMs (3 days before expiry)
- [ ] Add "remind me later" functionality
- [ ] Build first-time onboarding flow
- [ ] Add connection health monitoring
- [ ] Disconnect button functionality
- [ ] Bulk refresh option

#### Phase 4: Polish & Testing
- [✅] Add comprehensive logging (COMPLETE)
- [ ] Implement error recovery flows
- [ ] Create help documentation
- [ ] Write integration tests
- [ ] User acceptance testing

---

## Success Metrics

- **Auth Error Resolution Time**: <30 seconds (click → authorize → retry)
- **Token Expiration Warnings**: Sent 3 days before expiry
- **Auto-Retry Success Rate**: >90% of requests succeed after reconnection
- **User Confusion**: <5% of users contact support for auth issues
- **Connection Uptime**: >99% of the time users have valid connections

---

## Key Improvements Over Current State

1. **Proactive, not reactive**: Warns before tokens expire
2. **One-click reconnection**: No copying/pasting URLs
3. **Automatic retry**: After reconnecting, immediately retries original request
4. **Visual clarity**: Clear status indicators and helpful messages
5. **Zero context switching**: Everything happens in Slack

This design transforms authentication from a frustrating blocker into a smooth, barely-noticeable process.

---

## Extensibility: Adding New Integrations

### Architecture for Multi-Provider Support

The auth system is designed to easily add new OAuth providers (Microsoft 365, Notion, GitHub, Salesforce, etc.) without modifying core logic.

#### 1. Provider Registry Pattern

```typescript
// src/services/auth/provider-registry.ts
export interface OAuthProvider {
  id: string;           // 'google', 'microsoft', 'notion'
  name: string;         // Display name: 'Google', 'Microsoft 365'
  emoji: string;        // UI emoji: '📧', '📊'
  scopes: string[];     // OAuth scopes
  authUrl: string;      // OAuth authorization URL
  tokenUrl: string;     // Token exchange URL
  services: string[];   // Services this provides: ['gmail', 'calendar']
}

export class ProviderRegistry {
  private providers = new Map<string, OAuthProvider>();

  register(provider: OAuthProvider) {
    this.providers.set(provider.id, provider);
  }

  get(providerId: string): OAuthProvider | undefined {
    return this.providers.get(providerId);
  }

  getByService(service: string): OAuthProvider | undefined {
    return Array.from(this.providers.values())
      .find(p => p.services.includes(service));
  }

  getAll(): OAuthProvider[] {
    return Array.from(this.providers.values());
  }
}

// Initialize with built-in providers
const providerRegistry = new ProviderRegistry();

providerRegistry.register({
  id: 'google',
  name: 'Google',
  emoji: '🔵',
  scopes: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar'
  ],
  authUrl: 'https://accounts.google.com/o/oauth2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  services: ['gmail', 'calendar', 'drive']
});

providerRegistry.register({
  id: 'microsoft',
  name: 'Microsoft 365',
  emoji: '🔷',
  scopes: [
    'https://graph.microsoft.com/Mail.Read',
    'https://graph.microsoft.com/Calendars.ReadWrite'
  ],
  authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  services: ['outlook', 'teams', 'onedrive']
});

providerRegistry.register({
  id: 'notion',
  name: 'Notion',
  emoji: '📓',
  scopes: [],
  authUrl: 'https://api.notion.com/v1/oauth/authorize',
  tokenUrl: 'https://api.notion.com/v1/oauth/token',
  services: ['notion']
});
```

#### 2. Unified Token Storage Schema

```sql
-- Database schema supports multiple providers
CREATE TABLE user_tokens (
  user_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,              -- 'google', 'microsoft', 'notion'
  access_token TEXT,                      -- Encrypted
  refresh_token TEXT,                     -- Encrypted
  token_expiry TIMESTAMP,
  scopes TEXT[],                          -- Array of granted scopes
  metadata JSONB,                         -- Provider-specific data
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, team_id, provider_id)
);

-- Service-to-provider mapping for quick lookups
CREATE INDEX idx_user_tokens_lookup
  ON user_tokens(user_id, team_id)
  INCLUDE (provider_id, access_token, token_expiry);
```

#### 3. Generic OAuth Manager

```typescript
// src/services/auth/oauth-manager.ts
export class OAuthManager {
  constructor(
    private providerRegistry: ProviderRegistry,
    private tokenStorage: TokenStorageService
  ) {}

  async initiateAuth(providerId: string, userId: string, teamId: string): Promise<string> {
    const provider = this.providerRegistry.get(providerId);
    if (!provider) throw new Error(`Unknown provider: ${providerId}`);

    const state = this.generateState({ userId, teamId, providerId });

    const params = new URLSearchParams({
      client_id: this.getClientId(providerId),
      redirect_uri: this.getRedirectUri(providerId),
      scope: provider.scopes.join(' '),
      response_type: 'code',
      state
    });

    return `${provider.authUrl}?${params}`;
  }

  async handleCallback(code: string, state: string): Promise<void> {
    const { userId, teamId, providerId } = this.parseState(state);
    const provider = this.providerRegistry.get(providerId);

    const tokens = await this.exchangeCodeForTokens(providerId, code);
    await this.tokenStorage.storeTokens(userId, teamId, providerId, tokens);
  }

  // Get tokens for any provider
  async getTokens(userId: string, teamId: string, providerId: string) {
    return this.tokenStorage.getTokens(userId, teamId, providerId);
  }

  // Get tokens by service name (auto-resolves provider)
  async getTokensForService(userId: string, teamId: string, service: string) {
    const provider = this.providerRegistry.getByService(service);
    if (!provider) throw new Error(`No provider for service: ${service}`);

    return this.getTokens(userId, teamId, provider.id);
  }
}
```

#### 4. Service-Agnostic Auth Error Detection

```typescript
// src/framework/natural-language-agent.ts
private detectServiceFromError(error: Error): { provider: string; service: string } {
  const errorMsg = error.message.toLowerCase();

  // Pattern matching for different providers
  const patterns = [
    { pattern: /gmail|google mail/i, provider: 'google', service: 'gmail' },
    { pattern: /calendar.*google/i, provider: 'google', service: 'calendar' },
    { pattern: /outlook|office 365|microsoft mail/i, provider: 'microsoft', service: 'outlook' },
    { pattern: /teams/i, provider: 'microsoft', service: 'teams' },
    { pattern: /notion/i, provider: 'notion', service: 'notion' },
    { pattern: /github/i, provider: 'github', service: 'github' }
  ];

  for (const { pattern, provider, service } of patterns) {
    if (pattern.test(errorMsg)) return { provider, service };
  }

  // Fallback: try to detect from stack trace
  return this.detectFromStackTrace(error);
}
```

#### 5. Universal /auth Command

```typescript
// /auth command shows ALL connected providers
app.post('/slack/commands/auth', async (req, res) => {
  const { user_id, team_id } = req.body;
  res.status(200).send();

  const allProviders = providerRegistry.getAll();
  const connections = await Promise.all(
    allProviders.map(async provider => ({
      provider,
      status: await oauthManager.getConnectionStatus(user_id, team_id, provider.id)
    }))
  );

  await slackService.sendMessage(user_id, {
    blocks: [
      headerBlock('🔐 Your Connections'),
      dividerBlock(),
      ...connections.map(({ provider, status }) => [
        sectionBlock(
          `${provider.emoji} *${provider.name}*\n` +
          `${status.connected ? '✅' : '❌'} ${status.connected ? 'Connected' : 'Not connected'}\n` +
          `Services: ${provider.services.join(', ')}\n` +
          `${status.expiresIn ? `Expires: ${status.expiresIn}` : ''}`
        ),
        actionsBlock([
          status.connected
            ? buttonAction(`refresh_${provider.id}`, '🔄 Refresh')
            : buttonAction(`connect_${provider.id}`, '🔗 Connect', null, 'primary')
        ]),
        dividerBlock()
      ]).flat()
    ]
  });
});
```

### Adding a New Provider (Step-by-Step)

#### Example: Adding Notion Integration

**Step 1: Register the provider**
```typescript
// src/config/oauth-providers.ts
providerRegistry.register({
  id: 'notion',
  name: 'Notion',
  emoji: '📓',
  scopes: [], // Notion uses internal auth
  authUrl: 'https://api.notion.com/v1/oauth/authorize',
  tokenUrl: 'https://api.notion.com/v1/oauth/token',
  services: ['notion']
});
```

**Step 2: Add environment variables**
```env
NOTION_CLIENT_ID=your_client_id
NOTION_CLIENT_SECRET=your_client_secret
NOTION_REDIRECT_URI=https://yourapp.com/auth/notion/callback
```

**Step 3: Create provider-specific service**
```typescript
// src/services/notion/notion.service.ts
export class NotionService {
  async searchPages(query: string, tokens: OAuthTokens) {
    const response = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({ query })
    });
    return response.json();
  }
}
```

**Step 4: Create agent that uses the service**
```typescript
// src/agents/notion.agent.ts
export class NotionAgent extends NaturalLanguageAgent {
  async execute(intent: AgentIntent, context: AgentExecutionContext) {
    const tokens = await oauthManager.getTokensForService(
      context.userId,
      context.teamId,
      'notion'
    );

    if (!tokens) {
      throw new Error('Notion authentication required');
    }

    const notionService = new NotionService();
    const results = await notionService.searchPages(intent.parameters.query, tokens);

    return {
      response: this.formatResults(results),
      metadata: { service: 'notion', provider: 'notion' }
    };
  }
}
```

**Step 5: Register the agent**
```typescript
// src/config/agent-factory-init.ts
AgentFactory.registerAgent('notion', NotionAgent);
```

**That's it!** The system now:
- Shows Notion in `/auth` command
- Detects Notion auth errors automatically
- Generates auth prompts with "Reconnect Notion" button
- Handles OAuth flow through unified callback
- Stores tokens in generic schema

### Benefits of This Architecture

1. **Zero Core Changes**: Adding providers doesn't modify master agent or core logic
2. **Consistent UX**: All providers get same error handling, reconnect flow, and status UI
3. **Type Safety**: Provider registry ensures compile-time checks
4. **Easy Testing**: Mock provider registry for tests
5. **Future-Proof**: Supports any OAuth 2.0 provider (Google, Microsoft, GitHub, Notion, Salesforce, etc.)

### Supported Future Integrations

**Ready to add with this architecture:**
- **Microsoft 365**: Outlook, Teams, OneDrive, SharePoint
- **GitHub**: Repos, Issues, PRs, Actions
- **Notion**: Pages, Databases, Blocks
- **Salesforce**: CRM, Accounts, Opportunities
- **Jira**: Issues, Projects, Sprints
- **Linear**: Issues, Projects, Roadmaps
- **Asana**: Tasks, Projects, Teams
- **Dropbox**: Files, Folders, Sharing
- **Zoom**: Meetings, Recordings, Contacts

Each integration is ~50 lines of config + service-specific logic. The auth management happens automatically.