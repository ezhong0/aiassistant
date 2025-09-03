# Troubleshooting Guide

Common issues and solutions for the Assistant App Backend.

## Quick Diagnostics

### Health Check

First, verify the system is running:

```bash
# Check server health
curl http://localhost:3000/health

# Expected response
{
  "status": "OK",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 10.5,
  "services": {
    "database": "healthy",
    "openai": "healthy"
  }
}
```

### Service Status

```bash
# Check assistant service status
curl -H "Authorization: Bearer <token>" \
     http://localhost:3000/api/assistant/status

# Check configuration
npm run typecheck  # Verify TypeScript
npm run lint       # Check code quality
npm test          # Run test suite
```

## Startup Issues

### Port Already in Use

**Error:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solutions:**
```bash
# Find what's using the port
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change the port
echo "PORT=3001" >> .env
```

### Environment Variable Errors

**Error:**
```
Configuration validation failed:
JWT_SECRET: JWT_SECRET must be at least 32 characters for security
```

**Solution:**
```bash
# Generate a secure JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))" >> .env

# Or manually set a strong secret
echo "JWT_SECRET=your_super_secure_jwt_secret_at_least_32_characters_long" >> .env
```

**Error:**
```
GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID is required
```

**Solution:**
1. Get credentials from [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 Client IDs
3. Add to `.env`:
```bash
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
```

### Database Connection Issues

**Error:**
```
Failed to initialize database service: connect ECONNREFUSED 127.0.0.1:5432
```

**Solutions:**

**Option 1: Install PostgreSQL**
```bash
# macOS
brew install postgresql
brew services start postgresql

# Ubuntu
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# Create database
createdb assistantapp
```

**Option 2: Use Docker**
```bash
# Start PostgreSQL container
docker run --name postgres-dev -e POSTGRES_PASSWORD=password -e POSTGRES_DB=assistantapp -p 5432:5432 -d postgres:14

# Update .env
echo "DATABASE_URL=postgresql://postgres:password@localhost:5432/assistantapp" >> .env
```

**Option 3: Skip Database (Development)**
```bash
# Comment out database initialization in the code temporarily
# The app will run without persistent sessions
```

## Authentication Issues

### Google OAuth Errors

**Error:**
```
Error: redirect_uri_mismatch
```

**Solution:**
1. Check Google Cloud Console OAuth settings
2. Ensure redirect URI matches exactly:
   - Console: `http://localhost:3000/auth/callback`
   - .env: `GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback`
3. No trailing slashes, exact match required

**Error:**
```
Error: invalid_client
```

**Solution:**
1. Verify client ID and secret are correct
2. Check that the OAuth consent screen is configured
3. Ensure the project is not in testing mode (for production)

### JWT Token Issues

**Error:**
```
Authentication failed: Invalid token payload
```

**Solution:**
```bash
# Check JWT secret consistency
echo $JWT_SECRET  # Should be the same across restarts

# Clear any cached tokens
# Logout and login again
```

**Error:**
```
JsonWebTokenError: jwt malformed
```

**Solution:**
```bash
# Token format should be: Bearer <token>
# Check Authorization header format
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
     http://localhost:3000/protected/profile
```

## API Issues

### Rate Limiting

**Error:**
```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Maximum 100 requests per 15 minutes."
}
```

**Solutions:**
```bash
# Disable rate limiting for development
echo "DISABLE_RATE_LIMITING=true" >> .env

# Or adjust rate limits
echo "RATE_LIMIT_MAX_REQUESTS=1000" >> .env

# Wait for rate limit window to reset (15 minutes)
```

### CORS Issues

**Error:**
```
Access to fetch at 'http://localhost:3000/api' from origin 'http://localhost:3001' 
has been blocked by CORS policy
```

**Solution:**
```bash
# Add your frontend origin to CORS_ORIGIN
echo "CORS_ORIGIN=http://localhost:3000,http://localhost:3001" >> .env

# For development, you can allow all origins (not for production)
echo "CORS_ORIGIN=*" >> .env
```

### Assistant Agent Issues

**Error:**
```json
{
  "success": false,
  "error": "Assistant is currently unavailable"
}
```

**Solution:**
1. Check OpenAI API key:
```bash
echo "OPENAI_API_KEY=your_api_key" >> .env
```

2. Verify agent initialization:
```bash
# Check logs for agent initialization errors
tail -f logs/combined-$(date +%Y-%m-%d).log | grep -i agent
```

3. Test individual agents:
```bash
curl -X POST http://localhost:3000/api/assistant/text-command \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"command": "test"}'
```

### Email Agent Issues

**Error:**
```json
{
  "success": false,
  "error": "Access token required for email operations"
}
```

**Solution:**
1. Include Google access token:
```json
{
  "command": "send email to john@example.com",
  "accessToken": "ya29.your_google_access_token"
}
```

2. Refresh expired tokens:
```bash
# Use the refresh token endpoint
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "your_refresh_token"}'
```

**Error:**
```
Error: The request is missing a valid API key
```

**Solution:**
- Ensure the Google access token has proper Gmail API scopes
- Check Google Cloud Console APIs are enabled

## Performance Issues

### High Memory Usage

**Symptoms:**
- Server becomes slow
- "Out of memory" errors
- Process crashes

**Solutions:**
```bash
# Check memory usage
curl http://localhost:3000/health

# Restart the server
pm2 restart assistantapp  # If using PM2
# Or
npm run dev  # For development

# Adjust Node.js memory limits
node --max-old-space-size=4096 dist/index.js
```

### Slow Response Times

**Diagnostic:**
```bash
# Check agent execution times in logs
tail -f logs/combined-$(date +%Y-%m-%d).log | grep "execution completed"

# Test specific endpoints
time curl -X POST http://localhost:3000/api/assistant/text-command \
  -H "Authorization: Bearer <token>" \
  -d '{"command": "test"}'
```

**Solutions:**
1. Reduce AI model timeouts:
```typescript
// In ai-config.ts
timeout: 15000  // Reduce from 30000
```

2. Check external API performance:
```bash
# Test OpenAI API directly
curl -w "%{time_total}\n" -o /dev/null -s "https://api.openai.com/v1/models" \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Database Performance

**Symptoms:**
- Slow queries
- Connection timeouts

**Solutions:**
```bash
# Check database connections
psql -d assistantapp -c "SELECT count(*) FROM pg_stat_activity;"

# Optimize database configuration
echo "DATABASE_URL=postgresql://user:pass@host:5432/db?pool_max=10&pool_timeout=20" >> .env

# Clean up old sessions
npm run db:cleanup  # If script exists
```

## Logging and Debugging

### Enable Debug Logging

```bash
# Set detailed logging level
echo "LOG_LEVEL=debug" >> .env

# Restart the server
npm run dev
```

### Log File Locations

```bash
# Application logs
tail -f logs/combined-$(date +%Y-%m-%d).log

# Error logs only
tail -f logs/error-$(date +%Y-%m-%d).log

# Exception logs
tail -f logs/exceptions-$(date +%Y-%m-%d).log
```

### Useful Log Filters

```bash
# Filter for specific user
tail -f logs/combined-*.log | grep "userId.*user-123"

# Filter for errors
tail -f logs/combined-*.log | grep '"level":"error"'

# Filter for specific agent
tail -f logs/combined-*.log | grep "emailAgent"

# Filter authentication issues
tail -f logs/combined-*.log | grep -i "auth"
```

### Debug Mode

```bash
# Run with Node.js debugger
node --inspect dist/index.js

# Or with ts-node for TypeScript debugging
npx ts-node --inspect src/index.ts

# Connect with Chrome DevTools
# Navigate to: chrome://inspect
```

## Common Error Codes

### HTTP Status Codes

| Code | Meaning | Common Causes | Solutions |
|------|---------|---------------|-----------|
| 400 | Bad Request | Invalid JSON, missing fields | Check request format |
| 401 | Unauthorized | Missing/invalid JWT token | Login again, check token |
| 403 | Forbidden | Insufficient permissions | Check user permissions |
| 404 | Not Found | Invalid endpoint, missing resource | Check URL, resource exists |
| 409 | Conflict | Duplicate resource | Check for existing data |
| 422 | Unprocessable Entity | Validation errors | Check input validation |
| 429 | Too Many Requests | Rate limit exceeded | Wait or disable rate limiting |
| 500 | Internal Server Error | Server-side error | Check logs, fix bug |
| 503 | Service Unavailable | Service down | Check service health |

### Application Error Codes

| Code | Meaning | Solutions |
|------|---------|-----------|
| `AUTHENTICATION_REQUIRED` | Missing JWT token | Include Authorization header |
| `INVALID_TOKEN` | JWT token invalid | Login again |
| `SESSION_EXPIRED` | Session expired | Create new session |
| `MISSING_ACCESS_TOKEN` | Google access token needed | Include accessToken in request |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Wait or adjust rate limits |
| `SERVICE_UNAVAILABLE` | Service temporarily down | Check service status |
| `VALIDATION_ERROR` | Input validation failed | Fix request data |
| `AGENT_TIMEOUT` | Agent execution timeout | Increase timeout or retry |

## Development Tools

### Database Tools

```bash
# Connect to database
psql -d assistantapp

# View tables
\dt

# View sessions
SELECT session_id, user_id, created_at FROM sessions LIMIT 10;

# Clean up old sessions
DELETE FROM sessions WHERE expires_at < NOW();
```

### Testing Tools

```bash
# Run specific test
npm test -- --testNamePattern="EmailAgent"

# Run with coverage
npm run test:coverage

# Run integration tests
npm run test:integration
```

### Configuration Testing

```bash
# Test configuration loading
node -e "
const { configService } = require('./dist/config/config.service');
console.log('Config loaded:', configService.getAll());
"

# Test environment validation
node -e "
const { ENV_VALIDATION } = require('./dist/config/environment');
console.log('Missing vars:', ENV_VALIDATION.validateRequired());
"
```

## Getting Help

### Log Analysis

When seeking help, include:

1. **Error message** (exact text)
2. **Request that caused the error**
3. **Relevant logs** (with timestamps)
4. **Environment information**:
   ```bash
   node --version
   npm --version
   echo $NODE_ENV
   ```
5. **Configuration** (sanitized, no secrets):
   ```bash
   # Safe environment summary
   node -e "
   const { ENV_HELPERS } = require('./dist/config/environment');
   console.log(JSON.stringify(ENV_HELPERS.getSafeEnvSummary(), null, 2));
   "
   ```

### Support Checklist

Before reporting issues:

- [ ] Check this troubleshooting guide
- [ ] Verify environment variables are set correctly
- [ ] Test with a clean database/session
- [ ] Check logs for detailed error messages
- [ ] Try with rate limiting disabled
- [ ] Test authentication flow manually
- [ ] Verify external API keys are valid

### Additional Resources

- **Configuration Guide:** [configuration.md](./configuration.md)
- **API Reference:** [api-reference.md](./api-reference.md)
- **Architecture Overview:** [architecture.md](./architecture.md)
- **Agent Development:** [agent-development.md](./agent-development.md)