import { AIConfigManager } from '../../src/framework/ai-config';
import * as path from 'path';

describe('AIConfigManager', () => {
  let configManager: AIConfigManager;
  const testConfigPath = path.join(__dirname, '../../config/ai-config.yaml');

  beforeAll(() => {
    configManager = AIConfigManager.fromFile(testConfigPath);
  });

  describe('OpenAI Configuration', () => {
    it('should load routing configuration', () => {
      const config = configManager.getOpenAIConfig('routing');
      expect(config.model).toBe('gpt-4o-mini');
      expect(config.temperature).toBe(0.1);
      expect(config.max_tokens).toBe(500);
      expect(config.timeout).toBe(15000);
    });

    it('should load content configuration', () => {
      const config = configManager.getOpenAIConfig('content');
      expect(config.model).toBe('gpt-4');
      expect(config.temperature).toBe(0.7);
      expect(config.max_tokens).toBe(2000);
      expect(config.timeout).toBe(30000);
    });

    it('should load analysis configuration', () => {
      const config = configManager.getOpenAIConfig('analysis');
      expect(config.model).toBe('gpt-4o-mini');
      expect(config.temperature).toBe(0.0);
      expect(config.max_tokens).toBe(1000);
      expect(config.timeout).toBe(20000);
    });

    it('should fall back to general config when purpose not found', () => {
      // This should work if general config exists, or throw if not
      expect(() => {
        configManager.getOpenAIConfig('general');
      }).not.toThrow();
    });
  });

  describe('Prompt Templates', () => {
    it('should load email extraction prompt', () => {
      const prompt = configManager.getPrompt('email_extraction', {
        userInput: 'Send email to john@example.com about meeting'
      });
      expect(prompt).toContain('Send email to john@example.com about meeting');
      expect(prompt).toContain('Required JSON format');
    });

    it('should load contact resolution prompt', () => {
      const prompt = configManager.getPrompt('contact_resolution', {
        query: 'John Smith',
        contacts: '[{"name": "John Smith", "email": "john@example.com"}]'
      });
      expect(prompt).toContain('John Smith');
      expect(prompt).toContain('Available contacts');
    });

    it('should load master agent system prompt', () => {
      const prompt = configManager.getPrompt('master_agent_system', {
        currentDateTime: '2024-01-01T00:00:00Z',
        userInput: 'Send email to John',
        availableTools: 'emailAgent, contactAgent, Think'
      });
      expect(prompt).toContain('2024-01-01T00:00:00Z');
      expect(prompt).toContain('Send email to John');
      expect(prompt).toContain('emailAgent, contactAgent, Think');
    });

    it('should throw error for missing prompt', () => {
      expect(() => {
        configManager.getPrompt('nonexistent_prompt');
      }).toThrow('Prompt template not found: nonexistent_prompt');
    });

    it('should throw error for missing variables', () => {
      expect(() => {
        configManager.getPrompt('email_extraction', {});
      }).toThrow('Variable userInput not provided for template');
    });
  });

  describe('Agent Configuration', () => {
    it('should load emailAgent configuration', () => {
      const config = configManager.getAgentConfig('emailAgent');
      expect(config.timeout).toBe(30000);
      expect(config.retries).toBe(3);
      expect(config.enabled).toBe(true);
      expect(config.fallback_strategy).toBe('retry');
    });

    it('should load contactAgent configuration', () => {
      const config = configManager.getAgentConfig('contactAgent');
      expect(config.timeout).toBe(15000);
      expect(config.retries).toBe(2);
      expect(config.enabled).toBe(true);
      expect(config.fallback_strategy).toBe('fail');
    });

    it('should load masterAgent configuration', () => {
      const config = configManager.getAgentConfig('masterAgent');
      expect(config.timeout).toBe(45000);
      expect(config.retries).toBe(1);
      expect(config.enabled).toBe(true);
      expect(config.fallback_strategy).toBe('queue');
    });

    it('should throw error for missing agent', () => {
      expect(() => {
        configManager.getAgentConfig('nonexistentAgent');
      }).toThrow('Agent configuration not found: nonexistentAgent');
    });
  });

  describe('Utility Methods', () => {
    it('should return available prompts', () => {
      const prompts = configManager.getAvailablePrompts();
      expect(prompts).toContain('email_extraction');
      expect(prompts).toContain('contact_resolution');
      expect(prompts).toContain('master_agent_system');
    });

    it('should return available configurations', () => {
      const configs = configManager.getAvailableConfigs();
      expect(configs.openai).toContain('routing');
      expect(configs.openai).toContain('content');
      expect(configs.openai).toContain('analysis');
      expect(configs.agents).toContain('emailAgent');
      expect(configs.agents).toContain('contactAgent');
      expect(configs.agents).toContain('masterAgent');
    });
  });
});
