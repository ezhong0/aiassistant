import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { z } from 'zod';

// Configuration schemas
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

export class AIConfigManager {
  private config: any = {};
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private lastModified: Map<string, number> = new Map();

  constructor(private configPath: string) {
    this.loadConfig();
    this.setupHotReload();
  }

  // Factory method
  static fromFile(configPath: string): AIConfigManager {
    return new AIConfigManager(configPath);
  }

  // Type-safe configuration getters
  getOpenAIConfig(purpose: 'routing' | 'content' | 'analysis' | 'general' = 'general'): z.infer<typeof OpenAIConfigSchema> {
    // First try to get the specific purpose config
    let config = this.config.openai?.[purpose];
    
    // If not found and purpose is not 'general', fall back to general config
    if (!config && purpose !== 'general') {
      config = this.config.openai?.general;
    }
    
    if (!config) {
      throw new Error(`OpenAI configuration not found for purpose: ${purpose}`);
    }
    return OpenAIConfigSchema.parse(config);
  }

  getPrompt(key: string, variables: Record<string, any> = {}): string {
    const promptConfig = this.config.prompts?.[key];
    if (!promptConfig) {
      throw new Error(`Prompt template not found: ${key}`);
    }

    const validated = PromptTemplateSchema.parse(promptConfig);
    return this.renderTemplate(validated.template, variables);
  }

  getAgentConfig(agentName: string): z.infer<typeof AgentConfigSchema> {
    const config = this.config.agents?.[agentName];
    if (!config) {
      throw new Error(`Agent configuration not found: ${agentName}`);
    }
    return AgentConfigSchema.parse(config);
  }

  // Template rendering with variable substitution
  private renderTemplate(template: string, variables: Record<string, any>): string {
    return template.replace(/\$\{(\w+)\}/g, (match, varName) => {
      if (varName in variables) {
        return String(variables[varName]);
      }
      throw new Error(`Variable ${varName} not provided for template`);
    });
  }

  // Hot reload functionality
  private setupHotReload(): void {
    if (process.env.NODE_ENV === 'development') {
      const watcher = fs.watchFile(this.configPath, (curr, prev) => {
        if (curr.mtime !== prev.mtime) {
          console.log('🔄 AI configuration reloaded');
          this.loadConfig();
        }
      });
    }
  }

  private loadConfig(): void {
    try {
      const configContent = fs.readFileSync(this.configPath, 'utf8');
      const extension = path.extname(this.configPath);
      
      if (extension === '.yaml' || extension === '.yml') {
        this.config = yaml.load(configContent) as any;
      } else if (extension === '.json') {
        this.config = JSON.parse(configContent);
      } else {
        throw new Error('Unsupported config file format. Use .yaml, .yml, or .json');
      }
      
      console.log('✅ AI configuration loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load AI configuration:', error);
      throw error;
    }
  }

  // Get all available prompts for debugging
  getAvailablePrompts(): string[] {
    return Object.keys(this.config.prompts || {});
  }

  // Get all available configurations for debugging
  getAvailableConfigs(): { openai: string[], agents: string[] } {
    return {
      openai: Object.keys(this.config.openai || {}),
      agents: Object.keys(this.config.agents || {})
    };
  }
}

// Singleton instance
export const aiConfig = AIConfigManager.fromFile(
  path.join(__dirname, '../../config/ai-config.yaml')
);
