# AI Assistant Application

A sophisticated AI-powered assistant application that orchestrates multiple domain-specific services (Email, Calendar, Contacts, Slack) through an intelligent agent system.

## 🚀 Quick Start

```bash
# Clone and setup
git clone <repository-url>
cd assistantapp
npm install

# Backend setup
cd backend
npm install
cp env.example .env
# Edit .env with your configuration
npm run db:setup
npm run db:migrate:up

# Frontend setup
cd ../frontend/ChatbotApp
npm install

# Start development
cd ../../backend && npm run dev &
cd ../frontend/ChatbotApp && npm run ios
```

## 📁 Project Structure

```
assistantapp/
├── backend/             # Node.js/TypeScript API server
├── frontend/            # React Native mobile application
├── docs/                # Documentation
└── README.md           # This file
```

## 🏗️ Architecture

The application follows a **3-layer architecture** with stateless design:

- **Layer 1**: Query Decomposition (understanding user intent)
- **Layer 2**: Execution Coordination (orchestrating domain services)
- **Layer 3**: Response Synthesis (natural language generation)

## 📚 Documentation

- **[Getting Started](backend/docs/development/getting-started.md)** - Complete setup guide
- **[Architecture](backend/docs/architecture/)** - System design and patterns
- **[API Commands](backend/docs/CHATBOT_COMMANDS_EXAMPLES.md)** - Available commands
- **[Contributing](backend/docs/development/CONTRIBUTING.md)** - Development standards

## 🛠️ Development

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Redis (optional)

### Key Commands
```bash
# Backend
cd backend
npm run dev          # Start development server
npm test            # Run tests
npm run lint        # Check code quality

# Frontend
cd frontend/ChatbotApp
npm run ios         # iOS simulator
npm run android     # Android emulator
```

## 🔧 Configuration

Key environment variables (see `backend/env.example`):
- `DATABASE_URL` - PostgreSQL connection
- `OPENAI_API_KEY` - OpenAI API access
- `GOOGLE_CLIENT_ID/SECRET` - Google OAuth
- `JWT_SECRET` - Authentication secret

## 🧪 Testing

```bash
cd backend
npm test                    # All tests
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests
npm run test:e2e          # End-to-end tests
```

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

## 📊 Features

- **Multi-Agent AI System**: Specialized agents for different domains
- **OAuth 2.0 Authentication**: Secure authentication with Google and Slack
- **Token Management**: Encrypted token storage and management
- **Rate Limiting**: Built-in rate limiting and security middleware
- **Error Tracking**: Comprehensive error tracking with Sentry
- **Health Monitoring**: Service health checks and monitoring
- **Database Migrations**: Version-controlled database schema management
- **Comprehensive Testing**: Unit, integration, and E2E tests

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run the test suite
6. Submit a pull request

See [Contributing Guide](backend/docs/development/CONTRIBUTING.md) for detailed standards.

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

- **Documentation**: Check the `docs/` directory
- **Issues**: Open an issue on GitHub
- **Team**: Contact the development team
