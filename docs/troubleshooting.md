# 🚨 Troubleshooting Guide

Comprehensive troubleshooting guide for common issues and solutions in the AI Assistant Platform.

## 🎯 **Quick Diagnosis**

### **Health Check Commands**

```bash
# Basic health check
curl http://localhost:3000/health

# Detailed system status
curl http://localhost:3000/healthz

# Service-specific status
curl http://localhost:3000/api/assistant/status

# Environment configuration
curl http://localhost:3000/auth/debug/current-config
```

### **Common Error Patterns**

| **Error Type** | **Common Causes** | **Quick Fix** |
|----------------|-------------------|---------------|
| **Port Already in Use** | Another instance running | `lsof -ti:3000 \| xargs kill -9` |
| **Database Connection Failed** | Wrong credentials/URL | Check `DATABASE_URL` |
| **OAuth Redirect Mismatch** | Wrong redirect URI | Update Google Cloud Console |
| **OpenAI API Error** | Invalid API key | Check `OPENAI_API_KEY` |
| **Slack Verification Failed** | Wrong signing secret | Check `SLACK_SIGNING_SECRET` |

## 🔧 **Environment Issues**

### **Environment Variables Not Loading**

#### **Symptoms**
- Services fail to initialize
- "Environment variable not found" errors
- Default values being used instead of configured values

#### **Diagnosis**
```bash
# Check if .env file exists
ls -la .env

# Check file permissions
ls -la .env

# Verify file format
cat .env | grep -v "^#" | grep -v "^$"

# Test environment loading
node -e "require('dotenv').config(); console.log(process.env.NODE_ENV)"
```

#### **Solutions**

1. **File Location**
   ```bash
   # Ensure .env is in project root
   pwd
   ls -la .env
   ```

2. **File Format**
   ```bash
   # Check for proper format (no spaces around =)
   cat .env | grep "NODE_ENV"
   # Should be: NODE_ENV=development
   # Not: NODE_ENV = development
   ```

3. **File Permissions**
   ```bash
   # Fix permissions if needed
   chmod 600 .env
   ```

### **Missing Required Variables**

#### **Diagnosis**
```bash
# Check required variables
npm run validate:env

# Manual check
echo "NODE_ENV: $NODE_ENV"
echo "JWT_SECRET: ${JWT_SECRET:0:10}..."
echo "GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:0:20}..."
echo "OPENAI_API_KEY: ${OPENAI_API_KEY:0:10}..."
```

#### **Solutions**

1. **Generate JWT Secret**
   ```bash
   # Generate secure JWT secret
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

2. **Set Required Variables**
   ```bash
   # Add to .env file
   echo "JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")" >> .env
   ```

## 🔐 **Authentication Issues**

### **Google OAuth Problems**

#### **Common OAuth Errors**

| **Error** | **Cause** | **Solution** |
|-----------|-----------|--------------|
| `redirect_uri_mismatch` | Wrong redirect URI | Update Google Cloud Console |
| `invalid_client` | Wrong client ID/secret | Check credentials |
| `access_denied` | User denied permission | Check OAuth consent screen |
| `invalid_grant` | Expired or invalid code | Retry OAuth flow |

#### **Diagnosis**
```bash
# Test OAuth configuration
curl http://localhost:3000/auth/debug/oauth-config

# Test OAuth URL generation
curl http://localhost:3000/auth/debug/test-oauth-url

# Test token exchange (with valid code)
curl "http://localhost:3000/auth/debug/test-token-exchange?code=YOUR_CODE"
```

#### **Solutions**

1. **Redirect URI Mismatch**
   ```bash
   # Check current redirect URI
   echo $GOOGLE_REDIRECT_URI
   
   # Update Google Cloud Console
   # Go to: APIs & Services > Credentials > OAuth 2.0 Client IDs
   # Add: http://localhost:3000/auth/callback
   ```

2. **Client ID/Secret Issues**
   ```bash
   # Verify format
   echo $GOOGLE_CLIENT_ID | grep "\.apps\.googleusercontent\.com$"
   
   # Check in Google Cloud Console
   # Go to: APIs & Services > Credentials
   ```

3. **OAuth Consent Screen**
   ```bash
   # Check consent screen configuration
   # Go to: APIs & Services > OAuth consent screen
   # Ensure: App name, support email, developer email are set
   ```

### **JWT Token Issues**

#### **Symptoms**
- "Invalid token" errors
- Authentication failures
- Token expiration issues

#### **Diagnosis**
```bash
# Test JWT validation
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/auth/validate

# Check JWT secret
echo "JWT_SECRET length: ${#JWT_SECRET}"
```

#### **Solutions**

1. **Invalid JWT Secret**
   ```bash
   # Generate new secret
   JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
   echo "JWT_SECRET=$JWT_SECRET" >> .env
   ```

2. **Token Expiration**
   ```bash
   # Check token expiration
   node -e "
   const jwt = require('jsonwebtoken');
   const token = 'YOUR_JWT_TOKEN';
   const decoded = jwt.decode(token);
   console.log('Expires:', new Date(decoded.exp * 1000));
   "
   ```

## 🤖 **AI Service Issues**

### **OpenAI API Problems**

#### **Common OpenAI Errors**

| **Error** | **Cause** | **Solution** |
|-----------|-----------|--------------|
| `invalid_api_key` | Wrong API key | Check `OPENAI_API_KEY` |
| `insufficient_quota` | Billing issue | Add payment method |
| `rate_limit_exceeded` | Too many requests | Implement backoff |
| `model_not_found` | Wrong model name | Check model access |

#### **Diagnosis**
```bash
# Test OpenAI API key
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models

# Test with simple request
curl -X POST "http://localhost:3000/api/assistant/text-command" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "Hello"}'
```

#### **Solutions**

1. **API Key Issues**
   ```bash
   # Check API key format
   echo $OPENAI_API_KEY | grep "^sk-"
   
   # Verify in OpenAI dashboard
   # Go to: https://platform.openai.com/api-keys
   ```

2. **Billing Issues**
   ```bash
   # Check usage and billing
   # Go to: https://platform.openai.com/usage
   # Add payment method if needed
   ```

3. **Model Access**
   ```bash
   # Check model access
   curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     https://api.openai.com/v1/models | jq '.data[].id'
   ```

### **AI Agent Issues**

#### **Symptoms**
- Agents not responding
- Tool calls failing
- Master Agent routing errors

#### **Diagnosis**
```bash
# Check agent status
curl http://localhost:3000/api/assistant/status

# Test specific agent
curl -X POST "http://localhost:3000/api/assistant/text-command" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "Send an email to test@example.com"}'
```

#### **Solutions**

1. **Service Initialization Issues**
   ```bash
   # Check service health
   curl http://localhost:3000/health | jq '.services'
   
   # Restart services
   npm run dev
   ```

2. **Agent Configuration**
   ```bash
   # Check agent configuration
   curl http://localhost:3000/api/assistant/status | jq '.services'
   ```

## 💬 **Slack Integration Issues**

### **Slack Bot Problems**

#### **Common Slack Errors**

| **Error** | **Cause** | **Solution** |
|-----------|-----------|--------------|
| `invalid_auth` | Wrong bot token | Check `SLACK_BOT_TOKEN` |
| `channel_not_found` | Wrong channel ID | Verify channel exists |
| `not_in_channel` | Bot not in channel | Invite bot to channel |
| `missing_scope` | Insufficient permissions | Update bot scopes |

#### **Diagnosis**
```bash
# Test Slack configuration
curl http://localhost:3000/auth/debug/current-config | jq '.slack'

# Test bot token
curl -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  https://slack.com/api/auth.test
```

#### **Solutions**

1. **Bot Token Issues**
   ```bash
   # Check token format
   echo $SLACK_BOT_TOKEN | grep "^xoxb-"
   
   # Regenerate token in Slack dashboard
   # Go to: https://api.slack.com/apps > Your App > OAuth & Permissions
   ```

2. **Bot Permissions**
   ```bash
   # Check bot scopes
   curl -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
     https://slack.com/api/auth.test | jq '.scopes'
   
   # Add required scopes in Slack dashboard
   ```

3. **Event Subscriptions**
   ```bash
   # Verify event subscription URL
   # Go to: https://api.slack.com/apps > Your App > Event Subscriptions
   # URL: https://yourdomain.com/slack/events
   ```

### **Slack Event Handling**

#### **Symptoms**
- Bot not responding to messages
- Events not being received
- Webhook verification failures

#### **Diagnosis**
```bash
# Check Slack event endpoint
curl -X POST http://localhost:3000/slack/events \
  -H "Content-Type: application/json" \
  -d '{"type": "url_verification", "challenge": "test"}'

# Check signing secret
echo "SLACK_SIGNING_SECRET length: ${#SLACK_SIGNING_SECRET}"
```

#### **Solutions**

1. **Signing Secret Issues**
   ```bash
   # Get signing secret from Slack dashboard
   # Go to: https://api.slack.com/apps > Your App > Basic Information
   ```

2. **Event Subscription Issues**
   ```bash
   # Verify event subscription
   # Go to: https://api.slack.com/apps > Your App > Event Subscriptions
   # Ensure URL is accessible and returns 200
   ```

## 🗄️ **Database Issues**

### **PostgreSQL Connection Problems**

#### **Common Database Errors**

| **Error** | **Cause** | **Solution** |
|-----------|-----------|--------------|
| `ECONNREFUSED` | Database not running | Start PostgreSQL |
| `ENOTFOUND` | Wrong hostname | Check `DATABASE_URL` |
| `password authentication failed` | Wrong credentials | Check username/password |
| `database does not exist` | Database not created | Create database |

#### **Diagnosis**
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT version();"

# Check database URL format
echo $DATABASE_URL | grep "postgresql://"

# Test connection components
echo $DATABASE_URL | sed 's/.*:\/\/\([^:]*\):\([^@]*\)@\([^:]*\):\([^\/]*\)\/\(.*\)/Host: \3\nPort: \4\nUser: \1\nPassword: \2\nDatabase: \5/'
```

#### **Solutions**

1. **Database Not Running**
   ```bash
   # Start PostgreSQL
   # macOS
   brew services start postgresql
   
   # Ubuntu/Debian
   sudo systemctl start postgresql
   
   # Docker
   docker-compose up -d db
   ```

2. **Connection String Issues**
   ```bash
   # Check DATABASE_URL format
   # Should be: postgresql://user:password@host:port/database
   
   # Test with psql
   psql $DATABASE_URL -c "SELECT 1;"
   ```

3. **Database Creation**
   ```bash
   # Create database
   createdb assistantapp
   
   # Or using psql
   psql -c "CREATE DATABASE assistantapp;"
   ```

### **Migration Issues**

#### **Symptoms**
- Database schema errors
- Migration failures
- Table not found errors

#### **Diagnosis**
```bash
# Check migration status
npm run db:setup

# Check database tables
psql $DATABASE_URL -c "\dt"

# Check specific table
psql $DATABASE_URL -c "\d user_tokens"
```

#### **Solutions**

1. **Run Migrations**
   ```bash
   # Run database setup
   npm run db:setup
   
   # Or manually
   npx ts-node scripts/setup-database.ts
   ```

2. **Reset Database**
   ```bash
   # Drop and recreate database
   dropdb assistantapp
   createdb assistantapp
   npm run db:setup
   ```

## 🔄 **Redis Issues**

### **Redis Connection Problems**

#### **Common Redis Errors**

| **Error** | **Cause** | **Solution** |
|-----------|-----------|--------------|
| `ECONNREFUSED` | Redis not running | Start Redis |
| `NOAUTH` | Authentication required | Check password |
| `WRONGTYPE` | Wrong data type | Check Redis commands |

#### **Diagnosis**
```bash
# Test Redis connection
redis-cli -u $REDIS_URL ping

# Check Redis info
redis-cli -u $REDIS_URL info

# Test basic operations
redis-cli -u $REDIS_URL set test "hello"
redis-cli -u $REDIS_URL get test
```

#### **Solutions**

1. **Redis Not Running**
   ```bash
   # Start Redis
   # macOS
   brew services start redis
   
   # Ubuntu/Debian
   sudo systemctl start redis-server
   
   # Docker
   docker-compose up -d redis
   ```

2. **Authentication Issues**
   ```bash
   # Check Redis password
   echo $REDIS_URL | grep "redis://.*:.*@"
   
   # Test with password
   redis-cli -a $REDIS_PASSWORD ping
   ```

## 🚀 **Performance Issues**

### **Slow Response Times**

#### **Diagnosis**
```bash
# Check response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/health

# Check memory usage
curl http://localhost:3000/healthz | jq '.memory'

# Check service health
curl http://localhost:3000/health | jq '.services'
```

#### **Solutions**

1. **Database Optimization**
   ```bash
   # Check slow queries
   psql $DATABASE_URL -c "SELECT query, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
   
   # Optimize database
   npm run db:optimize
   ```

2. **Memory Issues**
   ```bash
   # Check memory usage
   curl http://localhost:3000/healthz | jq '.memory'
   
   # Restart application
   npm run dev
   ```

3. **Cache Issues**
   ```bash
   # Check Redis cache
   redis-cli -u $REDIS_URL info memory
   
   # Clear cache if needed
   redis-cli -u $REDIS_URL flushall
   ```

### **High Memory Usage**

#### **Symptoms**
- Application crashes
- Slow performance
- Out of memory errors

#### **Diagnosis**
```bash
# Check memory usage
curl http://localhost:3000/healthz | jq '.memory'

# Check for memory leaks
LOG_LEVEL=debug npm run dev
```

#### **Solutions**

1. **Memory Leak Detection**
   ```bash
   # Enable debug logging
   LOG_LEVEL=debug npm run dev
   
   # Monitor memory over time
   watch -n 5 'curl -s http://localhost:3000/healthz | jq ".memory"'
   ```

2. **Service Restart**
   ```bash
   # Restart services
   npm run dev
   
   # Or restart specific service
   # Check service manager logs
   ```

## 🔍 **Debug Mode**

### **Enable Debug Logging**

```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# Check debug endpoints
curl http://localhost:3000/auth/debug/current-config
curl http://localhost:3000/auth/debug/oauth-config
curl http://localhost:3000/auth/debug/test-oauth-url
```

### **Debug Endpoints**

| **Endpoint** | **Purpose** | **Usage** |
|--------------|-------------|-----------|
| `/auth/debug/current-config` | Show current configuration | `curl http://localhost:3000/auth/debug/current-config` |
| `/auth/debug/oauth-config` | OAuth configuration validation | `curl http://localhost:3000/auth/debug/oauth-config` |
| `/auth/debug/test-oauth-url` | Test OAuth URL generation | `curl http://localhost:3000/auth/debug/test-oauth-url` |
| `/auth/debug/test-token-exchange` | Test token exchange | `curl "http://localhost:3000/auth/debug/test-token-exchange?code=CODE"` |

### **Log Analysis**

```bash
# View application logs
tail -f logs/combined-$(date +%Y-%m-%d).log

# Filter error logs
grep "ERROR" logs/combined-$(date +%Y-%m-%d).log

# Filter specific service logs
grep "AuthService" logs/combined-$(date +%Y-%m-%d).log
```

## 📞 **Getting Help**

### **Self-Service Resources**

1. **Documentation**
   - [Getting Started Guide](./getting-started.md)
   - [Environment Setup](./environment-setup.md)
   - [System Architecture](./architecture.md)

2. **Debug Tools**
   - Health check endpoints
   - Debug configuration endpoints
   - Log analysis tools

3. **Community Support**
   - GitHub Issues
   - Community forums
   - Stack Overflow

### **Escalation Process**

1. **Check Documentation** - Review relevant guides
2. **Run Diagnostics** - Use debug endpoints and logs
3. **Search Issues** - Check GitHub issues for similar problems
4. **Create Issue** - Provide detailed error information
5. **Contact Support** - For critical production issues

### **Issue Reporting Template**

```markdown
## Issue Description
Brief description of the problem

## Environment
- Node.js version: 
- Platform: 
- Environment: development/production

## Steps to Reproduce
1. 
2. 
3. 

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Error Messages
```
Paste error messages here
```

## Debug Information
```
Paste debug endpoint output here
```

## Additional Context
Any other relevant information
```

---

**🚨 With this troubleshooting guide, you should be able to diagnose and resolve most issues with the AI Assistant Platform!**
