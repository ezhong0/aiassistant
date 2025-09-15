# 🚀 Production Deployment

Complete guide for deploying the AI Assistant Platform to production using Railway, Docker, and other cloud platforms.

## 🎯 **Deployment Overview**

The platform is designed for **cloud-native deployment** with support for:
- **Railway** (recommended) - One-click deployment
- **Docker** - Containerized deployment
- **Heroku** - Platform-as-a-Service
- **AWS/GCP/Azure** - Cloud provider deployment

## 🚂 **Railway Deployment (Recommended)**

Railway provides seamless deployment with integrated PostgreSQL and Redis.

### **1. Prerequisites**

- **Railway Account** - [Sign up](https://railway.app/)
- **GitHub Repository** - Code hosted on GitHub
- **Domain Name** (optional) - Custom domain for production

### **2. One-Click Deployment**

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/your-template-id)

### **3. Manual Railway Setup**

#### **Connect Repository**

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Choose "Deploy from GitHub repo"
4. Select your repository
5. Railway will automatically detect the Node.js app

#### **Configure Environment Variables**

In Railway dashboard, go to "Variables" tab and add:

```bash
# Core Configuration
NODE_ENV=production
PORT=3000
BASE_URL=https://your-app-name.railway.app
LOG_LEVEL=warn

# Security
JWT_SECRET=your-production-jwt-secret-64-chars-minimum

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://your-app-name.railway.app/auth/callback

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# Slack (if using)
SLACK_SIGNING_SECRET=your-slack-signing-secret
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_OAUTH_REDIRECT_URI=https://your-app-name.railway.app/auth/slack/callback

# Features
ENABLE_RATE_LIMITING=true
ENABLE_REQUEST_LOGGING=false
CORS_ORIGIN=https://your-app-name.railway.app
```

#### **Add Database**

1. Click "New" > "Database" > "PostgreSQL"
2. Railway will automatically provide `DATABASE_URL`
3. The app will automatically run migrations

#### **Add Redis (Optional)**

1. Click "New" > "Database" > "Redis"
2. Railway will automatically provide `REDIS_URL`

### **4. Railway Configuration**

#### **Railway Configuration File**

Create `railway.json` in project root:

```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

#### **Procfile**

Create `Procfile` in project root:

```
web: npm start
```

### **5. Custom Domain (Optional)**

1. In Railway dashboard, go to "Settings" > "Domains"
2. Click "Custom Domain"
3. Enter your domain name
4. Follow DNS configuration instructions
5. Update `BASE_URL` and `GOOGLE_REDIRECT_URI` environment variables

## 🐳 **Docker Deployment**

### **1. Dockerfile**

The platform includes a production-ready Dockerfile:

```dockerfile
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install dependencies
RUN npm install --only=production
WORKDIR /app/backend
RUN npm install

# Copy source code
WORKDIR /app
COPY . .

# Build the application
WORKDIR /app/backend
RUN npm run build

# Expose port
EXPOSE 3000

# Start command
CMD ["npm", "start"]
```

### **2. Docker Compose**

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/assistantapp
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    restart: unless-stopped

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=assistantapp
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

volumes:
  postgres_data:
```

### **3. Docker Commands**

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down

# Rebuild after changes
docker-compose up -d --build
```

## ☁️ **Cloud Provider Deployment**

### **AWS Deployment**

#### **Using AWS App Runner**

1. **Create App Runner Service**
   - Go to AWS App Runner console
   - Create new service
   - Connect to GitHub repository
   - Configure build settings

2. **Environment Variables**
   ```bash
   NODE_ENV=production
   PORT=8080
   DATABASE_URL=postgresql://user:pass@rds-endpoint:5432/db
   REDIS_URL=redis://elasticache-endpoint:6379
   ```

3. **RDS Database**
   - Create PostgreSQL RDS instance
   - Configure security groups
   - Update `DATABASE_URL`

4. **ElastiCache Redis**
   - Create Redis ElastiCache cluster
   - Configure security groups
   - Update `REDIS_URL`

#### **Using AWS ECS**

1. **Create ECS Cluster**
2. **Create Task Definition**
3. **Create Service**
4. **Configure Load Balancer**

### **Google Cloud Platform**

#### **Using Cloud Run**

1. **Build Container**
   ```bash
   gcloud builds submit --tag gcr.io/PROJECT-ID/assistant-app
   ```

2. **Deploy to Cloud Run**
   ```bash
   gcloud run deploy assistant-app \
     --image gcr.io/PROJECT-ID/assistant-app \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

3. **Cloud SQL Database**
   - Create Cloud SQL PostgreSQL instance
   - Configure connection
   - Update `DATABASE_URL`

### **Azure Deployment**

#### **Using Azure Container Instances**

1. **Build and Push**
   ```bash
   az acr build --registry myregistry --image assistant-app .
   ```

2. **Deploy Container**
   ```bash
   az container create \
     --resource-group myResourceGroup \
     --name assistant-app \
     --image myregistry.azurecr.io/assistant-app \
     --ports 3000
   ```

## 🔧 **Production Configuration**

### **Environment Variables**

#### **Required Production Variables**

```bash
# Core
NODE_ENV=production
PORT=3000
BASE_URL=https://yourdomain.com
LOG_LEVEL=warn

# Security
JWT_SECRET=your-production-jwt-secret-64-chars-minimum

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/callback

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Features
ENABLE_RATE_LIMITING=true
ENABLE_REQUEST_LOGGING=false
CORS_ORIGIN=https://yourdomain.com
```

#### **Optional Production Variables**

```bash
# Redis Cache
REDIS_URL=redis://host:6379

# Slack Integration
SLACK_SIGNING_SECRET=your-slack-signing-secret
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret

# Monitoring
LOG_FILE_PATH=/var/log/assistant-app/
LOG_MAX_FILES=30
```

### **Security Configuration**

#### **Production Security Checklist**

- [ ] **Strong JWT Secret** - 64+ character random string
- [ ] **HTTPS Only** - All traffic encrypted
- [ ] **CORS Restricted** - Only allow your domain
- [ ] **Rate Limiting Enabled** - Prevent abuse
- [ ] **Request Logging Disabled** - Reduce log noise
- [ ] **Environment Variables Secured** - Use secrets management
- [ ] **Database Encrypted** - At rest and in transit
- [ ] **Regular Updates** - Keep dependencies updated

#### **Security Headers**

The platform automatically includes security headers:

```javascript
// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

## 📊 **Monitoring & Health Checks**

### **Health Endpoints**

The platform provides comprehensive health monitoring:

```bash
# Basic health check
GET /health

# Detailed health status
GET /healthz

# Service-specific health
GET /api/assistant/status
```

### **Health Check Response**

```json
{
  "status": "ok",
  "timestamp": "2024-12-19T10:30:00.000Z",
  "uptime": 3600,
  "memory": {
    "rss": 45678912,
    "heapTotal": 20971520,
    "heapUsed": 15728640,
    "external": 1024000
  },
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "openai": "healthy",
    "google": "healthy"
  }
}
```

### **Monitoring Setup**

#### **Railway Monitoring**

Railway provides built-in monitoring:
- **Metrics Dashboard** - CPU, memory, network usage
- **Logs** - Real-time application logs
- **Alerts** - Automated alerts for issues

#### **External Monitoring**

For advanced monitoring, integrate with:

- **Datadog** - Application performance monitoring
- **New Relic** - Full-stack observability
- **Sentry** - Error tracking and performance monitoring
- **Uptime Robot** - Uptime monitoring

## 🔄 **CI/CD Pipeline**

### **GitHub Actions**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: |
        cd backend
        npm ci
    
    - name: Run tests
      run: |
        cd backend
        npm test
    
    - name: Build application
      run: |
        cd backend
        npm run build
    
    - name: Deploy to Railway
      uses: railway-app/railway-deploy@v1
      with:
        railway-token: ${{ secrets.RAILWAY_TOKEN }}
```

### **Railway Auto-Deploy**

Railway can automatically deploy on git push:

1. Go to Railway dashboard
2. Select your project
3. Go to "Settings" > "Source"
4. Enable "Auto Deploy"

## 🚨 **Troubleshooting Production Issues**

### **Common Production Issues**

#### **Database Connection Issues**

```bash
# Check database connectivity
curl https://yourdomain.com/health

# Check database logs
# Railway: View database logs in dashboard
# Docker: docker-compose logs db
```

#### **Memory Issues**

```bash
# Monitor memory usage
curl https://yourdomain.com/healthz | jq '.memory'

# Check for memory leaks
# Enable debug logging temporarily
LOG_LEVEL=debug
```

#### **Performance Issues**

```bash
# Check response times
curl -w "@curl-format.txt" -o /dev/null -s https://yourdomain.com/health

# Monitor CPU usage
# Railway: Check metrics dashboard
# Docker: docker stats
```

### **Debug Mode**

For production debugging:

```bash
# Enable debug logging (temporarily)
LOG_LEVEL=debug

# Check service health
curl https://yourdomain.com/health | jq

# View application logs
# Railway: View logs in dashboard
# Docker: docker-compose logs -f app
```

## 📈 **Scaling Considerations**

### **Horizontal Scaling**

The platform is designed for horizontal scaling:

- **Stateless Design** - No server-side sessions
- **Database Connection Pooling** - Efficient database connections
- **Redis Caching** - Shared cache across instances
- **Load Balancer Ready** - Works with any load balancer

### **Scaling Strategies**

#### **Railway Scaling**

Railway automatically handles scaling:
- **Auto-scaling** - Based on CPU/memory usage
- **Manual scaling** - Set minimum/maximum instances
- **Zero-downtime deployments** - Rolling updates

#### **Docker Scaling**

```bash
# Scale application instances
docker-compose up -d --scale app=3

# Use Docker Swarm for orchestration
docker swarm init
docker stack deploy -c docker-compose.yml assistant-app
```

### **Database Scaling**

For high-traffic applications:

- **Read Replicas** - Distribute read queries
- **Connection Pooling** - Efficient connection management
- **Query Optimization** - Optimize slow queries
- **Caching Strategy** - Cache frequently accessed data

## 🔒 **Security Best Practices**

### **Production Security**

1. **Environment Variables**
   - Use secrets management (Railway Variables, AWS Secrets Manager)
   - Never commit secrets to git
   - Rotate secrets regularly

2. **Network Security**
   - Use HTTPS everywhere
   - Configure proper CORS
   - Implement rate limiting
   - Use security headers

3. **Application Security**
   - Input validation and sanitization
   - SQL injection prevention
   - XSS protection
   - CSRF protection

4. **Monitoring**
   - Log security events
   - Monitor for suspicious activity
   - Set up alerts for security issues

## 📚 **Next Steps**

After successful deployment:

1. **[Monitoring & Logging](./monitoring-logging.md)** - Set up observability
2. **[Scaling & Performance](./scaling-performance.md)** - Optimize performance
3. **[Backup & Recovery](./backup-recovery.md)** - Data protection strategies
4. **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions

---

**🚀 Your AI Assistant Platform is now running in production with enterprise-grade reliability and security!**
