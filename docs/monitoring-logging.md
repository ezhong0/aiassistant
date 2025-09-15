# 📊 Monitoring & Logging

Comprehensive monitoring and logging guide for the AI Assistant Platform in production.

## 🎯 **Overview**

The platform includes built-in monitoring, logging, and observability features to ensure reliable operation and quick issue resolution.

### **Monitoring Stack**

| **Component** | **Purpose** | **Technology** |
|---------------|-------------|----------------|
| **Application Logs** | Debugging & Auditing | Winston + Custom Logger |
| **Performance Metrics** | System Health | Custom Metrics + Prometheus |
| **Error Tracking** | Issue Detection | Sentry Integration |
| **Health Checks** | Service Status | Custom Health Endpoints |
| **Uptime Monitoring** | Availability | External Monitoring |

## 📝 **Logging System**

### **Log Levels**

The platform uses structured logging with multiple levels:

```typescript
// Log levels (from most to least verbose)
DEBUG   // Detailed debugging information
INFO    // General information about operations
WARN    // Warning messages for potential issues
ERROR   // Error messages for failed operations
FATAL   // Critical errors that may cause system failure
```

### **Log Configuration**

```typescript
// Environment-based log configuration
const logConfig = {
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.NODE_ENV === 'production' ? 'json' : 'pretty',
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/application.log' }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' })
  ]
};
```

### **Structured Logging**

All logs include structured data for better analysis:

```typescript
// Example log entry
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "User authentication successful",
  "userId": "user-123",
  "sessionId": "session-456",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "duration": 150,
  "service": "auth-service"
}
```

### **Log Categories**

#### **Authentication Logs**

```typescript
// Login attempts
logger.info('User login attempt', {
  userId: user.id,
  email: user.email,
  ip: req.ip,
  userAgent: req.get('User-Agent')
});

// OAuth flows
logger.info('OAuth flow initiated', {
  provider: 'google',
  userId: user.id,
  redirectUri: redirectUri
});

// Token operations
logger.info('Token refreshed', {
  userId: user.id,
  tokenType: 'access',
  expiresIn: 3600
});
```

#### **AI Agent Logs**

```typescript
// Agent execution
logger.info('Agent execution started', {
  agentType: 'email',
  userId: user.id,
  sessionId: session.id,
  query: sanitizedQuery
});

// Tool calls
logger.info('Tool call executed', {
  toolName: 'sendEmail',
  userId: user.id,
  duration: 250,
  success: true
});

// AI API calls
logger.info('OpenAI API call', {
  model: 'gpt-4',
  tokens: 150,
  cost: 0.002,
  duration: 1200
});
```

#### **Error Logs**

```typescript
// Application errors
logger.error('Database connection failed', {
  error: error.message,
  stack: error.stack,
  userId: user.id,
  operation: 'user-lookup'
});

// External API errors
logger.error('External API error', {
  service: 'gmail',
  error: error.message,
  statusCode: error.statusCode,
  userId: user.id
});

// AI errors
logger.error('AI processing failed', {
  agentType: 'master',
  error: error.message,
  query: sanitizedQuery,
  userId: user.id
});
```

## 📊 **Performance Monitoring**

### **Custom Metrics**

The platform tracks key performance indicators:

```typescript
// Response time metrics
const responseTime = Date.now() - startTime;
metrics.record('api.response_time', responseTime, {
  endpoint: '/api/assistant/text-command',
  method: 'POST'
});

// AI processing metrics
metrics.record('ai.processing_time', processingTime, {
  agent: 'master',
  model: 'gpt-4'
});

// Database metrics
metrics.record('db.query_time', queryTime, {
  operation: 'user_lookup',
  table: 'users'
});
```

### **Key Metrics**

| **Metric** | **Description** | **Threshold** |
|------------|-----------------|---------------|
| **API Response Time** | Average response time | < 2 seconds |
| **AI Processing Time** | Time to process AI requests | < 5 seconds |
| **Database Query Time** | Average query execution time | < 100ms |
| **Memory Usage** | Application memory consumption | < 512MB |
| **CPU Usage** | CPU utilization | < 80% |
| **Error Rate** | Percentage of failed requests | < 1% |

### **Health Checks**

#### **Application Health**

```typescript
// Health check endpoint
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    services: {
      database: await checkDatabaseHealth(),
      redis: await checkRedisHealth(),
      openai: await checkOpenAIHealth(),
      slack: await checkSlackHealth()
    }
  };
  
  res.json(health);
});
```

#### **Service Health Checks**

```typescript
// Database health check
async function checkDatabaseHealth() {
  try {
    await databaseService.query('SELECT 1');
    return { status: 'healthy', responseTime: Date.now() - start };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}

// Redis health check
async function checkRedisHealth() {
  try {
    await redis.ping();
    return { status: 'healthy' };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}

// OpenAI health check
async function checkOpenAIHealth() {
  try {
    await openaiService.testConnection();
    return { status: 'healthy' };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}
```

## 🚨 **Error Tracking**

### **Sentry Integration**

```typescript
// Sentry configuration
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // Filter sensitive data
    if (event.user) {
      delete event.user.email;
    }
    return event;
  }
});

// Error tracking
try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      service: 'ai-agent',
      userId: user.id
    },
    extra: {
      query: sanitizedQuery,
      sessionId: session.id
    }
  });
  throw error;
}
```

### **Error Categories**

#### **Application Errors**

```typescript
// Database errors
logger.error('Database error', {
  error: error.message,
  query: sanitizedQuery,
  userId: user.id,
  severity: 'high'
});

// Authentication errors
logger.error('Authentication failed', {
  error: error.message,
  ip: req.ip,
  userAgent: req.get('User-Agent'),
  severity: 'medium'
});

// Validation errors
logger.error('Validation error', {
  error: error.message,
  input: sanitizedInput,
  userId: user.id,
  severity: 'low'
});
```

#### **External Service Errors**

```typescript
// OpenAI API errors
logger.error('OpenAI API error', {
  error: error.message,
  statusCode: error.statusCode,
  model: 'gpt-4',
  userId: user.id,
  severity: 'high'
});

// Google API errors
logger.error('Google API error', {
  error: error.message,
  service: 'gmail',
  userId: user.id,
  severity: 'high'
});

// Slack API errors
logger.error('Slack API error', {
  error: error.message,
  event: event.type,
  teamId: event.team_id,
  severity: 'medium'
});
```

## 📈 **Monitoring Dashboard**

### **Key Performance Indicators**

#### **System Metrics**

- **Uptime**: 99.9% target
- **Response Time**: < 2 seconds average
- **Error Rate**: < 1% of requests
- **Memory Usage**: < 512MB
- **CPU Usage**: < 80%

#### **Business Metrics**

- **Active Users**: Daily active users
- **AI Requests**: Requests per hour
- **Success Rate**: Successful AI operations
- **User Satisfaction**: Based on feedback

#### **Technical Metrics**

- **Database Performance**: Query times, connection pool
- **AI Performance**: Token usage, costs, response times
- **External APIs**: Response times, error rates
- **Security**: Failed login attempts, suspicious activity

### **Alerting Rules**

```typescript
// Alert conditions
const alertRules = {
  highErrorRate: {
    condition: 'error_rate > 5%',
    duration: '5 minutes',
    severity: 'critical'
  },
  slowResponse: {
    condition: 'avg_response_time > 5 seconds',
    duration: '10 minutes',
    severity: 'warning'
  },
  highMemoryUsage: {
    condition: 'memory_usage > 80%',
    duration: '5 minutes',
    severity: 'warning'
  },
  serviceDown: {
    condition: 'health_check_failed',
    duration: '1 minute',
    severity: 'critical'
  }
};
```

## 🔍 **Log Analysis**

### **Log Aggregation**

```bash
# View recent logs
tail -f logs/application.log

# Filter by level
grep "ERROR" logs/application.log

# Filter by user
grep "userId.*user-123" logs/application.log

# Filter by time range
grep "2024-01-15T10:" logs/application.log
```

### **Structured Log Analysis**

```bash
# Parse JSON logs
cat logs/application.log | jq 'select(.level == "ERROR")'

# Analyze error patterns
cat logs/application.log | jq 'select(.level == "ERROR") | .error' | sort | uniq -c

# Performance analysis
cat logs/application.log | jq 'select(.duration) | .duration' | awk '{sum+=$1; count++} END {print sum/count}'
```

### **Log Rotation**

```bash
# Configure logrotate
sudo nano /etc/logrotate.d/assistantapp

# Log rotation configuration
/var/log/assistantapp/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 node node
    postrotate
        systemctl reload assistantapp
    endscript
}
```

## 🚀 **Production Monitoring**

### **Uptime Monitoring**

#### **External Monitoring Services**

- **UptimeRobot**: Free uptime monitoring
- **Pingdom**: Advanced monitoring
- **StatusCake**: Comprehensive monitoring

#### **Custom Health Checks**

```typescript
// Comprehensive health check
app.get('/api/health/detailed', async (req, res) => {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkOpenAI(),
    checkSlack(),
    checkGmail(),
    checkCalendar()
  ]);
  
  const health = {
    status: checks.every(c => c.status === 'fulfilled') ? 'healthy' : 'unhealthy',
    checks: checks.map((check, index) => ({
      service: ['database', 'redis', 'openai', 'slack', 'gmail', 'calendar'][index],
      status: check.status === 'fulfilled' ? 'healthy' : 'unhealthy',
      error: check.status === 'rejected' ? check.reason.message : null
    }))
  };
  
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});
```

### **Performance Profiling**

```typescript
// Performance profiling middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Record performance metrics
    metrics.record('api.request_duration', duration, {
      method: req.method,
      path: req.path,
      status: res.statusCode
    });
    
    // Log slow requests
    if (duration > 5000) {
      logger.warn('Slow request detected', {
        method: req.method,
        path: req.path,
        duration: duration,
        userId: req.user?.id
      });
    }
  });
  
  next();
});
```

## 📚 **Next Steps**

After setting up monitoring:

1. **[Production Deployment](./production-deployment.md)** - Deploy to production
2. **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions
3. **[Security Guide](./security-guide.md)** - Security best practices
4. **[Performance Optimization](./performance-optimization.md)** - Optimize system performance

---

**📊 With comprehensive monitoring in place, you can ensure reliable operation and quick issue resolution!**
