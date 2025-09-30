# AI Assistant Application Backend

A sophisticated AI-powered assistant application that orchestrates multiple domain-specific services (Email, Calendar, Contacts, Slack) through an intelligent agent system.

## 🚀 Features

- **Multi-Agent AI System**: Specialized agents for different domains
- **OAuth 2.0 Authentication**: Secure authentication with Google and Slack
- **Token Management**: Encrypted token storage and management
- **Rate Limiting**: Built-in rate limiting and security middleware
- **Error Tracking**: Comprehensive error tracking with Sentry
- **Health Monitoring**: Service health checks and monitoring
- **Database Migrations**: Version-controlled database schema management
- **Comprehensive Testing**: Unit, integration, and E2E tests
- **CI/CD Pipeline**: Automated testing and deployment

## 🏗️ Architecture

The application follows a service-oriented architecture with:

- **BaseService**: Abstract base class for all services
- **ServiceManager**: Centralized service registry and dependency injection
- **Domain Services**: Specialized services for each domain
- **Infrastructure Services**: Core services (Database, Cache, Encryption, Error Tracking)
- **Agent Layer**: AI agents that orchestrate domain services
- **Middleware Layer**: Cross-cutting concerns (authentication, rate limiting, error handling)

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis (optional)
- npm or yarn

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd assistantapp/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Set up the database**
   ```bash
   npm run db:setup
   ```

5. **Run database migrations**
   ```bash
   npm run db:migrate:up
   ```

## 🔧 Configuration

### Environment Variables

Key environment variables (see `env.example` for complete list):

- `NODE_ENV`: Environment (development, production, test)
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string (optional)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Google OAuth credentials
- `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET`: Slack OAuth credentials
- `OPENAI_API_KEY`: OpenAI API key
- `JWT_SECRET`: JWT signing secret
- `TOKEN_ENCRYPTION_KEY`: Base64-encoded encryption key
- `SENTRY_DSN`: Sentry error tracking DSN (optional)

### Service Configuration

The application uses a unified configuration system that automatically detects available services and adapts accordingly.

## 🚀 Running the Application

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Docker
```bash
docker build -t assistantapp .
docker run -p 3000:3000 assistantapp
```

## 🧪 Testing

### Unit Tests
```bash
npm run test:unit
```

### Integration Tests
```bash
npm run test:integration
```

### E2E Tests
```bash
npm run test:e2e
```

### All Tests
```bash
npm test
```

### Test Coverage
```bash
npm run test:coverage
```

## 📊 Database Management

### Migrations
```bash
# Create new migration
npm run db:migrate:create migration_name

# Run migrations
npm run db:migrate:up

# Rollback migration
npm run db:migrate:down

# Run migrations with logging
npm run db:migrate:run
```

### Database Setup
```bash
# Setup database
npm run db:setup

# Optimize database
npm run db:optimize
```

## 🔒 Security

### Rate Limiting
- Built-in rate limiting middleware
- Configurable limits and windows
- Memory-efficient with TTL cleanup

### Token Encryption
- AES-256-GCM encryption for sensitive data
- Key rotation support
- Secure key management

### Security Headers
- Helmet.js for security headers
- CORS configuration
- Input validation with Zod

## 📈 Monitoring

### Health Checks
- Service health monitoring
- Database connectivity checks
- Cache service status
- Comprehensive health endpoint

### Error Tracking
- Sentry integration for error tracking
- Performance monitoring
- User context association
- Error filtering and categorization

### Logging
- Structured logging with Winston
- Request/response logging
- Audit trail for sensitive operations
- Configurable log levels

## 🚀 Deployment

### Railway
```bash
npm run railway:deploy
```

### Docker
```bash
docker build -t assistantapp .
docker run -p 3000:3000 assistantapp
```

### Environment Setup
1. Set environment variables
2. Run database migrations
3. Configure OAuth providers
4. Set up monitoring (Sentry, etc.)

## 📚 API Documentation

### Swagger UI
When running in development mode, API documentation is available at:
```
http://localhost:3000/docs
```

### Key Endpoints
- `GET /healthz` - Health check
- `GET /auth/google` - Google OAuth login
- `GET /auth/callback` - OAuth callback
- `GET /auth/validate` - Token validation

## 🏗️ Development

### Code Structure
```
src/
├── agents/           # AI agents
├── config/           # Configuration
├── framework/        # Framework components
├── middleware/       # Express middleware
├── routes/           # API routes
├── schemas/          # Validation schemas
├── services/         # Business logic services
├── types/            # TypeScript types
├── utils/            # Utility functions
└── validation/       # Validation logic
```

### Adding New Services
1. Create service class extending `BaseService`
2. Register service in `service-initialization.ts`
3. Add dependencies and initialization order
4. Write unit tests
5. Update documentation

### Adding New Agents
1. Create agent class extending `BaseSubagent`
2. Implement required methods
3. Register in agent factory
4. Add to master agent
5. Write tests

## 📝 Architecture Decision Records (ADRs)

Architecture decisions are documented in `docs/adr/`:

- [ADR-0001: Service Layer Architecture](docs/adr/0001-service-architecture.md)
- [ADR-0002: Encryption Service Extraction](docs/adr/0002-encryption-service.md)
- [ADR-0003: Sentry Error Tracking Integration](docs/adr/0003-sentry-integration.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run the test suite
6. Submit a pull request

### Development Guidelines
- Follow TypeScript best practices
- Write comprehensive tests
- Update documentation
- Follow the existing code style
- Use conventional commit messages

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Check the documentation
- Review the ADRs
- Open an issue
- Contact the development team

## 🔄 Changelog

### v1.0.2
- Added comprehensive CI/CD pipeline
- Implemented unit test structure
- Added database migrations
- Enhanced error tracking with Sentry
- Improved security with rate limiting
- Added comprehensive API documentation
- Implemented service architecture
- Added encryption service
- Enhanced health monitoring
- Improved Docker configuration
