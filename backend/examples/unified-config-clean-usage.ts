/**
 * Example: Clean Configuration Usage
 * 
 * This demonstrates how elegant the new unified configuration system is
 * compared to the previous scattered config approach.
 */

import { config } from '../src/config/unified-config';

// ========== BEFORE (Multiple Config Files) ==========
// 
// import { CONFIG } from './config/app-config';
// import { ENVIRONMENT } from './config/environment';
// import { ConfigService } from './services/config.service';
// import { AIConfigService } from './services/ai-config.service';
//
// const configService = new ConfigService();
// const aiConfig = AIConfigService.getConfig();
// const port = parseInt(process.env.PORT || '3000');
// const openaiKey = process.env.OPENAI_API_KEY;
// const googleClientId = ENVIRONMENT.google.clientId;
// const jwtSecret = configService.get('JWT_SECRET');

// ========== AFTER (Unified Config) ==========

// Core application settings
console.log('Server running on port:', config.port);
console.log('Environment:', config.nodeEnv);
console.log('Log level:', config.logLevel);

// Authentication configuration
if (config.googleAuth?.clientId) {
  console.log('Google OAuth configured:', config.googleAuth.clientId);
}

if (config.slackAuth?.clientId) {
  console.log('Slack OAuth configured:', config.slackAuth.clientId);
}

// Services configuration
if (config.openaiApiKey) {
  console.log('OpenAI API configured');
}

if (config.databaseUrl) {
  console.log('Database configured');
}

// AI model configuration
const generalModel = config.getAIModelConfig('general');
console.log('Default AI model:', generalModel.model);
console.log('Temperature:', generalModel.temperature);

// Security settings
console.log('CORS origin:', config.security.cors.origin);
console.log('Rate limiting enabled:', config.security.rateLimiting.enabled);

// Environment-specific behavior
if (config.isProduction) {
  console.log('🚀 Running in production mode');
  
  // Ensure all required secrets are present
  const health = config.getHealth();
  if (!health.healthy) {
    console.error('❌ Configuration issues:', health.details.issues);
    process.exit(1);
  }
} else if (config.isDevelopment) {
  console.log('🔧 Running in development mode');
  
  // Enable hot-reload for development
  config.reload();
} else {
  console.log('🧪 Running in test mode');
}

// Feature flags
if (config.isFeatureEnabled('request-logging')) {
  console.log('Request logging enabled');
}

// Clean service initialization example
const initializeServices = () => {
  // Before: Multiple config objects
  // const authConfig = { clientId: googleClientId, secret: googleSecret };
  // const aiConfig = { apiKey: openaiKey, timeout: parseInt(process.env.AI_TIMEOUT || '30000') };
  
  // After: Single config object
  const authConfig = {
    clientId: config.googleAuth?.clientId,
    secret: config.googleAuth?.clientSecret };
    
  const aiConfig = {
    apiKey: config.openaiApiKey,
    timeout: config.ai.timeouts.toolExecution };
    
  console.log('✅ Services configured elegantly');
};

// Clean middleware setup example
const setupMiddleware = () => {
  // Before: Scattered config values
  // const corsOrigin = ENVIRONMENT.cors.origin;
  // const rateLimitWindow = CONFIG.RATE_LIMITS.api.windowMs;
  // const rateLimitMax = CONFIG.RATE_LIMITS.api.maxRequests;
  
  // After: Unified config access
  const corsOrigin = config.security.cors.origin;
  const rateLimitWindow = config.security.rateLimiting.windowMs;
  const rateLimitMax = config.security.rateLimiting.maxRequests;
  
  console.log('✅ Middleware configured cleanly');
};

// Clean error handling example
const validateConfiguration = () => {
  const health = config.getHealth();
  
  if (!health.healthy) {
    throw new Error(`Configuration validation failed: ${health.details.issues.join(', ')}`);
  }
  
  console.log('✅ Configuration validated successfully');
};

// Execute examples
initializeServices();
setupMiddleware();
validateConfiguration();

/**
 * Benefits Summary:
 * 
 * ✅ Single source of truth
 * ✅ Type-safe access
 * ✅ Environment-aware defaults
 * ✅ Runtime validation
 * ✅ Health checking
 * ✅ Hot-reload (development)
 * ✅ Much cleaner imports
 * ✅ Hierarchical organization
 * ✅ Consistent naming
 * ✅ Excellent developer experience
 */
