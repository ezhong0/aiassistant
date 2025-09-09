import { ServiceManager } from '../../src/services/service-manager';
import { SlackInterfaceService } from '../../src/services/slack-interface.service';
import { ToolExecutorService } from '../../src/services/tool-executor.service';
import { ConfirmationService } from '../../src/services/confirmation.service';
import { ResponseFormatterService } from '../../src/services/response-formatter.service';
import { 
  ConfirmationFlow, 
  ConfirmationStatus,
  ConfirmationFlowResult 
} from '../../src/types/confirmation.types';
import { ToolCall, ToolExecutionContext } from '../../src/types/tools';
import { SlackContext, SlackAgentRequest } from '../../src/types/slack.types';
import logger from '../../src/utils/logger';

/**
 * Integration Tests for Slack-Confirmation Workflow
 * 
 * Tests the complete integration between SlackInterfaceService, ToolExecutorService,
 * ConfirmationService, and ResponseFormatterService following docs/TESTING.md patterns.
 */
describe('Slack-Confirmation Integration', () => {
  let serviceManager: ServiceManager;
  let slackInterface: SlackInterfaceService;
  let toolExecutorService: ToolExecutorService;
  let confirmationService: ConfirmationService;
  let responseFormatterService: ResponseFormatterService;

  // Mock Slack configuration
  const mockSlackConfig = {
    signingSecret: 'test-signing-secret',
    botToken: 'xoxb-test-token',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'http://localhost:3000/auth/callback',
    development: true
  };

  beforeEach(async () => {
    // Create fresh service manager for each test
    serviceManager = ServiceManager.getInstance();
    
    // Register mock services
    await registerMockServices();
    
    // Initialize services
    await serviceManager.initializeAllServices();
    
    // Get service instances
    slackInterface = serviceManager.getService('slackInterfaceService') as SlackInterfaceService;
    toolExecutorService = serviceManager.getService('toolExecutorService') as ToolExecutorService;
    confirmationService = serviceManager.getService('confirmationService') as ConfirmationService;
    responseFormatterService = serviceManager.getService('responseFormatterService') as ResponseFormatterService;
  });

  afterEach(async () => {
    // Clean up services
    await serviceManager.shutdown();
    
    // Clear any test data
    await cleanupTestData();
  });

  describe('Complete Confirmation Workflow', () => {
    it('should handle end-to-end confirmation flow for email agent', async () => {
      // Arrange
      const sessionId = 'test-session-confirmation-email';
      const userId = 'test-user-123';
      const teamId = 'test-team-456';
      
      const slackContext: SlackContext = {
        userId,
        channelId: 'test-channel-789',
        teamId,
        isDirectMessage: false,
        userName: 'testuser',
        userEmail: 'testuser@example.com'
      };

      const agentRequest: SlackAgentRequest = {
        message: 'Send an email to john@example.com about the quarterly review meeting',
        context: slackContext,
        eventType: 'message',
        metadata: {
          timestamp: new Date().toISOString(),
          eventId: 'test-event-email-confirmation'
        }
      };

      // Mock MasterAgent to return email tool call
      const mockMasterResponse = {
        message: 'I will send an email to John about the quarterly review meeting.',
        toolCalls: [
          {
            name: 'emailAgent',
            parameters: { 
              query: 'Send email to john@example.com about quarterly review meeting',
              to: 'john@example.com',
              subject: 'Quarterly Review Meeting',
              body: 'Hi John, I wanted to reach out about our upcoming quarterly review meeting...'
            }
          }
        ]
      };

      // Mock the agent factory and execution
      jest.doMock('../../src/config/agent-factory-init', () => ({
        createMasterAgent: () => ({
          processUserInput: jest.fn().mockResolvedValue(mockMasterResponse)
        })
      }));

      // Act - Route the request through SlackInterface
      const response = await (slackInterface as any).routeToAgent(agentRequest);

      // Assert
      expect(response.success).toBe(true);
      expect(response.shouldRespond).toBe(true);
      expect(response.executionMetadata.confirmationFlows).toBeDefined();
      expect(response.executionMetadata.confirmationFlows.length).toBe(1);

      // Verify confirmation flow was created
      const confirmationFlow = response.executionMetadata.confirmationFlows[0];
      expect(confirmationFlow.confirmationId).toBeDefined();
      expect(confirmationFlow.sessionId).toBe(sessionId);
      expect(confirmationFlow.userId).toBe(userId);
      expect(confirmationFlow.status).toBe(ConfirmationStatus.PENDING);
      expect(confirmationFlow.actionPreview.actionType).toBe('email');
      expect(confirmationFlow.actionPreview.title).toContain('Email');

      // Verify response contains Slack blocks with confirmation buttons
      expect(response.response.blocks).toBeDefined();
      const actionBlock = response.response.blocks.find((block: any) => block.type === 'actions');
      expect(actionBlock).toBeDefined();
      expect(actionBlock.elements).toHaveLength(2);
      expect(actionBlock.elements[0].action_id).toContain('confirm_');
      expect(actionBlock.elements[1].action_id).toContain('reject_');
    });

    it('should handle confirmation approval and action execution', async () => {
      // Arrange - First create a confirmation
      const confirmationId = 'test-confirmation-approval';
      const sessionId = 'test-session-approval';
      const userId = 'test-user-approval';
      
      const toolCall: ToolCall = {
        name: 'emailAgent',
        parameters: {
          query: 'Test email for confirmation approval',
          to: 'test@example.com',
          subject: 'Test Subject'
        }
      };

      const executionContext: ToolExecutionContext = {
        sessionId,
        userId,
        timestamp: new Date(),
        slackContext: {
          userId,
          channelId: 'test-channel',
          teamId: 'test-team',
          isDirectMessage: false
        }
      };

      // Create confirmation through service
      const confirmationRequest = {
        sessionId,
        userId,
        toolCall,
        context: { slackContext: executionContext.slackContext }
      };

      const createdConfirmation = await confirmationService.createConfirmation(confirmationRequest);
      expect(createdConfirmation.status).toBe(ConfirmationStatus.PENDING);

      // Act - Approve the confirmation
      const approvalResponse = {
        confirmationId: createdConfirmation.confirmationId,
        confirmed: true,
        respondedAt: new Date(),
        userContext: {
          slackUserId: userId,
          responseChannel: 'test-channel',
          responseThreadTs: undefined
        }
      };

      const updatedConfirmation = await toolExecutorService.respondToConfirmation(
        createdConfirmation.confirmationId,
        true,
        approvalResponse.userContext
      );

      // Assert confirmation was approved
      expect(updatedConfirmation).toBeDefined();
      expect(updatedConfirmation!.status).toBe(ConfirmationStatus.CONFIRMED);
      expect(updatedConfirmation!.confirmedAt).toBeDefined();

      // Act - Execute the confirmed action
      const executionResult = await toolExecutorService.executeConfirmedAction(
        createdConfirmation.confirmationId
      );

      // Assert execution completed
      expect(executionResult).toBeDefined();
      expect(executionResult.toolName).toBe('emailAgent');
      expect(executionResult.success).toBe(true); // Assuming mock execution succeeds
      expect(executionResult.executionTime).toBeGreaterThan(0);
    });

    it('should handle confirmation rejection', async () => {
      // Arrange
      const confirmationId = 'test-confirmation-rejection';
      const sessionId = 'test-session-rejection';
      const userId = 'test-user-rejection';
      
      const toolCall: ToolCall = {
        name: 'emailAgent',
        parameters: {
          query: 'Test email for confirmation rejection',
          to: 'test@example.com'
        }
      };

      const executionContext: ToolExecutionContext = {
        sessionId,
        userId,
        timestamp: new Date(),
        slackContext: {
          userId,
          channelId: 'test-channel',
          teamId: 'test-team',
          isDirectMessage: false
        }
      };

      const confirmationRequest = {
        sessionId,
        userId,
        toolCall,
        context: { slackContext: executionContext.slackContext }
      };

      const createdConfirmation = await confirmationService.createConfirmation(confirmationRequest);

      // Act - Reject the confirmation
      const updatedConfirmation = await toolExecutorService.respondToConfirmation(
        createdConfirmation.confirmationId,
        false,
        {
          slackUserId: userId,
          responseChannel: 'test-channel'
        }
      );

      // Assert confirmation was rejected
      expect(updatedConfirmation).toBeDefined();
      expect(updatedConfirmation!.status).toBe(ConfirmationStatus.REJECTED);
      expect(updatedConfirmation!.confirmedAt).toBeDefined();

      // Act - Attempt to execute rejected confirmation (should fail)
      await expect(
        toolExecutorService.executeConfirmedAction(createdConfirmation.confirmationId)
      ).rejects.toThrow();
    });

    it('should handle expired confirmations gracefully', async () => {
      // Arrange - Create confirmation with very short expiration
      const confirmationId = 'test-confirmation-expired';
      const sessionId = 'test-session-expired';
      const userId = 'test-user-expired';
      
      const toolCall: ToolCall = {
        name: 'emailAgent',
        parameters: { query: 'Test email for expiration' }
      };

      const confirmationRequest = {
        sessionId,
        userId,
        toolCall,
        context: { slackContext: { userId, channelId: 'test', teamId: 'test', isDirectMessage: false } },
        expirationMinutes: 0.01 // 0.6 seconds
      };

      const createdConfirmation = await confirmationService.createConfirmation(confirmationRequest);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Act - Try to respond to expired confirmation
      const result = await toolExecutorService.respondToConfirmation(
        createdConfirmation.confirmationId,
        true
      );

      // Assert confirmation is considered expired/invalid
      expect(result).toBeNull();
    });

    it('should format confirmation messages consistently', async () => {
      // Arrange
      const mockConfirmationFlow: ConfirmationFlow = {
        confirmationId: 'test-confirmation-formatting',
        sessionId: 'test-session-formatting',
        userId: 'test-user-formatting',
        actionPreview: {
          actionId: 'test-action-id',
          actionType: 'email',
          title: 'Send Email to John',
          description: 'Send an email to john@example.com about the quarterly review meeting',
          riskAssessment: {
            level: 'medium',
            factors: ['External recipient', 'Business communication'],
            warnings: ['Please review recipient and content before sending']
          },
          estimatedExecutionTime: '2-3 seconds',
          reversible: false,
          requiresConfirmation: true,
          awaitingConfirmation: true,
          previewData: {
            operation: 'emailAgent',
            to: 'john@example.com',
            subject: 'Quarterly Review Meeting',
            contentSummary: 'Meeting invitation and agenda'
          },
          originalQuery: 'Send email to john@example.com about quarterly review meeting',
          parameters: {
            to: 'john@example.com',
            subject: 'Quarterly Review Meeting'
          }
        },
        originalToolCall: {
          name: 'emailAgent',
          parameters: {
            query: 'Send email to john@example.com about quarterly review meeting'
          }
        },
        status: ConfirmationStatus.PENDING,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        slackContext: {
          userId: 'test-user-formatting',
          channelId: 'test-channel',
          teamId: 'test-team',
          isDirectMessage: false
        }
      };

      // Act - Format the confirmation message
      const formattedMessage = responseFormatterService.formatConfirmationMessage(
        mockConfirmationFlow,
        {
          includeRiskAssessment: true,
          includeExecutionTime: true,
          showDetailedPreview: true,
          useCompactFormat: false
        }
      );

      // Assert message structure
      expect(formattedMessage.text).toBeDefined();
      expect(formattedMessage.text).toContain('Send Email to John');
      expect(formattedMessage.blocks).toBeDefined();
      expect(formattedMessage.blocks.length).toBeGreaterThan(3);

      // Check for required block types
      const blockTypes = formattedMessage.blocks.map((block: any) => block.type);
      expect(blockTypes).toContain('section'); // Header
      expect(blockTypes).toContain('actions'); // Buttons

      // Check for confirmation buttons
      const actionBlock = formattedMessage.blocks.find((block: any) => block.type === 'actions');
      expect(actionBlock).toBeDefined();
      expect(actionBlock.elements).toHaveLength(2);
      expect(actionBlock.elements[0].action_id).toContain('confirm_');
      expect(actionBlock.elements[1].action_id).toContain('reject_');
      expect(actionBlock.elements[0].style).toBe('primary');
      expect(actionBlock.elements[1].style).toBe('danger');
    });

    it('should handle service failures gracefully', async () => {
      // Arrange
      const sessionId = 'test-session-failure';
      const agentRequest: SlackAgentRequest = {
        message: 'Test message that will cause service failure',
        context: {
          userId: 'test-user',
          channelId: 'test-channel',
          teamId: 'test-team',
          isDirectMessage: false
        },
        eventType: 'message',
        metadata: {
          timestamp: new Date().toISOString(),
          eventId: 'test-event-failure'
        }
      };

      // Mock ToolExecutorService to fail
      const mockExecuteWithConfirmation = jest.fn().mockRejectedValue(
        new Error('ToolExecutorService temporarily unavailable')
      );
      
      // Replace method temporarily
      const originalMethod = toolExecutorService.executeWithConfirmation;
      (toolExecutorService as any).executeWithConfirmation = mockExecuteWithConfirmation;

      try {
        // Act
        const response = await (slackInterface as any).routeToAgent(agentRequest);

        // Assert graceful error handling
        expect(response.success).toBe(true); // SlackInterface should still respond
        expect(response.shouldRespond).toBe(true);
        expect(response.response.text).toContain('temporarily unavailable');
        expect(response.error).toBeDefined();
        expect(response.executionMetadata.errorType).toBeDefined();
        expect(response.executionMetadata.errorContext).toBeDefined();

      } finally {
        // Restore original method
        (toolExecutorService as any).executeWithConfirmation = originalMethod;
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid confirmation IDs', async () => {
      // Act & Assert
      const result = await toolExecutorService.respondToConfirmation(
        'invalid-confirmation-id',
        true
      );
      
      expect(result).toBeNull();
    });

    it('should handle malformed tool calls gracefully', async () => {
      // Arrange
      const malformedToolCall: any = {
        // Missing required properties
        parameters: null
      };

      const executionContext: ToolExecutionContext = {
        sessionId: 'test-session-malformed',
        userId: 'test-user-malformed',
        timestamp: new Date()
      };

      // Act & Assert
      await expect(
        toolExecutorService.executeWithConfirmation(malformedToolCall, executionContext)
      ).rejects.toThrow();
    });

    it('should clean up expired confirmations automatically', async () => {
      // Arrange - Create multiple confirmations with short expiration
      const confirmations: ConfirmationFlow[] = [];
      
      for (let i = 0; i < 3; i++) {
        const confirmationRequest = {
          sessionId: `test-session-cleanup-${i}`,
          userId: `test-user-cleanup-${i}`,
          toolCall: {
            name: 'emailAgent',
            parameters: { query: `Test cleanup ${i}` }
          },
          context: { 
            slackContext: { 
              userId: `test-user-cleanup-${i}`, 
              channelId: 'test', 
              teamId: 'test', 
              isDirectMessage: false 
            } 
          },
          expirationMinutes: 0.01 // Very short expiration
        };

        const confirmation = await confirmationService.createConfirmation(confirmationRequest);
        confirmations.push(confirmation);
      }

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Act - Trigger cleanup
      const cleanedCount = await confirmationService.cleanupExpiredConfirmations();

      // Assert
      expect(cleanedCount).toBeGreaterThanOrEqual(3);

      // Verify confirmations are no longer accessible
      for (const confirmation of confirmations) {
        const retrieved = await confirmationService.getConfirmation(confirmation.confirmationId);
        expect(retrieved).toBeNull();
      }
    });
  });

  // Helper functions
  async function registerMockServices(): Promise<void> {
    // Register SlackInterfaceService
    const slackInterfaceService = new SlackInterfaceService(mockSlackConfig);
    serviceManager.registerService('slackInterfaceService', slackInterfaceService, {
      priority: 100,
      autoStart: true
    });

    // Register ToolExecutorService
    const toolExecutorService = new ToolExecutorService();
    serviceManager.registerService('toolExecutorService', toolExecutorService, {
      priority: 25,
      autoStart: true
    });

    // Register ConfirmationService
    const confirmationService = new ConfirmationService();
    serviceManager.registerService('confirmationService', confirmationService, {
      dependencies: ['toolExecutorService'],
      priority: 55,
      autoStart: true
    });

    // Register ResponseFormatterService
    const responseFormatterService = new ResponseFormatterService();
    serviceManager.registerService('responseFormatterService', responseFormatterService, {
      priority: 50,
      autoStart: true
    });

    logger.info('Mock services registered for Slack-Confirmation integration tests');
  }

  async function cleanupTestData(): Promise<void> {
    try {
      // Clean up any test confirmations
      const stats = await confirmationService.getConfirmationStats();
      if (stats.total > 0) {
        await confirmationService.cleanupExpiredConfirmations();
      }
    } catch (error) {
      logger.warn('Error cleaning up test data', error);
    }
  }
});