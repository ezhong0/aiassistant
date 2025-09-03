# 🚀 Deployment Guide - AI Development Guide

## 🎯 **Deployment Overview**

This document provides comprehensive deployment instructions for the AI Assistant Platform, covering development, staging, and production environments with PostgreSQL integration and Slack bot deployment.

## 🏗️ **Architecture Overview**

### **Deployment Architecture**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Slack App     │    │  Backend API    │    │ PostgreSQL      │
│   Directory     │◄──►│   (Railway)     │◄──►│   Database      │
│                 │    │                 │    │   (Railway)     │
│ • Distribution  │    │ • Express       │    │ • Sessions      │
│ • OAuth Flow    │    │ • TypeScript    │    │ • OAuth Tokens  │
│ • Event Sub     │    │ • Multi-Agent   │    │ • Slack Data    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **Environment Types**
- **Development**: Local development with local PostgreSQL
- **Staging**: Railway deployment with staging database
- **Production**: Railway deployment with production database

## 🔧 **Environment Configuration**

### **Required Environment Variables**

#### **Core Configuration**
```bash
# Application
NODE_ENV=production
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-here

# Database
DATABASE_URL=postgresql://username:password@host:5432/database

# Note: See docs/POSTGRESQL_INTEGRATION.md for detailed database setup and configuration

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# Slack Configuration
SLACK_SIGNING_SECRET=your-slack-signing-secret
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_OAUTH_REDIRECT_URI=https://your-domain.railway.app/slack/oauth/callback

# Note: See docs/OAUTH_FLOW_FIXES.md and docs/OAUTH_PERSISTENCE_FIX.md 
# for detailed OAuth implementation and troubleshooting
```

#### **Optional Configuration**
```bash
# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Timeouts
REQUEST_TIMEOUT_MS=30000
TOOL_EXECUTION_TIMEOUT_MS=60000

# Session Management
SESSION_TIMEOUT_MINUTES=30
MAX_CONVERSATION_HISTORY=50
```

### **Environment-Specific Configuration**

#### **Development Environment**
```bash
# .env.local
NODE_ENV=development
DATABASE_URL=postgresql://localhost:5432/assistantapp_dev
SLACK_OAUTH_REDIRECT_URI=http://localhost:3000/slack/oauth/callback
LOG_LEVEL=debug
```

#### **Staging Environment**
```bash
# Railway environment variables
NODE_ENV=staging
DATABASE_URL=postgresql://staging-db-url
SLACK_OAUTH_REDIRECT_URI=https://staging-app.railway.app/slack/oauth/callback
LOG_LEVEL=info
```

#### **Production Environment**
```bash
# Railway environment variables
NODE_ENV=production
DATABASE_URL=postgresql://production-db-url
SLACK_OAUTH_REDIRECT_URI=https://production-app.railway.app/slack/oauth/callback
LOG_LEVEL=warn
```

## 🚀 **Railway Deployment**

### **1. Railway Setup**

#### **Create Railway Account**
1. Go to [Railway](https://railway.app)
2. Sign up with GitHub account
3. Create new project

#### **Connect Repository**
```bash
# Connect your GitHub repository
# Railway will automatically detect the Node.js project
```

### **2. Database Setup**

#### **Create PostgreSQL Database**
1. In Railway dashboard, click "New"
2. Select "Database" → "PostgreSQL"
3. Note the connection string

#### **Configure Database Environment**
```bash
# Add to Railway environment variables
DATABASE_URL=postgresql://username:password@host:5432/database
```

#### **Run Database Setup**
```bash
# Deploy first, then run database setup
npm run db:setup
```

### **3. Backend Deployment**

#### **Deploy Backend**
1. Railway automatically detects `package.json`
2. Builds and deploys on push to main branch
3. Uses `npm start` as the start command

#### **Health Check Configuration**
```json
{
  "healthcheck": {
    "path": "/health",
    "interval": "30s",
    "timeout": "10s",
    "retries": 3
  }
}
```

### **4. Custom Domain (Optional)**
1. In Railway dashboard, go to "Settings"
2. Add custom domain
3. Configure DNS records
4. Update Slack OAuth redirect URI

## 🤖 **Slack App Deployment**

### **1. Slack App Configuration**

#### **Create Slack App**
1. Go to [Slack API Console](https://api.slack.com/apps)
2. Click "Create New App"
3. Choose "From scratch"
4. Name: "AI Assistant"
5. Select workspace

#### **Configure OAuth & Permissions**
1. Go to "OAuth & Permissions"
2. Add redirect URLs:
   ```
   https://your-domain.railway.app/slack/oauth/callback
   ```
3. Add bot token scopes:
   ```
   chat:write
   commands
   im:read
   mpim:read
   users:read
   users:read.email
   ```

#### **Configure Event Subscriptions**
1. Go to "Event Subscriptions"
2. Enable events
3. Request URL: `https://your-domain.railway.app/slack/events`
4. Subscribe to events:
   ```
   app_mention
   message.im
   ```

#### **Add Slash Commands**
1. Go to "Slash Commands"
2. Create command:
   - Command: `/assistant`
   - Request URL: `https://your-domain.railway.app/slack/commands`
   - Description: "AI Assistant for email and calendar management"

### **2. Environment Variables for Slack**
```bash
# Add to Railway environment variables
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_CLIENT_ID=your-client-id
SLACK_CLIENT_SECRET=your-client-secret
SLACK_OAUTH_REDIRECT_URI=https://your-domain.railway.app/slack/oauth/callback
```

### **3. Slack App Directory Submission**

#### **Prepare App Directory Listing**
1. Go to "App Home" in Slack API Console
2. Fill out required information:
   - App name and description
   - Icon and screenshots
   - Privacy policy URL
   - Support URL

#### **Submit for Review**
1. Go to "Distribution" → "App Directory"
2. Click "Submit for Review"
3. Provide detailed description of functionality
4. Include testing instructions

## 🗄️ **Database Management**

### **1. Database Schema Setup**

#### **Automatic Setup**
```bash
# Run database setup script
npm run db:setup
```

#### **Manual Setup (if needed)**
```sql
-- Connect to PostgreSQL and run:

-- Sessions table
CREATE TABLE sessions (
  session_id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255),
  conversation_history JSONB,
  tool_calls JSONB,
  tool_results JSONB,
  pending_actions JSONB,
  oauth_tokens JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);

-- OAuth tokens table
CREATE TABLE oauth_tokens (
  session_id VARCHAR(255) PRIMARY KEY,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  token_type VARCHAR(50),
  scope TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Slack workspaces table
CREATE TABLE slack_workspaces (
  team_id VARCHAR(255) PRIMARY KEY,
  team_name VARCHAR(255),
  access_token TEXT,
  bot_user_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Slack users table
CREATE TABLE slack_users (
  slack_user_id VARCHAR(255),
  team_id VARCHAR(255),
  google_user_id VARCHAR(255),
  access_token TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (slack_user_id, team_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires_at ON oauth_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_slack_users_google_id ON slack_users(google_user_id);
```

### **2. Database Maintenance**

#### **Automatic Cleanup**
```bash
# The application automatically cleans up expired sessions and tokens
# This runs every 30 minutes by default
```

#### **Manual Cleanup (if needed)**
```sql
-- Clean up expired sessions
DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP;

-- Clean up expired OAuth tokens
DELETE FROM oauth_tokens WHERE expires_at < CURRENT_TIMESTAMP;

-- Check database health
SELECT 
  COUNT(*) as total_sessions,
  COUNT(CASE WHEN expires_at < CURRENT_TIMESTAMP THEN 1 END) as expired_sessions
FROM sessions;
```

### **3. Database Backup**

#### **Railway Automatic Backups**
- Railway provides automatic daily backups
- Backups are retained for 7 days
- Can be restored from Railway dashboard

#### **Manual Backup (if needed)**
```bash
# Using Railway CLI
railway connect
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

## 🔍 **Monitoring and Health Checks**

### **1. Health Check Endpoint**
```bash
# Check application health
curl https://your-domain.railway.app/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "services": [
    {
      "name": "databaseService",
      "healthy": true,
      "state": "ready"
    },
    {
      "name": "sessionService", 
      "healthy": true,
      "state": "ready"
    }
  ]
}
```

### **2. Railway Monitoring**
- **Logs**: View real-time logs in Railway dashboard
- **Metrics**: CPU, memory, and network usage
- **Deployments**: Track deployment history and status

### **3. Custom Monitoring**

#### **Database Health**
```bash
# Check database connection
npm run db:test
```

#### **Service Health**
```bash
# Check all services
curl https://your-domain.railway.app/health/services
```

## 🔒 **Security Configuration**

### **1. Environment Security**
- **Never commit secrets**: Use Railway environment variables
- **Rotate secrets regularly**: Update JWT_SECRET and API keys
- **Use strong passwords**: For database and admin accounts

### **2. Network Security**
- **HTTPS only**: Railway provides automatic SSL certificates
- **CORS configuration**: Restrict to trusted domains
- **Rate limiting**: Prevent abuse and DDoS attacks

### **3. Data Security**
- **Encrypted storage**: OAuth tokens stored securely
- **Session management**: Secure session handling
- **Input validation**: Sanitize all user inputs

## 🧪 **Testing Deployment**

### **1. Pre-Deployment Testing**
```bash
# Local testing
npm run test
npm run typecheck
npm run build

# Database testing
npm run db:integration
```

### **2. Post-Deployment Testing**
```bash
# Health check
curl https://your-domain.railway.app/health

# Database connection
curl https://your-domain.railway.app/health/database

# Slack integration test
# Send a message to your Slack bot
```

### **3. Integration Testing**
```bash
# Test complete workflow
1. Install Slack app to workspace
2. Send message to bot
3. Verify OAuth flow works
4. Test email sending
5. Test calendar operations
```

## 🚨 **Troubleshooting**

### **1. Common Issues**

#### **Database Connection Failed**
```bash
# Check DATABASE_URL format
echo $DATABASE_URL

# Test connection
npm run db:test

# Check Railway database status
# Go to Railway dashboard → Database → Status
```

#### **Slack Events Not Working**
```bash
# Check Slack app configuration
# Verify request URL is correct
# Check bot token permissions

# Test endpoint
curl -X POST https://your-domain.railway.app/slack/events \
  -H "Content-Type: application/json" \
  -d '{"type":"url_verification","challenge":"test"}'
```

#### **OAuth Flow Issues**
```bash
# Check redirect URI configuration
# Verify Google OAuth settings
# Check Slack OAuth settings

# Test OAuth endpoint
curl https://your-domain.railway.app/slack/oauth/authorize
```

### **2. Log Analysis**
```bash
# View Railway logs
# Go to Railway dashboard → Deployments → Logs

# Common log patterns:
# - Database connection errors
# - Slack event processing errors
# - OAuth token validation failures
# - Rate limiting warnings
```

### **3. Performance Issues**
```bash
# Check Railway metrics
# Go to Railway dashboard → Metrics

# Common performance issues:
# - Database connection pool exhaustion
# - Memory leaks in session management
# - Slow external API calls
# - Rate limiting from Google/Slack APIs
```

## 📈 **Scaling Considerations**

### **1. Horizontal Scaling**
- **Railway auto-scaling**: Automatically scales based on load
- **Database scaling**: Upgrade PostgreSQL plan as needed
- **CDN**: Consider Cloudflare for static assets

### **2. Performance Optimization**
- **Database indexing**: Monitor query performance
- **Caching**: Implement Redis for session caching
- **Connection pooling**: Optimize database connections
- **Rate limiting**: Prevent API abuse

### **3. Cost Optimization**
- **Railway pricing**: Monitor usage and costs
- **Database optimization**: Clean up unused data
- **API usage**: Monitor Google and OpenAI API costs

## 📚 **Deployment Checklist**

### **Pre-Deployment**
- [ ] All tests passing
- [ ] TypeScript compilation successful
- [ ] Environment variables configured
- [ ] Database schema ready
- [ ] Slack app configured

### **Deployment**
- [ ] Railway project created
- [ ] Database provisioned
- [ ] Backend deployed
- [ ] Health checks passing
- [ ] Slack app installed

### **Post-Deployment**
- [ ] OAuth flow tested
- [ ] Email functionality verified
- [ ] Calendar operations tested
- [ ] Error handling validated
- [ ] Monitoring configured

### **Production Readiness**
- [ ] SSL certificates active
- [ ] Rate limiting configured
- [ ] Logging and monitoring active
- [ ] Backup strategy implemented
- [ ] Security review completed

This deployment guide provides comprehensive instructions for deploying the AI Assistant Platform to production with proper security, monitoring, and scaling considerations.
