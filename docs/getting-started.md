# Getting Started

Quick setup guide for the Assistant App Backend.

## Prerequisites

- **Node.js** 18.x or higher
- **npm** 8.x or higher  
- **PostgreSQL** 14.x or higher (for production)
- **Google Cloud Console** account with OAuth credentials

## Installation

### 1. Install Dependencies

```bash
# Clone and navigate to the backend directory
cd backend

# Install dependencies
npm install

# Or use the installation script
chmod +x install-dependencies.sh
./install-dependencies.sh
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env
```

Update `.env` with your configuration:

```bash
# REQUIRED: JWT Secret (minimum 32 characters)
JWT_SECRET=your_super_secure_jwt_secret_at_least_32_characters_long

# REQUIRED: Google OAuth credentials
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# OPTIONAL: OpenAI integration
OPENAI_API_KEY=your_openai_api_key

# OPTIONAL: Database configuration
DATABASE_URL=postgresql://user:password@localhost:5432/assistantapp

# OPTIONAL: Other settings
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
```

### 3. Database Setup (Optional)

If using PostgreSQL:

```bash
# Create database
createdb assistantapp

# Run database setup script (creates tables)
npm run db:setup
```

### 4. Build and Start

```bash
# Development mode with auto-reload
npm run dev

# Production build and start
npm run build
npm start
```

The server will start at `http://localhost:3000` (or your configured PORT).

## Verification

### Health Check

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 10.5,
  "environment": "development",
  "memory": {
    "used": 45.67,
    "total": 128.00
  }
}
```

### Authentication Flow

1. Navigate to `http://localhost:3000/auth/google`
2. Complete Google OAuth flow
3. Receive JWT token for API access

## Development Workflow

### Available Scripts

```bash
npm run dev          # Development server with auto-reload
npm run build        # Build TypeScript to JavaScript
npm start            # Start production server
npm run lint         # Run ESLint
npm run lint:fix     # Fix linting issues
npm run format       # Format code with Prettier
npm run typecheck    # TypeScript type checking
npm test             # Run test suite
npm run test:watch   # Run tests in watch mode
```

### Project Structure

```
backend/
├── src/
│   ├── agents/          # AI agent implementations
│   ├── config/          # Configuration management
│   ├── framework/       # Base classes and factories
│   ├── middleware/      # Express middleware
│   ├── routes/          # API endpoints
│   ├── services/        # Business logic layer
│   ├── types/           # TypeScript definitions
│   ├── utils/           # Utility functions
│   └── index.ts         # Application entry point
├── tests/               # Test files
├── logs/                # Log files (auto-created)
└── dist/                # Compiled JavaScript (auto-generated)
```

## Next Steps

- **API Integration:** See [API Reference](./api-reference.md)
- **Creating Agents:** Check [Agent Development](./agent-development.md)  
- **Configuration:** Review [Configuration Guide](./configuration.md)
- **Architecture:** Understand the [Architecture Overview](./architecture.md)

## Common Issues

### Port Already in Use
```bash
# Check what's using the port
lsof -i :3000

# Kill the process or change PORT in .env
```

### JWT Secret Too Short
```
Error: JWT_SECRET must be at least 32 characters for security
```
Generate a longer secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Google OAuth Redirect Mismatch
Ensure the `GOOGLE_REDIRECT_URI` in `.env` matches exactly what's configured in Google Cloud Console.

For more troubleshooting, see [Troubleshooting Guide](./troubleshooting.md).