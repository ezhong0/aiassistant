import { ToolExecutorService } from '../../../src/services/tool-executor.service';
import { ToolCall, ToolExecutionContext } from '../../../src/types/tools';
import { AgentFactory } from '../../../src/framework/agent-factory';

// Mock the AgentFactory
jest.mock('../../../src/framework/agent-factory');

describe('ToolExecutorService Operation-Aware Confirmation', () => {
  let toolExecutor: ToolExecutorService;
  let mockContext: ToolExecutionContext;

  beforeEach(() => {
    toolExecutor = new ToolExecutorService();
    mockContext = {
      sessionId: 'test-session',
      userId: 'test-user',
      timestamp: new Date(),
      slackContext: undefined
    };

    // Mock AgentFactory methods
    (AgentFactory.toolNeedsConfirmation as jest.Mock).mockImplementation((toolName: string) => {
      // Email and calendar agents require confirmation at agent level
      return ['emailAgent', 'calendarAgent'].includes(toolName);
    });

    (AgentFactory.getAgent as jest.Mock).mockImplementation((toolName: string) => {
      // Mock agent with executePreview method
      return {
        executePreview: jest.fn().mockResolvedValue({
          success: true,
          result: {
            awaitingConfirmation: true,
            message: 'Preview generated',
            actionId: 'test-action-id'
          }
        }),
        execute: jest.fn().mockResolvedValue({
          success: true,
          result: { message: 'Operation completed' }
        })
      };
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('operation-aware confirmation detection', () => {
    it('should execute read operations directly without confirmation', async () => {
      const toolCall: ToolCall = {
        name: 'emailAgent',
        parameters: { query: 'search for emails from boss' }
      };

      const result = await toolExecutor.executeTool(toolCall, mockContext, undefined, { preview: true });

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      // Should execute directly, not generate preview
      expect(AgentFactory.getAgent).toHaveBeenCalledWith('emailAgent');
    });

    it('should generate preview for write operations requiring confirmation', async () => {
      const toolCall: ToolCall = {
        name: 'emailAgent',
        parameters: { query: 'send email to john about project' }
      };

      const result = await toolExecutor.executeTool(toolCall, mockContext, undefined, { preview: true });

      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('awaitingConfirmation', true);
      expect(result.result).toHaveProperty('actionId', 'test-action-id');
    });

    it('should handle calendar read operations without confirmation', async () => {
      const toolCall: ToolCall = {
        name: 'calendarAgent',
        parameters: { query: 'show my calendar events', action: 'list' }
      };

      const result = await toolExecutor.executeTool(toolCall, mockContext, undefined, { preview: true });

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
    });

    it('should handle calendar write operations with confirmation', async () => {
      const toolCall: ToolCall = {
        name: 'calendarAgent',
        parameters: { query: 'create meeting tomorrow', action: 'create' }
      };

      const result = await toolExecutor.executeTool(toolCall, mockContext, undefined, { preview: true });

      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('awaitingConfirmation', true);
    });

    it('should handle contact operations without confirmation (read-only agent)', async () => {
      // Mock contact agent as not requiring confirmation
      (AgentFactory.toolNeedsConfirmation as jest.Mock).mockImplementation((toolName: string) => {
        return toolName === 'emailAgent' || toolName === 'calendarAgent';
      });

      const toolCall: ToolCall = {
        name: 'contactAgent',
        parameters: { query: 'search for john smith contact' }
      };

      const result = await toolExecutor.executeTool(toolCall, mockContext, undefined, { preview: true });

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
    });

    it('should handle search operations without confirmation (read-only agent)', async () => {
      // Mock search agent as not requiring confirmation
      (AgentFactory.toolNeedsConfirmation as jest.Mock).mockImplementation((toolName: string) => {
        return toolName === 'emailAgent' || toolName === 'calendarAgent';
      });

      const toolCall: ToolCall = {
        name: 'slackAgent',
        parameters: { query: 'read my slack messages' }
      };

      const result = await toolExecutor.executeTool(toolCall, mockContext, undefined, { preview: true });

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
    });
  });

  describe('executeWithConfirmation', () => {
    it('should execute read operations directly without creating confirmation flow', async () => {
      const toolCall: ToolCall = {
        name: 'emailAgent',
        parameters: { query: 'search for emails from boss' }
      };

      const result = await toolExecutor.executeWithConfirmation(toolCall, mockContext);

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('toolName', 'emailAgent');
      expect(result).toHaveProperty('result');
      // Should not be a ConfirmationFlowResult
      expect(result).not.toHaveProperty('confirmationFlow');
    });

    it('should create confirmation flow for write operations', async () => {
      // Mock confirmation service
      const mockConfirmationService = {
        createConfirmation: jest.fn().mockResolvedValue({
          confirmationId: 'test-confirmation-id',
          sessionId: 'test-session',
          userId: 'test-user',
          status: 'pending'
        })
      };

      // Inject mock confirmation service
      (toolExecutor as any).confirmationService = mockConfirmationService;

      const toolCall: ToolCall = {
        name: 'emailAgent',
        parameters: { query: 'send email to john about project' }
      };

      const result = await toolExecutor.executeWithConfirmation(toolCall, mockContext);

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('confirmationFlow');
      expect(mockConfirmationService.createConfirmation).toHaveBeenCalled();
    });
  });

  describe('operation detection from tool calls', () => {
    it('should detect operations from query parameters', () => {
      const toolCall: ToolCall = {
        name: 'emailAgent',
        parameters: { query: 'send email to john' }
      };

      // Access private method for testing
      const operation = (toolExecutor as any).detectOperationFromToolCall('emailAgent', toolCall);
      expect(operation).toBe('send');
    });

    it('should detect operations from action parameters', () => {
      const toolCall: ToolCall = {
        name: 'calendarAgent',
        parameters: { action: 'create', query: 'create meeting' }
      };

      const operation = (toolExecutor as any).detectOperationFromToolCall('calendarAgent', toolCall);
      expect(operation).toBe('create');
    });

    it('should return unknown for unrecognized operations', () => {
      const toolCall: ToolCall = {
        name: 'emailAgent',
        parameters: { query: 'random text' }
      };

      const operation = (toolExecutor as any).detectOperationFromToolCall('emailAgent', toolCall);
      expect(operation).toBe('unknown');
    });
  });
});
