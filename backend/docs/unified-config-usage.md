# Unified Configuration System Usage Guide

## Overview

The new unified configuration system provides type-safe, centralized configuration management for the entire application. It replaces multiple scattered configuration files and services with a single, elegant solution.

## Key Features

✅ **Type Safety** - Full TypeScript support with Zod validation  
✅ **Environment Aware** - Automatic defaults per environment  
✅ **Runtime Validation** - Comprehensive validation with detailed errors  
✅ **Health Checking** - Built-in configuration health monitoring  
✅ **Hot Reload** - Configuration updates without restart (development)  
✅ **Single Source** - All configuration in one place  

## Basic Usage

```typescript
import { config } from './config/index';

// Simple property access
console.log(config.nodeEnv);           // 'production' | 'development' | 'test'
console.log(config.port);             // 3000
console.log(config.openaiApiKey);     // string | undefined
console.log(config.jwtSecret);        // string (with validation)

// Hierarchical access
console.log(config.ai.models.general);     // AI model configuration
console.log(config.auth.google?.clientId); // Google OAuth client ID
console.log(config.security.rateLimiting); // Rate limiting settings
```

## Configuration Structure

```typescript
config.all = {
  environment: {
    NODE_ENV: 'production',
    PORT: 3000,
    LOG_LEVEL: 'info'
  },
  auth: {
    google: { clientId: 'xxx', clientSecret: 'xxx', redirectUri: 'xxx' },
    slack: { clientId: 'xxx', clientSecret: 'xxx', signingSecret: 'xxx' },
    jwt: { secret: 'xxx', expiresIn: '24h', issuer: 'assistantapp' }
  },
  services: {
    database: { url: 'xxx', poolSize: 10 },
    redis: { url: 'xxx', timeout: 5000 },
    openai: { apiKey: 'xxx', timeout: 30000 }
  },
  ai: {
    models: {
      general: { model: 'gpt-4o-mini', temperature: 0.3, maxTokens: 1000 },
      routing: { model: 'gpt-4o-mini', temperature: 0.1, maxTokens: 500 },
      content: { model: 'gpt-4', temperature: 0.7, maxTokens: 2000 },
      analysis: { model: 'gpt-4o-mini', temperature: 0.0, maxTokens: 1000 }
    },
    timeouts: {
      toolExecution: 30000,
      sessionTimeout: 1800000,
      gracefulShutdown: 10000
    }
  },
  security: {
    cors: { origin: '*', credentials: true },
    rateLimiting: { enabled: true, windowMs: 900000, maxRequests: 100 },
    requestLimits: { jsonBodySize: '10mb', urlEncodedBodySize: '10mb' }
  }
}
```

## Advanced Usage

### Environment-Specific Access

```typescript
// Environment detection
if (config.isProduction) {
  // Production-specific logic
  requireAuth(config.jwtSecret);
}

// Development-specific features
if (config.isDevelopment) {
  config.reload(); // Hot-reload configuration
}
```

### Feature Flags

```typescript
// Check if a feature is enabled
if (config.isFeatureEnabled('openai')) {
  // Use OpenAI services
}
```

### Health Checking

```typescript
// Get configuration health status
const health = config.getHealth();
if (!health.healthy) {
  console.error('Configuration issues:', health.details.issues);
}
```

### AI Model Configuration

```typescript
// Get specific AI model config
const generalConfig = config.getAIModelConfig('general');
const analysisConfig = config.getAIModelConfig('analysis');

// Use in AI services
const result = await openai.chat.completions.create({
  model: generalConfig.model,
  temperature: generalConfig.temperature,
  max_tokens: generalConfig.maxTokens,
  messages: [{ role: 'user', content: 'Hello' }]
});
```

## Migration from Old Config

### Before (Multiple Config Files)

```typescript
// Old scattered approach
import { CONFIG } from './config/app-config';
import { ENVIRONMENT } from './config/environment';
import { ConfigService } from './services/config.service';

const envConfig = new ConfigService();
const aiConfig = AIConfigService.getConfig();
const appConfig = CONFIG.TIMEOUTS;

// Complex, fragmented access
```

### After (Unified Config)

```typescript
// New elegant approach
import { config } from './config/index';

// Single, type-safe access
const port = config.port;
const aiTimeout = config.ai.timeouts.toolExecution;
const openaiKey = config.openaiApiKey;

// Clean, hierarchical access
```

## Environment Variables

The system automatically maps these environment variables:

### Core
- `NODE_ENV` - Environment (development/production/test)
- `PORT` - Server port
- `LOG_LEVEL` - Logging level

### Authentication
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`
- `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_ISSUER`, `JWT_AUDIENCE`

### Services
- `DATABASE_URL`, `REDIS_URL`, `OPENAI_API_KEY`

### Security
- `CORS_ORIGIN`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`

## Benefits

1. **Reduced Complexity** - Single config service instead of 6+ scattered files
2. **Type Safety** - Full TypeScript support with runtime validation
3. **Better Error Messages** - Detailed validation errors on startup
4. **Production Safety** - Automatic validation of required secrets
5. **Developer Experience** - Hot-reload in development
6. **Maintainability** - Single source of truth for all configuration

## Performance

- **Lean**: Configuration loaded once at startup
- **Cached**: No repeated environment variable parsing
- **Fast**: Direct property access with no function calls
- **Memory Efficient**: Single configuration instance shared across app
