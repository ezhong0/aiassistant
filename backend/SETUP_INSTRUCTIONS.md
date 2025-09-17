# 🚀 Assistant App Setup Instructions

## Quick Start (2 minutes)

1. **Fill in your API keys** in `.env`:
   ```bash
   # Edit the .env file with your API keys
   nano .env
   ```

2. **Start the application**:
   ```bash
   npm run dev
   ```

3. **Test the setup**:
   ```bash
   curl http://localhost:3000/health
   ```

## Required API Keys

### 1. OpenAI API Key (Required)
- Go to: https://platform.openai.com/api-keys
- Create a new API key
- Add to `.env`: `OPENAI_API_KEY=sk-...`

### 2. Google OAuth (Required for production)
- Go to: https://console.developers.google.com/
- Create a new project or select existing
- Enable Gmail API and Google Calendar API
- Create OAuth 2.0 credentials
- Add to `.env`:
  ```
  GOOGLE_CLIENT_ID=your_client_id
  GOOGLE_CLIENT_SECRET=your_client_secret
  ```

### 3. Slack Integration (Optional)
- Go to: https://api.slack.com/apps
- Create a new app
- Add bot token scopes: `chat:write`, `channels:read`, `users:read`
- Add to `.env`:
  ```
  SLACK_BOT_TOKEN=xoxb-...
  SLACK_SIGNING_SECRET=...
  SLACK_CLIENT_ID=...
  SLACK_CLIENT_SECRET=...
  ```

## Verification

Run the health check to verify everything works:
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "database": "healthy",
    "cache": "healthy",
    "openai": "configured"
  }
}
```

## Next Steps

1. **Test email functionality**: Try sending a test email
2. **Test calendar integration**: Try creating a calendar event
3. **Deploy to Railway**: Run `railway up` when ready

## Troubleshooting

- **Port 3000 in use**: Change `PORT=3001` in `.env`
- **Database errors**: The app works without a database in development
- **API key errors**: Check your API keys are valid and have proper permissions
