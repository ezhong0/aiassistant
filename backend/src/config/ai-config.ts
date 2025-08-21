import { z } from 'zod';
import logger from '../utils/logger';

// Configuration schemas for type safety
const OpenAIConfigSchema = z.object({
  model: z.string(),
  temperature: z.number().min(0).max(2),
  max_tokens: z.number().positive(),
  timeout: z.number().optional().default(30000)
});

const PromptTemplateSchema = z.object({
  template: z.string(),
  variables: z.array(z.string()).optional().default([]),
  description: z.string().optional()
});

const AgentConfigSchema = z.object({
  timeout: z.number().positive(),
  retries: z.number().min(0).max(10),
  enabled: z.boolean().default(true),
  fallback_strategy: z.enum(['fail', 'retry', 'queue']).default('retry')
});

// Type definitions
export type OpenAIConfig = z.infer<typeof OpenAIConfigSchema>;
export type PromptTemplate = z.infer<typeof PromptTemplateSchema>;
export type AgentAIConfig = z.infer<typeof AgentConfigSchema>;

// OpenAI configurations for different purposes
export const OPENAI_CONFIGS: Record<string, OpenAIConfig> = {
  general: {
    model: "gpt-4o-mini",
    temperature: 0.3,
    max_tokens: 1000,
    timeout: 25000
  },
  
  routing: {
    model: "gpt-4o-mini",
    temperature: 0.1,
    max_tokens: 500,
    timeout: 15000
  },
  
  content: {
    model: "gpt-4",
    temperature: 0.7,
    max_tokens: 2000,
    timeout: 30000
  },
  
  analysis: {
    model: "gpt-4o-mini",
    temperature: 0.0,
    max_tokens: 1000,
    timeout: 20000
  }
};

// Prompt templates with variable substitution
export const PROMPT_TEMPLATES: Record<string, PromptTemplate> = {
  email_extraction: {
    template: `Extract email components from this request: "\${userInput}"
      
      Required JSON format:
      {
        "recipient": "email address or person name",
        "subject": "email subject line", 
        "body": "email content",
        "priority": "low|normal|high"
      }
      
      Return only valid JSON.`,
    variables: ["userInput"],
    description: "Extracts structured email data from natural language"
  },
  
  contact_resolution: {
    template: `Find the best matching contact for: "\${query}"
      
      Available contacts:
      \${contacts}
      
      Return JSON with best match and confidence score (0-1).`,
    variables: ["query", "contacts"],
    description: "Resolves contact names to actual contact information"
  },
  
  master_agent_system: {
    template: `You are a master AI assistant that routes user requests to specialized tools.
      
      Current date/time: \${currentDateTime}
      User request: "\${userInput}"
      
      Available tools:
      \${availableTools}
      
      Rules:
      1. Call contactAgent first if email/calendar needs contact lookup
      2. Always call Think tool last for verification
      3. Multiple tools can be called in one response
      
      Return tool calls as JSON array.`,
    variables: ["currentDateTime", "userInput", "availableTools"],
    description: "Master agent routing prompt"
  }
};

// Agent AI configurations
export const AGENT_AI_CONFIGS: Record<string, AgentAIConfig> = {
  emailAgent: {
    timeout: 30000,
    retries: 3,
    enabled: true,
    fallback_strategy: 'retry'
  },
  
  contactAgent: {
    timeout: 15000,
    retries: 2,
    enabled: true,
    fallback_strategy: 'retry'
  },
  
  calendarAgent: {
    timeout: 30000,
    retries: 2,
    enabled: true,
    fallback_strategy: 'retry'
  },
  
  contentCreator: {
    timeout: 45000,
    retries: 2,
    enabled: true,
    fallback_strategy: 'retry'
  },
  
  Tavily: {
    timeout: 30000,
    retries: 2,
    enabled: true,
    fallback_strategy: 'retry'
  },
  
  Think: {
    timeout: 15000,
    retries: 1,
    enabled: true,
    fallback_strategy: 'fail'
  }
};

/**
 * Unified AI Configuration Service
 * Provides type-safe access to AI models, prompts, and agent settings
 */
export class AIConfigService {
  private static instance: AIConfigService;
  
  /**
   * Get singleton instance
   */
  static getInstance(): AIConfigService {
    if (!AIConfigService.instance) {
      AIConfigService.instance = new AIConfigService();
    }
    return AIConfigService.instance;
  }
  
  /**
   * Get OpenAI configuration for specific purpose
   */
  getOpenAIConfig(purpose: keyof typeof OPENAI_CONFIGS | string = 'general'): OpenAIConfig {
    const config = OPENAI_CONFIGS[purpose as keyof typeof OPENAI_CONFIGS];
    if (!config) {
      logger.warn(`OpenAI configuration not found for purpose: ${purpose}, using general config`);
      return OPENAI_CONFIGS.general as OpenAIConfig;
    }
    
    // Validate configuration
    try {
      return OpenAIConfigSchema.parse(config);
    } catch (error) {
      logger.error(`Invalid OpenAI configuration for ${purpose}:`, error);
      throw new Error(`Invalid OpenAI configuration for ${purpose}`);
    }
  }
  
  /**
   * Get prompt template with variable substitution
   */
  getPrompt(key: string, variables: Record<string, any> = {}): string {
    const promptConfig = PROMPT_TEMPLATES[key];
    if (!promptConfig) {
      throw new Error(`Prompt template not found: ${key}`);
    }
    
    // Validate prompt configuration
    try {
      const validated = PromptTemplateSchema.parse(promptConfig);
      return this.renderTemplate(validated.template, variables);
    } catch (error) {
      logger.error(`Invalid prompt template for ${key}:`, error);
      throw new Error(`Invalid prompt template for ${key}`);
    }
  }
  
  /**
   * Get agent AI configuration
   */
  getAgentConfig(agentName: string): AgentAIConfig {
    const config = AGENT_AI_CONFIGS[agentName];
    if (!config) {
      logger.warn(`Agent AI configuration not found for: ${agentName}, using default config`);
      return {
        timeout: 30000,
        retries: 2,
        enabled: true,
        fallback_strategy: 'retry'
      };
    }
    
    // Validate configuration
    try {
      return AgentConfigSchema.parse(config);
    } catch (error) {
      logger.error(`Invalid agent configuration for ${agentName}:`, error);
      throw new Error(`Invalid agent configuration for ${agentName}`);
    }
  }
  
  /**
   * Render template with variable substitution
   */
  private renderTemplate(template: string, variables: Record<string, any>): string {
    return template.replace(/\$\{(\w+)\}/g, (match, varName) => {
      if (varName in variables) {
        return String(variables[varName]);
      }
      logger.warn(`Variable ${varName} not provided for template, leaving placeholder`);
      return match;
    });
  }
  
  /**
   * Get all available OpenAI configurations
   */
  getAvailableOpenAIConfigs(): string[] {
    return Object.keys(OPENAI_CONFIGS);
  }
  
  /**
   * Get all available prompt templates
   */
  getAvailablePrompts(): string[] {
    return Object.keys(PROMPT_TEMPLATES);
  }
  
  /**
   * Get all available agent configurations
   */
  getAvailableAgentConfigs(): string[] {
    return Object.keys(AGENT_AI_CONFIGS);
  }
  
  /**
   * Update OpenAI configuration at runtime (for testing/development)
   */
  updateOpenAIConfig(purpose: string, config: Partial<OpenAIConfig>): void {
    if (!OPENAI_CONFIGS[purpose]) {
      throw new Error(`OpenAI configuration not found for purpose: ${purpose}`);
    }
    
    const updatedConfig = { ...OPENAI_CONFIGS[purpose], ...config };
    
    try {
      OpenAIConfigSchema.parse(updatedConfig);
      OPENAI_CONFIGS[purpose] = updatedConfig;
      logger.info(`Updated OpenAI configuration for ${purpose}`, updatedConfig);
    } catch (error) {
      logger.error(`Invalid OpenAI configuration update for ${purpose}:`, error);
      throw new Error(`Invalid OpenAI configuration update for ${purpose}`);
    }
  }
  
  /**
   * Update agent configuration at runtime (for testing/development)
   */
  updateAgentConfig(agentName: string, config: Partial<AgentAIConfig>): void {
    if (!AGENT_AI_CONFIGS[agentName]) {
      throw new Error(`Agent configuration not found for: ${agentName}`);
    }
    
    const updatedConfig = { ...AGENT_AI_CONFIGS[agentName], ...config };
    
    try {
      AgentConfigSchema.parse(updatedConfig);
      AGENT_AI_CONFIGS[agentName] = updatedConfig;
      logger.info(`Updated agent configuration for ${agentName}`, updatedConfig);
    } catch (error) {
      logger.error(`Invalid agent configuration update for ${agentName}:`, error);
      throw new Error(`Invalid agent configuration update for ${agentName}`);
    }
  }
  
  /**
   * Get configuration summary for debugging
   */
  getConfigSummary(): {
    openai: string[];
    prompts: string[];
    agents: string[];
  } {
    return {
      openai: this.getAvailableOpenAIConfigs(),
      prompts: this.getAvailablePrompts(),
      agents: this.getAvailableAgentConfigs()
    };
  }
  
  /**
   * Validate all configurations
   */
  validateAllConfigs(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Validate OpenAI configs
    for (const [purpose, config] of Object.entries(OPENAI_CONFIGS)) {
      try {
        OpenAIConfigSchema.parse(config);
      } catch (error) {
        errors.push(`Invalid OpenAI config for ${purpose}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // Validate prompt templates
    for (const [key, template] of Object.entries(PROMPT_TEMPLATES)) {
      try {
        PromptTemplateSchema.parse(template);
      } catch (error) {
        errors.push(`Invalid prompt template for ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // Validate agent configs
    for (const [agentName, config] of Object.entries(AGENT_AI_CONFIGS)) {
      try {
        AgentConfigSchema.parse(config);
      } catch (error) {
        errors.push(`Invalid agent config for ${agentName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    if (errors.length > 0) {
      logger.error('AI configuration validation failed:', errors);
    } else {
      logger.info('All AI configurations validated successfully');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export const aiConfigService = AIConfigService.getInstance();

// Export for backward compatibility and convenience
export const aiConfig = aiConfigService;

// Validate all configurations on module load
aiConfigService.validateAllConfigs();

// Development hot-reload capabilities
if (process.env.NODE_ENV === 'development') {
  // Allow runtime configuration updates via environment variable changes
  const originalEnv = { ...process.env };
  
  // Check for configuration changes every 30 seconds in development
  const configCheckInterval = setInterval(() => {
    let hasChanges = false;
    
    // Check for environment variable changes that might affect configuration
    const relevantEnvVars = ['OPENAI_API_KEY', 'LOG_LEVEL', 'NODE_ENV'];
    for (const envVar of relevantEnvVars) {
      if (process.env[envVar] !== originalEnv[envVar]) {
        hasChanges = true;
        originalEnv[envVar] = process.env[envVar];
      }
    }
    
    if (hasChanges) {
      logger.info('🔄 Environment changes detected, configuration remains type-safe');
      aiConfigService.validateAllConfigs();
    }
  }, 30000);
  
  // Clean up interval on process exit
  process.on('SIGINT', () => {
    clearInterval(configCheckInterval);
  });
  
  process.on('SIGTERM', () => {
    clearInterval(configCheckInterval);
  });
  
  logger.info('🔥 Development mode: Basic configuration monitoring enabled');
}

logger.info('✅ AI configuration service initialized with TypeScript configs');
