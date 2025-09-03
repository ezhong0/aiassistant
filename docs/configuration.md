# Configuration Guide

Complete guide for configuring the Assistant App Backend, including environment variables, AI settings, and deployment configurations.

## Environment Configuration

### Environment Variables

All configuration is managed through environment variables with validation and type safety.

#### Required Variables

```bash
# JWT Configuration (REQUIRED)
JWT_SECRET=your_super_secure_jwt_secret_at_least_32_characters_long
JWT_EXPIRES_IN=24h
JWT_ISSUER=assistantapp
JWT_AUDIENCE=assistantapp-client

# Google OAuth (REQUIRED for authentication)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
GOOGLE_WEB_CLIENT_ID=your_web_client_id  # Optional
```

#### Optional Variables

```bash
# Server Configuration
NODE_ENV=development                    # development | production | test
PORT=3000                              # Server port
LOG_LEVEL=info                         # error | warn | info | debug
BASE_URL=http://localhost:3000         # Base URL for OAuth redirects

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/assistantapp
REDIS_URL=redis://localhost:6379      # For caching (future use)

# External APIs
OPENAI_API_KEY=your_openai_api_key     # For AI functionality
TAVILY_API_KEY=your_tavily_api_key     # For web search

# Slack Integration
SLACK_SIGNING_SECRET=your_slack_signing_secret
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_OAUTH_REDIRECT_URI=https://yourdomain.com/slack/oauth/callback

# Security & Performance
CORS_ORIGIN=http://localhost:3000,https://yourdomain.com
RATE_LIMIT_WINDOW_MS=900000            # 15 minutes in milliseconds
RATE_LIMIT_MAX_REQUESTS=100            # Max requests per window
BCRYPT_SALT_ROUNDS=12                  # Password hashing rounds

# Feature Flags
DISABLE_RATE_LIMITING=false            # Disable rate limiting (dev only)
ENABLE_OPENAI=true                     # Enable OpenAI integration
ENABLE_REQUEST_LOGGING=true            # Enable detailed request logging
```

### Configuration Validation

The system uses Zod schemas for environment variable validation:

```typescript
// Validation happens at startup
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().regex(/^\d+$/).transform(Number).default('3000'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  // ... more validations
});
```

### Environment Files

```bash
# Development
cp .env.example .env.development

# Staging  
cp .env.example .env.staging

# Production
cp .env.example .env.production
```

Load environment-specific files:
```bash
NODE_ENV=production node dist/index.js  # Loads .env.production
```

## AI Configuration

### OpenAI Models Configuration

The system supports multiple OpenAI model configurations for different purposes:

```typescript
// src/config/ai-config.ts
export const OPENAI_MODELS = {
  general: {
    model: 'gpt-4o-mini',
    temperature: 0.7,
    max_tokens: 2000,
    timeout: 30000
  },
  routing: {
    model: 'gpt-4o-mini',
    temperature: 0.3,
    max_tokens: 500,
    timeout: 15000
  },
  content: {
    model: 'gpt-4o',
    temperature: 0.8,
    max_tokens: 4000,
    timeout: 45000
  },
  analysis: {
    model: 'gpt-4o',
    temperature: 0.2,
    max_tokens: 3000,
    timeout: 40000
  }
};
```

### Prompt Templates

```typescript
export const PROMPT_TEMPLATES = {
  email_extraction: `
    You are an email processing assistant. Extract structured data from this request:
    "{userInput}"
    
    Return JSON with: to, cc, bcc, subject, body
  `,
  
  contact_resolution: `
    Resolve contact names to contact information from this query:
    "{userInput}"
    
    Available contacts: {availableContacts}
  `,
  
  master_agent_system: `
    You are a master routing agent. Analyze the user's request and determine which tools to use:
    
    Available tools:
    - emailAgent: For email operations (send, search, manage)
    - calendarAgent: For calendar operations (schedule, view, manage)
    - contactAgent: For contact operations (search, manage)
    - tavilyAgent: For web search and information gathering
    
    User request: "{userInput}"
  `
};
```

### Agent Configuration

```typescript
export const AGENT_CONFIGS = {
  emailAgent: {
    timeout: 30000,
    retries: 3,
    enabled: true,
    fallback_strategy: 'retry',
    confirmation_required: true,
    requires_oauth: true
  },
  
  calendarAgent: {
    timeout: 25000,
    retries: 2,
    enabled: true,
    fallback_strategy: 'retry',
    confirmation_required: true,
    requires_oauth: true
  },
  
  contactAgent: {
    timeout: 20000,
    retries: 2,
    enabled: true,
    fallback_strategy: 'retry',
    confirmation_required: false,
    requires_oauth: true
  },
  
  tavilyAgent: {
    timeout: 15000,
    retries: 1,
    enabled: true,
    fallback_strategy: 'fail',
    confirmation_required: false,
    requires_oauth: false
  }
};
```

### Using AI Configuration

```typescript
import { aiConfigService } from '../config/ai-config';

// Get OpenAI configuration for specific purpose
const routingConfig = aiConfigService.getOpenAIConfig('routing');

// Get prompt with variable substitution
const prompt = aiConfigService.getPrompt('email_extraction', {
  userInput: 'Send email to john@example.com about meeting'
});

// Get agent configuration
const emailConfig = aiConfigService.getAgentConfig('emailAgent');
console.log(`Email agent timeout: ${emailConfig.timeout}ms`);

// Runtime updates (development only)
if (configService.isDevelopment) {
  aiConfigService.updateAgentConfig('emailAgent', { 
    timeout: 45000,
    retries: 5 
  });
}
```

## Application Configuration

### Timeouts and Limits

```typescript
// src/config/app-config.ts
export const TIMEOUTS = {
  httpRequest: 30000,        // HTTP request timeout
  toolExecution: 60000,      // Tool execution timeout
  databaseQuery: 10000,      // Database query timeout
  sessionTimeout: 1800000,   // Session timeout (30 minutes)
  oauthCallback: 120000      // OAuth callback timeout
};

export const REQUEST_LIMITS = {
  maxRequestSize: 10485760,  // 10MB max request size
  maxJsonDepth: 10,          // Max JSON nesting depth
  maxArrayLength: 1000,      // Max array length
  
  command: {
    minLength: 1,
    maxLength: 5000
  },
  
  sessionId: {
    maxLength: 255
  },
  
  emailSearch: {
    defaultMaxResults: 10,
    maxResults: 50
  }
};

export const RATE_LIMITS = {
  global: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    maxRequests: 1000          // Per window
  },
  
  api: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 100
  },
  
  auth: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 10
  },
  
  assistant: {
    textCommand: {
      windowMs: 15 * 60 * 1000,
      maxRequests: 30
    },
    session: {
      windowMs: 15 * 60 * 1000,
      maxRequests: 20
    }
  }
};
```

### Security Configuration

```typescript
export const SECURITY_CONFIG = {
  cors: {
    maxAge: 86400,  // 24 hours
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With', 
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control'
    ]
  },
  
  jwt: {
    algorithm: 'HS256',
    issuer: 'assistantapp',
    audience: 'assistantapp-client',
    expiresIn: '24h'
  },
  
  headers: {
    hsts: {
      maxAge: 31536000,      // 1 year
      includeSubDomains: true,
      preload: true
    },
    
    csp: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:']
    }
  }
};
```

## Configuration Access Patterns

### Type-Safe Configuration Access

```typescript
import { configService } from '../config/config.service';

// Environment variables with validation
const port = configService.port;                    // number
const isDev = configService.isDevelopment;         // boolean
const googleClientId = configService.googleClientId; // string

// Configuration validation
configService.validate(); // Throws if invalid

// Get all configuration (for debugging)
const allConfig = configService.getAll();
console.log('Configuration loaded:', allConfig);
```

### Feature Flags

```typescript
import { ENVIRONMENT } from '../config/environment';

// Check if features are enabled
if (ENVIRONMENT.features.openai) {
  // Initialize OpenAI integration
}

if (ENVIRONMENT.features.rateLimiting) {
  // Apply rate limiting middleware
}

// Environment-specific behavior
if (ENVIRONMENT.isDevelopment()) {
  // Development-only features
}
```

### Configuration Helpers

```typescript
import { ENV_HELPERS, ENV_VALIDATION } from '../config/environment';

// Get environment variable with type conversion
const maxConnections = ENV_HELPERS.getNumberEnv('DB_MAX_CONNECTIONS', 20);
const enableFeature = ENV_HELPERS.getBooleanEnv('ENABLE_FEATURE', false);
const allowedHosts = ENV_HELPERS.getArrayEnv('ALLOWED_HOSTS');

// Validate environment configuration
const missing = ENV_VALIDATION.validateRequired();
if (missing.length > 0) {
  console.error('Missing required environment variables:', missing);
  process.exit(1);
}

// Check service configurations
const isGoogleConfigured = ENV_VALIDATION.isGoogleConfigured();
const isOpenAIConfigured = ENV_VALIDATION.isOpenAIConfigured();
```

## Environment-Specific Configurations

### Development Configuration

```bash
# .env.development
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Relaxed CORS for development
CORS_ORIGIN=http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000

# Local database
DATABASE_URL=postgresql://postgres:password@localhost:5432/assistantapp_dev

# Disable rate limiting for easier testing
DISABLE_RATE_LIMITING=true

# Enable all features
ENABLE_OPENAI=true
ENABLE_REQUEST_LOGGING=true
```

### Production Configuration

```bash
# .env.production
NODE_ENV=production
PORT=443

# Production logging
LOG_LEVEL=info

# Strict CORS
CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com

# Production database with connection pooling
DATABASE_URL=postgresql://user:password@prod-db:5432/assistantapp?sslmode=require&pool_max=20

# Enable rate limiting
DISABLE_RATE_LIMITING=false
RATE_LIMIT_MAX_REQUESTS=50  # Stricter limits

# Production JWT with longer secret
JWT_SECRET=your_64_character_or_longer_production_jwt_secret_here_for_security
JWT_EXPIRES_IN=1h  # Shorter expiration
```

### Testing Configuration

```bash
# .env.test
NODE_ENV=test
PORT=3001
LOG_LEVEL=error

# In-memory or test database
DATABASE_URL=postgresql://postgres:password@localhost:5432/assistantapp_test

# Disable external services in tests
ENABLE_OPENAI=false
DISABLE_RATE_LIMITING=true

# Short timeouts for faster tests
JWT_EXPIRES_IN=5m
```

## Configuration Best Practices

### 1. Security

```bash
# ✅ Good: Strong secrets
JWT_SECRET=$(openssl rand -hex 64)  # 128 character secret

# ✅ Good: Environment-specific origins
CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com

# ❌ Bad: Weak or default secrets
JWT_SECRET=secret123
CORS_ORIGIN=*
```

### 2. Environment Separation

```bash
# ✅ Good: Separate configs per environment
.env.development
.env.staging  
.env.production

# ❌ Bad: One config for all environments
.env
```

### 3. Validation

```typescript
// ✅ Good: Validate at startup
export class ConfigService {
  constructor() {
    this.config = this.loadAndValidateConfig();
    this.validate();  // Additional runtime validation
  }
  
  validate(): void {
    if (this.isProduction && this.config.JWT_SECRET.length < 64) {
      throw new Error('JWT_SECRET must be at least 64 characters in production');
    }
  }
}

// ❌ Bad: No validation
const config = process.env;  // Unvalidated access
```

### 4. Documentation

```typescript
// ✅ Good: Documented configuration
interface Config {
  /** Server port number (default: 3000) */
  port: number;
  
  /** JWT secret for token signing (min 32 chars, 64+ recommended for production) */
  jwtSecret: string;
  
  /** Google OAuth client ID from Google Cloud Console */
  googleClientId: string;
}
```

## Troubleshooting Configuration

### Common Issues

**Configuration Validation Errors**
```
Error: JWT_SECRET must be at least 32 characters for security
```
Solution: Generate a longer secret
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Missing Environment Variables**
```
Error: Configuration validation failed:
GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID is required
```
Solution: Set the missing variable in your `.env` file

**CORS Issues**
```
Access to fetch at 'http://localhost:3000/api' from origin 'http://localhost:3001' has been blocked by CORS policy
```
Solution: Add the origin to `CORS_ORIGIN`
```bash
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
```

### Configuration Debugging

```typescript
// Check configuration at runtime
import { configService } from './config/config.service';
import { ENV_VALIDATION } from './config/environment';

// Validate all configuration
const missing = ENV_VALIDATION.validateRequired();
if (missing.length > 0) {
  console.error('Missing variables:', missing);
}

// Get configuration summary
const summary = ENV_VALIDATION.getConfigSummary();
console.log('Configuration status:', summary);

// Check specific services
console.log({
  google: ENV_VALIDATION.isGoogleConfigured(),
  openai: ENV_VALIDATION.isOpenAIConfigured(),
  slack: ENV_VALIDATION.isSlackConfigured()
});
```

This configuration system provides a robust, type-safe foundation for managing all application settings across different environments.