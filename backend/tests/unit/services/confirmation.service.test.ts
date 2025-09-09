import { ConfirmationService } from '../../../src/services/confirmation.service';
import { ToolExecutorService } from '../../../src/services/tool-executor.service';
import { DatabaseService } from '../../../src/services/database.service';
import { 
  ConfirmationRequest, 
  ConfirmationStatus,
  ConfirmationError,
  ConfirmationErrorCode
} from '../../../src/types/confirmation.types';
import { ToolCall, ToolExecutionContext } from '../../../src/types/tools';
import { ServiceState } from '../../../src/services/service-manager';

// Mock dependencies
jest.mock('../../../src/services/service-manager');
jest.mock('../../../src/framework/agent-factory');

describe('ConfirmationService', () => {
  let confirmationService: ConfirmationService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockToolExecutorService: jest.Mocked<ToolExecutorService>;

  beforeEach(async () => {
    // Create mock services
    mockDatabaseService = {
      name: 'databaseService',
      state: ServiceState.READY,
      isReady: jest.fn().mockReturnValue(true),
      query: jest.fn(),
      initialize: jest.fn(),
      destroy: jest.fn(),
      getHealth: jest.fn()
    } as any;

    mockToolExecutorService = {
      name: 'toolExecutorService',
      state: ServiceState.READY,
      isReady: jest.fn().mockReturnValue(true),
      executeTool: jest.fn(),
      initialize: jest.fn(),
      destroy: jest.fn(),
      getHealth: jest.fn()
    } as any;

    // Mock the getService function
    const { getService } = require('../../../src/services/service-manager');
    getService.mockImplementation((serviceName: string) => {
      switch (serviceName) {
        case 'databaseService':
          return mockDatabaseService;
        case 'toolExecutorService':
          return mockToolExecutorService;
        default:
          return null;
      }
    });

    // Mock AgentFactory
    const { AgentFactory } = require('../../../src/framework/agent-factory');
    AgentFactory.getAgent = jest.fn().mockReturnValue({
      generatePreview: jest.fn().mockResolvedValue({
        success: true,
        preview: {
          actionId: 'test-action-id',
          actionType: 'email',
          title: 'Test Email Action',
          description: 'Test email description',
          riskAssessment: {
            level: 'low',
            factors: ['Standard email operation']
          },
          estimatedExecutionTime: '2-5 seconds',
          reversible: false,
          requiresConfirmation: true,
          awaitingConfirmation: true,
          previewData: {
            recipients: {
              to: ['test@example.com']
            },
            subject: 'Test Subject',
            contentSummary: 'Test content',
            recipientCount: 1
          },
          originalQuery: 'test query',
          parameters: {}
        }
      })
    });

    confirmationService = new ConfirmationService();
    await confirmationService.initialize();
  });

  afterEach(async () => {
    if (confirmationService) {
      await confirmationService.destroy();
    }
    jest.clearAllMocks();
  });

  describe('Service Lifecycle', () => {
    it('should initialize successfully with dependencies', async () => {
      const service = new ConfirmationService();
      await service.initialize();

      expect(service.isReady()).toBe(true);
      expect(service.state).toBe(ServiceState.READY);
      
      await service.destroy();
    });

    it('should initialize successfully without database service', async () => {
      const { getService } = require('../../../src/services/service-manager');
      getService.mockImplementation((serviceName: string) => {
        switch (serviceName) {
          case 'toolExecutorService':
            return mockToolExecutorService;
          default:
            return null; // No database service
        }
      });

      const service = new ConfirmationService();
      await service.initialize();

      expect(service.isReady()).toBe(true);
      
      await service.destroy();
    });

    it('should fail to initialize without tool executor service', async () => {
      const { getService } = require('../../../src/services/service-manager');
      getService.mockImplementation(() => null);

      const service = new ConfirmationService();
      
      await expect(service.initialize()).rejects.toThrow('ToolExecutorService is required for ConfirmationService');
    });
  });

  describe('createConfirmation', () => {
    const mockToolCall: ToolCall = {
      name: 'emailAgent',
      parameters: {
        query: 'send email to test@example.com about meeting'
      }
    };

    const mockContext: ToolExecutionContext = {
      sessionId: 'test-session',
      userId: 'test-user',
      timestamp: new Date()
    };

    const mockRequest: ConfirmationRequest = {
      sessionId: 'test-session',
      userId: 'test-user',
      toolCall: mockToolCall,
      context: {
        conversationHistory: [],
        userPreferences: {}
      }
    };

    it('should create a confirmation flow successfully', async () => {
      const confirmation = await confirmationService.createConfirmation(mockRequest);

      expect(confirmation).toBeDefined();
      expect(confirmation.confirmationId).toMatch(/^conf_[a-f0-9]{32}$/);
      expect(confirmation.sessionId).toBe('test-session');
      expect(confirmation.userId).toBe('test-user');
      expect(confirmation.status).toBe(ConfirmationStatus.PENDING);
      expect(confirmation.actionPreview).toBeDefined();
      expect(confirmation.originalToolCall).toEqual(mockToolCall);
      expect(confirmation.createdAt).toBeInstanceOf(Date);
      expect(confirmation.expiresAt).toBeInstanceOf(Date);
    });

    it('should handle preview generation failure gracefully', async () => {
      const { AgentFactory } = require('../../../src/framework/agent-factory');
      AgentFactory.getAgent.mockReturnValue({
        generatePreview: jest.fn().mockResolvedValue({
          success: false,
          error: 'Preview generation failed'
        })
      });

      await expect(confirmationService.createConfirmation(mockRequest))
        .rejects.toThrow(ConfirmationError);
    });

    it('should handle missing agent gracefully', async () => {
      const { AgentFactory } = require('../../../src/framework/agent-factory');
      AgentFactory.getAgent.mockReturnValue(null);

      const confirmation = await confirmationService.createConfirmation(mockRequest);

      expect(confirmation.actionPreview.title).toContain('emailAgent Operation');
    });

    it('should store confirmation in database when available', async () => {
      mockDatabaseService.query.mockResolvedValue({ rows: [] });

      const confirmation = await confirmationService.createConfirmation(mockRequest);

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO confirmations'),
        expect.any(Array)
      );
    });

    it('should set custom expiration time', async () => {
      const requestWithCustomExpiration = {
        ...mockRequest,
        expirationMinutes: 10
      };

      const confirmation = await confirmationService.createConfirmation(requestWithCustomExpiration);

      const expectedExpirationTime = confirmation.createdAt.getTime() + (10 * 60 * 1000);
      const actualExpirationTime = confirmation.expiresAt.getTime();
      
      expect(Math.abs(actualExpirationTime - expectedExpirationTime)).toBeLessThan(1000); // Within 1 second
    });
  });

  describe('getConfirmation', () => {
    it('should retrieve confirmation from cache', async () => {
      const mockRequest: ConfirmationRequest = {
        sessionId: 'test-session',
        toolCall: { name: 'emailAgent', parameters: { query: 'test' } },
        context: {}
      };

      const createdConfirmation = await confirmationService.createConfirmation(mockRequest);
      const retrievedConfirmation = await confirmationService.getConfirmation(createdConfirmation.confirmationId);

      expect(retrievedConfirmation).toEqual(createdConfirmation);
    });

    it('should return null for non-existent confirmation', async () => {
      const result = await confirmationService.getConfirmation('non-existent-id');
      expect(result).toBeNull();
    });

    it('should return null for expired confirmation', async () => {
      const mockRequest: ConfirmationRequest = {
        sessionId: 'test-session',
        toolCall: { name: 'emailAgent', parameters: { query: 'test' } },
        context: {},
        expirationMinutes: 0 // Expire immediately
      };

      const confirmation = await confirmationService.createConfirmation(mockRequest);
      
      // Wait a bit to ensure expiration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result = await confirmationService.getConfirmation(confirmation.confirmationId);
      expect(result).toBeNull();
    });
  });

  describe('respondToConfirmation', () => {
    let testConfirmation: any;

    beforeEach(async () => {
      const mockRequest: ConfirmationRequest = {
        sessionId: 'test-session',
        toolCall: { name: 'emailAgent', parameters: { query: 'test' } },
        context: {}
      };

      testConfirmation = await confirmationService.createConfirmation(mockRequest);
    });

    it('should accept confirmation', async () => {
      const response = {
        confirmationId: testConfirmation.confirmationId,
        confirmed: true,
        respondedAt: new Date()
      };

      const updatedConfirmation = await confirmationService.respondToConfirmation(
        testConfirmation.confirmationId,
        response
      );

      expect(updatedConfirmation.status).toBe(ConfirmationStatus.CONFIRMED);
      expect(updatedConfirmation.confirmedAt).toEqual(response.respondedAt);
    });

    it('should reject confirmation', async () => {
      const response = {
        confirmationId: testConfirmation.confirmationId,
        confirmed: false,
        respondedAt: new Date()
      };

      const updatedConfirmation = await confirmationService.respondToConfirmation(
        testConfirmation.confirmationId,
        response
      );

      expect(updatedConfirmation.status).toBe(ConfirmationStatus.REJECTED);
      expect(updatedConfirmation.confirmedAt).toEqual(response.respondedAt);
    });

    it('should throw error for non-existent confirmation', async () => {
      const response = {
        confirmationId: 'non-existent',
        confirmed: true,
        respondedAt: new Date()
      };

      await expect(confirmationService.respondToConfirmation('non-existent', response))
        .rejects.toThrow(ConfirmationError);
    });

    it('should throw error for already responded confirmation', async () => {
      const response1 = {
        confirmationId: testConfirmation.confirmationId,
        confirmed: true,
        respondedAt: new Date()
      };

      await confirmationService.respondToConfirmation(testConfirmation.confirmationId, response1);

      const response2 = {
        confirmationId: testConfirmation.confirmationId,
        confirmed: false,
        respondedAt: new Date()
      };

      await expect(confirmationService.respondToConfirmation(testConfirmation.confirmationId, response2))
        .rejects.toThrow(ConfirmationError);
    });
  });

  describe('executeConfirmedAction', () => {
    let confirmedConfirmation: any;

    beforeEach(async () => {
      const mockRequest: ConfirmationRequest = {
        sessionId: 'test-session',
        toolCall: { name: 'emailAgent', parameters: { query: 'test' } },
        context: {}
      };

      const confirmation = await confirmationService.createConfirmation(mockRequest);
      
      const response = {
        confirmationId: confirmation.confirmationId,
        confirmed: true,
        respondedAt: new Date()
      };

      confirmedConfirmation = await confirmationService.respondToConfirmation(
        confirmation.confirmationId,
        response
      );
    });

    it('should execute confirmed action successfully', async () => {
      const mockToolResult = {
        toolName: 'emailAgent',
        result: { success: true, messageId: 'msg123' },
        success: true,
        executionTime: 1000
      };

      mockToolExecutorService.executeTool.mockResolvedValue(mockToolResult);

      const result = await confirmationService.executeConfirmedAction(confirmedConfirmation.confirmationId);

      expect(result).toEqual(mockToolResult);
      expect(mockToolExecutorService.executeTool).toHaveBeenCalledWith(
        confirmedConfirmation.originalToolCall,
        expect.objectContaining({
          sessionId: confirmedConfirmation.sessionId,
          userId: confirmedConfirmation.userId
        }),
        undefined,
        { preview: false }
      );
    });

    it('should throw error for non-confirmed status', async () => {
      const mockRequest: ConfirmationRequest = {
        sessionId: 'test-session',
        toolCall: { name: 'emailAgent', parameters: { query: 'test' } },
        context: {}
      };

      const pendingConfirmation = await confirmationService.createConfirmation(mockRequest);

      await expect(confirmationService.executeConfirmedAction(pendingConfirmation.confirmationId))
        .rejects.toThrow(ConfirmationError);
    });
  });

  describe('cleanupExpiredConfirmations', () => {
    it('should clean up expired confirmations', async () => {
      const mockRequest: ConfirmationRequest = {
        sessionId: 'test-session',
        toolCall: { name: 'emailAgent', parameters: { query: 'test' } },
        context: {},
        expirationMinutes: 0 // Expire immediately
      };

      await confirmationService.createConfirmation(mockRequest);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const cleanedCount = await confirmationService.cleanupExpiredConfirmations();
      expect(cleanedCount).toBeGreaterThan(0);
    });
  });

  describe('getPendingConfirmations', () => {
    it('should return pending confirmations for session', async () => {
      const mockRequest1: ConfirmationRequest = {
        sessionId: 'test-session',
        toolCall: { name: 'emailAgent', parameters: { query: 'test1' } },
        context: {}
      };

      const mockRequest2: ConfirmationRequest = {
        sessionId: 'test-session',
        toolCall: { name: 'emailAgent', parameters: { query: 'test2' } },
        context: {}
      };

      const mockRequest3: ConfirmationRequest = {
        sessionId: 'other-session',
        toolCall: { name: 'emailAgent', parameters: { query: 'test3' } },
        context: {}
      };

      await confirmationService.createConfirmation(mockRequest1);
      await confirmationService.createConfirmation(mockRequest2);
      await confirmationService.createConfirmation(mockRequest3);

      const pendingConfirmations = await confirmationService.getPendingConfirmations('test-session');

      expect(pendingConfirmations).toHaveLength(2);
      expect(pendingConfirmations.every(c => c.sessionId === 'test-session')).toBe(true);
      expect(pendingConfirmations.every(c => c.status === ConfirmationStatus.PENDING)).toBe(true);
    });

    it('should return empty array for session with no confirmations', async () => {
      const pendingConfirmations = await confirmationService.getPendingConfirmations('empty-session');
      expect(pendingConfirmations).toHaveLength(0);
    });
  });

  describe('getConfirmationStats', () => {
    beforeEach(async () => {
      // Create test confirmations with various statuses
      const requests = [
        { sessionId: 'session1', status: 'pending' },
        { sessionId: 'session1', status: 'confirmed' },
        { sessionId: 'session1', status: 'rejected' },
        { sessionId: 'session2', status: 'pending' },
        { sessionId: 'session2', status: 'executed' }
      ];

      for (const request of requests) {
        const mockRequest: ConfirmationRequest = {
          sessionId: request.sessionId,
          toolCall: { name: 'emailAgent', parameters: { query: 'test' } },
          context: {}
        };

        const confirmation = await confirmationService.createConfirmation(mockRequest);

        if (request.status !== 'pending') {
          const response = {
            confirmationId: confirmation.confirmationId,
            confirmed: request.status === 'confirmed' || request.status === 'executed',
            respondedAt: new Date()
          };

          await confirmationService.respondToConfirmation(confirmation.confirmationId, response);
        }
      }
    });

    it('should return overall stats', async () => {
      const stats = await confirmationService.getConfirmationStats();

      expect(stats.total).toBe(5);
      expect(stats.pending).toBeGreaterThan(0);
      expect(stats.confirmed).toBeGreaterThan(0);
      expect(stats.rejected).toBeGreaterThan(0);
    });

    it('should return stats for specific session', async () => {
      const stats = await confirmationService.getConfirmationStats('session1');

      expect(stats.total).toBe(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully during confirmation creation', async () => {
      mockDatabaseService.query.mockRejectedValue(new Error('Database error'));

      const mockRequest: ConfirmationRequest = {
        sessionId: 'test-session',
        toolCall: { name: 'emailAgent', parameters: { query: 'test' } },
        context: {}
      };

      // Should still succeed using cache
      const confirmation = await confirmationService.createConfirmation(mockRequest);
      expect(confirmation).toBeDefined();
    });

    it('should handle agent errors during preview generation', async () => {
      const { AgentFactory } = require('../../../src/framework/agent-factory');
      AgentFactory.getAgent.mockImplementation(() => {
        throw new Error('Agent error');
      });

      const mockRequest: ConfirmationRequest = {
        sessionId: 'test-session',
        toolCall: { name: 'brokenAgent', parameters: { query: 'test' } },
        context: {}
      };

      // Should still create a fallback confirmation
      const confirmation = await confirmationService.createConfirmation(mockRequest);
      expect(confirmation.actionPreview.title).toContain('brokenAgent Operation');
    });
  });
});