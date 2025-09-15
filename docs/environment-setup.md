# 🔧 Environment Setup

Complete guide for configuring the AI Assistant Platform environment variables and external service integrations.

## 📋 **Environment Variables Overview**

The platform uses **87 environment variables** across the codebase, organized into logical groups for easy management.

### **Variable Categories**

| **Category** | **Variables** | **Required** | **Description** |
|--------------|---------------|--------------|-----------------|
| **Core** | 4 | Yes | Basic application configuration |
| **Security** | 3 | Yes | JWT secrets and security settings |
| **Google OAuth** | 3 | Yes | Google Workspace integration |
| **OpenAI** | 1 | Yes | AI model integration |
| **Slack** | 5 | Optional | Slack bot integration |
| **Database** | 4 | Optional | PostgreSQL configuration |
| **Redis** | 3 | Optional | Caching configuration |
| **Features** | 6 | No | Feature flags and toggles |
| **Monitoring** | 4 | No | Logging and monitoring settings |

## 🚀 **Quick Setup**

### **1. Copy Environment Template**

```bash
# Copy the example environment file
cp .env.example .env

# Edit with your preferred editor
nano .env
```

### **2. Required Variables**

```bash
# Core Configuration
NODE_ENV=development
PORT=3000
BASE_URL=http://localhost:3000
LOG_LEVEL=info

# Security (REQUIRED)
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters

# Google OAuth (REQUIRED)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# OpenAI (REQUIRED)
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### **3. Optional Variables**

```bash
# Slack Integration (Optional)
SLACK_SIGNING_SECRET=your-slack-signing-secret
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_OAUTH_REDIRECT_URI=http://localhost:3000/auth/slack/callback

# Database (Optional - for production)
DATABASE_URL=postgresql://user:password@localhost:5432/assistantapp
DB_HOST=localhost
DB_PORT=5432
DB_NAME=assistantapp
DB_USER=postgres
DB_PASSWORD=your-database-password

# Redis Cache (Optional)
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Feature Flags
ENABLE_OPENAI=true
ENABLE_RATE_LIMITING=true
ENABLE_REQUEST_LOGGING=true
DISABLE_RATE_LIMITING=false
DISABLE_REDIS=false
CORS_ORIGIN=*

# Monitoring
LOG_LEVEL=info
ENABLE_REQUEST_LOGGING=true
LOG_FILE_PATH=logs/
LOG_MAX_FILES=30
```

## 🔐 **Security Configuration**

### **JWT Secret Generation**

Generate a secure JWT secret:

```bash
# Method 1: Using Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Method 2: Using OpenSSL
openssl rand -hex 64

# Method 3: Using online generator
# Visit: https://generate-secret.vercel.app/64
```

### **Environment Security**

```bash
# Production security settings
NODE_ENV=production
LOG_LEVEL=warn
ENABLE_REQUEST_LOGGING=false
CORS_ORIGIN=https://yourdomain.com
```

## 🔌 **Google Cloud Console Setup**

### **1. Create Google Cloud Project**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "New Project"
3. Enter project name: "AI Assistant Platform"
4. Click "Create"

### **2. Enable Required APIs**

Navigate to "APIs & Services" > "Library" and enable:

- **Gmail API** - For email operations
- **Google Calendar API** - For calendar management
- **People API** - For contact management
- **Google+ API** - For user profile information

### **3. Create OAuth 2.0 Credentials**

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Choose "Web application"
4. Configure authorized redirect URIs:
   - Development: `http://localhost:3000/auth/callback`
   - Production: `https://yourdomain.com/auth/callback`
5. Copy Client ID and Client Secret

### **4. OAuth Consent Screen**

1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" user type
3. Fill in required information:
   - App name: "AI Assistant Platform"
   - User support email: your-email@example.com
   - Developer contact: your-email@example.com
4. Add scopes:
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/contacts.readonly`

## 🤖 **OpenAI Configuration**

### **1. Get API Key**

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign in or create account
3. Navigate to "API Keys"
4. Click "Create new secret key"
5. Copy the key (starts with `sk-`)

### **2. Configure Billing**

1. Go to "Billing" in OpenAI dashboard
2. Add payment method
3. Set usage limits:
   - Development: $10-20/month
   - Production: Based on expected usage

### **3. Model Access**

Ensure you have access to:
- **GPT-4o-mini** (recommended for cost efficiency)
- **GPT-4** (for higher quality responses)

## 💬 **Slack Integration Setup**

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

### **4. Configure Event Subscriptions**

1. Go to "Event Subscriptions"
2. Enable Events
3. Set Request URL: `https://yourdomain.com/slack/events`
4. Subscribe to Bot Events:
   - `app_mention`
   - `message.channels`
   - `message.im`

## 🗄️ **Database Configuration**

### **PostgreSQL Setup**

#### **Local Development**

```bash
# Install PostgreSQL
# macOS
brew install postgresql
brew services start postgresql

# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql

# Create database
createdb assistantapp

# Create user
psql -c "CREATE USER assistantapp WITH PASSWORD 'your-password';"
psql -c "GRANT ALL PRIVILEGES ON DATABASE assistantapp TO assistantapp;"
```

#### **Environment Variables**

```bash
# Database configuration
DATABASE_URL=postgresql://assistantapp:your-password@localhost:5432/assistantapp
DB_HOST=localhost
DB_PORT=5432
DB_NAME=assistantapp
DB_USER=assistantapp
DB_PASSWORD=your-password
```

#### **Production Database**

For production, consider:
- **Railway PostgreSQL** - Integrated with Railway deployment
- **Supabase** - Managed PostgreSQL with additional features
- **AWS RDS** - Enterprise-grade managed database
- **Google Cloud SQL** - Managed PostgreSQL on GCP

## 🔄 **Redis Configuration**

### **Local Development**

```bash
# Install Redis
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis-server

# Test connection
redis-cli ping
```

### **Environment Variables**

```bash
# Redis configuration
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # Leave empty for local development
```

### **Production Redis**

For production, consider:
- **Railway Redis** - Integrated with Railway deployment
- **Redis Cloud** - Managed Redis service
- **AWS ElastiCache** - Managed Redis on AWS
- **Google Cloud Memorystore** - Managed Redis on GCP

## 🚀 **Production Configuration**

### **Environment-Specific Settings**

#### **Development**

```bash
NODE_ENV=development
LOG_LEVEL=debug
ENABLE_REQUEST_LOGGING=true
DISABLE_RATE_LIMITING=true
CORS_ORIGIN=*
```

#### **Production**

```bash
NODE_ENV=production
LOG_LEVEL=warn
ENABLE_REQUEST_LOGGING=false
DISABLE_RATE_LIMITING=false
CORS_ORIGIN=https://yourdomain.com
```

### **Security Considerations**

```bash
# Use strong, unique secrets
JWT_SECRET=your-production-jwt-secret-64-chars-minimum

# Restrict CORS origins
CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com

# Enable all security features
ENABLE_RATE_LIMITING=true
ENABLE_REQUEST_LOGGING=true
```

## 🔍 **Environment Validation**

### **Validation Script**

The platform includes built-in environment validation:

```bash
# Check environment configuration
npm run validate:env

# Or check specific services
npm run validate:google
npm run validate:openai
npm run validate:slack
```

### **Manual Validation**

```bash
# Test Google OAuth
curl "http://localhost:3000/auth/debug/oauth-config"

# Test OpenAI connection
curl -X POST "http://localhost:3000/api/assistant/text-command" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"command": "test"}'

# Test Slack integration
curl -X POST "http://localhost:3000/slack/events" \
  -H "Content-Type: application/json" \
  -d '{"type": "url_verification", "challenge": "test"}'
```

## 🛠️ **Configuration Management**

### **Environment Files**

```bash
# Development
.env.development

# Production
.env.production

# Test
.env.test

# Local overrides
.env.local
```

### **Secrets Management**

For production, use secure secrets management:

- **Railway Variables** - Integrated secrets management
- **AWS Secrets Manager** - Enterprise secrets management
- **Google Secret Manager** - GCP secrets management
- **HashiCorp Vault** - Open-source secrets management

## 🚨 **Troubleshooting**

### **Common Issues**

#### **Google OAuth Errors**

```bash
# Check redirect URI
echo $GOOGLE_REDIRECT_URI
# Should match exactly in Google Cloud Console

# Verify client ID format
echo $GOOGLE_CLIENT_ID
# Should be a long string ending in .apps.googleusercontent.com
```

#### **OpenAI API Errors**

```bash
# Check API key format
echo $OPENAI_API_KEY
# Should start with 'sk-'

# Test API key
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models
```

#### **Database Connection Issues**

```bash
# Test database connection
psql $DATABASE_URL -c "SELECT version();"

# Check database exists
psql $DATABASE_URL -c "\l"
```

#### **Redis Connection Issues**

```bash
# Test Redis connection
redis-cli -u $REDIS_URL ping

# Check Redis info
redis-cli -u $REDIS_URL info
```

### **Debug Mode**

```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# Check service health
curl http://localhost:3000/health | jq

# View environment summary
curl http://localhost:3000/auth/debug/current-config | jq
```

## 📚 **Next Steps**

After completing environment setup:

1. **[First Integration](./first-integration.md)** - Test your configuration
2. **[Production Deployment](./production-deployment.md)** - Deploy to production
3. **[Monitoring & Logging](./monitoring-logging.md)** - Set up observability
4. **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions

---

**🔧 With proper environment configuration, your AI Assistant Platform will be ready for development and production use!**
