import { BaseAgent } from '../../../src/framework/base-agent';
import { ToolExecutionContext, AgentConfig } from '../../../src/types/tools';

// Mock agent for testing
class TestAgent extends BaseAgent<{ query: string }, { result: string }> {
  constructor() {
    super({
      name: 'testAgent',
      description: 'Test agent for operation detection',
      enabled: true,
      timeout: 30000,
      retryCount: 3
    });
  }

  protected async processQuery(params: { query: string }, context: ToolExecutionContext): Promise<{ result: string }> {
    return { result: `Processed: ${params.query}` };
  }

  // Override detectOperation for testing
  protected detectOperation(params: { query: string }): string {
    const lowerQuery = params.query.toLowerCase();
    
    if (lowerQuery.includes('send')) return 'send';
    if (lowerQuery.includes('search')) return 'search';
    if (lowerQuery.includes('get')) return 'get';
    if (lowerQuery.includes('create')) return 'create';
    
    return 'unknown';
  }
}

describe('BaseAgent Operation Detection', () => {
  let testAgent: TestAgent;
  let mockContext: ToolExecutionContext;

  beforeEach(() => {
    testAgent = new TestAgent();
    mockContext = {
      sessionId: 'test-session',
      userId: 'test-user',
      timestamp: new Date(),
      slackContext: undefined
    };
  });

  describe('detectOperation', () => {
    it('should detect operations from query parameters', () => {
      expect(testAgent.detectOperation({ query: 'send email to john' })).toBe('send');
      expect(testAgent.detectOperation({ query: 'search for emails' })).toBe('search');
      expect(testAgent.detectOperation({ query: 'get email details' })).toBe('get');
      expect(testAgent.detectOperation({ query: 'create new email' })).toBe('create');
      expect(testAgent.detectOperation({ query: 'random text' })).toBe('unknown');
    });

    it('should handle missing query parameter', () => {
      expect(testAgent.detectOperation({ query: '' })).toBe('unknown');
    });
  });

  describe('operationRequiresConfirmation', () => {
    it('should check confirmation requirements for detected operations', () => {
      // These should use the agent config rules
      expect(testAgent.operationRequiresConfirmation('send')).toBe(true);
      expect(testAgent.operationRequiresConfirmation('search')).toBe(false);
      expect(testAgent.operationRequiresConfirmation('get')).toBe(false);
      expect(testAgent.operationRequiresConfirmation('create')).toBe(true);
    });
  });

  describe('getOperationConfirmationReason', () => {
    it('should provide reasons for confirmation requirements', () => {
      expect(testAgent.getOperationConfirmationReason('send'))
        .toBe('Email sending modifies external state');
      expect(testAgent.getOperationConfirmationReason('search'))
        .toBe('Read-only email search operation');
      expect(testAgent.getOperationConfirmationReason('unknown'))
        .toBe('Agent-level confirmation required');
    });
  });

  describe('isReadOnlyOperation', () => {
    it('should correctly identify read-only operations', () => {
      expect(testAgent.isReadOnlyOperation('search')).toBe(true);
      expect(testAgent.isReadOnlyOperation('get')).toBe(true);
      expect(testAgent.isReadOnlyOperation('send')).toBe(false);
      expect(testAgent.isReadOnlyOperation('create')).toBe(false);
    });
  });

  describe('executePreview with operation detection', () => {
    it('should execute directly for read operations without confirmation', async () => {
      const result = await testAgent.executePreview(
        { query: 'search for emails from boss' },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result).toHaveProperty('result');
      expect(result.result.result).toBe('Processed: search for emails from boss');
    });

    it('should generate preview for write operations requiring confirmation', async () => {
      // Mock the generatePreview method
      const originalGeneratePreview = testAgent.generatePreview;
      testAgent.generatePreview = jest.fn().mockResolvedValue({
        success: true,
        preview: {
          actionId: 'test-action-id',
          actionType: 'email',
          title: 'Send Email',
          description: 'Send email to recipient',
          riskAssessment: { level: 'low', factors: ['Standard operation'] },
          estimatedExecutionTime: '2-5 seconds',
          reversible: false,
          requiresConfirmation: true,
          awaitingConfirmation: true,
          originalQuery: 'send email to john',
          parameters: { query: 'send email to john' }
        }
      });

      const result = await testAgent.executePreview(
        { query: 'send email to john' },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('awaitingConfirmation', true);
      expect(result.result).toHaveProperty('preview');

      // Restore original method
      testAgent.generatePreview = originalGeneratePreview;
    });
  });
});
