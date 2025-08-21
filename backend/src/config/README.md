# Unified Configuration System

A centralized, type-safe configuration management system that consolidates all application settings into TypeScript modules.

## 🚀 Overview

This system replaces the previous dual YAML/TypeScript configuration approach with a single, unified TypeScript-based system that provides:

- **Type Safety**: Full TypeScript support with Zod schema validation
- **Centralized Management**: All configurations in one organized structure  
- **Runtime Updates**: Ability to update configurations during development
- **Environment Awareness**: Different behaviors for development vs production
- **No File Watching**: Compiled configurations for better performance

## 📁 File Structure

```
src/config/
├── ai-config.ts           # AI models, prompts, and agent settings
├── agent-config.ts        # Agent behavioral configuration
├── app-config.ts          # Application timeouts, limits, and operational settings
├── config.service.ts      # Environment variables and validation
├── constants.ts           # Application constants
├── environment.ts         # Environment variable helpers
└── README.md              # This file
```

## 🔧 Quick Start

### 1. Basic AI Configuration Usage

```typescript
import { aiConfigService } from './config/ai-config';

// Get OpenAI configuration for different purposes
const routingConfig = aiConfigService.getOpenAIConfig('routing');
const contentConfig = aiConfigService.getOpenAIConfig('content');
const analysisConfig = aiConfigService.getOpenAIConfig('analysis');

// Get prompt templates with variable substitution
const emailPrompt = aiConfigService.getPrompt('email_extraction', {
  userInput: 'Send email to john@example.com about meeting'
});

// Get agent AI configuration
const emailAgentConfig = aiConfigService.getAgentConfig('emailAgent');
```

### 2. Application Configuration

```typescript
import { TIMEOUTS, RATE_LIMITS } from './config/app-config';
import { AGENT_CONFIG } from './config/agent-config';

// Use timeout constants
const toolTimeout = TIMEOUTS.toolExecution;
const apiTimeout = TIMEOUTS.httpRequest;

// Use rate limiting configuration
const apiRateLimit = RATE_LIMITS.api;

// Use agent behavioral settings
const emailAgentBehavior = AGENT_CONFIG.email;
```

### 3. Environment Configuration

```typescript
import { configService } from './config/config.service';
import { ENVIRONMENT } from './config/environment';

// Access validated environment variables
const port = configService.get('PORT');
const googleClientId = configService.get('GOOGLE_CLIENT_ID');

// Use environment helpers
const isDevelopment = ENVIRONMENT.isDevelopment;
const logLevel = ENVIRONMENT.logLevel;
```

## 📝 Configuration Types

### AI Configuration

**OpenAI Models**:
- `general`: Default model for general purpose tasks
- `routing`: Fast model for request routing and classification
- `content`: High-quality model for content generation
- `analysis`: Precise model for analysis and reasoning

**Prompt Templates**:
- `email_extraction`: Extract structured email data from natural language
- `contact_resolution`: Resolve contact names to contact information
- `master_agent_system`: Master agent routing and orchestration

**Agent Settings**:
- `timeout`: Maximum execution time in milliseconds
- `retries`: Number of retry attempts on failure
- `enabled`: Whether the agent is currently enabled
- `fallback_strategy`: How to handle failures ('fail', 'retry', 'queue')

### Application Configuration

**Timeouts**: Execution timeouts for various operations
**Rate Limits**: Request rate limiting configurations  
**Request Limits**: Size and content limitations
**Performance Limits**: Memory and concurrency settings
**Security Config**: CORS, authentication, and sanitization settings

### Agent Behavioral Configuration

**Keywords**: Natural language keywords for agent routing
**Routing Patterns**: Regular expressions for intelligent request routing
**Confirmation Settings**: Which agents require user confirmation
**Authentication Requirements**: Which agents need OAuth tokens

## 🔄 Runtime Configuration Updates

The system supports runtime configuration updates for development and testing:

```typescript
// Update OpenAI configuration
aiConfigService.updateOpenAIConfig('routing', { 
  temperature: 0.2,
  max_tokens: 600 
});

// Update agent configuration
aiConfigService.updateAgentConfig('emailAgent', { 
  timeout: 45000,
  retries: 5 
});
```

## 🧪 Testing

The configuration system includes comprehensive tests:

```bash
# Run configuration tests
npm test -- tests/unit/ai-config.test.ts

# Test specific configuration areas
npm test -- --testNamePattern="OpenAI Configuration"
npm test -- --testNamePattern="Agent Configuration"
```

## 🔍 Validation

All configurations are validated using Zod schemas:

```typescript
// Validate all configurations
const validation = aiConfigService.validateAllConfigs();
if (!validation.valid) {
  console.error('Configuration errors:', validation.errors);
}

// Get configuration summary
const summary = aiConfigService.getConfigSummary();
console.log('Available configs:', summary);
```

## 🛠️ Development Mode Features

In development mode (`NODE_ENV=development`), the system provides:

- **Configuration Monitoring**: Checks for environment variable changes
- **Enhanced Logging**: Detailed configuration validation logs
- **Runtime Updates**: Ability to modify configurations without restart

## 🚀 Production Optimizations

In production mode:

- **Static Configurations**: No file watching or runtime monitoring
- **Optimized Validation**: Configurations validated once at startup
- **Memory Efficient**: No unnecessary monitoring intervals

## ⚠️ Migration Notes

If migrating from the previous YAML-based system:

1. **YAML files have been removed**: `ai-config.yaml` → TypeScript constants
2. **Import changes**: `import { aiConfig }` → `import { aiConfigService }`
3. **Method signatures**: Same API, better type safety
4. **Hot reload**: Now via runtime updates instead of file watching

## 🎯 Best Practices

1. **Use Type-Safe Access**: Always import from the specific config modules
2. **Environment Separation**: Use different configs for dev/staging/production
3. **Validation First**: Call `validateAllConfigs()` during application startup
4. **Runtime Updates**: Only use for development/testing, not production
5. **Centralized Changes**: Update configurations in the TypeScript files, not at runtime

## 🔗 Related Files

- **Service Files**: `src/services/openai.service.ts` - Uses AI configurations
- **Agent Framework**: `src/framework/base-agent.ts` - Uses agent configurations  
- **Application**: `src/index.ts` - Uses application configurations
- **Tests**: `tests/unit/ai-config.test.ts` - Configuration test examples
