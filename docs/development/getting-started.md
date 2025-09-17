# Getting Started

Welcome to the AI Assistant Platform! This guide will help you get up and running quickly with the platform's powerful AI-first multi-agent system.

## 🚀 **Quick Start (5 minutes)**

### **1. Prerequisites**

Before you begin, ensure you have:

- **Node.js** 18+ installed
- **npm** or **yarn** package manager
- **Git** for version control
- **PostgreSQL** database (optional for development)
- **Redis** cache (optional for development)

### **2. Clone and Setup**

```bash
# Clone the repository
git clone <repository-url>
cd assistantapp

# Navigate to backend
cd backend

# Run the automated setup script
chmod +x scripts/setup.sh
./scripts/setup.sh
```

The setup script will:
- Install all dependencies
- Generate a secure JWT secret
- Create a `.env` file with default configuration
- Generate setup instructions

### **3. Configure API Keys**

Edit the `.env` file with your API keys:

```bash
# Required: OpenAI API Key
OPENAI_API_KEY=sk-your-openai-api-key

# Required for production: Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Optional: Slack Integration
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_SIGNING_SECRET=your-slack-signing-secret
```

### **4. Start the Application**

```bash
# Start in development mode
npm run dev

# Or start in production mode
npm run build
npm start
```

### **5. Test the Setup**

```bash
# Test the health endpoint
curl http://localhost:3000/health

# Expected response:
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

## 🔑 **API Key Setup**

### **OpenAI API Key (Required)**

1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new API key
3. Add to `.env`: `OPENAI_API_KEY=sk-...`

### **Google OAuth (Required for Production)**

1. Go to [Google Cloud Console](https://console.developers.google.com/)
2. Create a new project or select existing
3. Enable APIs:
   - Gmail API
   - Google Calendar API
   - Google Contacts API
4. Create OAuth 2.0 credentials
5. Add to `.env`:
   ```
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
   ```

### **Slack Integration (Optional)**

1. Go to [Slack API](https://api.slack.com/apps)
2. Create a new app
3. Add bot token scopes:
   - `chat:write`
   - `channels:read`
   - `users:read`
4. Add to `.env`:
   ```
   SLACK_BOT_TOKEN=xoxb-...
   SLACK_SIGNING_SECRET=...
   SLACK_CLIENT_ID=...
   SLACK_CLIENT_SECRET=...
   ```

## 🧪 **Testing the Platform**

### **Basic Functionality Test**

```bash
# Test email search (requires Google OAuth)
curl -X POST http://localhost:3000/assistant/text-command \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "command": "find me recent emails",
    "sessionId": "test-session-123"
  }'
```

### **Calendar Integration Test**

```bash
# Test calendar event creation
curl -X POST http://localhost:3000/assistant/text-command \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "command": "schedule a meeting tomorrow at 2pm",
    "sessionId": "test-session-123"
  }'
```

### **Slack Integration Test**

```bash
# Test Slack message reading
curl -X POST http://localhost:3000/assistant/text-command \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "command": "what did we discuss in the last meeting?",
    "sessionId": "test-session-123",
    "context": {
      "slack": {
        "channelId": "C1234567890",
        "teamId": "T1234567890"
      }
    }
  }'
```

## 📚 **Understanding the Platform**

### **Architecture Overview**

The AI Assistant Platform is built on a **service-oriented architecture** with:

- **26+ Services** managed by dependency injection
- **Multi-Agent System** with specialized AI agents
- **Intelligent Caching** with Redis-backed performance optimization
- **Enterprise Security** with comprehensive validation and rate limiting

### **Key Components**

1. **Master Agent**: Central orchestrator that coordinates all operations
2. **Email Agent**: Handles Gmail operations and email management
3. **Calendar Agent**: Manages Google Calendar events and scheduling
4. **Contact Agent**: Resolves contacts and manages contact information
5. **Slack Agent**: Integrates with Slack for context gathering
6. **Cache Services**: Optimize performance with intelligent caching

### **AI-First Design**

The platform uses **OpenAI GPT-4o-mini** for:
- Intent classification and understanding
- Tool call generation and validation
- Result synthesis and natural language responses
- Context detection and gathering

## 🔧 **Development Workflow**

### **Local Development**

```bash
# Start development server with hot reload
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Build for production
npm run build
```

### **Database Setup (Optional)**

```bash
# Setup PostgreSQL database
npm run setup:database

# Run migrations
npm run migrate

# Seed test data
npm run seed
```

### **Redis Setup (Optional)**

```bash
# Start Redis locally
redis-server

# Test Redis connection
npm run test:redis
```

## 🚀 **Deployment**

### **Railway Deployment**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Deploy to Railway
railway up
```

### **Environment Variables**

Set these environment variables in Railway:

```bash
# Core configuration
NODE_ENV=production
PORT=3000
JWT_SECRET=your-secure-jwt-secret

# API keys
OPENAI_API_KEY=sk-...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Database (Railway provides this)
DATABASE_URL=postgresql://...

# Redis (Railway provides this)
REDIS_URL=redis://...
```

## 📊 **Monitoring and Health**

### **Health Endpoints**

- **Overall Health**: `GET /health`
- **Service Health**: `GET /health/service/{serviceName}`
- **Dependencies**: `GET /health/dependencies`

### **Performance Metrics**

- **Response Time**: <500ms average
- **Cache Hit Rate**: 70-90% for external APIs
- **AI Planning**: <2s for complex operations
- **Memory Usage**: Optimized with service lifecycle management

## 🆘 **Troubleshooting**

### **Common Issues**

**1. OpenAI API Key Issues**
```bash
# Check if API key is set
echo $OPENAI_API_KEY

# Test API key
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models
```

**2. Database Connection Issues**
```bash
# Test database connection
npm run test:database

# Check database URL
echo $DATABASE_URL
```

**3. Redis Connection Issues**
```bash
# Test Redis connection
npm run test:redis

# Check Redis URL
echo $REDIS_URL
```

**4. Port Already in Use**
```bash
# Change port in .env
PORT=3001

# Or kill process using port 3000
lsof -ti:3000 | xargs kill -9
```

### **Logs and Debugging**

```bash
# View application logs
npm run logs

# Debug mode
DEBUG=* npm run dev

# Check service status
curl http://localhost:3000/health
```

## 📖 **Next Steps**

1. **Explore the API**: Check out the [API Reference](./api/rest-api.md)
2. **Understand Agents**: Learn about [Agent Architecture](./architecture/ai-agent-system.md)
3. **Set up Testing**: Follow the [Testing Guide](./testing/testing-strategy.md)
4. **Deploy to Production**: Use the [Deployment Guide](./deployment/production-deployment.md)
5. **Contribute**: Read the [Contributing Guide](./development/contributing.md)

## 🎯 **Key Features to Try**

- **Email Management**: "Send email to john@company.com about project update"
- **Calendar Scheduling**: "Schedule a meeting tomorrow at 2pm with the team"
- **Contact Resolution**: "Find contact information for Sarah"
- **Slack Integration**: "What did we discuss in the last meeting?"
- **Complex Workflows**: "Send a follow-up email about yesterday's meeting and schedule a follow-up call"

---

**Need Help?** Check the [Troubleshooting Guide](./deployment/troubleshooting.md) or [API Reference](./api/rest-api.md) for more detailed information.
