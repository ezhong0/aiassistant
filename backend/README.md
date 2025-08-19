# Assistant App Backend

A secure, production-ready Node.js/TypeScript backend API with Google OAuth authentication, JWT token management, and comprehensive security features.

## 🚀 Features

### Core Features
- ✅ **Google OAuth 2.0 Integration** - Secure authentication flow
- ✅ **JWT Token Management** - Stateless authentication
- ✅ **TypeScript** - Full type safety and IntelliSense
- ✅ **Input Validation** - Zod-powered request validation
- ✅ **Rate Limiting** - Protection against abuse
- ✅ **Security Headers** - CORS, Helmet, CSP, HSTS
- ✅ **Request Compression** - Gzip compression for responses
- ✅ **Structured Logging** - Winston with daily log rotation
- ✅ **Error Handling** - Comprehensive error management
- ✅ **Health Checks** - System monitoring endpoints

### Security Features
- 🔒 **JWT Security** - Algorithm whitelisting, secure secrets
- 🛡️ **Input Sanitization** - XSS protection and validation
- 🚫 **Rate Limiting** - IP and user-based limits
- 🔐 **Security Headers** - Helmet.js integration
- 🌐 **CORS Configuration** - Flexible origin management
- 📏 **Request Size Limits** - Protection against large payloads
- ⏱️ **Request Timeouts** - Prevent hanging requests

### Architecture
- 📁 **Layered Architecture** - Routes → Middleware → Services → Utils
- ⚙️ **Configuration Management** - Centralized config with validation
- 📊 **Structured Logging** - Consistent log format with metadata
- 🔄 **Graceful Shutdown** - Clean server termination
- 🧪 **Test-Ready** - Prepared for comprehensive testing

## 📋 Prerequisites

- **Node.js** 16.x or higher
- **npm** 7.x or higher
- **TypeScript** 4.x or higher
- **Google Cloud Console** account with OAuth credentials

## 🛠️ Installation

### 1. Install Dependencies

Run the installation script:
```bash
chmod +x install-dependencies.sh
./install-dependencies.sh
```

Or install manually:
```bash
npm install
npm install zod cors helmet compression
npm install --save-dev @types/cors @types/compression jest @types/jest ts-jest supertest @types/supertest cross-env
```

### 2. Environment Configuration

Copy the example environment file:
```bash
cp .env.example .env
```

Update `.env` with your configuration:
```bash
# REQUIRED: Set a strong JWT secret (minimum 32 characters)
JWT_SECRET=your_super_secure_jwt_secret_at_least_32_characters_long

# REQUIRED: Google OAuth credentials
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# OPTIONAL: Customize other settings
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

### 3. Build and Start

```bash
# Build TypeScript
npm run build

# Start production server
npm start

# Or start development server with auto-reload
npm run dev
```

## 🏗️ Project Structure

```
src/
├── config/
│   └── config.service.ts          # Centralized configuration management
├── middleware/
│   ├── auth.middleware.ts          # JWT authentication middleware
│   ├── errorHandler.ts            # Error handling middleware
│   ├── rate-limiting.middleware.ts # Rate limiting with cleanup
│   ├── requestLogger.ts           # Request logging middleware
│   ├── security.middleware.ts     # Security headers and CORS
│   └── validation.middleware.ts   # Input validation with Zod
├── routes/
│   ├── auth.routes.ts             # Authentication endpoints
│   ├── health.ts                  # Health check endpoints
│   └── protected.routes.ts        # Protected API endpoints
├── services/
│   └── auth.service.ts            # OAuth and JWT service logic
├── types/
│   └── auth.types.ts              # TypeScript type definitions
├── utils/
│   ├── auth-errors.ts             # Authentication error handling
│   └── logger.ts                  # Winston logging configuration
└── index.ts                       # Main server file
```

## 🔐 API Endpoints

### Authentication Endpoints

#### `GET /auth/google`
Initiates Google OAuth flow
- **Rate Limited**: 10 requests per 15 minutes per IP
- **Response**: Redirects to Google OAuth

#### `GET /auth/callback`
Handles OAuth callback from Google
- **Rate Limited**: 10 requests per 15 minutes per IP
- **Query Parameters**: `code`, `state`, `error`, `error_description`
- **Response**: JWT token and user information

#### `POST /auth/refresh`
Refreshes expired access tokens
- **Rate Limited**: 10 requests per 15 minutes per IP
- **Body**: `{ \"refresh_token\": \"string\" }`
- **Response**: New tokens and JWT

#### `POST /auth/exchange-mobile-tokens`
Exchanges mobile OAuth tokens for JWT
- **Rate Limited**: 10 requests per 15 minutes per IP
- **Body**: `{ \"access_token\": \"string\", \"platform\": \"ios|android\" }`
- **Response**: JWT token for backend authentication

#### `POST /auth/logout`
Logs out user and revokes tokens
- **Body**: `{ \"access_token\": \"string\", \"everywhere\": boolean }`
- **Response**: Success confirmation

#### `GET /auth/validate`
Validates JWT tokens
- **Headers**: `Authorization: Bearer <jwt_token>`
- **Response**: Token validity and payload

### Protected Endpoints

#### `GET /protected/profile`
Get user profile (requires authentication)
- **Headers**: `Authorization: Bearer <jwt_token>`
- **Response**: User profile information

#### `PUT /protected/profile`
Update user profile (requires authentication)
- **Headers**: `Authorization: Bearer <jwt_token>`
- **Body**: Profile update data
- **Response**: Updated profile

#### `GET /protected/dashboard`
Get dashboard data (optional authentication)
- **Headers**: `Authorization: Bearer <jwt_token>` (optional)
- **Response**: Personalized or public dashboard data

### System Endpoints

#### `GET /health`
System health check
- **Response**: Server health, memory usage, uptime

#### `GET /`
API information
- **Response**: API version, environment, timestamp

## 🧪 Testing

### Running Tests
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Test Structure
```
tests/
├── unit/                    # Unit tests
│   ├── services/           # Service tests
│   ├── middleware/         # Middleware tests
│   └── utils/              # Utility tests
├── integration/            # API integration tests
└── fixtures/               # Test data and mocks
```

### Example Test
```typescript
describe('Auth Service', () => {
  it('should generate valid JWT tokens', () => {
    const payload = { userId: '123', email: 'test@example.com' };
    const token = authService.generateJWT(payload);
    
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    
    const validation = authService.validateJWT(token);
    expect(validation.valid).toBe(true);
  });
});
```

## 📊 Monitoring and Logging

### Log Levels
- **Error**: System errors, authentication failures
- **Warn**: Rate limiting, security warnings
- **Info**: Server startup, successful operations
- **Debug**: Detailed request/response information

### Log Format
```json
{
  \"timestamp\": \"2023-12-07T10:30:00.000Z\",
  \"level\": \"info\",
  \"message\": \"User authenticated successfully\",
  \"userId\": \"google_123456789\",
  \"email\": \"user@example.com\",
  \"ip\": \"192.168.1.1\"
}
```

### Health Monitoring
```bash
# Check server health
curl http://localhost:3000/health

# Response example
{
  \"status\": \"OK\",
  \"timestamp\": \"2023-12-07T10:30:00.000Z\",
  \"uptime\": 3600.5,
  \"environment\": \"production\",
  \"version\": \"1.0.0\",
  \"memory\": {
    \"used\": 45.67,
    \"total\": 128.00
  }
}
```

## 🔒 Security

### JWT Security
- **Algorithm Whitelisting**: Only HS256 allowed
- **Token Expiration**: Configurable (default 24h)
- **Secret Validation**: Minimum length requirements
- **Payload Validation**: Required fields checked

### Rate Limiting
- **Global Limits**: 100 requests per 15 minutes
- **Auth Limits**: 10 requests per 15 minutes
- **User Limits**: Per-user rate limiting
- **Memory Management**: Automatic cleanup of expired entries

### Security Headers
```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'
```

### Input Validation
- **Zod Schemas**: Comprehensive request validation
- **XSS Protection**: Input sanitization
- **Size Limits**: Request payload limits
- **Type Safety**: TypeScript validation

## 🚀 Deployment

### Environment Variables for Production
```bash
# Production settings
NODE_ENV=production
PORT=443
JWT_SECRET=<64-character-secure-random-string>

# HTTPS URLs
GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/callback
CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com

# Database (when implemented)
DATABASE_URL=postgresql://user:password@host:5432/database
REDIS_URL=redis://host:6379
```

### Production Checklist
- [ ] Set strong JWT_SECRET (64+ characters)
- [ ] Configure HTTPS URLs
- [ ] Set up SSL/TLS certificates
- [ ] Configure reverse proxy (nginx/Apache)
- [ ] Set up log aggregation
- [ ] Configure monitoring/alerting
- [ ] Set up automated backups
- [ ] Review CORS origins
- [ ] Test OAuth flow
- [ ] Performance testing

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD [\"node\", \"dist/index.js\"]
```

### PM2 Configuration
```javascript
module.exports = {
  apps: [{
    name: 'assistantapp-api',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

## 🛠️ Development

### Available Scripts
```bash
npm run dev          # Start development server with auto-reload
npm run build        # Build TypeScript to JavaScript
npm start            # Start production server
npm run lint         # Run ESLint
npm run lint:fix     # Fix linting issues automatically
npm run format       # Format code with Prettier
npm run typecheck    # Run TypeScript type checking
npm test             # Run test suite
```

### Code Quality
- **ESLint**: Consistent code style
- **Prettier**: Automatic code formatting
- **Husky**: Pre-commit hooks
- **lint-staged**: Staged file processing
- **TypeScript**: Type safety and IntelliSense

### Development Workflow
1. Create feature branch
2. Write tests for new functionality
3. Implement feature with type safety
4. Run linting and formatting
5. Commit changes (triggers pre-commit hooks)
6. Create pull request
7. Review and merge

## 🤝 Contributing

### Code Standards
- Use TypeScript for all new code
- Follow existing naming conventions
- Write comprehensive tests
- Add JSDoc comments for public APIs
- Update documentation for new features

### Pull Request Process
1. Fork the repository
2. Create a feature branch
3. Write tests and implementation
4. Ensure all tests pass
5. Update documentation
6. Submit pull request with clear description

## 📄 License

ISC License - see LICENSE file for details.

## 🆘 Troubleshooting

### Common Issues

**Server won't start**
- Check if port is already in use: `lsof -i :3000`
- Verify environment variables are set
- Check JWT_SECRET length (minimum 32 characters)

**JWT token errors**
- Verify JWT_SECRET matches between services
- Check token expiration
- Ensure algorithm is HS256

**Google OAuth errors**
- Verify redirect URI matches Google Console
- Check client ID and secret
- Ensure OAuth consent screen is configured

**Rate limiting issues**
- Check IP address detection
- Verify rate limit configuration
- Clear rate limit cache if needed

### Debug Mode
```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# Check logs
tail -f logs/combined-$(date +%Y-%m-%d).log
```

### Support
- Check logs in `logs/` directory
- Review error messages in console
- Verify configuration against `.env.example`
- Test endpoints with curl or Postman

---

**Built with ❤️ using Node.js, TypeScript, Express, and best security practices.**