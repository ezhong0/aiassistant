import { BaseAgent } from '../../../src/framework/base-agent';
import { AgentConfig, ToolExecutionContext } from '../../../src/types/tools';

// Create a concrete test implementation
class TestAgent extends BaseAgent<any, any> {
  async processQuery(params: any, context: ToolExecutionContext): Promise<any> {
    return {
      success: true,
      data: { processed: true, input: params },
      metadata: { agent: this.config.name }
    };
  }

  validateParams(params: any): boolean {
    return params !== null && params !== undefined;
  }
}

describe('BaseAgent', () => {
  let testAgent: TestAgent;
  let mockConfig: AgentConfig;

  beforeEach(() => {
    mockConfig = {
      name: 'TestAgent',
      timeout: 5000,
      retries: 2,
      enabled: true,
      fallback_strategy: 'retry' as const
    };
    testAgent = new TestAgent(mockConfig);
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(testAgent.config).toEqual(mockConfig);
      expect(testAgent.config.name).toBe('TestAgent');
      expect(testAgent.config.timeout).toBe(5000);
    });

    it('should have logger with agent context', () => {
      expect(testAgent.logger).toBeDefined();
    });
  });

  describe('Query Processing', () => {
    it('should process query successfully', async () => {
      const testParams = { query: 'test input' };
      const context: ToolExecutionContext = {
        userId: 'test-user',
        sessionId: 'test-session'
      };

      const result = await testAgent.processQuery(testParams, context);

      expect(result.success).toBe(true);
      expect(result.data.processed).toBe(true);
      expect(result.data.input).toEqual(testParams);
      expect(result.metadata.agent).toBe('TestAgent');
    });

    it('should validate parameters', () => {
      expect(testAgent.validateParams({ valid: true })).toBe(true);
      expect(testAgent.validateParams(null)).toBe(false);
      expect(testAgent.validateParams(undefined)).toBe(false);
    });
  });

  describe('Configuration', () => {
    it('should handle different timeout values', () => {
      const shortTimeoutConfig = { ...mockConfig, timeout: 1000 };
      const shortTimeoutAgent = new TestAgent(shortTimeoutConfig);
      
      expect(shortTimeoutAgent.config.timeout).toBe(1000);
    });

    it('should handle different retry strategies', () => {
      const failConfig = { ...mockConfig, fallback_strategy: 'fail' as const };
      const failAgent = new TestAgent(failConfig);
      
      expect(failAgent.config.fallback_strategy).toBe('fail');
    });

    it('should handle disabled agents', () => {
      const disabledConfig = { ...mockConfig, enabled: false };
      const disabledAgent = new TestAgent(disabledConfig);
      
      expect(disabledAgent.config.enabled).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid context gracefully', async () => {
      const testParams = { query: 'test' };
      const invalidContext = {} as ToolExecutionContext;

      // Should still process even with minimal context
      const result = await testAgent.processQuery(testParams, invalidContext);
      expect(result.success).toBe(true);
    });
  });
});