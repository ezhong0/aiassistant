# Getting Started

This guide will help you set up the AI Assistant Application for development.

## Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis (optional, can be disabled)
- npm or yarn
- Git

## Quick Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd assistantapp

# Install root dependencies
npm install

# Setup backend
cd backend
npm install

# Setup frontend
cd ../frontend/ChatbotApp
npm install
```

### 2. Environment Configuration

```bash
# Backend environment
cd backend
cp env.example .env
# Edit .env with your configuration (see Environment Variables below)

# Frontend environment (if needed)
cd ../frontend/ChatbotApp
# Add any frontend-specific environment variables
```

### 3. Database Setup

```bash
cd backend

# Setup database
npm run db:setup

# Run migrations
npm run db:migrate:up
```

### 4. Start Development Servers

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend (iOS)
cd frontend/ChatbotApp
npm run ios

# Terminal 3: Frontend (Android)
cd frontend/ChatbotApp
npm run android
```

## Environment Variables

### Required Backend Variables

```bash
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/assistantapp

# Redis (optional - set DISABLE_REDIS=true to disable)
REDIS_URL=redis://localhost:6379
DISABLE_REDIS=false

# OpenAI
OPENAI_API_KEY=sk-your-openai-key

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# Slack (optional)
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret

# Security
JWT_SECRET=your-jwt-secret-key
TOKEN_ENCRYPTION_KEY=your-base64-encryption-key

# Optional
SENTRY_DSN=your-sentry-dsn
```

### Optional Variables

```bash
# Environment
NODE_ENV=development

# Server
PORT=3000
BASE_URL=http://localhost:3000

# Logging
LOG_LEVEL=info
```

## Project Structure

```
assistantapp/
├── backend/             # Node.js/TypeScript API server
│   ├── src/            # Source code
│   ├── tests/          # Test files
│   ├── docs/           # Documentation
│   └── package.json    # Backend dependencies
├── frontend/            # React Native mobile application
│   └── ChatbotApp/     # Main app
│       ├── src/        # Source code
│       └── package.json # Frontend dependencies
└── package.json         # Root package configuration
```

## Development Workflow

### Backend Development

```bash
cd backend

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Testing
npm test                    # All tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests
npm run test:e2e          # End-to-end tests

# Database operations
npm run db:migrate:create migration_name
npm run db:migrate:up
npm run db:migrate:down
```

### Frontend Development

```bash
cd frontend/ChatbotApp

# Start Metro bundler
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Clear cache and restart
npm start -- --reset-cache
```

## Common Issues

### Backend Issues

**"Service not initialized"**
- Check: Service is registered in `src/di/registrations/`
- Check: Dependencies are initialized first
- Fix: Add to appropriate registration file

**"Agent not found"**
- Check: Agent registered in AgentFactory
- Check: Agent extends BaseSubAgent
- Fix: Import and register in agent-factory.ts

**Database connection issues**
- Verify DATABASE_URL is correct
- Ensure PostgreSQL is running
- Check database exists and migrations are up

### Frontend Issues

**Metro bundler issues**
```bash
# Clear cache and restart
rm -rf node_modules/.cache
npm start -- --reset-cache
```

**iOS build issues**
```bash
# Clean iOS build
rm -rf ios/build
cd ios && pod install && cd ..
npm run ios
```

**Android build issues**
```bash
# Clean Android build
cd android && ./gradlew clean && cd ..
npm run android
```

## Testing

### Running Tests

```bash
# Backend tests
cd backend
npm test                    # All tests
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests
npm run test:e2e          # E2E tests

# Frontend tests
cd frontend/ChatbotApp
npm test                   # Jest tests
```

### Test Structure

Tests mirror the source structure:
```
src/services/domain/email-domain.service.ts
tests/unit/services/domain/email-domain.service.test.ts
```

## API Documentation

When running in development mode, API documentation is available at:
```
http://localhost:3000/docs
```

### Key Endpoints

- `GET /healthz` - Health check
- `GET /auth/google` - Google OAuth login
- `GET /auth/callback` - OAuth callback
- `POST /api/chat/message` - Chat API

## Next Steps

1. **Read the Architecture Docs**: Check `docs/architecture/` for system design
2. **Review Contributing Guide**: See `CONTRIBUTING.md` for development standards
3. **Explore the Codebase**: Start with `src/index.ts` and follow the flow
4. **Run Tests**: Ensure everything works with `npm test`
5. **Check Linting**: Run `npm run lint` to see code quality standards

## Getting Help

- **Documentation**: Check `docs/` directory
- **Architecture**: Review `docs/architecture/` files
- **Issues**: Open an issue on GitHub
- **Team**: Ask team members for guidance

## Additional Resources

- [Architecture Overview](../architecture/overview.md)
- [Contributing Guide](../CONTRIBUTING.md)
- [Quick Reference](../QUICK_REFERENCE.md)
- [Linting Guide](../LINTING.md)
