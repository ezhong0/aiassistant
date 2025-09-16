# 🔌 Slack Integration

Complete guide for integrating the AI Assistant Platform with Slack workspaces.

## 🎯 **Overview**

The Slack integration provides a natural language interface for the AI Assistant Platform, allowing users to interact with Gmail, Calendar, and Contacts through Slack commands and mentions.

### **Key Features**
- **Natural Language Commands** - "Send an email to John about the meeting"
- **OAuth Integration** - Secure Google Workspace access through Slack
- **Confirmation Workflows** - AI-powered risk assessment for actions
- **Message History** - Context-aware responses based on conversation
- **Multi-Channel Support** - Works in channels and direct messages

## 🚀 **Quick Setup**

### **1. Create Slack App**

1. Go to [Slack API](https://api.slack.com/apps)
2. Click "Create New App"
3. Choose "From scratch"
4. Enter app name: "AI Assistant"
5. Select your workspace

### **2. Configure Bot Permissions**

Go to "OAuth & Permissions" and add these Bot Token Scopes:

**Required Scopes:**
- `app_mentions:read` - Read mentions
- `channels:history` - Read channel messages
- `chat:write` - Send messages
- `im:history` - Read direct messages
- `im:read` - Access direct message metadata
- `im:write` - Send direct messages

**Optional Scopes:**
- `users:read` - Read user information
- `team:read` - Read team information
- `files:read` - Read file information

### **3. Install App**

1. Click "Install to Workspace"
2. Authorize the app
3. Copy the Bot User OAuth Token
4. Copy the Signing Secret from "Basic Information"

### **4. Configure Environment Variables**

Add to your `.env` file:

```bash
# Slack Configuration
SLACK_SIGNING_SECRET=your-slack-signing-secret
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_OAUTH_REDIRECT_URI=http://localhost:3000/auth/slack/callback
```

## 🔧 **Advanced Configuration**

### **Event Subscriptions**

1. Go to "Event Subscriptions"
2. Enable Events
3. Set Request URL: `https://yourdomain.com/slack/events`
4. Subscribe to Bot Events:
   - `app_mention`
   - `message.channels`
   - `message.im`

### **Interactive Components**

1. Go to "Interactive Components"
2. Enable Interactivity
3. Set Request URL: `https://yourdomain.com/slack/interactive`

### **Slash Commands**

1. Go to "Slash Commands"
2. Create New Command
3. Command: `/assistant`
4. Request URL: `https://yourdomain.com/slack/commands`
5. Short Description: "AI Assistant commands"

## 🎯 **Usage Examples**

### **Basic Commands**

```
# Send an email
@assistant send an email to john@example.com about the meeting

# Create calendar event
@assistant schedule a meeting with John tomorrow at 2pm

# Search contacts
@assistant find John's email address

# Check calendar
@assistant what's on my calendar today?
```

### **Advanced Workflows**

```
# Multi-step workflow
@assistant send an email to John about the meeting and schedule a follow-up for next week

# Context-aware responses
@assistant reply to the last email from John

# Confirmation workflows
@assistant send an email to the entire team about the project update
# Bot: I'm about to send an email to 15 people. Would you like me to proceed?
# User: yes
```

## 🔐 **OAuth Integration**

### **Google OAuth Flow**

The Slack integration includes a seamless Google OAuth flow:

1. **User requests email/calendar action**
2. **Bot detects missing OAuth**
3. **Bot provides OAuth link**
4. **User completes Google OAuth**
5. **Bot stores tokens securely**
6. **Bot executes requested action**

### **OAuth URL Generation**

```typescript
// OAuth URL includes Slack context
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirectUri,
  scope: scopes,
  state: JSON.stringify({
    source: 'slack',
    team_id: slackContext.teamId,
    user_id: slackContext.userId,
    channel_id: slackContext.channelId
  }),
  response_type: 'code',
  access_type: 'offline',
  prompt: 'consent'
});
```

### **Token Storage**

OAuth tokens are stored securely with Slack context:

```typescript
const userId = `${slackContext.team_id}:${slackContext.user_id}`;
await tokenStorageService.storeUserTokens(userId, {
  google: {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(tokens.expiry_date),
    scope: tokens.scope
  },
  slack: {
    team_id: slackContext.team_id,
    user_id: slackContext.user_id
  }
});
```

## 🧠 **AI-Powered Features**

### **Natural Language Processing**

The Slack integration uses OpenAI GPT-4o-mini for:

- **Intent Recognition** - Understanding user requests
- **Entity Extraction** - Identifying people, dates, times
- **Context Awareness** - Using conversation history
- **Confirmation Generation** - AI-powered risk assessment

### **Confirmation Workflows**

```typescript
// AI determines if action needs confirmation
const needsConfirmation = await aiClassificationService.operationRequiresConfirmation(
  userQuery,
  selectedAgent
);

if (needsConfirmation) {
  const confirmationMessage = await generateDynamicConfirmationMessage(
    toolCalls,
    previewResults,
    userQuery
  );
  
  await sendMessage(channelId, {
    text: confirmationMessage,
    blocks: confirmationBlocks
  });
}
```

### **Context Gathering**

The Slack integration includes sophisticated context gathering:

```typescript
// Read recent message history
const recentMessages = await slackMessageReaderService.readRecentMessages(
  channelId,
  { limit: 10, includeReactions: true }
);

// Analyze conversation context
const context = await analyzeConversationContext(recentMessages);

// Use context in AI processing
const enhancedPrompt = buildSystemPromptWithContext(context);
```

## 🔧 **Development**

### **Local Development**

1. **Install ngrok** for local tunneling:
   ```bash
   npm install -g ngrok
   ngrok http 3000
   ```

2. **Update Slack URLs** to use ngrok URL:
   - Event Subscriptions: `https://your-ngrok-url.ngrok.io/slack/events`
   - Interactive Components: `https://your-ngrok-url.ngrok.io/slack/interactive`

3. **Test locally**:
   ```bash
   npm run dev
   ```

### **Testing Slack Integration**

```bash
# Test Slack event endpoint
curl -X POST http://localhost:3000/slack/events \
  -H "Content-Type: application/json" \
  -H "X-Slack-Signature: your-signature" \
  -H "X-Slack-Request-Timestamp: $(date +%s)" \
  -d '{"type": "url_verification", "challenge": "test"}'

# Test bot token
curl -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  https://slack.com/api/auth.test
```

### **Slack Interface Service**

The `SlackInterfaceService` handles all Slack interactions:

```typescript
export class SlackInterfaceService extends BaseService {
  // Event processing
  async handleSlackEvent(event: SlackEvent): Promise<void>
  
  // Message sending
  async sendMessage(channelId: string, message: SlackMessage): Promise<void>
  
  // OAuth handling
  async handleOAuthCallback(code: string, state: string): Promise<void>
  
  // Context gathering
  async gatherSlackContext(channelId: string): Promise<SlackContext>
}
```

## 📊 **Monitoring & Analytics**

### **Slack-Specific Metrics**

- **Message Processing Time** - How long requests take
- **OAuth Success Rate** - OAuth completion rate
- **Confirmation Rate** - How often confirmations are needed
- **Error Rates** - Failed requests and their causes

### **Health Monitoring**

```bash
# Check Slack service health
curl http://localhost:3000/health | jq '.services.slack'

# Test Slack API connectivity
curl -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  https://slack.com/api/auth.test
```

### **Logging**

Slack-specific logging includes:

```typescript
logger.info('Slack event processed', {
  eventType: event.type,
  channelId: event.channel,
  userId: event.user,
  teamId: event.team,
  processingTime: Date.now() - startTime
});
```

## 🚨 **Troubleshooting**

### **Common Issues**

#### **Bot Not Responding**

1. **Check Bot Token**:
   ```bash
   curl -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
     https://slack.com/api/auth.test
   ```

2. **Verify Event Subscriptions**:
   - Check Request URL is accessible
   - Ensure bot is subscribed to correct events
   - Verify signing secret

3. **Check Bot Permissions**:
   ```bash
   curl -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
     https://slack.com/api/auth.test | jq '.scopes'
   ```

#### **OAuth Issues**

1. **Check OAuth Configuration**:
   ```bash
   curl http://localhost:3000/auth/debug/oauth-config
   ```

2. **Verify Redirect URI**:
   - Must match exactly in Google Cloud Console
   - Include Slack context in state parameter

3. **Test Token Exchange**:
   ```bash
   curl "http://localhost:3000/auth/debug/test-token-exchange?code=CODE"
   ```

#### **Message Processing Errors**

1. **Check Event Processing**:
   ```bash
   # Enable debug logging
   LOG_LEVEL=debug npm run dev
   
   # Check logs for Slack events
   tail -f logs/combined-$(date +%Y-%m-%d).log | grep "Slack"
   ```

2. **Verify Message Format**:
   - Check Slack message structure
   - Ensure proper JSON formatting
   - Validate required fields

### **Debug Endpoints**

```bash
# Test Slack configuration
curl http://localhost:3000/auth/debug/current-config | jq '.slack'

# Test OAuth URL generation
curl http://localhost:3000/auth/debug/test-oauth-url

# Test token validation
curl -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  https://slack.com/api/auth.test
```

## 🔒 **Security Considerations**

### **Slack Security**

1. **Signing Secret Validation**:
   ```typescript
   const signature = req.headers['x-slack-signature'];
   const timestamp = req.headers['x-slack-request-timestamp'];
   const isValid = validateSlackSignature(signature, timestamp, body);
   ```

2. **Token Security**:
   - Store tokens encrypted
   - Use secure token refresh
   - Implement token expiration

3. **Rate Limiting**:
   - Implement per-user rate limiting
   - Monitor for abuse patterns
   - Set appropriate limits

### **OAuth Security**

1. **State Parameter Validation**:
   ```typescript
   const state = JSON.parse(stateParam);
   if (state.source !== 'slack') {
     throw new Error('Invalid OAuth state');
   }
   ```

2. **Token Storage**:
   - Encrypt sensitive tokens
   - Use secure storage mechanisms
   - Implement proper access controls

## 📚 **Next Steps**

After setting up Slack integration:

1. **[Google Workspace Integration](./google-workspace.md)** - Complete Gmail/Calendar setup
2. **[Production Deployment](./production-deployment.md)** - Deploy to production
3. **[Monitoring & Logging](./monitoring-logging.md)** - Set up observability
4. **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions

---

**💬 Your AI Assistant Platform is now integrated with Slack, providing natural language access to Gmail, Calendar, and Contacts!**
