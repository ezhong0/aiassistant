# Development Setup

This guide provides detailed instructions for setting up a local development environment for the AI Assistant Platform.

## 🛠️ **Development Environment Setup**

### **System Requirements**

- **Node.js**: 18.0.0 or higher
- **npm**: 8.0.0 or higher (or yarn 1.22.0+)
- **Git**: 2.30.0 or higher
- **PostgreSQL**: 13.0 or higher (optional)
- **Redis**: 6.0 or higher (optional)

### **IDE Recommendations**

- **VS Code** with extensions:
  - TypeScript and JavaScript Language Features
  - ESLint
  - Prettier
  - GitLens
  - REST Client
  - Thunder Client

## 📦 **Project Setup**

### **1. Clone Repository**

```bash
# Clone the repository
git clone <repository-url>
cd assistantapp

# Checkout the main branch
git checkout main
```

### **2. Install Dependencies**

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Or using yarn
yarn install
```

### **3. Environment Configuration**

```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

**Required Environment Variables:**

```bash
# Core Application
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
BASE_URL=http://localhost:3000

# Security
JWT_SECRET=your-secure-jwt-secret-key-here

# OpenAI API (Required)
OPENAI_API_KEY=sk-your-openai-api-key

# Google OAuth (Required for production)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# Slack Integration (Optional)
SLACK_SIGNING_SECRET=your-slack-signing-secret
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_OAUTH_REDIRECT_URI=http://localhost:3000/auth/slack/callback

# Database (Optional for development)
DATABASE_URL=postgresql://username:password@localhost:5432/assistantapp

# Redis (Optional for development)
REDIS_URL=redis://localhost:6379
DISABLE_REDIS=false

# Feature Flags
ENABLE_OPENAI=true
ENABLE_RATE_LIMITING=false
ENABLE_REQUEST_LOGGING=true
```

### **4. Database Setup (Optional)**

**PostgreSQL Setup:**

```bash
# Install PostgreSQL (macOS)
brew install postgresql
brew services start postgresql

# Install PostgreSQL (Ubuntu)
sudo apt update
sudo apt install postgresql postgresql-contrib

# Create database
createdb assistantapp

# Run database setup script
npm run setup:database

# Run migrations
npm run migrate
```

**Database Configuration:**

```bash
# Test database connection
npm run test:database

# Check database status
npm run db:status
```

### **5. Redis Setup (Optional)**

**Redis Installation:**

```bash
# Install Redis (macOS)
brew install redis
brew services start redis

# Install Redis (Ubuntu)
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server

# Test Redis connection
npm run test:redis
```

## 🚀 **Development Commands**

### **Core Development Commands**

```bash
# Start development server with hot reload
npm run dev

# Start development server with debugging
npm run dev:debug

# Build the application
npm run build

# Start production server
npm start

# Clean build artifacts
npm run clean
```

### **Testing Commands**

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test files
npm run test:unit
npm run test:integration

# Run tests for specific service
npm run test:service -- --grep "EmailAgent"
```

### **Code Quality Commands**

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type check
npm run type-check

# Run all quality checks
npm run quality
```

### **Database Commands**

```bash
# Setup database
npm run setup:database

# Run migrations
npm run migrate

# Rollback migrations
npm run migrate:rollback

# Seed test data
npm run seed

# Reset database
npm run db:reset
```

## 🔧 **Development Tools**

### **VS Code Configuration**

Create `.vscode/settings.json`:

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": [
    "javascript",
    "typescript"
  ],
  "files.associations": {
    "*.env.example": "dotenv",
    "*.env": "dotenv"
  }
}
```

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Application",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/backend/src/index.ts",
      "env": {
        "NODE_ENV": "development"
      },
      "runtimeArgs": ["-r", "ts-node/register"],
      "console": "integratedTerminal",
      "restart": true,
      "protocol": "inspector"
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/backend/node_modules/.bin/jest",
      "args": ["--runInBand", "--no-cache"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### **Git Hooks**

```bash
# Install husky for git hooks
npm install --save-dev husky

# Setup pre-commit hook
npx husky add .husky/pre-commit "npm run quality"

# Setup pre-push hook
npx husky add .husky/pre-push "npm test"
```

### **Docker Development (Optional)**

Create `docker-compose.dev.yml`:

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:13
    environment:
      POSTGRES_DB: assistantapp
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:6-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

```bash
# Start development services
docker-compose -f docker-compose.dev.yml up -d

# Stop development services
docker-compose -f docker-compose.dev.yml down
```

## 🧪 **Testing Setup**

### **Test Environment**

```bash
# Set test environment variables
export NODE_ENV=test
export PORT=0
export DISABLE_RATE_LIMITING=true
export LOG_LEVEL=error

# Run tests
npm test
```

### **Test Database**

```bash
# Create test database
createdb assistantapp_test

# Set test database URL
export DATABASE_URL=postgresql://username:password@localhost:5432/assistantapp_test

# Run test migrations
npm run migrate:test
```

### **Mock Services**

The test environment automatically mocks external services:

- **OpenAI API**: Mocked responses for AI operations
- **Gmail API**: Mocked email operations
- **Google Calendar API**: Mocked calendar operations
- **Slack API**: Mocked Slack operations

## 📊 **Development Monitoring**

### **Logging Configuration**

```bash
# Development logging
LOG_LEVEL=debug

# Production logging
LOG_LEVEL=info

# Test logging
LOG_LEVEL=error
```

### **Performance Monitoring**

```bash
# Enable performance monitoring
ENABLE_PERFORMANCE_MONITORING=true

# Memory usage monitoring
ENABLE_MEMORY_MONITORING=true

# Request timing
ENABLE_REQUEST_TIMING=true
```

### **Health Checks**

```bash
# Check application health
curl http://localhost:3000/health

# Check service health
curl http://localhost:3000/health/service/databaseService

# Check dependencies
curl http://localhost:3000/health/dependencies
```

## 🔍 **Debugging**

### **Debug Mode**

```bash
# Start with debug logging
DEBUG=* npm run dev

# Debug specific modules
DEBUG=ai-assistant:* npm run dev

# Debug with Node.js inspector
node --inspect-brk src/index.ts
```

### **Common Debug Scenarios**

**1. Service Initialization Issues**
```bash
# Check service status
curl http://localhost:3000/health

# View service logs
npm run logs -- --grep "ServiceManager"
```

**2. AI Service Issues**
```bash
# Test OpenAI connection
npm run test:openai

# Check AI service health
curl http://localhost:3000/health/service/openaiService
```

**3. Database Issues**
```bash
# Test database connection
npm run test:database

# Check database health
curl http://localhost:3000/health/service/databaseService
```

**4. Cache Issues**
```bash
# Test Redis connection
npm run test:redis

# Check cache health
curl http://localhost:3000/health/service/cacheService
```

## 🚀 **Development Workflow**

### **Feature Development**

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Develop Feature**
   ```bash
   # Start development server
   npm run dev
   
   # Run tests
   npm test
   
   # Check code quality
   npm run quality
   ```

3. **Test Feature**
   ```bash
   # Run integration tests
   npm run test:integration
   
   # Test API endpoints
   npm run test:api
   ```

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### **Bug Fixing**

1. **Identify Issue**
   ```bash
   # Check logs
   npm run logs
   
   # Run health checks
   curl http://localhost:3000/health
   ```

2. **Reproduce Issue**
   ```bash
   # Create test case
   npm run test:create -- --grep "bug description"
   ```

3. **Fix Issue**
   ```bash
   # Implement fix
   # Run tests
   npm test
   ```

4. **Verify Fix**
   ```bash
   # Run integration tests
   npm run test:integration
   
   # Test manually
   curl http://localhost:3000/health
   ```

## 📚 **Development Resources**

### **Documentation**

- [API Reference](./api/rest-api.md)
- [Architecture Overview](./architecture/system-architecture.md)
- [Testing Guide](./testing/testing-strategy.md)
- [Deployment Guide](./deployment/production-deployment.md)

### **Useful Commands**

```bash
# View all available scripts
npm run

# Check package versions
npm list

# Update dependencies
npm update

# Audit security
npm audit

# Fix security issues
npm audit fix
```

### **Development Tips**

1. **Use TypeScript**: Leverage TypeScript for better development experience
2. **Write Tests**: Always write tests for new features
3. **Follow Conventions**: Use ESLint and Prettier for consistent code
4. **Monitor Performance**: Use performance monitoring tools
5. **Document Changes**: Update documentation for new features

---

**Next**: [Code Organization](./development/code-organization.md) - Project structure and conventions
