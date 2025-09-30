# AI Executive Assistant

> Your AI Chief of Staff for Gmail, Calendar, Contacts, and Slack

**Orchestrate complex workflows through natural language.** Save 10-20 hours per week on email, scheduling, and coordination tasks.

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)

---

## 🎯 What This Does

Type in Slack:
```
"The demo went well - send thank you, schedule follow-up, 
and add prospect to nurture sequence"
```

The AI:
1. Drafts personalized thank-you email
2. Finds available time on both calendars
3. Creates meeting and sends invitations
4. Starts multi-email nurture sequence
5. Reports back: "Done."

**20 minutes of work → One natural language request**

[Read the full overview →](APP_OVERVIEW.md)

---

## ⚡ Quick Start

### Prerequisites

- Node.js 20.0.0 or higher
- PostgreSQL database
- Google Cloud Platform account (for Gmail, Calendar, Contacts APIs)
- Slack workspace (optional but recommended)
- OpenAI API key

### Installation (5 minutes)

```bash
# 1. Clone the repository
git clone <repository-url>
cd assistantapp/backend

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your credentials (see Configuration section below)

# 4. Set up database
npm run db:setup

# 5. Start the server
npm run dev
```

The application will be available at `http://localhost:3000`

---

## 🔧 Configuration

### Required Environment Variables

Create a `.env` file in the `backend` directory:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/assistantapp

# Google OAuth (see Google Cloud Setup below)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# Slack (see Slack App Setup below)
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_SIGNING_SECRET=your_slack_signing_secret
SLACK_BOT_TOKEN=xoxb-your-bot-token

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# JWT (generate a secure random string)
JWT_SECRET=your_secure_jwt_secret

# Application
NODE_ENV=development
PORT=3000
BASE_URL=http://localhost:3000

# Optional: Redis for caching
REDIS_URL=redis://localhost:6379
```

### Google Cloud Setup

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Enable Required APIs**
   - Gmail API
   - Google Calendar API
   - People API (for Google Contacts)

3. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: "Web application"
   - Add authorized redirect URIs:
     - `http://localhost:3000/auth/callback` (development)
     - `https://yourdomain.com/auth/callback` (production)

4. **Copy Credentials**
   - Copy Client ID and Client Secret to your `.env` file

### Slack App Setup

1. **Create a Slack App**
   - Go to [api.slack.com/apps](https://api.slack.com/apps)
   - Click "Create New App" → "From scratch"
   - Name your app and select your workspace

2. **Configure OAuth & Permissions**
   - Go to "OAuth & Permissions"
   - Add the following Bot Token Scopes:
     - `chat:write`
     - `chat:write.public`
     - `channels:history`
     - `channels:read`
     - `groups:history`
     - `im:history`
     - `im:read`
     - `users:read`
   - Add Redirect URLs:
     - `http://localhost:3000/slack/oauth` (development)
     - `https://yourdomain.com/slack/oauth` (production)

3. **Enable Events (Optional)**
   - Go to "Event Subscriptions"
   - Enable Events
   - Set Request URL: `https://yourdomain.com/slack/events`
   - Subscribe to bot events:
     - `message.channels`
     - `message.groups`
     - `message.im`

4. **Copy Credentials**
   - Copy Client ID, Client Secret, and Signing Secret to your `.env` file

5. **Install App to Workspace**
   - Go to "Install App"
   - Click "Install to Workspace"
   - Copy the Bot Token to your `.env` file as `SLACK_BOT_TOKEN`

---

## 🚀 Usage

### First-Time Setup

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **Connect Google Workspace:**
   - In Slack, type: `@YourBot connect google`
   - Or visit: `http://localhost:3000/auth/google`
   - Authorize Gmail, Calendar, and Contacts access

3. **Start using natural language commands:**
   ```
   "Check my calendar for tomorrow"
   "Find John Smith's email address"
   "Schedule a meeting with Alice next Tuesday at 2pm"
   ```

### Example Commands

#### Simple Operations
```
"Find Sarah's email address"
"Check if I'm free next Tuesday at 2pm"
"Show me emails from john@company.com from last week"
```

#### Medium Complexity
```
"Schedule a 1-hour meeting with Alice and Bob next week to discuss Q4 budget"
"Draft a follow-up email to the client about their proposal"
"Send this template email to all 20 contacts in this CSV"
```

#### Complex Workflows
```
"Set up the board meeting next month - send invites, request agenda items, 
and follow up on RSVPs"

"Coordinate the customer visit: schedule 3 meetings, book conference rooms, 
send logistics email"

"Triage my inbox - flag anything urgent from investors or board members 
and draft replies for approval"
```

[See 500+ more examples →](backend/docs/PROMPT_BUILDERS_USE_CASES.md)

---

## 📁 Project Structure

```
assistantapp/
├── backend/
│   ├── src/
│   │   ├── agents/              # AI agents (Master, Email, Calendar, Contact, Slack)
│   │   ├── services/            # Domain services and API clients
│   │   │   ├── domain/          # Business logic layer
│   │   │   ├── oauth/           # OAuth management
│   │   │   └── *.service.ts     # Core services (DB, cache, AI, etc.)
│   │   ├── routes/              # Express routes
│   │   ├── middleware/          # Auth, rate limiting, error handling
│   │   ├── framework/           # Agent framework and tool registry
│   │   ├── schemas/             # Validation schemas
│   │   └── types/               # TypeScript type definitions
│   ├── tests/                   # Unit, integration, and E2E tests
│   ├── docs/                    # Architecture and API documentation
│   └── package.json
├── APP_OVERVIEW.md              # Product overview and value proposition
└── README.md                    # This file
```

---

## 🧪 Testing

### Run Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# End-to-end tests only
npm run test:e2e

# With coverage report
npm run test:coverage
```

### Test Structure

- **Unit Tests**: Individual components and services
- **Integration Tests**: Service integration and API interactions
- **E2E Tests**: Full workflow testing with AI evaluation

---

## 🚢 Deployment

### Railway Deployment

1. **Install Railway CLI:**
   ```bash
   npm install -g railway
   ```

2. **Login and initialize:**
   ```bash
   railway login
   railway init
   ```

3. **Add environment variables:**
   - Go to Railway dashboard
   - Add all environment variables from `.env`
   - Update `BASE_URL` and redirect URIs to production URLs

4. **Deploy:**
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

### Environment-Specific Configuration

**Development:**
- Debug routes enabled at `/auth/debug/*`
- Verbose logging
- Local database and cache

**Production:**
- Debug routes disabled
- Minimal logging (errors only)
- Production database and Redis
- Rate limiting enabled
- Security headers enforced

---

## 🔒 Security

### Authentication & Authorization

- ✅ **OAuth 2.0** for Google and Slack
- ✅ **JWT tokens** for internal authentication
- ✅ **Encrypted token storage** in PostgreSQL
- ✅ **Automatic token refresh** with rotation
- ✅ **Rate limiting** per user and endpoint
- ✅ **Input validation** on all requests

### Data Protection

- ✅ **Encryption at rest** for OAuth tokens
- ✅ **HTTPS only** in production
- ✅ **CORS protection** with whitelist
- ✅ **Helmet.js** security headers
- ✅ **No email content storage** (privacy-first)
- ✅ **User-controlled access** (revoke anytime)

### Best Practices

- Never commit `.env` files
- Use secrets management in production (Railway, AWS Secrets Manager, etc.)
- Rotate JWT secrets periodically
- Monitor for suspicious activity
- Keep dependencies updated

---

## 📊 API Endpoints

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/google` | GET | Initiate Google OAuth |
| `/auth/callback` | GET | OAuth callback handler |
| `/auth/refresh` | POST | Refresh access tokens |
| `/auth/logout` | POST | Revoke tokens and logout |
| `/auth/status` | GET | Check auth status |

### Protected Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/protected/profile` | GET | Get user profile |
| `/protected/profile` | PUT | Update user profile |
| `/protected/dashboard` | GET | User dashboard |
| `/protected/health` | GET | Authenticated health check |

### Slack Integration

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/slack/events` | POST | Slack event handler |
| `/slack/commands` | POST | Slash command handler |
| `/slack/oauth` | GET | Slack OAuth callback |

### Health & Status

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Basic health check |
| `/healthz` | GET | Kubernetes-style health |

### Debug (Development Only)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/debug/oauth-config` | GET | View OAuth configuration |
| `/auth/debug/current-config` | GET | View current settings |
| `/auth/debug/test-oauth-url` | GET | Test OAuth URL generation |

---

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev              # Start with hot reload
npm run build            # Build TypeScript
npm run start            # Start production server

# Database
npm run db:setup         # Initialize database
npm run db:migrate       # Run migrations
npm run db:seed          # Seed test data

# Testing
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix linting issues
npm run format           # Format with Prettier
npm run type-check       # TypeScript type checking
```

### Development Workflow

1. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes and test:**
   ```bash
   npm run dev              # Start server
   npm run test:watch       # Run tests in watch mode
   ```

3. **Check code quality:**
   ```bash
   npm run lint             # Check linting
   npm run type-check       # Check types
   npm test                 # Run all tests
   ```

4. **Commit and push:**
   ```bash
   git add .
   git commit -m "Add your feature"
   git push origin feature/your-feature-name
   ```

---

## 📖 Documentation

- **[APP_OVERVIEW.md](APP_OVERVIEW.md)** - Product overview and value proposition
- **[backend/docs/ARCHITECTURE.md](backend/docs/ARCHITECTURE.md)** - Technical architecture details
- **[backend/docs/PROMPT_BUILDERS_USE_CASES.md](backend/docs/PROMPT_BUILDERS_USE_CASES.md)** - 500+ example use cases
- **[backend/docs/PROMPT_BUILDERS_REFERENCE.md](backend/docs/PROMPT_BUILDERS_REFERENCE.md)** - Prompt engineering reference
- **[backend/docs/QUICK_REFERENCE.md](backend/docs/QUICK_REFERENCE.md)** - Quick API reference

---

## 🐛 Troubleshooting

### Common Issues

**Database Connection Error**
```bash
# Check PostgreSQL is running
psql --version

# Verify DATABASE_URL format
postgresql://username:password@localhost:5432/database_name

# Reset database
npm run db:setup
```

**OAuth Authentication Failed**
```bash
# Verify credentials in .env
echo $GOOGLE_CLIENT_ID
echo $GOOGLE_CLIENT_SECRET

# Check redirect URI matches exactly
# Google Cloud Console → Credentials → Authorized redirect URIs

# Test OAuth URL generation
curl http://localhost:3000/auth/debug/test-oauth-url
```

**Slack Integration Not Working**
```bash
# Verify Slack credentials
echo $SLACK_CLIENT_ID
echo $SLACK_SIGNING_SECRET

# Check bot token starts with xoxb-
echo $SLACK_BOT_TOKEN

# Verify app is installed to workspace
# Slack API → Your App → Install App
```

**OpenAI API Errors**
```bash
# Verify API key is valid
echo $OPENAI_API_KEY

# Check API key starts with sk-
# Ensure you have credits available
```

### Getting Help

1. Check the [documentation](backend/docs/)
2. Review [common use cases](backend/docs/PROMPT_BUILDERS_USE_CASES.md)
3. Enable debug logging:
   ```bash
   NODE_ENV=development npm run dev
   ```
4. Check logs:
   ```bash
   tail -f backend/logs/application-*.log
   ```

---

## 🤝 Contributing

We welcome contributions! Here's how:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass (`npm test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Code Standards

- **TypeScript**: All code must be typed
- **ESLint**: Follow the project's ESLint configuration
- **Tests**: Maintain or improve code coverage
- **Documentation**: Update docs for new features

---

## 📄 License

ISC License - see [LICENSE](LICENSE) file for details

---

## 🙏 Acknowledgments

Built with:
- [OpenAI](https://openai.com/) - GPT models for natural language processing
- [Google APIs](https://developers.google.com/) - Gmail, Calendar, Contacts
- [Slack API](https://api.slack.com/) - Workspace integration
- [Railway](https://railway.app/) - Hosting and deployment
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Express.js](https://expressjs.com/) - Web framework

---

## 📞 Support

- 📧 Email: [support contact]
- 💬 Slack: [workspace link]
- 🐛 Issues: [GitHub issues](https://github.com/yourusername/assistantapp/issues)

---

**Built with ❤️ for intelligent executive automation**

*Save 10-20 hours per week. Focus on what matters.*
