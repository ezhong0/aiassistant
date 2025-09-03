# Assistant App Backend

A secure, production-ready Node.js/TypeScript backend API for an AI-powered assistant with Google OAuth authentication, multi-agent architecture, and comprehensive integrations.

## 📚 Documentation

**➡️ [Complete Documentation](../docs/README.md)** - Start here for comprehensive guides

### Quick Links
- **[Getting Started](../docs/getting-started.md)** - Setup and installation
- **[API Reference](../docs/api-reference.md)** - Complete API documentation
- **[Agent Development](../docs/agent-development.md)** - Building AI agents
- **[Configuration Guide](../docs/configuration.md)** - Environment and settings
- **[Architecture Overview](../docs/architecture.md)** - System design
- **[Troubleshooting](../docs/troubleshooting.md)** - Common issues and solutions

## 🚀 Features

### AI-Powered Assistant
- ✅ **Multi-Agent Architecture** - Specialized agents for different tasks
- ✅ **OpenAI Integration** - GPT-4 powered intelligent responses
- ✅ **Natural Language Processing** - Command interpretation and routing
- ✅ **Conversation Management** - Session-based conversation continuity
- ✅ **Action Confirmation** - User confirmation for sensitive operations

### Core Integrations
- 📧 **Gmail Integration** - Send, search, and manage emails
- 📅 **Google Calendar** - Schedule and manage calendar events
- 👥 **Google Contacts** - Search and manage contacts
- 💬 **Slack Integration** - Bot interface for Slack workspaces
- 🔍 **Web Search** - Tavily-powered web information gathering

### Security & Infrastructure
- 🔒 **JWT Security** - Stateless authentication with secure tokens
- 🛡️ **OAuth 2.0 Flow** - Google and Slack OAuth integrations
- 🚫 **Rate Limiting** - Multi-tier protection against abuse
- 🔐 **Security Headers** - Comprehensive security middleware
- 📊 **Structured Logging** - Winston with daily log rotation
- 🗄️ **PostgreSQL Database** - Persistent session and user data
- ⚡ **Service Architecture** - Dependency injection and lifecycle management

## ⚡ Quick Start

### Prerequisites
- **Node.js** 18.x or higher
- **PostgreSQL** 14.x or higher (optional)
- **Google Cloud Console** account for OAuth

### Installation & Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your settings (see Configuration Guide)

# 3. Start development server
npm run dev
```

**➡️ For detailed setup instructions, see [Getting Started Guide](../docs/getting-started.md)**

## 🏗️ Architecture

```
backend/
├── src/
│   ├── agents/          # AI agent implementations
│   ├── config/          # Configuration management
│   ├── framework/       # Base classes and factories
│   ├── interfaces/      # External service interfaces
│   ├── middleware/      # Express middleware
│   ├── routes/          # API endpoints
│   ├── services/        # Business logic layer
│   ├── types/           # TypeScript definitions
│   ├── utils/           # Utility functions
│   └── index.ts         # Application entry point
├── docs/                # Documentation
├── tests/               # Test files
└── logs/                # Log files
```

**➡️ For detailed architecture information, see [Architecture Overview](../docs/architecture.md)**

## 🔗 API Overview

### Core Endpoints

- **`/auth/*`** - Authentication and OAuth flows
- **`/api/assistant/*`** - Main assistant functionality  
- **`/protected/*`** - User profile and protected operations
- **`/slack/*`** - Slack integration webhooks
- **`/health`** - System health monitoring

### Key Features

- **Natural Language Processing** - Send commands in plain English
- **Action Confirmation** - Secure confirmation for sensitive operations
- **Session Management** - Persistent conversation context
- **Multi-format Responses** - JSON responses with rich metadata

**➡️ For complete API documentation, see [API Reference](../docs/api-reference.md)**

## 🧪 Development & Testing

### Available Scripts

```bash
npm run dev          # Development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm start            # Start production server
npm run lint         # Run ESLint
npm run test         # Run test suite
npm run typecheck    # TypeScript type checking
```

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit
npm run test:integration
```

## 🔍 Monitoring & Logging

The system includes comprehensive logging and monitoring:

- **Structured Logging** - Winston with daily log rotation
- **Health Endpoints** - System status and metrics  
- **Error Tracking** - Detailed error logs with context
- **Performance Metrics** - Request timing and resource usage

```bash
# Check system health
curl http://localhost:3000/health

# View logs  
tail -f logs/combined-$(date +%Y-%m-%d).log
```

## 🛡️ Security Features

- **Multi-layer Authentication** - JWT + OAuth 2.0
- **Request Validation** - Zod schema validation
- **Rate Limiting** - Multi-tier protection
- **Security Headers** - Comprehensive header protection
- **Input Sanitization** - XSS and injection protection

## 🚀 Production Deployment

Ready for production with:

- **Environment Configuration** - Validated settings
- **Database Integration** - PostgreSQL with migrations
- **Process Management** - PM2 and Docker support
- **Health Monitoring** - Built-in health checks
- **Graceful Shutdown** - Clean process termination

**➡️ For deployment guides, see [Configuration Guide](../docs/configuration.md)**

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](../docs/contributing.md) for:

- Code standards and style guides
- Development workflow and testing
- Pull request process
- Issue reporting guidelines

## 🆘 Need Help?

- **Getting Started Issues** - See [Getting Started Guide](../docs/getting-started.md)
- **API Questions** - Check [API Reference](../docs/api-reference.md)  
- **Configuration Problems** - Review [Configuration Guide](../docs/configuration.md)
- **Common Issues** - Visit [Troubleshooting Guide](../docs/troubleshooting.md)

### Quick Debug

```bash
# Check system health
curl http://localhost:3000/health

# Enable debug logging
LOG_LEVEL=debug npm run dev

# View real-time logs
tail -f logs/combined-$(date +%Y-%m-%d).log
```

## 📄 License

ISC License - see LICENSE file for details.

---

**🤖 Built with Node.js, TypeScript, OpenAI, and modern development practices.**