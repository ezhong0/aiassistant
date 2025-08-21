# AI Configuration System

A centralized, hot-reloadable configuration system for AI models, prompts, and agent settings that enables rapid experimentation without code changes.

## 🚀 Features

- **Hot Reload**: Configuration changes take effect immediately without restarting the application
- **Type Safety**: Full TypeScript support with Zod schema validation
- **Centralized Management**: All AI settings in one place
- **Template System**: Dynamic prompt templates with variable substitution
- **Environment Aware**: Different configurations for development vs production
- **Fallback Strategies**: Configurable retry, fail, and queue strategies for agents

## 📁 File Structure

```
backend/
├── src/framework/ai-config.ts          # Configuration manager
├── config/ai-config.yaml               # Configuration file
├── demo-ai-config.js                   # Demo script
└── AI_CONFIG_README.md                 # This file
```

## 🔧 Quick Start

### 1. Basic Usage

```typescript
import { aiConfig } from './src/framework/ai-config';

// Get OpenAI configuration for different purposes
const routingConfig = aiConfig.getOpenAIConfig('routing');
const contentConfig = aiConfig.getOpenAIConfig('content');
const analysisConfig = aiConfig.getOpenAIConfig('analysis');

// Get prompt templates with variable substitution
const emailPrompt = aiConfig.getPrompt('email_extraction', {
  userInput: 'Send email to john@example.com about meeting'
});

// Get agent configuration
const emailAgentConfig = aiConfig.getAgentConfig('emailAgent');
```

### 2. Configuration File Format

The system supports both YAML and JSON formats. Here's the YAML structure:

```yaml
openai:
  general:
    model: "gpt-4o-mini"
    temperature: 0.3
    max_tokens: 1000
    timeout: 25000
    
  routing:
    model: "gpt-4o-mini"
    temperature: 0.1
    max_tokens: 500
    timeout: 15000
    
  content:
    model: "gpt-4"
    temperature: 0.7
    max_tokens: 2000
    timeout: 30000

prompts:
  email_extraction:
    template: |
      Extract email components from this request: "${userInput}"
      # ... rest of template
    variables: ["userInput"]
    description: "Extracts structured email data from natural language"

agents:
  emailAgent:
    timeout: 30000
    retries: 3
    enabled: true
    fallback_strategy: "retry"
```

## 🎯 Configuration Sections

### OpenAI Configurations

- **`general`**: Default configuration for general use
- **`routing`**: Optimized for tool routing and decision making
- **`content`**: Optimized for content generation and creative tasks
- **`analysis`**: Optimized for analysis and structured output

### Prompt Templates

- **Template Variables**: Use `${variableName}` syntax
- **Variable Validation**: All required variables must be provided
- **Dynamic Content**: Templates are rendered at runtime

### Agent Configurations

- **`timeout`**: Maximum execution time in milliseconds
- **`retries`**: Number of retry attempts on failure
- **`enabled`**: Whether the agent is active
- **`fallback_strategy`**: How to handle failures (`retry`, `fail`, `queue`)

## ⚡ Hot Reload

The configuration system automatically detects file changes and reloads:

```typescript
// In development mode, this will automatically reload when the config file changes
const config = aiConfig.getOpenAIConfig('routing');
```

**Note**: Hot reload only works in development mode (`NODE_ENV=development`).

## 🔄 Integration with BaseAgent

The BaseAgent framework automatically uses AI configuration:

```typescript
export class EmailAgent extends BaseAgent<EmailAgentParams, EmailResult> {
  constructor() {
    super({
      name: 'emailAgent',
      description: 'Send, reply to, search, and manage emails using Gmail API',
      enabled: true,
      timeout: 30000,  // This will be overridden by AI config if available
      retryCount: 3    // This will be overridden by AI config if available
    });
  }

  // The BaseAgent automatically uses AI configuration for:
  // - getTimeout() - gets timeout from AI config
  // - getRetries() - gets retry count from AI config
  // - getFallbackStrategy() - gets fallback strategy from AI config
}
```

## 🧪 Testing

Run the configuration tests:

```bash
npm test -- tests/unit/ai-config.test.ts
```

## 📊 Demo

Run the demonstration script:

```bash
node demo-ai-config.js
```

## 🔍 Debugging

### Available Methods

```typescript
// Get all available prompts
const prompts = aiConfig.getAvailablePrompts();

// Get all available configurations
const configs = aiConfig.getAvailableConfigs();

// Check what's loaded
console.log('OpenAI configs:', configs.openai);
console.log('Agent configs:', configs.agents);
console.log('Prompt templates:', prompts);
```

### Common Issues

1. **Configuration not found**: Check the YAML file structure and indentation
2. **Variable missing**: Ensure all required variables are provided to prompt templates
3. **Hot reload not working**: Verify `NODE_ENV=development` is set
4. **Type errors**: Check that the configuration matches the expected schema

## 🚀 Advanced Usage

### Custom Configuration Manager

```typescript
import { AIConfigManager } from './src/framework/ai-config';

// Create a custom instance with a different config file
const customConfig = AIConfigManager.fromFile('./custom-config.yaml');

// Use in your service
const config = customConfig.getOpenAIConfig('routing');
```

### Environment-Specific Configurations

```typescript
// Load different config files based on environment
const configPath = process.env.NODE_ENV === 'production' 
  ? './config/ai-config.prod.yaml'
  : './config/ai-config.yaml';

const configManager = AIConfigManager.fromFile(configPath);
```

### Schema Validation

The system uses Zod for runtime validation. Invalid configurations will throw descriptive errors:

```typescript
try {
  const config = aiConfig.getOpenAIConfig('routing');
} catch (error) {
  console.error('Configuration validation failed:', error.message);
  // Handle invalid configuration
}
```

## 🔧 Migration Guide

### From Hardcoded Values

**Before:**
```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  temperature: 0.1,
  max_tokens: 1000,
  timeout: 30000,
});
```

**After:**
```typescript
const config = aiConfig.getOpenAIConfig('routing');
const response = await openai.chat.completions.create({
  model: config.model,
  temperature: config.temperature,
  max_tokens: config.max_tokens,
  timeout: config.timeout,
});
```

### From Static Prompts

**Before:**
```typescript
const systemPrompt = `You are a master AI assistant...`;
```

**After:**
```typescript
const systemPrompt = aiConfig.getPrompt('master_agent_system', {
  currentDateTime: new Date().toISOString(),
  userInput: userRequest,
  availableTools: toolList
});
```

## 🎉 Benefits

1. **Rapid Experimentation**: Change AI behavior without code changes
2. **Consistent Configuration**: Centralized management across all services
3. **Type Safety**: Catch configuration errors at compile time
4. **Hot Reload**: Instant feedback during development
5. **Environment Flexibility**: Different configs for different environments
6. **Template System**: Dynamic, reusable prompt templates
7. **Validation**: Automatic schema validation and error reporting

## 🔮 Future Enhancements

- [ ] Configuration versioning and rollback
- [ ] Configuration encryption for sensitive data
- [ ] Remote configuration sources (API, database)
- [ ] Configuration change notifications
- [ ] Configuration analytics and usage tracking
- [ ] Multi-tenant configuration support
