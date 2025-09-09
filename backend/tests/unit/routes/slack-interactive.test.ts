import request from 'supertest';
import express from 'express';
import { createSlackRoutes } from '../../../src/routes/slack.routes';
import { ServiceManager } from '../../../src/services/service-manager';
import { ToolExecutorService } from '../../../src/services/tool-executor.service';
import { ResponseFormatterService } from '../../../src/services/response-formatter.service';
import { ConfirmationFlow, ConfirmationStatus } from '../../../src/types/confirmation.types';

/**
 * Unit Tests for Slack Interactive Route Handler
 * 
 * Tests the /interactive endpoint's confirmation button handling following
 * docs/TESTING.md route testing patterns.
 */
describe('Slack Interactive Route - Confirmation Buttons', () => {
  let app: express.Application;
  let mockServiceManager: jest.Mocked<ServiceManager>;
  let mockToolExecutorService: jest.Mocked<ToolExecutorService>;
  let mockResponseFormatterService: jest.Mocked<ResponseFormatterService>;

  beforeEach(() => {
    // Create mock services
    mockToolExecutorService = createMockToolExecutorService();
    mockResponseFormatterService = createMockResponseFormatterService();
    
    // Create mock service manager
    mockServiceManager = {
      getService: jest.fn().mockImplementation((serviceName: string) => {
        switch (serviceName) {
          case 'toolExecutorService':
            return mockToolExecutorService;
          case 'responseFormatterService':
            return mockResponseFormatterService;
          default:
            return null;
        }
      })
    } as any;

    // Create express app with routes
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use('/slack', createSlackRoutes(mockServiceManager));
  });

  describe('POST /slack/interactive', () => {
    describe('Confirmation Button Handling', () => {
      it('should handle confirmation approval successfully', async () => {
        // Arrange
        const confirmationId = 'test-confirmation-approve';
        const mockConfirmation = createMockConfirmationFlow(confirmationId);
        const mockExecutionResult = {
          toolName: 'emailAgent',
          success: true,
          result: { messageId: 'msg123' },
          executionTime: 1500
        };

        const slackPayload = {
          type: 'block_actions',
          user: { id: 'U123456', name: 'testuser' },
          team: { id: 'T123456' },
          channel: { id: 'C123456' },
          actions: [{
            action_id: `confirm_${confirmationId}`,
            value: `confirm_${confirmationId}`,
            type: 'button'
          }],
          response_url: 'https://hooks.slack.com/test'
        };

        // Mock service responses
        mockToolExecutorService.respondToConfirmation.mockResolvedValue({
          ...mockConfirmation,
          status: ConfirmationStatus.CONFIRMED,
          confirmedAt: new Date()
        });
        
        mockToolExecutorService.executeConfirmedAction.mockResolvedValue(mockExecutionResult);

        mockResponseFormatterService.formatCompletionMessage.mockReturnValue({
          text: '✅ Action completed successfully',
          blocks: [{
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '✅ **Action Completed Successfully**\nSend Email to John completed successfully.'
            }
          }]
        });

        // Act
        const response = await request(app)
          .post('/slack/interactive')
          .send({ payload: JSON.stringify(slackPayload) })
          .expect(200);

        // Assert
        expect(mockToolExecutorService.respondToConfirmation).toHaveBeenCalledWith(
          confirmationId,
          true,
          expect.objectContaining({
            slackUserId: 'U123456',
            responseChannel: 'C123456'
          })
        );

        expect(mockToolExecutorService.executeConfirmedAction).toHaveBeenCalledWith(confirmationId);
        
        expect(mockResponseFormatterService.formatCompletionMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            status: ConfirmationStatus.CONFIRMED,
            executionResult: mockExecutionResult
          })
        );

        expect(response.body.text).toBe('✅ Action completed successfully');
        expect(response.body.response_type).toBe('in_channel');
        expect(response.body.replace_original).toBe(true);
      });

      it('should handle confirmation rejection successfully', async () => {
        // Arrange
        const confirmationId = 'test-confirmation-reject';
        const mockConfirmation = createMockConfirmationFlow(confirmationId);

        const slackPayload = {
          type: 'block_actions',
          user: { id: 'U123456', name: 'testuser' },
          team: { id: 'T123456' },
          channel: { id: 'C123456' },
          actions: [{
            action_id: `reject_${confirmationId}`,
            value: `reject_${confirmationId}`,
            type: 'button'
          }]
        };

        // Mock service responses
        mockToolExecutorService.respondToConfirmation.mockResolvedValue({
          ...mockConfirmation,
          status: ConfirmationStatus.REJECTED,
          confirmedAt: new Date()
        });

        mockResponseFormatterService.formatCancellationMessage.mockReturnValue({
          text: '🚫 Action Cancelled',
          blocks: [{
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '🚫 **Action Cancelled**\nSend Email to John was not executed.'
            }
          }]
        });

        // Act
        const response = await request(app)
          .post('/slack/interactive')
          .send({ payload: JSON.stringify(slackPayload) })
          .expect(200);

        // Assert
        expect(mockToolExecutorService.respondToConfirmation).toHaveBeenCalledWith(
          confirmationId,
          false,
          expect.objectContaining({
            slackUserId: 'U123456',
            responseChannel: 'C123456'
          })
        );

        expect(mockToolExecutorService.executeConfirmedAction).not.toHaveBeenCalled();
        
        expect(mockResponseFormatterService.formatCancellationMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            status: ConfirmationStatus.REJECTED
          })
        );

        expect(response.body.text).toBe('🚫 Action Cancelled');
        expect(response.body.response_type).toBe('in_channel');
        expect(response.body.replace_original).toBe(true);
      });

      it('should handle expired/invalid confirmation gracefully', async () => {
        // Arrange
        const confirmationId = 'invalid-confirmation-id';
        const slackPayload = {
          type: 'block_actions',
          user: { id: 'U123456' },
          team: { id: 'T123456' },
          channel: { id: 'C123456' },
          actions: [{
            action_id: `confirm_${confirmationId}`,
            value: `confirm_${confirmationId}`,
            type: 'button'
          }]
        };

        // Mock service to return null (confirmation not found)
        mockToolExecutorService.respondToConfirmation.mockResolvedValue(null);

        // Act
        const response = await request(app)
          .post('/slack/interactive')
          .send({ payload: JSON.stringify(slackPayload) })
          .expect(200);

        // Assert
        expect(response.body.text).toContain('expired or already been processed');
        expect(response.body.response_type).toBe('ephemeral');
      });

      it('should handle service unavailable gracefully', async () => {
        // Arrange
        const confirmationId = 'test-confirmation-service-fail';
        const slackPayload = {
          type: 'block_actions',
          user: { id: 'U123456' },
          actions: [{
            action_id: `confirm_${confirmationId}`,
            value: `confirm_${confirmationId}`,
            type: 'button'
          }]
        };

        // Mock service manager to return null (service unavailable)
        mockServiceManager.getService.mockImplementation((serviceName) => {
          if (serviceName === 'toolExecutorService') return null;
          return mockResponseFormatterService;
        });

        // Act
        const response = await request(app)
          .post('/slack/interactive')
          .send({ payload: JSON.stringify(slackPayload) })
          .expect(200);

        // Assert
        expect(response.body.text).toContain('Service temporarily unavailable');
        expect(response.body.response_type).toBe('ephemeral');
      });

      it('should handle malformed confirmation ID gracefully', async () => {
        // Arrange
        const slackPayload = {
          type: 'block_actions',
          user: { id: 'U123456' },
          actions: [{
            action_id: 'confirm_', // Empty confirmation ID
            value: 'confirm_',
            type: 'button'
          }]
        };

        // Act
        const response = await request(app)
          .post('/slack/interactive')
          .send({ payload: JSON.stringify(slackPayload) })
          .expect(200);

        // Assert
        expect(response.body.text).toContain('Could not identify confirmation request');
        expect(response.body.response_type).toBe('ephemeral');
      });

      it('should handle service errors during confirmation processing', async () => {
        // Arrange
        const confirmationId = 'test-confirmation-error';
        const slackPayload = {
          type: 'block_actions',
          user: { id: 'U123456' },
          actions: [{
            action_id: `confirm_${confirmationId}`,
            value: `confirm_${confirmationId}`,
            type: 'button'
          }]
        };

        // Mock service to throw error
        mockToolExecutorService.respondToConfirmation.mockRejectedValue(
          new Error('Database connection failed')
        );

        // Act
        const response = await request(app)
          .post('/slack/interactive')
          .send({ payload: JSON.stringify(slackPayload) })
          .expect(200);

        // Assert
        expect(response.body.text).toContain('An error occurred while processing your confirmation');
        expect(response.body.response_type).toBe('ephemeral');
      });

      it('should use fallback formatting when ResponseFormatterService unavailable', async () => {
        // Arrange
        const confirmationId = 'test-confirmation-fallback';
        const mockConfirmation = createMockConfirmationFlow(confirmationId);
        const mockExecutionResult = { toolName: 'emailAgent', success: true, executionTime: 1000 };

        const slackPayload = {
          type: 'block_actions',
          user: { id: 'U123456' },
          actions: [{
            action_id: `confirm_${confirmationId}`,
            value: `confirm_${confirmationId}`,
            type: 'button'
          }]
        };

        // Mock services
        mockToolExecutorService.respondToConfirmation.mockResolvedValue({
          ...mockConfirmation,
          status: ConfirmationStatus.CONFIRMED
        });
        mockToolExecutorService.executeConfirmedAction.mockResolvedValue(mockExecutionResult);
        
        // Mock ResponseFormatterService as unavailable
        mockServiceManager.getService.mockImplementation((serviceName) => {
          if (serviceName === 'toolExecutorService') return mockToolExecutorService;
          return null; // ResponseFormatterService unavailable
        });

        // Act
        const response = await request(app)
          .post('/slack/interactive')
          .send({ payload: JSON.stringify(slackPayload) })
          .expect(200);

        // Assert - Should use fallback formatting
        expect(response.body.text).toContain('Action completed successfully');
        expect(response.body.blocks).toBeDefined();
        expect(response.body.blocks[0].text.text).toContain('Action Completed Successfully');
        expect(response.body.response_type).toBe('in_channel');
      });
    });

    describe('Legacy Button Support', () => {
      it('should handle view results buttons for backward compatibility', async () => {
        // Arrange
        const slackPayload = {
          type: 'block_actions',
          user: { id: 'U123456', name: 'testuser' },
          actions: [{
            action_id: 'view_emailagent_results',
            type: 'button'
          }]
        };

        // Act
        const response = await request(app)
          .post('/slack/interactive')
          .send({ payload: JSON.stringify(slackPayload) })
          .expect(200);

        // Assert
        expect(response.body.text).toBe('📋 emailagent Results');
        expect(response.body.blocks).toBeDefined();
        expect(response.body.blocks[0].text.text).toContain('emailagent Results');
      });
    });

    describe('Error Handling', () => {
      it('should handle missing payload', async () => {
        // Act
        const response = await request(app)
          .post('/slack/interactive')
          .send({}) // No payload
          .expect(400);

        // Assert
        expect(response.body.error).toBe('No payload provided');
      });

      it('should handle malformed JSON payload', async () => {
        // Act
        const response = await request(app)
          .post('/slack/interactive')
          .send({ payload: 'invalid-json{' })
          .expect(500);

        // Assert
        expect(response.body.error).toBe('Internal server error');
      });

      it('should handle unknown interaction types gracefully', async () => {
        // Arrange
        const slackPayload = {
          type: 'unknown_interaction_type',
          user: { id: 'U123456' }
        };

        // Act
        const response = await request(app)
          .post('/slack/interactive')
          .send({ payload: JSON.stringify(slackPayload) })
          .expect(200);

        // Assert
        expect(response.body.ok).toBe(true);
      });
    });
  });

  // Helper functions
  function createMockConfirmationFlow(confirmationId: string = 'test-confirmation'): ConfirmationFlow {
    return {
      confirmationId,
      sessionId: 'test-session',
      userId: 'test-user',
      actionPreview: {
        actionId: 'test-action',
        actionType: 'email',
        title: 'Send Email to John',
        description: 'Send an email about the meeting',
        riskAssessment: {
          level: 'medium',
          factors: ['External recipient'],
          warnings: []
        },
        estimatedExecutionTime: '2-3 seconds',
        reversible: false,
        requiresConfirmation: true,
        awaitingConfirmation: true,
        previewData: {},
        originalQuery: 'Send email to John',
        parameters: {}
      },
      originalToolCall: {
        name: 'emailAgent',
        parameters: { query: 'Send email' }
      },
      status: ConfirmationStatus.PENDING,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      slackContext: {
        userId: 'test-user',
        channelId: 'test-channel',
        teamId: 'test-team',
        isDirectMessage: false
      }
    };
  }

  function createMockToolExecutorService(): jest.Mocked<ToolExecutorService> {
    return {
      respondToConfirmation: jest.fn(),
      executeConfirmedAction: jest.fn(),
      executeWithConfirmation: jest.fn(),
      executeTool: jest.fn(),
      executeTools: jest.fn(),
      getPendingConfirmations: jest.fn(),
      isValidConfirmation: jest.fn(),
      getExecutionStats: jest.fn(),
      getConfig: jest.fn(),
      updateConfig: jest.fn()
    } as any;
  }

  function createMockResponseFormatterService(): jest.Mocked<ResponseFormatterService> {
    return {
      formatConfirmationMessage: jest.fn(),
      formatCompletionMessage: jest.fn(),
      formatCancellationMessage: jest.fn(),
      formatSimpleConfirmationMessage: jest.fn()
    } as any;
  }
});