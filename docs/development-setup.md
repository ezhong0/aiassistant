# 🔧 Development Setup

Complete guide for setting up a local development environment for the AI Assistant Platform.

## 🎯 **Prerequisites**

Before starting development, ensure you have:

- **Node.js** 18+ (LTS recommended)
- **npm** 9+ or **yarn** 1.22+
- **PostgreSQL** 13+ (local or cloud)
- **Redis** 6+ (optional, for caching)
- **Git** 2.30+

### **System Requirements**

| **Component** | **Minimum** | **Recommended** |
|---------------|-------------|-----------------|
| **RAM** | 8GB | 16GB+ |
| **Storage** | 10GB | 50GB+ |
| **CPU** | 2 cores | 4+ cores |

## 🚀 **Quick Start**

### **1. Clone Repository**

```bash
git clone https://github.com/your-org/assistantapp.git
cd assistantapp
```

### **2. Install Dependencies**

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install
```

### **3. Environment Setup**

```bash
# Copy environment template
cp backend/.env.example backend/.env

# Edit environment variables
nano backend/.env
```

### **4. Database Setup**

```bash
# Start PostgreSQL (if using local)
brew services start postgresql  # macOS
sudo systemctl start postgresql  # Linux

# Create database
createdb assistantapp_dev

# Run migrations
cd backend
npm run db:migrate
```

### **5. Start Development Server**

```bash
# Start backend
cd backend
npm run dev

# In another terminal, start frontend (if applicable)
npm run dev:frontend
```

## 🔧 **Environment Configuration**

### **Required Environment Variables**

Create `backend/.env` with:

```bash
# Application
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
BASE_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/assistantapp_dev
REDIS_URL=redis://localhost:6379

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback

# JWT
JWT_SECRET=your-super-secret-jwt-key

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# Slack
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_SIGNING_SECRET=your-slack-signing-secret
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
```

### **Optional Environment Variables**

```bash
# Feature Flags
ENABLE_RATE_LIMITING=true
ENABLE_CACHING=true
ENABLE_AI_CIRCUIT_BREAKER=true

# External APIs
TAVILY_API_KEY=your-tavily-api-key

# Monitoring
SENTRY_DSN=your-sentry-dsn
```

## 🗄️ **Database Setup**

### **PostgreSQL Installation**

#### **macOS (Homebrew)**

```bash
# Install PostgreSQL
brew install postgresql

# Start service
brew services start postgresql

# Create user and database
createuser -s postgres
createdb assistantapp_dev
```

#### **Ubuntu/Debian**

```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create user and database
sudo -u postgres createuser -s $USER
sudo -u postgres createdb assistantapp_dev
```

#### **Windows**

1. Download PostgreSQL installer from [postgresql.org](https://www.postgresql.org/download/windows/)
2. Run installer with default settings
3. Use pgAdmin or command line to create database

### **Database Migrations**

```bash
# Run all migrations
npm run db:migrate

# Create new migration
npm run db:create-migration add_new_table

# Rollback last migration
npm run db:rollback

# Check migration status
npm run db:status
```

### **Database Seeding**

```bash
# Seed development data
npm run db:seed

# Reset database (drop, create, migrate, seed)
npm run db:reset
```

## 🔄 **Redis Setup (Optional)**

### **Installation**

#### **macOS (Homebrew)**

```bash
brew install redis
brew services start redis
```

#### **Ubuntu/Debian**

```bash
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

#### **Windows**

1. Download Redis from [redis.io](https://redis.io/download)
2. Extract and run `redis-server.exe`

### **Configuration**

```bash
# Test Redis connection
redis-cli ping
# Should return: PONG

# Check Redis info
redis-cli info
```

## 🧪 **Testing Setup**

### **Run Tests**

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm test -- tests/unit/agents/

# Run in watch mode
npm run test:watch
```

### **Test Database**

```bash
# Create test database
createdb assistantapp_test

# Set test environment
export NODE_ENV=test
export DATABASE_URL=postgresql://username:password@localhost:5432/assistantapp_test

# Run tests
npm test
```

## 🔍 **Development Tools**

### **Code Quality**

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type check
npm run type-check
```

### **Debugging**

#### **VS Code Configuration**

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Backend",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/backend/src/index.ts",
      "outFiles": ["${workspaceFolder}/backend/dist/**/*.js"],
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "restart": true,
      "protocol": "inspector"
    }
  ]
}
```

#### **Debugging with Chrome DevTools**

```bash
# Start with debugging
npm run dev:debug

# Open Chrome DevTools
# Navigate to: chrome://inspect
# Click "Open dedicated DevTools for Node"
```

### **API Testing**

#### **Postman Collection**

1. Import Postman collection from `docs/postman/`
2. Set environment variables
3. Test API endpoints

#### **curl Examples**

```bash
# Health check
curl http://localhost:3000/api/health

# Test authentication
curl -X POST http://localhost:3000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"redirectUri": "http://localhost:3000/api/auth/callback"}'

# Test assistant
curl -X POST http://localhost:3000/api/assistant/text-command \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "Hello, can you help me?"}'
```

## 🔧 **Development Workflow**

### **Git Workflow**

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push branch
git push origin feature/new-feature

# Create pull request
# Merge after review
```

### **Code Standards**

1. **TypeScript**: Use strict typing
2. **ESLint**: Follow configured rules
3. **Prettier**: Consistent formatting
4. **Conventional Commits**: Standardized commit messages

### **Pre-commit Hooks**

```bash
# Install husky
npm install --save-dev husky

# Setup pre-commit hook
npx husky install
npx husky add .husky/pre-commit "npm run lint && npm run type-check"
```

## 🚀 **Hot Reload & Development**

### **Backend Hot Reload**

```bash
# Start with nodemon
npm run dev

# Or with ts-node
npm run dev:ts-node
```

### **Frontend Hot Reload**

```bash
# Start frontend dev server
npm run dev:frontend

# Or with Vite
npm run dev:vite
```

## 📊 **Monitoring & Logging**

### **Development Logging**

```bash
# View logs in real-time
tail -f logs/development.log

# Filter logs by level
tail -f logs/development.log | grep ERROR

# View structured logs
tail -f logs/development.log | jq .
```

### **Performance Monitoring**

```bash
# Monitor memory usage
npm run dev:monitor

# Profile CPU usage
npm run dev:profile
```

## 🔐 **OAuth Setup**

### **Google OAuth**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Enable Google+ API, Gmail API, Calendar API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback`
   - `http://localhost:3000/api/auth/google/slack`

### **Slack OAuth**

1. Go to [Slack API](https://api.slack.com/apps)
2. Create new app
3. Set OAuth redirect URL:
   - `http://localhost:3000/api/auth/slack/callback`
4. Install app to workspace
5. Copy bot token and signing secret

## 🐛 **Common Issues**

### **Port Already in Use**

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 PID

# Or use different port
PORT=3001 npm run dev
```

### **Database Connection Issues**

```bash
# Check PostgreSQL status
brew services list | grep postgresql

# Restart PostgreSQL
brew services restart postgresql

# Check connection
psql -h localhost -U postgres -d assistantapp_dev
```

### **Permission Issues**

```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm

# Or use nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install node
nvm use node
```

## 📚 **Next Steps**

After development setup:

1. **[Testing Guide](./testing-guide.md)** - Set up comprehensive testing
2. **[Production Deployment](./production-deployment.md)** - Deploy to production
3. **[Monitoring & Logging](./monitoring-logging.md)** - Set up observability
4. **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions

---

**🔧 With development environment set up, you're ready to build amazing AI-powered features!**
