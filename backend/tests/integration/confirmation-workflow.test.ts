import { ConfirmationService } from '../../src/services/confirmation.service';
import { ResponseFormatterService } from '../../src/services/response-formatter.service';
import { ToolExecutorService } from '../../src/services/tool-executor.service';
import { serviceManager } from '../../src/services/service-manager';
import { initializeAllCoreServices } from '../../src/services/service-initialization';
import { 
  ConfirmationRequest, 
  ConfirmationStatus,
  ConfirmationFlow 
} from '../../src/types/confirmation.types';
import { ToolCall, ToolExecutionContext } from '../../src/types/tools';

// Mock external services for integration testing
jest.mock('../../src/services/database.service', () => ({
  DatabaseService: class MockDatabaseService {
    name = 'databaseService';
    state = 'ready';
    isReady() { return true; }
    initialize() { return Promise.resolve(); }
    destroy() { return Promise.resolve(); }
    getHealth() { return { healthy: true }; }
    query() { return Promise.resolve({ rows: [] }); }
  }
}));

jest.mock('../../src/services/gmail.service');
jest.mock('../../src/services/contact.service');
jest.mock('../../src/services/calendar.service');

// Mock AgentFactory to provide a test email agent
jest.mock('../../src/framework/agent-factory', () => ({
  AgentFactory: {
    getAgent: jest.fn().mockImplementation((agentName: string) => {
      if (agentName === 'emailAgent') {
        return {
          generatePreview: jest.fn().mockResolvedValue({
            success: true,
            preview: {
              actionId: 'test-email-action',
              actionType: 'email',
              title: 'Send Email to John about Quarterly Review',
              description: 'Send an email to john@example.com about the quarterly review meeting',
              riskAssessment: {
                level: 'medium',
                factors: ['External recipient', 'Business communication'],
                warnings: ['Please verify the recipient email address']
              },
              estimatedExecutionTime: '2-5 seconds',
              reversible: false,
              requiresConfirmation: true,
              awaitingConfirmation: true,
              previewData: {
                recipients: {
                  to: ['john@example.com']
                },
                subject: 'Quarterly Review Meeting - Action Required',
                contentSummary: 'Email requesting John\'s availability for the quarterly review meeting scheduled for next week. Includes meeting agenda and preparation materials.',
                recipientCount: 1,
                externalDomains: ['example.com']
              },
              originalQuery: 'send an email to john asking if he wants to have dinner at 8',
              parameters: {
                query: 'send an email to john asking if he wants to have dinner at 8'
              }
            }
          }),
          execute: jest.fn().mockResolvedValue({
            toolName: 'emailAgent',
            result: {
              success: true,
              messageId: 'msg_abc123def456',
              threadId: 'thread_xyz789',
              message: 'Email sent successfully to john@example.com'
            },
            success: true,
            executionTime: 1247
          })
        };
      }
      return null;
    })
  }
}));

describe('Confirmation Workflow Integration', () => {
  let confirmationService: ConfirmationService;
  let responseFormatterService: ResponseFormatterService;
  let toolExecutorService: ToolExecutorService;

  beforeAll(async () => {
    // Initialize all services
    await initializeAllCoreServices();
    
    confirmationService = serviceManager.getService<ConfirmationService>('confirmationService')!;
    responseFormatterService = serviceManager.getService<ResponseFormatterService>('responseFormatterService')!;
    toolExecutorService = serviceManager.getService<ToolExecutorService>('toolExecutorService')!;
    
    expect(confirmationService).toBeDefined();
    expect(responseFormatterService).toBeDefined();
    expect(toolExecutorService).toBeDefined();
  });

  afterAll(async () => {
    await serviceManager.forceCleanup();
  });

  describe('Complete Confirmation Workflow', () => {
    it('should execute the full workflow from outputs.md example', async () => {
      // Step 1: User input triggers confirmation request
      const userInput = "send an email to john asking if he wants to have dinner at 8";
      
      const toolCall: ToolCall = {
        name: 'emailAgent',
        parameters: {
          query: userInput
        }
      };

      const context: ToolExecutionContext = {
        sessionId: 'test-session-123',
        userId: 'slack-user-U1234567',
        timestamp: new Date(),
        slackContext: {
          teamId: 'T1234567',
          channelId: 'C1234567',
          userId: 'U1234567',
          threadTs: '1640995200.000100'
        }
      };

      // Step 2: Execute with confirmation support
      const executionResult = await toolExecutorService.executeWithConfirmation(
        toolCall,
        context
      );

      // Verify confirmation flow was created
      expect(executionResult.success).toBe(true);
      expect('confirmationFlow' in executionResult).toBe(true);
      
      if ('confirmationFlow' in executionResult) {
        const confirmationFlow = executionResult.confirmationFlow!;
        
        expect(confirmationFlow.confirmationId).toMatch(/^conf_[a-f0-9]{32}$/);
        expect(confirmationFlow.sessionId).toBe('test-session-123');
        expect(confirmationFlow.userId).toBe('slack-user-U1234567');
        expect(confirmationFlow.status).toBe(ConfirmationStatus.PENDING);
        expect(confirmationFlow.actionPreview.title).toBe('Send Email to John about Quarterly Review');
        expect(confirmationFlow.actionPreview.actionType).toBe('email');

        // Step 3: Format confirmation message for Slack
        const slackMessage = responseFormatterService.formatConfirmationMessage(confirmationFlow);
        
        expect(slackMessage.text).toContain('📧 Action Preview');
        expect(slackMessage.blocks).toBeDefined();
        expect(slackMessage.blocks.length).toBeGreaterThan(5);

        // Verify email-specific details are included
        const detailsBlock = slackMessage.blocks.find((block: any) => 
          block.fields && block.fields.some((field: any) => field.text.includes('john@example.com'))
        );
        expect(detailsBlock).toBeDefined();

        // Verify action buttons are present
        const actionsBlock = slackMessage.blocks.find((block: any) => block.type === 'actions');
        expect(actionsBlock).toBeDefined();
        expect(actionsBlock.elements).toHaveLength(2);

        // Step 4: User confirms the action
        const confirmationResponse = {
          confirmationId: confirmationFlow.confirmationId,
          confirmed: true,
          respondedAt: new Date(),
          userContext: {
            slackUserId: 'U1234567',
            responseChannel: 'C1234567',
            responseThreadTs: '1640995200.000200'
          }
        };

        const confirmedFlow = await confirmationService.respondToConfirmation(
          confirmationFlow.confirmationId,
          confirmationResponse
        );

        expect(confirmedFlow.status).toBe(ConfirmationStatus.CONFIRMED);
        expect(confirmedFlow.confirmedAt).toEqual(confirmationResponse.respondedAt);

        // Step 5: Execute the confirmed action
        const executionResult = await confirmationService.executeConfirmedAction(
          confirmationFlow.confirmationId
        );

        expect(executionResult.success).toBe(true);
        expect(executionResult.toolName).toBe('emailAgent');
        expect(executionResult.result.success).toBe(true);
        expect(executionResult.result.messageId).toBe('msg_abc123def456');

        // Step 6: Format completion message
        const updatedFlow = await confirmationService.getConfirmation(confirmationFlow.confirmationId);
        expect(updatedFlow!.status).toBe(ConfirmationStatus.EXECUTED);
        
        const completionMessage = responseFormatterService.formatCompletionMessage(updatedFlow!);
        
        expect(completionMessage.text).toContain('✅');
        expect(completionMessage.text).toContain('Action Completed Successfully');
      }
    });

    it('should handle rejection workflow', async () => {
      // Create confirmation
      const request: ConfirmationRequest = {
        sessionId: 'rejection-test-session',
        userId: 'test-user',
        toolCall: {
          name: 'emailAgent',
          parameters: {
            query: 'send email to sensitive@company.com with confidential data'
          }
        },
        context: {
          slackContext: {
            teamId: 'T1234567',
            channelId: 'C1234567',
            userId: 'U1234567'
          }
        }
      };

      const confirmationFlow = await confirmationService.createConfirmation(request);

      // User rejects the action
      const rejectionResponse = {
        confirmationId: confirmationFlow.confirmationId,
        confirmed: false,
        respondedAt: new Date(),
        userContext: {
          slackUserId: 'U1234567'
        }
      };

      const rejectedFlow = await confirmationService.respondToConfirmation(
        confirmationFlow.confirmationId,
        rejectionResponse
      );

      expect(rejectedFlow.status).toBe(ConfirmationStatus.REJECTED);

      // Format cancellation message
      const cancellationMessage = responseFormatterService.formatCancellationMessage(rejectedFlow);
      
      expect(cancellationMessage.text).toContain('🚫 Action Cancelled');
      expect(cancellationMessage.blocks[0].text.text).toContain('was not executed');

      // Verify execution throws error for rejected confirmation
      await expect(confirmationService.executeConfirmedAction(confirmationFlow.confirmationId))
        .rejects.toThrow();
    });

    it('should handle expiration cleanup workflow', async () => {
      // Create confirmation with very short expiration
      const request: ConfirmationRequest = {
        sessionId: 'expiration-test-session',
        userId: 'test-user',
        toolCall: {
          name: 'emailAgent',
          parameters: { query: 'test expiration' }
        },
        context: {},
        expirationMinutes: 0.01 // 0.6 seconds
      };

      const confirmationFlow = await confirmationService.createConfirmation(request);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      // Try to get confirmation - should be null (expired)
      const expiredConfirmation = await confirmationService.getConfirmation(confirmationFlow.confirmationId);
      expect(expiredConfirmation).toBeNull();

      // Cleanup should find and clean up expired confirmations
      const cleanedCount = await confirmationService.cleanupExpiredConfirmations();
      expect(cleanedCount).toBeGreaterThan(0);
    });

    it('should handle multiple pending confirmations for a session', async () => {
      const sessionId = 'multi-confirmation-session';

      // Create multiple confirmations
      const confirmations: ConfirmationFlow[] = [];
      
      for (let i = 0; i < 3; i++) {
        const request: ConfirmationRequest = {
          sessionId,
          userId: 'test-user',
          toolCall: {
            name: 'emailAgent',
            parameters: { query: `test email ${i + 1}` }
          },
          context: {}
        };

        const confirmation = await confirmationService.createConfirmation(request);
        confirmations.push(confirmation);
      }

      // Get pending confirmations for session
      const pendingConfirmations = await confirmationService.getPendingConfirmations(sessionId);
      
      expect(pendingConfirmations).toHaveLength(3);
      expect(pendingConfirmations.every(c => c.sessionId === sessionId)).toBe(true);
      expect(pendingConfirmations.every(c => c.status === ConfirmationStatus.PENDING)).toBe(true);

      // Confirm one, reject one, leave one pending
      await confirmationService.respondToConfirmation(
        confirmations[0].confirmationId,
        {
          confirmationId: confirmations[0].confirmationId,
          confirmed: true,
          respondedAt: new Date()
        }
      );

      await confirmationService.respondToConfirmation(
        confirmations[1].confirmationId,
        {
          confirmationId: confirmations[1].confirmationId,
          confirmed: false,
          respondedAt: new Date()
        }
      );

      // Check updated pending confirmations
      const updatedPending = await confirmationService.getPendingConfirmations(sessionId);
      expect(updatedPending).toHaveLength(1);
      expect(updatedPending[0].confirmationId).toBe(confirmations[2].confirmationId);
    });

    it('should provide accurate statistics', async () => {
      const statsSessionId = 'stats-test-session';

      // Create confirmations with different outcomes
      const requests = [
        { status: 'confirm', query: 'confirmed email 1' },
        { status: 'confirm', query: 'confirmed email 2' },
        { status: 'reject', query: 'rejected email 1' },
        { status: 'pending', query: 'pending email 1' }
      ];

      const confirmations: ConfirmationFlow[] = [];

      for (const req of requests) {
        const request: ConfirmationRequest = {
          sessionId: statsSessionId,
          userId: 'stats-user',
          toolCall: {
            name: 'emailAgent',
            parameters: { query: req.query }
          },
          context: {}
        };

        const confirmation = await confirmationService.createConfirmation(request);
        confirmations.push(confirmation);

        if (req.status === 'confirm') {
          await confirmationService.respondToConfirmation(
            confirmation.confirmationId,
            {
              confirmationId: confirmation.confirmationId,
              confirmed: true,
              respondedAt: new Date()
            }
          );
        } else if (req.status === 'reject') {
          await confirmationService.respondToConfirmation(
            confirmation.confirmationId,
            {
              confirmationId: confirmation.confirmationId,
              confirmed: false,
              respondedAt: new Date()
            }
          );
        }
      }

      // Get statistics
      const sessionStats = await confirmationService.getConfirmationStats(statsSessionId);

      expect(sessionStats.total).toBe(4);
      expect(sessionStats.pending).toBe(1);
      expect(sessionStats.confirmed).toBe(2);
      expect(sessionStats.rejected).toBe(1);
      expect(sessionStats.confirmationRate).toBeCloseTo(50); // 2/4 = 50%
      expect(sessionStats.averageResponseTime).toBeDefined();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle agent errors gracefully in full workflow', async () => {
      // Mock agent to throw error
      const { AgentFactory } = require('../../src/framework/agent-factory');
      const originalGetAgent = AgentFactory.getAgent;
      
      AgentFactory.getAgent.mockImplementation((agentName: string) => {
        if (agentName === 'brokenAgent') {
          return {
            generatePreview: jest.fn().mockRejectedValue(new Error('Agent preview failed'))
          };
        }
        return originalGetAgent(agentName);
      });

      const toolCall: ToolCall = {
        name: 'brokenAgent',
        parameters: { query: 'this will fail' }
      };

      const context: ToolExecutionContext = {
        sessionId: 'error-test-session',
        userId: 'test-user',
        timestamp: new Date()
      };

      // Should still create confirmation with fallback preview
      const executionResult = await toolExecutorService.executeWithConfirmation(
        toolCall,
        context
      );

      expect(executionResult.success).toBe(true);
      if ('confirmationFlow' in executionResult) {
        expect(executionResult.confirmationFlow!.actionPreview.title).toContain('brokenAgent Operation');
      }

      // Restore mock
      AgentFactory.getAgent.mockImplementation(originalGetAgent);
    });
  });
});