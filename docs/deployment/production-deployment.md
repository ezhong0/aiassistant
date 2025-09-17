# Production Deployment

This guide covers deploying the AI Assistant Platform to production using Railway, including environment configuration, monitoring, and troubleshooting.

## 🚀 **Railway Deployment**

### **Prerequisites**

- **Railway Account**: Sign up at [railway.app](https://railway.app)
- **Railway CLI**: Install with `npm install -g @railway/cli`
- **Git Repository**: Code pushed to GitHub/GitLab
- **API Keys**: OpenAI, Google OAuth, Slack credentials

### **Initial Deployment**

```bash
# Login to Railway
railway login

# Initialize Railway project
railway init

# Deploy to Railway
railway up
```

### **Environment Configuration**

Set environment variables in Railway dashboard or CLI:

```bash
# Core configuration
NODE_ENV=production
PORT=3000
JWT_SECRET=your-secure-jwt-secret-here

# OpenAI API
OPENAI_API_KEY=sk-your-openai-api-key

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://your-app.railway.app/auth/callback

# Slack Integration
SLACK_SIGNING_SECRET=your-slack-signing-secret
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_OAUTH_REDIRECT_URI=https://your-app.railway.app/auth/slack/callback

# Database (Railway provides this)
DATABASE_URL=postgresql://username:password@host:port/database

# Redis (Railway provides this)
REDIS_URL=redis://username:password@host:port

# Feature flags
ENABLE_OPENAI=true
ENABLE_RATE_LIMITING=true
ENABLE_REQUEST_LOGGING=true
DISABLE_RATE_LIMITING=false
```

### **Database Setup**

Railway automatically provides PostgreSQL. Run migrations:

```bash
# Connect to Railway database
railway connect

# Run migrations
npm run migrate

# Verify database setup
npm run db:status
```

### **Redis Setup**

Railway automatically provides Redis. Test connection:

```bash
# Test Redis connection
npm run test:redis

# Check Redis health
curl https://your-app.railway.app/health/service/cacheService
```

## 🔧 **Environment Configuration**

### **Production Environment Variables**

```bash
# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
BASE_URL=https://your-app.railway.app

# Security
JWT_SECRET=your-secure-jwt-secret-minimum-32-characters
CORS_ORIGIN=https://your-frontend-domain.com

# Database
DATABASE_URL=postgresql://username:password@host:port/database
DB_POOL_SIZE=10
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=10000

# Redis
REDIS_URL=redis://username:password@host:port
DISABLE_REDIS=false
CACHE_TTL_DEFAULT=300
CACHE_TTL_GMAIL=3600
CACHE_TTL_CONTACTS=7200
CACHE_TTL_SLACK=1800

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.1
OPENAI_MAX_TOKENS=1000

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://your-app.railway.app/auth/callback

# Slack
SLACK_SIGNING_SECRET=your-slack-signing-secret
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_OAUTH_REDIRECT_URI=https://your-app.railway.app/auth/slack/callback

# Rate Limiting
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_ASSISTANT=50
RATE_LIMIT_HEAVY=10

# Performance
REQUEST_TIMEOUT=30000
SERVICE_INIT_TIMEOUT=30000
SERVICE_HEALTH_CHECK_INTERVAL=60000
```

### **Google OAuth Configuration**

Update Google OAuth settings:

1. Go to [Google Cloud Console](https://console.developers.google.com/)
2. Navigate to APIs & Services > Credentials
3. Edit your OAuth 2.0 client
4. Add authorized redirect URIs:
   - `https://your-app.railway.app/auth/callback`
   - `https://your-app.railway.app/auth/slack/callback`

### **Slack App Configuration**

Update Slack app settings:

1. Go to [Slack API](https://api.slack.com/apps)
2. Select your app
3. Update OAuth & Permissions:
   - Redirect URLs: `https://your-app.railway.app/auth/slack/callback`
4. Update Event Subscriptions:
   - Request URL: `https://your-app.railway.app/slack/events`
5. Update Interactivity & Shortcuts:
   - Request URL: `https://your-app.railway.app/slack/interactive`

## 📊 **Monitoring & Logging**

### **Health Monitoring**

Railway provides built-in health monitoring:

```bash
# Check application health
curl https://your-app.railway.app/health

# Check specific service health
curl https://your-app.railway.app/health/service/databaseService
curl https://your-app.railway.app/health/service/cacheService
curl https://your-app.railway.app/health/service/openaiService
```

### **Log Monitoring**

View logs in Railway dashboard or CLI:

```bash
# View logs
railway logs

# Follow logs in real-time
railway logs --follow

# Filter logs by service
railway logs --grep "EmailService"
```

### **Performance Monitoring**

Monitor key metrics:

```bash
# Check cache performance
curl https://your-app.railway.app/cache/metrics

# Check service dependencies
curl https://your-app.railway.app/health/dependencies

# Check memory usage
curl https://your-app.railway.app/health | jq '.metrics.memoryUsage'
```

### **Custom Monitoring**

Set up custom monitoring endpoints:

```typescript
// Custom monitoring endpoint
router.get('/monitoring/performance', async (req, res) => {
  const performanceMetrics = {
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    cache: await getCacheMetrics(),
    services: await getServiceMetrics()
  };
  
  res.json(performanceMetrics);
});
```

## 🔒 **Security Configuration**

### **HTTPS & SSL**

Railway automatically provides HTTPS. Verify SSL:

```bash
# Check SSL certificate
curl -I https://your-app.railway.app/health

# Test SSL configuration
openssl s_client -connect your-app.railway.app:443
```

### **CORS Configuration**

Configure CORS for production:

```typescript
// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'https://your-frontend-domain.com',
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
```

### **Rate Limiting**

Configure production rate limiting:

```typescript
// Rate limiting configuration
const rateLimitConfig = {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false
};

app.use(rateLimit(rateLimitConfig));
```

### **Security Headers**

Add security headers:

```typescript
// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.openai.com"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

## 🚀 **Deployment Strategies**

### **Blue-Green Deployment**

Railway supports blue-green deployments:

```bash
# Deploy to staging
railway up --environment staging

# Test staging deployment
curl https://your-app-staging.railway.app/health

# Promote to production
railway promote --environment production
```

### **Rolling Deployment**

Configure rolling deployments:

```yaml
# railway.toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npm start"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

### **Database Migrations**

Handle database migrations safely:

```bash
# Run migrations before deployment
railway run npm run migrate

# Verify migration success
railway run npm run db:status

# Deploy application
railway up
```

## 📈 **Performance Optimization**

### **Caching Strategy**

Optimize caching for production:

```typescript
// Production cache configuration
const cacheConfig = {
  redis: {
    url: process.env.REDIS_URL,
    connectTimeout: 10000,
    lazyConnect: true,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3
  },
  ttl: {
    gmail: parseInt(process.env.CACHE_TTL_GMAIL || '3600'),
    contacts: parseInt(process.env.CACHE_TTL_CONTACTS || '7200'),
    slack: parseInt(process.env.CACHE_TTL_SLACK || '1800')
  }
};
```

### **Connection Pooling**

Optimize database connections:

```typescript
// Production database configuration
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: parseInt(process.env.DB_POOL_SIZE || '10'),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000')
};
```

### **Memory Optimization**

Optimize memory usage:

```typescript
// Memory optimization
process.on('warning', (warning) => {
  if (warning.name === 'MaxListenersExceededWarning') {
    logger.warn('Memory warning', { warning: warning.message });
  }
});

// Garbage collection
if (global.gc) {
  setInterval(() => {
    global.gc();
  }, 300000); // Every 5 minutes
}
```

## 🔧 **Troubleshooting**

### **Common Issues**

**1. Service Initialization Failures**
```bash
# Check service health
curl https://your-app.railway.app/health

# Check specific service
curl https://your-app.railway.app/health/service/databaseService

# View service logs
railway logs --grep "ServiceManager"
```

**2. Database Connection Issues**
```bash
# Test database connection
railway run npm run test:database

# Check database URL
railway variables | grep DATABASE_URL

# Verify database exists
railway run psql $DATABASE_URL -c "SELECT version();"
```

**3. Redis Connection Issues**
```bash
# Test Redis connection
railway run npm run test:redis

# Check Redis URL
railway variables | grep REDIS_URL

# Test Redis commands
railway run redis-cli $REDIS_URL ping
```

**4. OpenAI API Issues**
```bash
# Test OpenAI connection
railway run npm run test:openai

# Check API key
railway variables | grep OPENAI_API_KEY

# Test API key validity
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models
```

### **Debugging Commands**

```bash
# View all environment variables
railway variables

# Check deployment status
railway status

# View deployment logs
railway logs --deployment latest

# Connect to running container
railway shell

# Run commands in container
railway run npm run test:health
```

### **Performance Debugging**

```bash
# Check memory usage
railway run node -e "console.log(process.memoryUsage())"

# Check CPU usage
railway run top

# Check disk usage
railway run df -h

# Check network connections
railway run netstat -an
```

## 📊 **Production Metrics**

### **Key Performance Indicators**

Monitor these metrics in production:

- **Response Time**: <500ms average
- **Cache Hit Rate**: >70% for external APIs
- **Error Rate**: <1% of requests
- **Uptime**: >99.9%
- **Memory Usage**: <80% of available memory
- **Database Connections**: <80% of pool size

### **Monitoring Dashboard**

Create a monitoring dashboard:

```typescript
// Monitoring endpoint
router.get('/monitoring/dashboard', async (req, res) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    services: await getServiceHealth(),
    cache: await getCacheMetrics(),
    database: await getDatabaseMetrics(),
    performance: await getPerformanceMetrics()
  };
  
  res.json(metrics);
});
```

## 🔄 **Backup & Recovery**

### **Database Backups**

Railway provides automatic database backups:

```bash
# Create manual backup
railway run pg_dump $DATABASE_URL > backup.sql

# Restore from backup
railway run psql $DATABASE_URL < backup.sql
```

### **Configuration Backups**

Backup environment configuration:

```bash
# Export environment variables
railway variables --json > env-backup.json

# Restore environment variables
railway variables --file env-backup.json
```

### **Disaster Recovery**

Create disaster recovery plan:

1. **Database Recovery**: Restore from latest backup
2. **Service Recovery**: Redeploy from Git repository
3. **Configuration Recovery**: Restore environment variables
4. **Data Recovery**: Restore from cache and database backups

---

**Next**: [Environment Configuration](./deployment/environment-configuration.md) - Environment variables and secrets management
