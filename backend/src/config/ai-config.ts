import { z } from 'zod';
import logger from '../utils/logger';
import { BaseService } from '../services/base-service';

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
      2. Always call Think tool last to verify actions
      3. Return structured tool calls`,
    variables: ["currentDateTime", "userInput", "availableTools"],
    description: "Master agent system prompt with dynamic tool information"
  }
};

// Agent-specific AI configurations
export const AGENT_AI_CONFIGS: Record<string, AgentAIConfig> = {
  master: {
    timeout: 30000,
    retries: 3,
    enabled: true,
    fallback_strategy: 'retry'
  },
  
  // Add both naming conventions for compatibility
  email: {
    timeout: 25000,
    retries: 2,
    enabled: true,
    fallback_strategy: 'retry'
  },
  emailAgent: {
    timeout: 25000,
    retries: 2,
    enabled: true,
    fallback_strategy: 'retry'
  },
  
  contact: {
    timeout: 15000,
    retries: 2,
    enabled: true,
    fallback_strategy: 'retry'
  },
  contactAgent: {
    timeout: 15000,
    retries: 2,
    enabled: true,
    fallback_strategy: 'retry'
  },
  
  calendar: {
    timeout: 20000,
    retries: 2,
    enabled: true,
    fallback_strategy: 'retry'
  },
  calendarAgent: {
    timeout: 20000,
    retries: 2,
    enabled: true,
    fallback_strategy: 'retry'
  },
  
  content: {
    timeout: 45000,
    retries: 1,
    enabled: true,
    fallback_strategy: 'fail'
  },
  contentCreator: {
    timeout: 45000,
    retries: 1,
    enabled: true,
    fallback_strategy: 'fail'
  },
  
  // Add other agent names that might be used
  Think: {
    timeout: 10000,
    retries: 1,
    enabled: true,
    fallback_strategy: 'fail'
  },
  
  tavily: {
    timeout: 15000,
    retries: 2,
    enabled: true,
    fallback_strategy: 'retry'
  },
  tavilyAgent: {
    timeout: 15000,
    retries: 2,
    enabled: true,
    fallback_strategy: 'retry'
  }
};

/**
 * Unified AI Configuration Service
 * Provides type-safe access to AI models, prompts, and agent settings
 */
export class AIConfigService extends BaseService {
  
  constructor() {
    super('AIConfigService');
  }
  
  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    // Validate all configurations on startup
    this.validateAllConfigurations();
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    // No cleanup needed for configuration
  }

  /**
   * Get service health status
   */
  getHealth(): { healthy: boolean; details?: any } {
    const healthy = this.isReady();
    return {
      healthy,
      details: {
        openaiConfigs: Object.keys(OPENAI_CONFIGS).length,
        promptTemplates: Object.keys(PROMPT_TEMPLATES).length,
        agentConfigs: Object.keys(AGENT_AI_CONFIGS).length,
        timestamp: new Date().toISOString()
      }
    };
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
  getAllOpenAIConfigs(): Record<string, OpenAIConfig> {
    return { ...OPENAI_CONFIGS };
  }
  
  /**
   * Get all available prompt templates
   */
  getAllPromptTemplates(): Record<string, PromptTemplate> {
    return { ...PROMPT_TEMPLATES };
  }
  
  /**
   * Get all available agent configurations
   */
  getAllAgentConfigs(): Record<string, AgentAIConfig> {
    return { ...AGENT_AI_CONFIGS };
  }
  
  /**
   * Validate all configurations on startup
   */
  private validateAllConfigurations(): void {
    try {
      // Validate OpenAI configurations
      Object.entries(OPENAI_CONFIGS).forEach(([key, config]) => {
        OpenAIConfigSchema.parse(config);
      });
      
      // Validate prompt templates
      Object.entries(PROMPT_TEMPLATES).forEach(([key, template]) => {
        PromptTemplateSchema.parse(template);
      });
      
      // Validate agent configurations
      Object.entries(AGENT_AI_CONFIGS).forEach(([key, config]) => {
        AgentConfigSchema.parse(config);
      });
      
      logger.info('All AI configurations validated successfully', {
        openaiConfigs: Object.keys(OPENAI_CONFIGS).length,
        promptTemplates: Object.keys(PROMPT_TEMPLATES).length,
        agentConfigs: Object.keys(AGENT_AI_CONFIGS).length
      });
    } catch (error) {
      logger.error('AI configuration validation failed:', error);
      throw new Error('AI configuration validation failed');
    }
  }
}

// Export singleton instance for backward compatibility
export const aiConfigService = new AIConfigService();
