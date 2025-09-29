# AI Assistant App

A sophisticated, multi-agent AI system that functions as an intelligent executive assistant, integrating with Google services (Gmail, Calendar, Contacts) and Slack to automate complex workflows through natural language commands.

## 🚀 Quick Start

### Prerequisites

- Node.js 20.0.0 or higher
- PostgreSQL database
- Redis (optional, for caching)
- Google Cloud Platform project with APIs enabled
- Slack workspace with bot permissions

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd assistantapp
   ```

2. **Install dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up the database**
   ```bash
   npm run db:setup
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:3000`

## 🎯 What This App Does

This AI Assistant App serves as a **conversational interface** that can understand complex, multi-step requests in natural language and execute them across multiple integrated services.

### Key Capabilities

- **📧 Email Management**: Send, search, and manage Gmail with AI-powered drafting
- **📅 Calendar Coordination**: Schedule meetings, find availability, manage events
- **👥 Contact Management**: Search and manage Google Contacts
- **💬 Slack Integration**: Send messages, read conversations, handle commands
- **🤖 AI Workflow Orchestration**: Execute complex multi-step tasks

### Example Use Cases

- *"Set up the board meeting next month - send calendar invites, request agenda items, and follow up on RSVPs"*
- *"Coordinate the customer visit: schedule meetings, book conference rooms, send logistics email to attendees"*
- *"The demo went well - send thank you, schedule follow-up, and add prospect to nurture sequence"*

## 🏗️ Architecture

### Multi-Agent System

- **Master Agent**: Orchestrates workflows and manages context
- **Email Agent**: Gmail operations and email management
- **Calendar Agent**: Google Calendar operations and scheduling
- **Contact Agent**: Google Contacts management
- **Slack Agent**: Slack workspace operations

### Technology Stack

- **Backend**: Node.js, TypeScript, Express
- **AI**: OpenAI GPT models
- **Database**: PostgreSQL with encrypted token storage
- **Cache**: Redis (optional)
- **Authentication**: OAuth 2.0 (Google, Slack)
- **Deployment**: Railway, Docker

## 🔧 Configuration

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/assistantapp

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# Slack
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_SIGNING_SECRET=your_slack_signing_secret

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# JWT
JWT_SECRET=your_jwt_secret

# Application
NODE_ENV=development
PORT=3000
BASE_URL=http://localhost:3000
```

### Google Cloud Setup

1. Create a Google Cloud Project
2. Enable the following APIs:
   - Gmail API
   - Google Calendar API
   - People API (Contacts)
3. Create OAuth 2.0 credentials
4. Add authorized redirect URIs

### Slack App Setup

1. Create a Slack App at [api.slack.com](https://api.slack.com/apps)
2. Configure OAuth & Permissions with required scopes
3. Set up Event Subscriptions (optional)
4. Install the app to your workspace

## 📚 API Documentation

### Authentication Endpoints

- `GET /auth/google` - Initiate Google OAuth
- `GET /auth/callback` - Handle OAuth callback
- `POST /auth/refresh` - Refresh access tokens
- `POST /auth/logout` - Revoke tokens and logout

### Protected Endpoints

- `GET /protected/profile` - Get user profile
- `PUT /protected/profile` - Update user profile
- `GET /protected/dashboard` - User dashboard
- `POST /protected/api-heavy` - Heavy operations (rate limited)

### Slack Endpoints

- `POST /slack/commands` - Handle slash commands
- `POST /slack/events` - Handle Slack events
- `GET /slack/oauth` - Slack OAuth callback

## 🧪 Testing

### Run Tests

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e

# All tests with coverage
npm run test:coverage
```

### Test Structure

- **Unit Tests**: Individual component testing
- **Integration Tests**: Service integration testing
- **E2E Tests**: Full workflow testing with AI evaluation

## 🚀 Deployment

### Railway Deployment

1. **Connect to Railway**
   ```bash
   npm run railway:deploy
   ```

2. **Set environment variables** in Railway dashboard

3. **Deploy**
   ```bash
   railway up
   ```

### Docker Deployment

```bash
# Build image
docker build -t assistantapp .

# Run container
docker run -p 3000:3000 --env-file .env assistantapp
```

## 🔒 Security

### Authentication & Authorization

- **OAuth 2.0**: Secure Google and Slack integration
- **JWT Tokens**: Internal authentication
- **Token Encryption**: Secure storage of OAuth tokens
- **Rate Limiting**: API abuse prevention

### Data Protection

- **Input Validation**: Request sanitization
- **Error Handling**: Secure error responses
- **CORS Configuration**: Cross-origin request security
- **Helmet.js**: Security headers

## 📊 Monitoring & Logging

### Logging

- **Winston**: Structured logging
- **Daily Rotation**: Log file management
- **Correlation IDs**: Request tracking
- **Error Tracking**: Comprehensive error logging

### Health Checks

- `GET /health` - Basic health check
- `GET /healthz` - Kubernetes health check
- `GET /protected/health` - Authenticated health check

## 🤝 Contributing

### Development Setup

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
4. **Run tests**
   ```bash
   npm test
   ```
5. **Commit your changes**
   ```bash
   git commit -m "Add your feature"
   ```
6. **Push to your branch**
   ```bash
   git push origin feature/your-feature-name
   ```
7. **Create a Pull Request**

### Code Style

- **ESLint**: Code linting
- **Prettier**: Code formatting
- **TypeScript**: Type safety
- **Husky**: Git hooks for quality checks

## 📖 Documentation

- [App Overview](APP_OVERVIEW.md) - Comprehensive application overview
- [API Documentation](docs/) - Detailed API reference
- [Testing Framework](backend/docs/testing-framework-design.md) - Testing architecture
- [Prompt Documentation](docs/all-prompts.md) - AI prompt reference

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Issues**
   - Check PostgreSQL is running
   - Verify DATABASE_URL format
   - Run `npm run db:setup`

2. **OAuth Issues**
   - Verify client IDs and secrets
   - Check redirect URIs match
   - Ensure APIs are enabled in Google Cloud

3. **Slack Integration Issues**
   - Verify bot permissions
   - Check signing secret
   - Ensure app is installed to workspace

### Debug Endpoints

- `GET /auth/debug/oauth-config` - OAuth configuration
- `GET /auth/debug/current-config` - Current settings
- `GET /auth/debug/test-oauth-url` - Test OAuth URL generation

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OpenAI for GPT models
- Google for Gmail, Calendar, and Contacts APIs
- Slack for workspace integration
- Railway for hosting platform
- The open-source community for various dependencies

## 📞 Support

For support and questions:

- Create an issue in the repository
- Check the documentation
- Review the troubleshooting section

---

**Built with ❤️ for intelligent business automation**
