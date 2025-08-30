# Slack Integration Setup Guide

This guide will help you set up the Slack integration for your AI Assistant app.

## Required Environment Variables

Create a `.env` file in the backend directory with the following variables:

```bash
# Slack Configuration
SLACK_SIGNING_SECRET=your_slack_signing_secret_here
SLACK_BOT_TOKEN=xoxb-your_bot_token_here
SLACK_CLIENT_ID=your_client_id_here
SLACK_CLIENT_SECRET=your_client_secret_here
SLACK_OAUTH_REDIRECT_URI=https://aiassistant-production-5333.up.railway.app/slack/oauth/callback

# Other required variables
NODE_ENV=development
PORT=3000
OPENAI_API_KEY=your_openai_api_key_here
JWT_SECRET=your_jwt_secret_here
```

## Slack App Configuration

### 1. Create a Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App"
3. Choose "From scratch"
4. Enter app name (e.g., "AI Assistant")
5. Select your workspace

### 2. Configure OAuth & Permissions

1. In your app settings, go to "OAuth & Permissions"
2. Add the following Bot Token Scopes:
   - `app_mentions:read` - Read mentions of your app
   - `chat:write` - Send messages as your app
   - `commands` - Add slash commands
   - `im:history` - Read direct message history
   - `im:read` - Read direct messages
   - `im:write` - Send direct messages
   - `users:read` - Read user information
   - `channels:read` - Read channel information

3. Set the Redirect URL to: `https://aiassistant-production-5333.up.railway.app/slack/oauth/callback`

### 3. Configure Event Subscriptions

1. Go to "Event Subscriptions" in your app settings
2. Enable Events: **Turn ON**
3. Set Request URL to: `https://aiassistant-production-5333.up.railway.app/slack/events`
4. Subscribe to the following bot events:
   - `app_mention` - When someone mentions your app
   - `message.im` - Direct messages to your app
   - `team_join` - When new users join the team

### 4. Configure Slash Commands

1. Go to "Slash Commands" in your app settings
2. Create a new command:
   - Command: `/assistant`
   - Request URL: `https://aiassistant-production-5333.up.railway.app/slack/commands`
   - Short Description: "Get AI assistance with any task"
   - Usage Hint: "your request or question"
   - Description: "Ask me anything - I can help with email, calendar, contacts, and more!"

### 5. Configure Interactive Components

1. Go to "Interactive Components" in your app settings
2. Set the Request URL to: `https://aiassistant-production-5333.up.railway.app/slack/interactive`

### 6. Install the App

1. Go to "Install App" in your app settings
2. Click "Install to Workspace"
3. Authorize the app with the requested permissions

## Production URLs

**Base Domain**: `https://aiassistant-production-5333.up.railway.app`

**Slack Integration Endpoints** (Use these in your Slack app settings):
- Event Subscriptions: `https://aiassistant-production-5333.up.railway.app/slack/events`
- Slash Commands: `https://aiassistant-production-5333.up.railway.app/slack/commands`
- Interactive Components: `https://aiassistant-production-5333.up.railway.app/slack/interactive`
- OAuth Redirect: `https://aiassistant-production-5333.up.railway.app/slack/oauth/callback`
- App Installation: `https://aiassistant-production-5333.up.railway.app/slack/install`
- Health Check: `https://aiassistant-production-5333.up.railway.app/slack/health`

**Note**: The Bolt framework internal endpoints (`/slack/bolt/*`) are handled automatically by the application and should not be configured in Slack.

## Testing the Integration

### 1. Check Configuration

Visit `/slack/test-config` in development mode to verify your Slack configuration.

### 2. Test URL Verification

1. In Slack App settings, click "Retry" on the Request URL
2. Check your server logs for the verification challenge
3. The endpoint should respond with the challenge value

### 3. Test Commands

1. In Slack, type `/assistant help`
2. You should receive a response from your bot

### 4. Test Mentions

1. In any channel, mention your bot: `@AI Assistant help`
2. The bot should respond

## Examples of What Users Can Do

### Slash Commands (Any Plain Text Input)
Users can type `/assistant` followed by any request:

- `/assistant check my email` - Check for new emails
- `/assistant schedule a meeting with John tomorrow at 2pm` - Schedule a meeting
- `/assistant find contact info for Sarah Johnson` - Look up contact information
- `/assistant what meetings do I have today?` - Check calendar
- `/assistant send an email to the team about the project update` - Compose and send email
- `/assistant help me organize my tasks` - Get task organization help
- `/assistant what's the weather like?` - Get weather information
- `/assistant summarize my recent emails` - AI-powered email summary
- `/assistant help` - Get help and see available features

### App Mentions
Users can mention the bot in any channel:

- `@AI Assistant can you help me schedule a meeting?`
- `@AI Assistant what's on my calendar for this week?`
- `@AI Assistant find emails from last week about the budget`

### Direct Messages
Users can send direct messages to the bot:

- "Check my email"
- "Schedule a meeting with the marketing team"
- "Who is my contact for Acme Corp?"
- "Help me organize my day"

## Troubleshooting

### URL Verification Fails

- Check that your server is running and accessible
- Verify the Request URL is exactly: `https://your-domain.com/slack/events`
- Check server logs for errors
- Ensure all environment variables are set correctly

### Bot Not Responding

- Check that the bot token is correct
- Verify the bot is installed to your workspace
- Check server logs for authentication errors
- Ensure the bot has the required scopes

### Events Not Received

- Verify Event Subscriptions are enabled
- Check that the Request URL is correct
- Ensure the bot is subscribed to the right events
- Check server logs for incoming events

## Architecture Overview

The Slack integration uses a dual-endpoint approach:

1. **Main Endpoints** (`/slack/*`):
   - `/slack/events` - Handles URL verification and forwards events
   - `/slack/oauth/callback` - OAuth flow
   - `/slack/install` - Installation page

2. **Bolt Framework Endpoints** (`/slack/bolt/*`):
   - `/slack/bolt/events` - Processes actual events
   - `/slack/bolt/commands` - Handles slash commands
   - `/slack/bolt/interactive` - Handles button clicks, modals

This separation ensures that Slack can verify the main endpoint while the Bolt framework handles the actual event processing.

## Security Notes

- Never commit your `.env` file to version control
- Keep your signing secret and bot token secure
- Use HTTPS in production
- Validate all incoming requests using the signing secret
- Implement proper rate limiting

## Next Steps

Once the basic integration is working:

1. Customize the bot's responses and behavior
2. Add more sophisticated event handling
3. Implement user authentication and session management
4. Add error handling and monitoring
5. Set up production deployment
