# 🚀 AI Assistant Slack Integration Setup Guide

## Quick Start (10 Minutes)

```bash
# 1. Deploy to Railway (get permanent URLs)
railway login && railway init && railway up

# 2. Set environment variables
railway variables set SLACK_BOT_TOKEN="xoxb-your-token"

# 3. Copy Railway URLs to your Slack App (ONCE!)
# 4. Install to your workspace
# 5. Test with /assistant or @AI Assistant
```

---

## 📋 Complete Setup Checklist

### ✅ Phase 1: Backend Setup (Already Done)
- [x] Slack SDK installed
- [x] Services created and registered  
- [x] Environment configuration ready
- [x] Railway deployment configured

### 🔧 Phase 2: Slack App Creation (5 minutes)

#### 1. Create Slack App
1. Go to https://api.slack.com/apps
2. Click **"Create New App"** → **"From scratch"**
3. App Name: `AI Assistant`
4. Choose your development workspace
5. Click **"Create App"**

#### 2. Configure Bot Token Scopes
Go to **OAuth & Permissions** → **Scopes** → **Bot Token Scopes**

Add these scopes:
```
app_mentions:read    # Read @mentions
chat:write          # Send messages
commands            # Handle slash commands  
im:history          # Read DM history
im:read             # Read DMs
im:write            # Send DMs
users:read          # Get user info
channels:read       # Get channel info
```

#### 3. Configure Event Subscriptions
Go to **Event Subscriptions**:

1. **Enable Events**: Toggle **ON**
2. **Request URL**: `https://yourapp.railway.app/slack/events`
   - ✅ URL will auto-verify when your app is deployed
3. **Subscribe to bot events**:
   - `app_mention` - When users @mention the bot
   - `message.im` - Direct messages to the bot

#### 4. Create Slash Command
Go to **Slash Commands** → **Create New Command**:

- **Command**: `/assistant`
- **Request URL**: `https://yourapp.railway.app/slack/commands`
- **Short Description**: `Chat with your AI Assistant`
- **Usage Hint**: `help | check email | schedule meeting`

#### 5. Configure Interactivity  
Go to **Interactivity & Shortcuts**:

1. **Interactivity**: Toggle **ON**
2. **Request URL**: `https://yourapp.railway.app/slack/interactive`

#### 6. App Home Settings
Go to **App Home**:

1. **Home Tab**: Toggle **ON**
2. **Messages Tab**: Toggle **ON** 
3. **Allow users to send Slash commands and messages**: ✅ **Check this**

---

### 🌍 Phase 3: Environment Setup (2 minutes)

#### 1. Copy Slack Credentials

From your Slack App settings, copy these values to your `.env` file:

```bash
# From "Basic Information" → "App Credentials"
SLACK_SIGNING_SECRET=your_signing_secret_here
SLACK_CLIENT_ID=your_client_id_here  
SLACK_CLIENT_SECRET=your_client_secret_here

# From "OAuth & Permissions" → "OAuth Tokens for Your Workspace"
SLACK_BOT_TOKEN=xoxb-your-bot-token-here

# Your OAuth callback URL
SLACK_OAUTH_REDIRECT_URI=https://yourapp.railway.app/slack/oauth/callback

# Required for JWT tokens (min 32 characters)
JWT_SECRET=your-super-secret-jwt-key-at-least-32-chars-long
```

#### 2. Get Your Slack Credentials

**Signing Secret** (Basic Information → App Credentials):
```
abcdef123456789...
```

**Bot Token** (OAuth & Permissions → OAuth Tokens):
```  
xoxb-your-workspace-bot-token-here
```

**Client ID & Secret** (Basic Information → App Credentials):
```
Client ID: 1234567890.1234567890
Client Secret: abcdefghijklmnopqrstuvwxyz123456
```

---

### 🚀 Phase 4: Railway Deployment

#### Deploy to Railway (One-Time Setup)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up

# Set environment variables
railway variables set NODE_ENV=production
railway variables set SLACK_BOT_TOKEN="xoxb-your-token"
# ... (add all other env vars)

# Get your permanent URL
railway domain
# Returns: https://yourapp.railway.app
```

#### Your Permanent Slack URLs (Set Once!)
Replace `yourapp` with your actual Railway subdomain:
```
📋 Update your Slack App with these PERMANENT URLs:
────────────────────────────────────────────────────────────
🔗 Event Subscriptions Request URL:
   https://yourapp.railway.app/slack/events

⚡ Slash Commands Request URL:
   https://yourapp.railway.app/slack/commands

🎯 Interactivity Request URL:
   https://yourapp.railway.app/slack/interactive

🔐 OAuth Redirect URL:
   https://yourapp.railway.app/slack/oauth/callback
```

**✅ These URLs NEVER change - set them once and you're done!**

---

### 🏠 Phase 5: Install to Workspace

#### Option 1: Auto-Install Page
Visit: `https://yourapp.railway.app/slack/install`

#### Option 2: Manual Install  
1. Go to **OAuth & Permissions** in your Slack App
2. Click **"Install to Workspace"**
3. Authorize the permissions

---

### 🧪 Phase 6: Testing

#### Test Slash Command
```
/assistant help
/assistant check my email
/assistant schedule meeting with John tomorrow at 2pm
```

#### Test App Mentions
```
@AI Assistant what's on my calendar today?
@AI Assistant help me find John's contact info
```

#### Test Direct Messages
DM the bot directly:
```
Hello! Can you check my inbox?
Schedule a meeting with the team
```

---

## 🔧 Development Commands

```bash
# Local development
npm run dev

# Deploy to Railway
railway up

# View Railway logs
railway logs

# Set environment variables
railway variables set KEY=value

# Open Railway dashboard
railway open
```

---

## 📁 What I Created For You

### New Files Added:
```
backend/
├── src/
│   ├── types/slack.types.ts           # TypeScript interfaces
│   ├── services/
│   │   ├── slack.service.ts           # Main Slack integration
│   │   └── slack-formatter.service.ts # Block Kit formatting
│   └── routes/slack.routes.ts         # OAuth & webhook routes
└── RAILWAY_DEPLOYMENT.md              # Complete Railway setup guide
```

### Updated Files:
```
backend/
├── src/
│   ├── config/environment.ts          # Added Slack env vars
│   ├── services/service-initialization.ts # Registered Slack services
│   └── index.ts                       # Added Slack routes
├── package.json                       # Added Railway deployment script
├── railway.toml                       # Railway configuration
├── nixpacks.toml                      # Build configuration
└── .env.example                       # Added Slack configuration
```

---

## 🎯 Next Steps After Setup

### Immediate (Day 1):
1. ✅ Deploy to Railway
2. ✅ Set Slack URLs in app settings (once!)
3. ✅ Test basic bot responses

### Week 1: Core Integration
- [ ] Connect Slack events to your MasterAgent
- [ ] Implement email checking via Slack
- [ ] Add calendar integration
- [ ] Test contact lookup

### Week 2: Polish
- [ ] Improve message formatting with Block Kit
- [ ] Add interactive buttons
- [ ] Implement error handling
- [ ] Add user onboarding flow

### Week 3: Launch Prep
- [ ] Fix Slack TypeScript integration issues
- [ ] App Directory submission prep
- [ ] Beta user recruitment
- [ ] Usage analytics implementation

---

## 🆘 Troubleshooting

### Common Issues:

#### ❌ "URL Verification Failed"
- ✅ Ensure your app is deployed: `railway logs`
- ✅ Check Railway app is accessible
- ✅ Verify Slack signing secret in Railway variables

#### ❌ "Bot doesn't respond"
- ✅ Check bot token is correct (`xoxb-...`)
- ✅ Verify event subscriptions are enabled
- ✅ Check Railway logs for errors: `railway logs`

#### ❌ "Deploy failed"  
- ✅ Check build logs: `railway logs --deployment`
- ✅ Verify environment variables are set
- ✅ Ensure health check endpoint `/health` works

#### ❌ "Missing permissions"
- ✅ Verify all bot scopes are added
- ✅ Reinstall app to workspace

### Getting Help:
1. Check Railway logs: `railway logs` for detailed error info
2. Check Slack App Event History: Shows webhook delivery status
3. Test endpoints directly: Visit `https://yourapp.railway.app/slack/health`

---

## 🚀 Production Deployment

**You're already in production with Railway!**

Ready for Slack App Directory:

1. ✅ **Production URLs**: Already configured with Railway
2. ✅ **SSL certificates**: Auto-configured by Railway  
3. ✅ **Environment variables**: Set via Railway dashboard
4. ✅ **Custom domain**: Optional with `railway domain add`
5. ✅ **Submit to Slack App Directory**: URLs never change!

---

## 📊 Success Metrics to Track

- [ ] Webhook response times < 3 seconds
- [ ] Bot response accuracy > 90%
- [ ] Daily active users growth
- [ ] User retention after 7 days
- [ ] Feature usage analytics

---

**🎉 You're ready to build the next great Slack AI assistant!**

Questions? Check the troubleshooting section above or review the Slack API documentation at https://api.slack.com/