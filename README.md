# AI Assistant for Email & Calendar Management

> A production-grade AI assistant that transforms natural language queries into complex multi-step operations across Google Workspace APIs. Built with a novel 3-layer DAG-based architecture for parallel execution and intelligent query decomposition.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![React Native](https://img.shields.io/badge/React_Native-20232A?logo=react&logoColor=61DAFB)](https://reactnative.dev/)

---

## 📹 Demo

**[Watch 2-minute demo video](#)** *(coming soon)*

---

## The Problem

Knowledge workers drown in email and calendar management:
- **Inbox overload**: 200+ emails/day, urgent messages buried
- **Dropped commitments**: "I'll get back to you" promises forgotten
- **Context switching**: Searching through threads kills productivity
- **Calendar chaos**: Finding meeting times across timezones is painful

Existing tools (Gmail search, Superhuman, etc.) only handle **simple keyword searches**. Complex queries like *"Show me emails where I promised to follow up but haven't responded in 3+ days"* require manual hunting.

## The Solution

An AI assistant that **understands intent, decomposes complex queries, and executes multi-step operations in parallel**:

**Example queries:**
- *"Show me urgent emails I haven't responded to"*
- *"What did I promise to do in the Smith project thread?"*
- *"Find all unanswered emails from clients this week"*
- *"When am I free for a 30-minute meeting with Sarah?"*
- *"Catch me up on the Q4 planning discussion"*

Instead of keyword matching, the system:
1. **Decomposes** the query into a directed acyclic graph (DAG) of operations
2. **Executes** operations in parallel stages (respecting dependencies)
3. **Synthesizes** structured results into natural language responses

---

## 🏗️ Architecture Highlights

### Novel 3-Layer Pipeline

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: Query Decomposition                          │
│  Natural language → Structured execution graph (DAG)   │
│  • Identifies intent and required operations           │
│  • Builds dependency graph for parallel execution      │
│  • Estimates cost/tokens before execution              │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 2: Parallel Execution Engine                    │
│  Executes DAG in stages with 5 strategy types          │
│  • Metadata filtering (fast path)                      │
│  • Keyword search (medium complexity)                  │
│  • Semantic analysis (AI-powered)                      │
│  • Cross-reference operations (multi-domain)           │
│  • Batch thread reading (context recovery)             │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 3: Response Synthesis                           │
│  Structured findings → Natural language response       │
│  • Context-aware summarization                         │
│  • User preference handling (tone, format)             │
│  • Token-bounded output                                │
└─────────────────────────────────────────────────────────┘
```

### Key Technical Decisions

**Stateless Architecture**
- Client manages conversation history
- Enables horizontal scaling without session affinity
- No server-side state to manage or synchronize

**DAG-Based Execution**
- Automatic dependency resolution
- Parallel execution where possible (2-5x faster)
- Fault-tolerant (continues on partial failures)

**Production-Grade Security**
- OAuth 2.0 with automatic token refresh
- AES-256-GCM encrypted token storage
- Rate limiting and request validation
- Circuit breakers for external APIs

---

## 📊 Project Stats

| Metric | Value |
|--------|-------|
| **Lines of Code** | 29,744 (TypeScript) |
| **Source Files** | 127 |
| **Test Files** | 36 |
| **Test Coverage** | 80%+ |
| **Documented Use Cases** | 700+ |
| **TypeScript Errors** | 0 (strict mode) |
| **Development Time** | 4 weeks (322 commits) |

---

## 🛠️ Tech Stack

**Backend**
- **Runtime**: Node.js 20+ with TypeScript (strict mode, Phase 1)
- **Framework**: Express.js with comprehensive middleware
- **Database**: PostgreSQL 15+ via Supabase
- **Cache**: Redis (optional, can be disabled)
- **AI**: OpenAI GPT-4 + Anthropic Claude

**Frontend**
- **Mobile**: React Native with TypeScript
- **State**: Context API with AsyncStorage
- **UI**: Custom design system
- **Auth**: Supabase OAuth 2.0

**Infrastructure**
- **Deployment**: Railway (Docker)
- **Monitoring**: Sentry error tracking
- **Logging**: Winston structured logging
- **CI/CD**: GitHub Actions (configured)

---

## ✨ Key Features

**For Users:**
- Natural language query interface (no syntax to learn)
- Complex multi-domain operations (email + calendar + contacts)
- Cost estimation before expensive operations
- Offline-first mobile app with sync
- Comprehensive onboarding flow

**For Engineers:**
- **Dependency Injection**: Awilix-based DI with lifecycle management
- **Error Factory Pattern**: Centralized, categorized error creation
- **DataLoader Pattern**: 10x performance via automatic batching
- **Retry Manager**: Exponential backoff with jitter
- **Request Tracing**: UUID correlation IDs throughout stack
- **Custom E2E Framework**: AI-powered test validation with ground truth

---

## 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/ezhong0/assistantapp
cd assistantapp/backend

# Install dependencies
npm install

# Set up environment
cp env.example .env
# Edit .env with your API keys (see Configuration section)

# Database setup
npm run db:setup
npm run db:migrate:up

# Start development server
npm run dev

# In another terminal - run tests
npm test
```

**Frontend (React Native):**
```bash
cd frontend/ChatbotApp
npm install
npm run ios  # or npm run android
```

---

## ⚙️ Configuration

Required environment variables (90+ total, see `backend/env.example`):

```bash
# Database
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...

# AI Services
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Security
JWT_SECRET=your-secret-key-min-32-chars
TOKEN_ENCRYPTION_KEY=base64-encoded-key

# Optional
DISABLE_REDIS=true  # Disable caching for local dev
```

---

## 🧪 Testing

The project includes a **custom E2E testing framework** with AI-powered validation:

```bash
# Run all tests
npm test

# Specific test suites
npm run test:unit          # Unit tests (services, utilities)
npm run test:integration   # Integration tests (API endpoints)
npm run test:e2e          # End-to-end tests (full workflows)

# E2E system (generate realistic test data + validate)
npm run e2e:generate-inbox founder  # Generate test inbox
npm run e2e:test                   # Run multi-LLM evaluation
npm run e2e:report                # Generate HTML report
```

**E2E Framework Features:**
- Generates realistic inboxes with ground truth
- Compares responses from multiple LLMs
- Validates against expected outcomes
- Produces detailed HTML reports

---

## 📚 Documentation

**Start Here:**
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System architecture, 3-layer design, data flow
- **[WHY.md](docs/WHY.md)** - Design philosophy, tradeoffs, alternatives considered

**Development:**
- **[Getting Started](backend/docs/development/getting-started.md)** - Detailed setup guide
- **[Quick Reference](backend/docs/development/QUICK_REFERENCE.md)** - Common tasks and patterns
- **[CONTRIBUTING.md](backend/docs/development/CONTRIBUTING.md)** - Conventions and guidelines
- **[ADRs](backend/docs/adr/)** - Architecture Decision Records

**API:**
- **[API Reference](backend/docs/api/api.md)** - Endpoint documentation
- **[Command Library](backend/docs/api/commands.md)** - 700+ example queries

---

## 📁 Project Structure

```
assistantapp/
├── backend/                    # Node.js/TypeScript API server
│   ├── src/
│   │   ├── layers/            # 3-layer architecture implementation
│   │   │   ├── layer1-decomposition/
│   │   │   ├── layer2-execution/
│   │   │   └── layer3-synthesis/
│   │   ├── services/          # Domain & infrastructure services
│   │   │   ├── domain/        # Email, Calendar, Contacts, AI
│   │   │   └── infrastructure/
│   │   ├── di/                # Dependency injection container
│   │   ├── errors/            # Error factory & transformers
│   │   └── middleware/        # Express middleware (auth, validation)
│   ├── tests/                 # Unit, integration, E2E tests
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   └── docs/                  # Backend documentation
│
├── frontend/                  # React Native mobile app
│   └── ChatbotApp/
│       ├── src/
│       │   ├── components/    # UI components
│       │   ├── screens/       # App screens
│       │   ├── contexts/      # State management
│       │   └── services/      # API client
│
└── docs/                      # Project-level documentation
    ├── ARCHITECTURE.md
    ├── WHY.md
    └── architecture/
```

---

## 🚀 Deployment

**Railway (Recommended):**
```bash
npm run railway:deploy
```

**Docker:**
```bash
docker build -t assistantapp .
docker run -p 3000:3000 --env-file .env assistantapp
```

**Environment Setup:**
- Configure all 90+ environment variables
- Set up Supabase project (PostgreSQL + Auth)
- Configure Google OAuth credentials
- Add OpenAI/Anthropic API keys
- Optional: Configure Redis for caching

---

## 🎯 Current Status

**What's Complete:**
- ✅ Complete 3-layer architecture implementation
- ✅ 5 execution strategies (metadata, keyword, semantic, cross-ref, batch)
- ✅ OAuth 2.0 authentication with Google
- ✅ Encrypted token storage with auto-refresh
- ✅ Comprehensive error handling and retry logic
- ✅ Custom E2E testing framework
- ✅ React Native mobile app with onboarding
- ✅ 700+ documented use cases
- ✅ Full documentation (15+ markdown files)

**In Progress:**
- 🔨 E2E test stabilization (mock setup issues)
- 🔨 Frontend chat interface completion
- 🔨 Production deployment validation

**Timeline:** 2-3 weeks to production-ready v1.0

---

## 🤝 Contributing

1. Read **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** and **[WHY.md](docs/WHY.md)** first
2. Check **[CONTRIBUTING.md](backend/docs/development/CONTRIBUTING.md)** for conventions
3. Follow TypeScript strict mode guidelines
4. Add tests for all changes (maintain 80%+ coverage)
5. Use ErrorFactory (no raw `throw new Error()`)
6. Submit PR with detailed description

---

## 📄 License

This project is licensed under the **AGPL-3.0 License**.

This means:
- ✅ You can use, modify, and distribute this code
- ✅ You can run it as a service
- ⚠️ If you modify and run as a service, you **must** open-source your changes
- ⚠️ Cannot create a proprietary derivative

See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

Built by **[Edward Zhong](https://github.com/ezhong0)** over 4 weeks (Sept-Oct 2024) as a demonstration of:
- Production-grade system architecture
- TypeScript/Node.js best practices
- AI/LLM integration patterns
- Full-stack development capabilities

**Technologies & Libraries:**
- OpenAI & Anthropic for LLM APIs
- Supabase for auth and database
- Awilix for dependency injection
- Zod for runtime validation
- Jest for testing
- React Native for mobile

---

## 📧 Contact

**Edward Zhong**
- GitHub: [@ezhong0](https://github.com/ezhong0)
- LinkedIn: [/in/edwardzhong0](https://linkedin.com/in/edwardzhong0)
- Email: edwardrzhong@gmail.com

---

## ⭐ If you find this project impressive, please star the repo!

This helps others discover the project and validates the architecture and implementation approach.

---

**README last updated:** January 2025
