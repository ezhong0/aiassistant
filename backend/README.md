# Backend API Server

The backend provides a REST API for the AI Assistant Application with a 3-layer architecture.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Setup environment
cp env.example .env
# Edit .env with your configuration

# Setup database
npm run db:setup
npm run db:migrate:up

# Start development server
npm run dev
```

## 🏗️ Architecture

**3-Layer Stateless Architecture:**
- **Layer 1**: Query Decomposition (understanding user intent)
- **Layer 2**: Execution Coordination (orchestrating domain services)  
- **Layer 3**: Response Synthesis (natural language generation)

**Key Components:**
- **BaseService**: Abstract base class for all services
- **ServiceManager**: Centralized service registry and dependency injection
- **Domain Services**: Specialized services for each domain
- **Infrastructure Services**: Core services (Database, Cache, Encryption, Error Tracking)
- **Middleware Layer**: Cross-cutting concerns (authentication, rate limiting, error handling)

## 🔧 Configuration

Key environment variables (see `env.example`):
- `DATABASE_URL` - PostgreSQL connection
- `OPENAI_API_KEY` - OpenAI API access  
- `GOOGLE_CLIENT_ID/SECRET` - Google OAuth
- `JWT_SECRET` - Authentication secret
- `REDIS_URL` - Redis cache (optional)

## 🚀 Running

```bash
# Development
npm run dev

# Production  
npm run build && npm start

# Docker
docker build -t assistantapp .
docker run -p 3000:3000 assistantapp
```

## 🧪 Testing

```bash
npm test                    # All tests
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests  
npm run test:e2e          # End-to-end tests
```

## 📊 API Documentation

When running in development mode, API documentation is available at:
```
http://localhost:3000/docs
```

### Key Endpoints
- `GET /healthz` - Health check
- `GET /auth/google` - Google OAuth login
- `POST /api/chat/message` - Chat API

## 📚 Documentation

- **[Getting Started](../docs/development/getting-started.md)** - Complete setup guide
- **[Architecture](../docs/architecture/)** - System design and patterns
- **[Contributing](../docs/development/CONTRIBUTING.md)** - Development standards
- **[Quick Reference](../docs/development/QUICK_REFERENCE.md)** - Common tasks

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run the test suite
6. Submit a pull request

See [Contributing Guide](../docs/development/CONTRIBUTING.md) for detailed standards.
