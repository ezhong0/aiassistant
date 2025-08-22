# 🚀 Deployment & Configuration - AI Development Guide

## 🎯 **Deployment Vision**

This document establishes the **deployment and configuration strategy** for the AI assistant platform. The deployment approach ensures consistent, secure, and scalable deployments across environments while maintaining the architectural integrity established in development.

## 🏗️ **Deployment Architecture Overview**

### **Deployment Environment Structure**
```
┌─────────────────────────────────────────────────────────────┐
│                    Production Environment                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│  │   Load      │ │   App       │ │   Database  │         │
│  │  Balancer   │ │  Servers    │ │   Cluster   │         │
│  └─────────────┘ └─────────────┘ └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   Staging       │
                    │  Environment    │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Development    │
                    │  Environment    │
                    └─────────────────┘
```

### **Core Deployment Principles**
1. **Environment Parity**: Staging mirrors production configuration
2. **Infrastructure as Code**: Reproducible deployments
3. **Security First**: Secure by default configuration
4. **Monitoring Integration**: Comprehensive health monitoring
5. **Rollback Capability**: Quick recovery from deployment issues

## 🔧 **Environment Configuration**

### **1. Environment Variables**

#### **Root Environment Configuration**
```bash
# .env.example - Root configuration file
# Application Configuration
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=24h

# Database Configuration (if applicable)
DATABASE_URL=postgresql://username:password@localhost:5432/assistantapp

# Redis Configuration (if applicable)
REDIS_URL=redis://localhost:6379

# Logging Configuration
LOG_LEVEL=info
LOG_FILE_PATH=./logs/app.log

# Security Configuration
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Monitoring Configuration
HEALTH_CHECK_INTERVAL=30000
METRICS_ENABLED=true
```

#### **Environment-Specific Configuration**
```typescript
// backend/src/config/environment.ts
export class EnvironmentConfig {
  // Environment
  get nodeEnv(): string {
    return process.env.NODE_ENV || 'development';
  }
  
  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }
  
  get isStaging(): boolean {
    return this.nodeEnv === 'staging';
  }
  
  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }
  
  // Server Configuration
  get port(): number {
    return parseInt(process.env.PORT || '3000', 10);
  }
  
  get host(): string {
    return process.env.HOST || '0.0.0.0';
  }
  
  // Google OAuth
  get googleClientId(): string {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error('GOOGLE_CLIENT_ID is required');
    }
    return clientId;
  }
  
  get googleClientSecret(): string {
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientSecret) {
      throw new Error('GOOGLE_CLIENT_SECRET is required');
    }
    return clientSecret;
  }
  
  // OpenAI
  get openaiApiKey(): string {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required');
    }
    return apiKey;
  }
  
  get openaiModel(): string {
    return process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }
  
  // JWT
  get jwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is required');
    }
    return secret;
  }
  
  get jwtExpiresIn(): string {
    return process.env.JWT_EXPIRES_IN || '24h';
  }
  
  // Security
  get corsOrigin(): string {
    return process.env.CORS_ORIGIN || 'http://localhost:3000';
  }
  
  get rateLimitWindowMs(): number {
    return parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10);
  }
  
  get rateLimitMaxRequests(): number {
    return parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);
  }
  
  // Monitoring
  get healthCheckInterval(): number {
    return parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10);
  }
  
  get metricsEnabled(): boolean {
    return process.env.METRICS_ENABLED === 'true';
  }
}

// Singleton instance
export const environmentConfig = new EnvironmentConfig();
```

### **2. Configuration Validation**

#### **Configuration Validation Service**
```typescript
// backend/src/config/config-validator.ts
export class ConfigValidator {
  private static instance: ConfigValidator;
  private validationErrors: string[] = [];
  
  static getInstance(): ConfigValidator {
    if (!ConfigValidator.instance) {
      ConfigValidator.instance = new ConfigValidator();
    }
    return ConfigValidator.instance;
  }
  
  validateConfiguration(): { valid: boolean; errors: string[] } {
    this.validationErrors = [];
    
    try {
      // Validate required environment variables
      this.validateRequiredEnvVars();
      
      // Validate Google OAuth configuration
      this.validateGoogleOAuth();
      
      // Validate OpenAI configuration
      this.validateOpenAI();
      
      // Validate JWT configuration
      this.validateJWT();
      
      // Validate security configuration
      this.validateSecurityConfig();
      
      // Validate environment-specific requirements
      this.validateEnvironmentSpecific();
      
    } catch (error) {
      this.validationErrors.push(`Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return {
      valid: this.validationErrors.length === 0,
      errors: this.validationErrors
    };
  }
  
  private validateRequiredEnvVars(): void {
    const requiredVars = [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'OPENAI_API_KEY',
      'JWT_SECRET'
    ];
    
    for (const envVar of requiredVars) {
      if (!process.env[envVar]) {
        this.validationErrors.push(`Required environment variable ${envVar} is not set`);
      }
    }
  }
  
  private validateGoogleOAuth(): void {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (clientId && clientId.length < 20) {
      this.validationErrors.push('GOOGLE_CLIENT_ID appears to be invalid (too short)');
    }
    
    if (clientSecret && clientSecret.length < 20) {
      this.validationErrors.push('GOOGLE_CLIENT_SECRET appears to be invalid (too short)');
    }
  }
  
  private validateOpenAI(): void {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (apiKey && !apiKey.startsWith('sk-')) {
      this.validationErrors.push('OPENAI_API_KEY should start with "sk-"');
    }
  }
  
  private validateJWT(): void {
    const jwtSecret = process.env.JWT_SECRET;
    
    if (jwtSecret && jwtSecret.length < 32) {
      this.validationErrors.push('JWT_SECRET should be at least 32 characters long');
    }
    
    if (jwtSecret === 'your_jwt_secret_key_here') {
      this.validationErrors.push('JWT_SECRET should not use the default placeholder value');
    }
  }
  
  private validateSecurityConfig(): void {
    const nodeEnv = process.env.NODE_ENV;
    
    if (nodeEnv === 'production') {
      if (process.env.JWT_SECRET === 'your_jwt_secret_key_here') {
        this.validationErrors.push('JWT_SECRET must be changed in production');
      }
      
      if (process.env.CORS_ORIGIN === 'http://localhost:3000') {
        this.validationErrors.push('CORS_ORIGIN must be configured for production');
      }
    }
  }
  
  private validateEnvironmentSpecific(): void {
    const nodeEnv = process.env.NODE_ENV;
    
    if (nodeEnv === 'production') {
      // Production-specific validations
      if (!process.env.DATABASE_URL) {
        this.validationErrors.push('DATABASE_URL is required in production');
      }
      
      if (process.env.LOG_LEVEL === 'debug') {
        this.validationErrors.push('LOG_LEVEL should not be debug in production');
      }
    }
  }
}

// Usage in application startup
export const validateConfiguration = (): void => {
  const validator = ConfigValidator.getInstance();
  const result = validator.validateConfiguration();
  
  if (!result.valid) {
    console.error('Configuration validation failed:');
    result.errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }
  
  console.log('Configuration validation passed');
};
```

## 🚀 **Deployment Process**

### **1. Pre-Deployment Checklist**

#### **Production Deployment Checklist**
```markdown
## Pre-Deployment Checklist

### Code Quality
- [ ] All tests passing (unit, integration, AI behavior)
- [ ] Code coverage above 80%
- [ ] Linting and formatting checks passed
- [ ] Type checking completed successfully
- [ ] Security review completed
- [ ] Performance benchmarks met

### Configuration
- [ ] Environment variables configured for production
- [ ] Google OAuth credentials updated for production domain
- [ ] JWT secret changed from default
- [ ] CORS origin configured for production domain
- [ ] Database connection strings updated
- [ ] Redis connection strings updated (if applicable)

### Infrastructure
- [ ] Production servers provisioned
- [ ] Load balancer configured
- [ ] SSL certificates installed
- [ ] Domain names configured
- [ ] Monitoring and logging configured
- [ ] Backup strategy implemented

### Security
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Authentication middleware active
- [ ] Input validation enabled
- [ ] SQL injection protection (if applicable)

### Testing
- [ ] Staging environment deployment successful
- [ ] Integration tests passed in staging
- [ ] Load testing completed
- [ ] Security testing completed
- [ ] User acceptance testing completed
```

### **2. Deployment Scripts**

#### **Deployment Automation**
```bash
#!/bin/bash
# scripts/deploy.sh

set -e  # Exit on any error

# Configuration
ENVIRONMENT=${1:-staging}
APP_NAME="assistantapp"
DEPLOY_PATH="/opt/$APP_NAME"
BACKUP_PATH="/opt/backups/$APP_NAME"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting deployment to $ENVIRONMENT...${NC}"

# 1. Pre-deployment checks
echo "Performing pre-deployment checks..."
if ! npm run test:coverage; then
    echo -e "${RED}Tests failed. Aborting deployment.${NC}"
    exit 1
fi

if ! npm run build; then
    echo -e "${RED}Build failed. Aborting deployment.${NC}"
    exit 1
fi

# 2. Create backup
echo "Creating backup of current deployment..."
if [ -d "$DEPLOY_PATH" ]; then
    mkdir -p "$BACKUP_PATH"
    cp -r "$DEPLOY_PATH" "$BACKUP_PATH/$(date +%Y%m%d_%H%M%S)"
fi

# 3. Deploy new version
echo "Deploying new version..."
rsync -av --delete dist/ "$DEPLOY_PATH/"

# 4. Copy configuration files
echo "Copying configuration files..."
cp .env.$ENVIRONMENT "$DEPLOY_PATH/.env"
cp ecosystem.config.js "$DEPLOY_PATH/"

# 5. Install production dependencies
echo "Installing production dependencies..."
cd "$DEPLOY_PATH"
npm ci --only=production

# 6. Restart application
echo "Restarting application..."
pm2 restart ecosystem.config.js --env $ENVIRONMENT

# 7. Health check
echo "Performing health check..."
sleep 10
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}Deployment successful!${NC}"
else
    echo -e "${RED}Health check failed. Rolling back...${NC}"
    # Rollback logic here
    exit 1
fi

echo -e "${GREEN}Deployment to $ENVIRONMENT completed successfully!${NC}"
```

#### **PM2 Ecosystem Configuration**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'assistantapp',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_staging: {
      NODE_ENV: 'staging',
      PORT: 3000,
      LOG_LEVEL: 'info'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      LOG_LEVEL: 'warn',
      METRICS_ENABLED: 'true'
    },
    // Process management
    max_memory_restart: '1G',
    min_uptime: '10s',
    max_restarts: 10,
    
    // Logging
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Monitoring
    pmx: true,
    monitor: true,
    
    // Graceful shutdown
    kill_timeout: 5000,
    listen_timeout: 3000,
    
    // Health checks
    health_check_grace_period: 3000,
    health_check_fatal_exceptions: true
  }]
};
```

### **3. Docker Deployment**

#### **Dockerfile**
```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Copy configuration
COPY .env.production ./.env

# Create logs directory
RUN mkdir -p logs && chown nodejs:nodejs logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start application
CMD ["node", "dist/index.js"]
```

#### **Docker Compose**
```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    depends_on:
      - redis
      - postgres
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: assistantapp
      POSTGRES_USER: assistantapp
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  redis_data:
  postgres_data:
```

## 🔒 **Security Configuration**

### **1. Security Headers**

#### **Security Middleware Configuration**
```typescript
// backend/src/middleware/security.middleware.ts
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://www.googleapis.com", "https://api.openai.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  frameguard: { action: 'deny' },
  xssFilter: true
});

export const apiSecurityHeaders = helmet({
  contentSecurityPolicy: false, // Disable CSP for API endpoints
  hsts: false, // Disable HSTS for API endpoints
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  frameguard: { action: 'deny' },
  xssFilter: true
});

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://yourdomain.com',
      'https://www.yourdomain.com'
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
});

export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false
});
```

### **2. Authentication Security**

#### **JWT Security Configuration**
```typescript
// backend/src/services/auth.service.ts
export class AuthService implements IService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly refreshTokenExpiresIn: string;
  
  constructor() {
    this.jwtSecret = environmentConfig.jwtSecret;
    this.jwtExpiresIn = environmentConfig.jwtExpiresIn;
    this.refreshTokenExpiresIn = '7d';
  }
  
  private createAccessToken(userId: string, scopes: string[]): string {
    return jwt.sign(
      {
        userId,
        scopes,
        type: 'access'
      },
      this.jwtSecret,
      {
        expiresIn: this.jwtExpiresIn,
        issuer: 'assistantapp',
        audience: 'assistantapp-users'
      }
    );
  }
  
  private createRefreshToken(userId: string): string {
    return jwt.sign(
      {
        userId,
        type: 'refresh'
      },
      this.jwtSecret,
      {
        expiresIn: this.refreshTokenExpiresIn,
        issuer: 'assistantapp',
        audience: 'assistantapp-users'
      }
    );
  }
  
  async validateToken(token: string): Promise<JwtPayload | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'assistantapp',
        audience: 'assistantapp-users'
      }) as JwtPayload;
      
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid token');
      }
      
      throw new AuthenticationError('Token validation failed');
    }
  }
}
```

## 📊 **Monitoring and Health Checks**

### **1. Health Check Endpoints**

#### **Comprehensive Health Monitoring**
```typescript
// backend/src/routes/health.ts
import { Router, Request, Response } from 'express';
import { getService } from '../services/service-manager';
import { AgentFactory } from '../framework/agent-factory';
import { environmentConfig } from '../config/environment';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    // Basic application health
    const basicHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: environmentConfig.nodeEnv,
      version: process.env.npm_package_version || 'unknown',
      nodeVersion: process.version,
      memory: process.memoryUsage(),
      pid: process.pid
    };
    
    // Service health status
    const serviceManager = getService('serviceManager');
    let servicesHealth: any[] = [];
    
    if (serviceManager) {
      servicesHealth = await serviceManager.getHealthStatus();
    }
    
    // Agent health status
    const agentsHealth = AgentFactory.getStats();
    
    // Database health (if applicable)
    let databaseHealth = { status: 'unknown' };
    try {
      // Add database health check here
      databaseHealth = { status: 'healthy' };
    } catch (error) {
      databaseHealth = { status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error' };
    }
    
    // External service health
    const externalServicesHealth = {
      google: await checkGoogleAPIAccess(),
      openai: await checkOpenAIAccess()
    };
    
    // Overall health assessment
    const allServicesHealthy = servicesHealth.every(service => service.healthy);
    const allExternalHealthy = Object.values(externalServicesHealth).every(status => status === 'healthy');
    
    const overallHealth = allServicesHealthy && allExternalHealthy ? 'healthy' : 'degraded';
    
    const health = {
      ...basicHealth,
      status: overallHealth,
      services: servicesHealth,
      agents: agentsHealth,
      database: databaseHealth,
      externalServices: externalServicesHealth,
      responseTime: Date.now() - startTime
    };
    
    const statusCode = overallHealth === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
    
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check if all critical services are ready
    const serviceManager = getService('serviceManager');
    if (!serviceManager) {
      return res.status(503).json({ status: 'not ready', reason: 'Service manager not available' });
    }
    
    const servicesHealth = await serviceManager.getHealthStatus();
    const criticalServices = servicesHealth.filter(service => 
      ['sessionService', 'authService', 'gmailService'].includes(service.name)
    );
    
    const allCriticalReady = criticalServices.every(service => service.healthy);
    
    if (allCriticalReady) {
      res.status(200).json({ status: 'ready' });
    } else {
      res.status(503).json({ 
        status: 'not ready', 
        reason: 'Critical services not healthy',
        services: criticalServices
      });
    }
    
  } catch (error) {
    res.status(503).json({ 
      status: 'not ready', 
      reason: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/live', (req: Request, res: Response) => {
  // Simple liveness check
  res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });
});

async function checkGoogleAPIAccess(): Promise<string> {
  try {
    // Simple Google API check
    const response = await fetch('https://www.googleapis.com/discovery/v1/apis');
    return response.ok ? 'healthy' : 'unhealthy';
  } catch (error) {
    return 'unhealthy';
  }
}

async function checkOpenAIAccess(): Promise<string> {
  try {
    // Simple OpenAI API check (without using API key)
    const response = await fetch('https://api.openai.com/v1/models');
    return response.status === 401 ? 'healthy' : 'unhealthy'; // 401 means API is reachable
  } catch (error) {
    return 'unhealthy';
  }
}

export default router;
```

### **2. Metrics Collection**

#### **Performance Metrics**
```typescript
// backend/src/utils/metrics.ts
export class MetricsCollector {
  private static instance: MetricsCollector;
  private metrics: Map<string, any> = new Map();
  
  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }
  
  recordRequest(method: string, path: string, statusCode: number, duration: number): void {
    const key = `${method}_${path}`;
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        count: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        statusCodes: {}
      });
    }
    
    const metric = this.metrics.get(key);
    metric.count++;
    metric.totalDuration += duration;
    metric.minDuration = Math.min(metric.minDuration, duration);
    metric.maxDuration = Math.max(metric.maxDuration, duration);
    
    const statusKey = statusCode.toString();
    metric.statusCodes[statusKey] = (metric.statusCodes[statusKey] || 0) + 1;
  }
  
  recordAgentExecution(agentName: string, success: boolean, duration: number): void {
    const key = `agent_${agentName}`;
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalDuration: 0,
        averageDuration: 0
      });
    }
    
    const metric = this.metrics.get(key);
    metric.totalExecutions++;
    metric.totalDuration += duration;
    metric.averageDuration = metric.totalDuration / metric.totalExecutions;
    
    if (success) {
      metric.successfulExecutions++;
    } else {
      metric.failedExecutions++;
    }
  }
  
  getMetrics(): any {
    const metrics = {};
    for (const [key, value] of this.metrics) {
      metrics[key] = { ...value };
    }
    return metrics;
  }
  
  resetMetrics(): void {
    this.metrics.clear();
  }
}

export const metricsCollector = MetricsCollector.getInstance();
```

## 🔄 **Rollback Strategy**

### **1. Automated Rollback**

#### **Rollback Script**
```bash
#!/bin/bash
# scripts/rollback.sh

set -e

ENVIRONMENT=${1:-staging}
APP_NAME="assistantapp"
DEPLOY_PATH="/opt/$APP_NAME"
BACKUP_PATH="/opt/backups/$APP_NAME"

echo "Starting rollback for $ENVIRONMENT..."

# Find latest backup
LATEST_BACKUP=$(ls -t "$BACKUP_PATH" | head -n1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "No backup found. Cannot rollback."
    exit 1
fi

echo "Rolling back to backup: $LATEST_BACKUP"

# Stop application
pm2 stop ecosystem.config.js --env $ENVIRONMENT

# Restore from backup
rm -rf "$DEPLOY_PATH"
cp -r "$BACKUP_PATH/$LATEST_BACKUP" "$DEPLOY_PATH"

# Restart application
cd "$DEPLOY_PATH"
pm2 start ecosystem.config.js --env $ENVIRONMENT

# Health check
sleep 10
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "Rollback successful!"
else
    echo "Rollback failed health check!"
    exit 1
fi

echo "Rollback completed successfully!"
```

### **2. Database Rollback**

#### **Migration Rollback**
```typescript
// backend/src/utils/migration-manager.ts
export class MigrationManager {
  private static instance: MigrationManager;
  private migrations: Migration[] = [];
  
  static getInstance(): MigrationManager {
    if (!MigrationManager.instance) {
      MigrationManager.instance = new MigrationManager();
    }
    return MigrationManager.instance;
  }
  
  async rollback(steps: number = 1): Promise<void> {
    try {
      const currentVersion = await this.getCurrentVersion();
      const targetVersion = currentVersion - steps;
      
      if (targetVersion < 0) {
        throw new Error('Cannot rollback beyond version 0');
      }
      
      logger.info(`Rolling back from version ${currentVersion} to ${targetVersion}`);
      
      // Execute rollback migrations
      for (let i = currentVersion; i > targetVersion; i--) {
        const migration = this.migrations.find(m => m.version === i);
        if (migration && migration.down) {
          await migration.down();
          logger.info(`Rolled back migration: ${migration.name}`);
        }
      }
      
      // Update version
      await this.updateVersion(targetVersion);
      
      logger.info(`Rollback completed successfully to version ${targetVersion}`);
      
    } catch (error) {
      logger.error('Rollback failed:', error);
      throw new Error(`Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private async getCurrentVersion(): Promise<number> {
    // Implementation to get current migration version
    return 0;
  }
  
  private async updateVersion(version: number): Promise<void> {
    // Implementation to update migration version
  }
}

export interface Migration {
  version: number;
  name: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}
```

## 📋 **Deployment Checklist**

### **1. Pre-Deployment Validation**

#### **Automated Pre-Deployment Checks**
```typescript
// backend/src/utils/deployment-validator.ts
export class DeploymentValidator {
  static async validatePreDeployment(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      // 1. Configuration validation
      const configValidator = ConfigValidator.getInstance();
      const configResult = configValidator.validateConfiguration();
      if (!configResult.valid) {
        errors.push(...configResult.errors);
      }
      
      // 2. Test validation
      if (!await this.runTests()) {
        errors.push('Tests failed');
      }
      
      // 3. Build validation
      if (!await this.validateBuild()) {
        errors.push('Build validation failed');
      }
      
      // 4. Security validation
      if (!await this.validateSecurity()) {
        errors.push('Security validation failed');
      }
      
      // 5. Performance validation
      if (!await this.validatePerformance()) {
        errors.push('Performance validation failed');
      }
      
    } catch (error) {
      errors.push(`Deployment validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  private static async runTests(): Promise<boolean> {
    try {
      // Run test suite
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      await execAsync('npm run test:coverage');
      return true;
    } catch (error) {
      return false;
    }
  }
  
  private static async validateBuild(): Promise<boolean> {
    try {
      // Validate build output
      const fs = require('fs');
      const path = require('path');
      
      const distPath = path.join(__dirname, '../../dist');
      if (!fs.existsSync(distPath)) {
        return false;
      }
      
      const indexFile = path.join(distPath, 'index.js');
      if (!fs.existsSync(indexFile)) {
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }
  
  private static async validateSecurity(): Promise<boolean> {
    try {
      // Security checks
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      // Run security audit
      await execAsync('npm audit --audit-level=high');
      return true;
    } catch (error) {
      return false;
    }
  }
  
  private static async validatePerformance(): Promise<boolean> {
    try {
      // Performance benchmarks
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      await execAsync('npm run test:performance');
      return true;
    } catch (error) {
      return false;
    }
  }
}
```

This comprehensive deployment and configuration strategy ensures secure, reliable, and scalable deployments while maintaining the architectural integrity established in development.
