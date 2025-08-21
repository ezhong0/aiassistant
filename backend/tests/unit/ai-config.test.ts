import { aiConfigService } from '../../src/config/ai-config';

describe('AIConfigService', () => {
  describe('OpenAI Configuration', () => {
    it('should load routing configuration', () => {
      const config = aiConfigService.getOpenAIConfig('routing');
      expect(config.model).toBe('gpt-4o-mini');
      expect(config.temperature).toBe(0.1);
      expect(config.max_tokens).toBe(500);
      expect(config.timeout).toBe(15000);
    });

    it('should load content configuration', () => {
      const config = aiConfigService.getOpenAIConfig('content');
      expect(config.model).toBe('gpt-4');
      expect(config.temperature).toBe(0.7);
      expect(config.max_tokens).toBe(2000);
      expect(config.timeout).toBe(30000);
    });

    it('should load analysis configuration', () => {
      const config = aiConfigService.getOpenAIConfig('analysis');
      expect(config.model).toBe('gpt-4o-mini');
      expect(config.temperature).toBe(0.0);
      expect(config.max_tokens).toBe(1000);
      expect(config.timeout).toBe(20000);
    });

    it('should load general configuration as default', () => {
      const config = aiConfigService.getOpenAIConfig('general');
      expect(config.model).toBe('gpt-4o-mini');
      expect(config.temperature).toBe(0.3);
      expect(config.max_tokens).toBe(1000);
      expect(config.timeout).toBe(25000);
    });

    it('should fall back to general config when purpose not found', () => {
      const config = aiConfigService.getOpenAIConfig('nonexistent' as any);
      expect(config.model).toBe('gpt-4o-mini'); // should use general config
    });

    it('should update configuration at runtime', () => {
      aiConfigService.updateOpenAIConfig('routing', { temperature: 0.2 });
      const config = aiConfigService.getOpenAIConfig('routing');
      expect(config.temperature).toBe(0.2);
      
      // Reset for other tests
      aiConfigService.updateOpenAIConfig('routing', { temperature: 0.1 });
    });
  });

  describe('Prompt Templates', () => {
    it('should load email extraction prompt', () => {
      const prompt = aiConfigService.getPrompt('email_extraction', {
        userInput: 'Send email to john@example.com about meeting'
      });
      expect(prompt).toContain('Send email to john@example.com about meeting');
      expect(prompt).toContain('Required JSON format');
    });

    it('should load contact resolution prompt', () => {
      const prompt = aiConfigService.getPrompt('contact_resolution', {
        query: 'John Smith',
        contacts: '[{"name": "John Smith", "email": "john@example.com"}]'
      });
      expect(prompt).toContain('John Smith');
      expect(prompt).toContain('Available contacts');
    });

    it('should load master agent system prompt', () => {
      const prompt = aiConfigService.getPrompt('master_agent_system', {
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
        aiConfigService.getPrompt('nonexistent_prompt');
      }).toThrow('Prompt template not found: nonexistent_prompt');
    });

    it('should handle missing variables gracefully', () => {
      const prompt = aiConfigService.getPrompt('email_extraction', {});
      expect(prompt).toContain('${userInput}'); // placeholder should remain
    });
  });

  describe('Agent Configuration', () => {
    it('should load emailAgent configuration', () => {
      const config = aiConfigService.getAgentConfig('emailAgent');
      expect(config.timeout).toBe(30000);
      expect(config.retries).toBe(3);
      expect(config.enabled).toBe(true);
      expect(config.fallback_strategy).toBe('retry');
    });

    it('should load contactAgent configuration', () => {
      const config = aiConfigService.getAgentConfig('contactAgent');
      expect(config.timeout).toBe(15000);
      expect(config.retries).toBe(2);
      expect(config.enabled).toBe(true);
      expect(config.fallback_strategy).toBe('retry');
    });

    it('should load Think agent configuration', () => {
      const config = aiConfigService.getAgentConfig('Think');
      expect(config.timeout).toBe(15000);
      expect(config.retries).toBe(1);
      expect(config.enabled).toBe(true);
      expect(config.fallback_strategy).toBe('fail');
    });

    it('should provide default config for missing agent', () => {
      const config = aiConfigService.getAgentConfig('nonexistentAgent');
      expect(config.timeout).toBe(30000);
      expect(config.retries).toBe(2);
      expect(config.enabled).toBe(true);
      expect(config.fallback_strategy).toBe('retry');
    });

    it('should update agent configuration at runtime', () => {
      aiConfigService.updateAgentConfig('emailAgent', { timeout: 45000 });
      const config = aiConfigService.getAgentConfig('emailAgent');
      expect(config.timeout).toBe(45000);
      
      // Reset for other tests
      aiConfigService.updateAgentConfig('emailAgent', { timeout: 30000 });
    });
  });

  describe('Utility Methods', () => {
    it('should return available prompts', () => {
      const prompts = aiConfigService.getAvailablePrompts();
      expect(prompts).toContain('email_extraction');
      expect(prompts).toContain('contact_resolution');
      expect(prompts).toContain('master_agent_system');
    });

    it('should return available OpenAI configurations', () => {
      const configs = aiConfigService.getAvailableOpenAIConfigs();
      expect(configs).toContain('routing');
      expect(configs).toContain('content');
      expect(configs).toContain('analysis');
      expect(configs).toContain('general');
    });

    it('should return available agent configurations', () => {
      const agents = aiConfigService.getAvailableAgentConfigs();
      expect(agents).toContain('emailAgent');
      expect(agents).toContain('contactAgent');
      expect(agents).toContain('Think');
    });

    it('should return configuration summary', () => {
      const summary = aiConfigService.getConfigSummary();
      expect(summary.openai).toContain('routing');
      expect(summary.prompts).toContain('email_extraction');
      expect(summary.agents).toContain('emailAgent');
    });

    it('should validate all configurations', () => {
      const validation = aiConfigService.validateAllConfigs();
      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });
  });
});