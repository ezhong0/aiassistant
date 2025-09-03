# 🧠 AI Assistant Platform

A sophisticated, AI-powered Slack assistant that demonstrates **architecture-first development** with clear boundaries, continuous validation, and AI-assisted implementation. This platform serves as a reference implementation for building complex, maintainable applications with AI collaboration.

## 📚 Documentation

**➡️ [Complete Documentation](./docs/README.md)** - Comprehensive guides and references

### Quick Links
- **[Getting Started](./docs/getting-started.md)** - Setup and installation
- **[API Reference](./docs/api-reference.md)** - Complete API documentation
- **[System Architecture](./docs/architecture.md)** - Technical architecture
- **[Agent Development](./docs/agent-development.md)** - Building AI agents
- **[Configuration Guide](./docs/configuration.md)** - Environment setup
- **[Troubleshooting](./docs/troubleshooting.md)** - Common issues

## 🎯 Vision & Features

### Core Capabilities
- **🤖 Multi-Agent Intelligence** - Master agent orchestrating 6 specialized sub-agents
- **📧 Gmail Integration** - Natural language email operations
- **📅 Calendar Management** - Google Calendar integration with smart scheduling
- **👥 Contact Management** - Google Contacts with fuzzy matching
- **🔍 Web Search** - Tavily-powered information retrieval
- **💬 Slack Integration** - Rich bot interface with interactive components
- **🔒 Enterprise Security** - OAuth 2.0, JWT, rate limiting, input validation

## ⚡ Quick Start

### Prerequisites
- **Node.js** 18+ and npm
- **PostgreSQL** (optional, for persistence)
- **Google Cloud Console** account for OAuth
- **OpenAI API Key** for AI functionality
- **Slack Developer Account** (for Slack integration)

### Installation

```bash
# 1. Clone and setup
git clone <repository>
cd assistantapp

# 2. Backend setup
cd backend
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your API keys and settings

# 4. Start development server
npm run dev
```

The server will start at `http://localhost:3000`. Verify with:

```bash
curl http://localhost:3000/health
```

**➡️ For detailed setup instructions, see [Getting Started Guide](./docs/getting-started.md)**

## 🏗️ Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Slack Bot Interface                          │
│              (Web App, Mobile App, Slack Bot)                   │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTP/HTTPS
┌─────────────────────▼───────────────────────────────────────────┐
│                    Express.js Server                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
│  │ Middleware  │ │   Routes    │ │  Interfaces │ │   Utils   │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                   Service Layer                                  │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │ Service Manager │ │  Agent Factory  │ │ Database Service│   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
└─────────────┬───────────────────┬───────────────────┬───────────┘
              │                   │                   │
┌─────────────▼───────┐ ┌─────────▼───────┐ ┌─────────▼───────┐
│   PostgreSQL DB     │ │   AI Agents     │ │  External APIs  │
│                     │ │                 │ │                 │
│ • Sessions          │ │ • Master Agent  │ │ • Google APIs   │
│ • OAuth Tokens      │ │ • Email Agent   │ │ • OpenAI API    │
│ • Slack Data        │ │ • Contact Agent │ │ • Slack API     │
│ • User Data         │ │ • Calendar Agent│ │ • Tavily API    │
└─────────────────────┘ └─────────────────┘ └─────────────────┘
```

### Project Structure

```
assistantapp/
├── backend/                      # Node.js/TypeScript backend
│   ├── src/
│   │   ├── agents/              # AI agent implementations
│   │   ├── services/            # Business logic services
│   │   ├── interfaces/          # Input/output interfaces
│   │   ├── routes/              # API route handlers
│   │   ├── middleware/          # Express middleware
│   │   ├── framework/           # Core framework classes
│   │   ├── config/              # Configuration management
│   │   └── types/               # TypeScript type definitions
│   ├── tests/                   # Comprehensive test suite
│   └── docs/                    # Technical documentation
└── docs/                        # Project documentation
    ├── README.md                # Documentation hub
    ├── getting-started.md       # Setup guide
    ├── architecture.md          # System architecture
    ├── agent-development.md     # Agent framework guide
    └── ...                      # Additional guides
```

**➡️ For detailed architecture, see [System Architecture](./docs/architecture.md)**

## 🛠️ Development

### Available Commands

```bash
# Development
npm run dev          # Development server with hot reload
npm run build        # TypeScript compilation
npm run start        # Production server

# Quality & Testing
npm run lint         # ESLint code quality check
npm run format       # Prettier code formatting
npm run typecheck    # TypeScript type checking
npm test             # Run all tests
npm run test:watch   # Watch mode for tests

# Database
npm run db:setup     # Set up database schema
npm run db:test      # Test database connection
```

### Technology Stack

- **Runtime:** Node.js 18+ with TypeScript
- **Framework:** Express 5.x with Slack Bolt SDK
- **Database:** PostgreSQL with connection pooling
- **AI Integration:** OpenAI GPT-4
- **Authentication:** JWT + Google/Slack OAuth 2.0
- **External APIs:** Google Workspace, Slack API, Tavily
- **Testing:** Jest with comprehensive test coverage

## 🎯 Development Philosophy

### Architecture-First Approach
This platform demonstrates **AI-assisted development** with clear architectural boundaries:

1. **Review architectural patterns** before implementation
2. **Follow established interfaces** and service contracts
3. **Maintain separation of concerns** between layers
4. **Use comprehensive testing** for validation

### AI Collaboration Patterns
- **Architecture AI** - System design and refactoring decisions
- **Implementation AI** - Feature development within established patterns
- **Quality AI** - Code review and optimization
- **Testing AI** - Test generation and coverage analysis

## 🚀 Current Status

### ✅ Completed Features
- **Backend Foundation** - Express server with TypeScript and comprehensive middleware
- **Multi-Agent System** - Master agent with 6 specialized sub-agents
- **Service Architecture** - Dependency injection and lifecycle management
- **Authentication** - Complete OAuth 2.0 flow with Google and Slack
- **Database Integration** - PostgreSQL for persistent storage
- **Slack Integration** - Complete bot with event handling
- **Testing Framework** - Comprehensive test suite with AI behavior validation
- **Documentation** - Complete technical and architectural documentation

### 🔄 In Progress
- **Performance Optimization** - Response time optimization
- **Advanced Workflows** - Cross-agent communication protocols
- **Production Deployment** - Environment configuration and monitoring

### 📋 Next Steps
- **Slack App Directory** - Prepare for official distribution
- **Beta Testing** - Launch with test workspaces
- **Mobile Interface** - Extend beyond Slack integration

## 🤝 Contributing

We welcome contributions! This platform demonstrates how to build complex, maintainable applications with AI assistance while maintaining architectural integrity and code quality.

### Development Workflow
1. **Architecture Review** - Understand existing patterns before implementation
2. **Feature Planning** - Follow established interfaces and service contracts
3. **Implementation** - Use AI assistance within established boundaries
4. **Testing** - Comprehensive testing with AI behavior validation
5. **Documentation** - Update relevant documentation sections

### Quality Gates
- **Code Review** - All changes require architectural review
- **Testing** - Minimum 80% test coverage maintained
- **Linting** - ESLint and Prettier compliance required
- **Type Safety** - Comprehensive TypeScript validation

**➡️ See [Contributing Guidelines](./docs/contributing.md) for detailed information**

## 📞 Support & Resources

### Development Resources
- **Health Check:** `http://localhost:3000/health`
- **API Documentation:** [docs/api-reference.md](./docs/api-reference.md)
- **Troubleshooting:** [docs/troubleshooting.md](./docs/troubleshooting.md)
- **Architecture Guide:** [docs/architecture.md](./docs/architecture.md)

### Getting Started with AI Development
1. **Read the Documentation** - Start with [docs/README.md](./docs/README.md)
2. **Understand Architecture** - Review [docs/architecture.md](./docs/architecture.md)
3. **Follow Patterns** - Use established error handling and logging
4. **Test Thoroughly** - Leverage the comprehensive test suite
5. **Document Changes** - Update relevant documentation sections

## 📄 License

ISC License - see LICENSE file for details.

---

**🤖 Built with Node.js, TypeScript, OpenAI, and modern development practices as a reference implementation for AI-assisted development.**
