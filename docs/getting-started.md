# 🚀 Quick Start Guide

Get your AI Assistant Platform running in **5 minutes** with this streamlined setup guide.

## 📋 **Prerequisites**

Before you begin, ensure you have:

- **Node.js** 18.x or higher ([Download](https://nodejs.org/))
- **Git** for cloning the repository
- **Google Cloud Console** account ([Sign up](https://console.cloud.google.com/))
- **OpenAI API Key** ([Get one](https://platform.openai.com/api-keys))
- **Slack Developer Account** ([Create app](https://api.slack.com/apps))

## ⚡ **5-Minute Setup**

### **Step 1: Clone and Install (1 minute)**

```bash
# Clone the repository
git clone <your-repository-url>
cd assistantapp

# Install dependencies
cd backend
npm install
```

### **Step 2: Environment Configuration (2 minutes)**

```bash
# Copy the example environment file
cp .env.example .env

# Edit the environment file
nano .env  # or use your preferred editor
```

**Required Environment Variables:**
```bash
# Core Configuration
NODE_ENV=development
PORT=3000
BASE_URL=http://localhost:3000

# JWT Security (generate a random string)
JWT_SECRET=your-super-secret-jwt-key-here

# OpenAI Integration
OPENAI_API_KEY=sk-your-openai-api-key-here

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# Slack Integration (optional for initial setup)
SLACK_SIGNING_SECRET=your-slack-signing-secret
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
```

### **Step 3: Start the Server (1 minute)**

```bash
# Start the development server
npm run dev
```

You should see output like:
```
✅ All services initialized successfully
🚀 Server started successfully on port 3000
```

### **Step 4: Verify Installation (1 minute)**

Open your browser and visit:
- **Health Check**: http://localhost:3000/health
- **API Status**: http://localhost:3000/api/assistant/status

You should see JSON responses confirming the system is running.

## 🎯 **First Integration Test**

### **Test Google OAuth**

1. Visit: http://localhost:3000/auth/google
2. Complete the Google OAuth flow
3. You should be redirected back with authentication tokens

### **Test AI Assistant**

```bash
# Test the assistant endpoint
curl -X POST http://localhost:3000/api/assistant/text-command \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "command": "Hello, can you help me?",
    "sessionId": "test-session-123"
  }'
```

## 🔧 **Google Cloud Console Setup**

### **1. Create a New Project**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "New Project"
3. Enter project name: "AI Assistant Platform"
4. Click "Create"

### **2. Enable Required APIs**
1. Go to "APIs & Services" > "Library"
2. Enable these APIs:
   - **Gmail API**
   - **Google Calendar API**
   - **People API** (for contacts)
   - **Google+ API** (for user info)

### **3. Create OAuth Credentials**
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Choose "Web application"
4. Add authorized redirect URI: `http://localhost:3000/auth/callback`
5. Copy the Client ID and Client Secret to your `.env` file

## 🤖 **OpenAI Setup**

### **1. Get API Key**
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign in or create account
3. Go to "API Keys"
4. Click "Create new secret key"
5. Copy the key to your `.env` file

### **2. Add Billing**
1. Go to "Billing" in OpenAI dashboard
2. Add a payment method
3. Set usage limits (recommended: $10-20/month for development)

## 💬 **Slack Setup (Optional)**

### **1. Create Slack App**
1. Go to [Slack API](https://api.slack.com/apps)
2. Click "Create New App"
3. Choose "From scratch"
4. Enter app name: "AI Assistant"
5. Select your workspace

### **2. Configure Bot Permissions**
1. Go to "OAuth & Permissions"
2. Add these Bot Token Scopes:
   - `app_mentions:read`
   - `channels:history`
   - `chat:write`
   - `im:history`
   - `im:read`
   - `im:write`

### **3. Install App**
1. Click "Install to Workspace"
2. Copy the Bot User OAuth Token to your `.env` file
3. Copy the Signing Secret to your `.env` file

## 🧪 **Testing Your Setup**

### **Run Basic Tests**

```bash
# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run all tests
npm test
```

### **Test API Endpoints**

```bash
# Health check
curl http://localhost:3000/health

# Assistant status
curl http://localhost:3000/api/assistant/status

# Test authentication
curl http://localhost:3000/auth/validate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🚨 **Troubleshooting**

### **Common Issues**

**Port Already in Use:**
```bash
# Find and kill process using port 3000
lsof -ti:3000 | xargs kill -9
```

**Environment Variables Not Loading:**
```bash
# Check if .env file exists and has correct format
cat .env | grep -v "^#" | grep -v "^$"
```

**Google OAuth Errors:**
- Verify redirect URI matches exactly: `http://localhost:3000/auth/callback`
- Check that APIs are enabled in Google Cloud Console
- Ensure client ID and secret are correct

**OpenAI API Errors:**
- Verify API key is valid and has billing enabled
- Check usage limits in OpenAI dashboard
- Ensure model access permissions

### **Debug Mode**

```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# Check service health
curl http://localhost:3000/health | jq
```

## 🎉 **Next Steps**

Congratulations! Your AI Assistant Platform is now running. Here's what to do next:

1. **[Environment Setup](./environment-setup.md)** - Complete configuration guide
2. **[First Integration](./first-integration.md)** - Connect Slack and test workflows
3. **[System Architecture](./architecture.md)** - Understand the technical foundation
4. **[Agent Development](./agent-development.md)** - Build custom AI agents

## 📞 **Need Help?**

- **Setup Issues**: Check the [Troubleshooting Guide](./troubleshooting.md)
- **Configuration Help**: See [Environment Setup](./environment-setup.md)
- **Integration Questions**: Review [First Integration](./first-integration.md)
- **Technical Details**: Explore [System Architecture](./architecture.md)

---

**🎯 Ready to build something amazing? Let's dive deeper into the platform!**
