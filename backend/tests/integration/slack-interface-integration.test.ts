import request from 'supertest';
import express from 'express';
import { SlackInterfaceService } from '../../src/services/slack-interface.service';
import { initializeSlackInterfaceService } from '../../src/services/service-initialization';
import { createSlackRoutes } from '../../src/routes/slack.routes';
import { serviceManager } from '../../src/services/service-manager';

// Mock the service dependencies
jest.mock('../../src/services/token-manager');
jest.mock('../../src/services/tool-executor.service');
jest.mock('../../src/services/slack-formatter.service');
jest.mock('@slack/web-api');
jest.mock('../../src/config/agent-factory-init');
jest.mock('../../src/config/environment');

describe('Slack Interface Integration', () => {
  let app: express.Application;
  let slackInterfaceService: SlackInterfaceService;

  const mockSlackConfig = {
    signingSecret: 'test-signing-secret',
    botToken: 'xoxb-test-token',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'https://test.example.com/slack/oauth/callback',
    development: true
  };

  beforeAll(async () => {
    // Setup Express app
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Mock service manager responses
    const mockServiceManager = {
      getService: jest.fn().mockImplementation((serviceName: string) => {
        switch (serviceName) {
          case 'tokenManager':
            return {
              hasValidOAuthTokens: jest.fn().mockResolvedValue(true),
              getValidTokens: jest.fn().mockResolvedValue('mock-token'),
              isReady: () => true
            };
          case 'toolExecutorService':
            return {
              executeTool: jest.fn().mockResolvedValue({
                toolName: 'testTool',
                success: true,
                result: 'Success',
                executionTime: 100
              }),
              isReady: () => true
            };
          case 'slackFormatterService':
            return {
              formatAgentResponse: jest.fn().mockResolvedValue({
                text: 'Formatted response',
                blocks: []
              }),
              isReady: () => true
            };
          default:
            return null;
        }
      }),
      registerService: jest.fn(),
      initializeService: jest.fn(),
      getServiceCount: jest.fn().mockReturnValue(3),
      getRegisteredServices: jest.fn().mockReturnValue(['tokenManager', 'toolExecutorService', 'slackFormatterService'])
    };

    // Replace the service manager
    Object.assign(serviceManager, mockServiceManager);

    try {
      // Initialize Slack interface service
      slackInterfaceService = new SlackInterfaceService(mockSlackConfig);
      await slackInterfaceService.initialize();

      // Create interface getter function
      const getInterfaces = () => ({
        slackInterface: slackInterfaceService
      });

      // Setup routes
      const slackRoutes = createSlackRoutes(serviceManager as any, getInterfaces);
      app.use('/slack', slackRoutes);

    } catch (error) {
      console.error('Setup error:', error);
      throw error;
    }
  });

  afterAll(async () => {
    if (slackInterfaceService) {
      await slackInterfaceService.destroy();
    }
  });

  describe('Slack Routes Integration', () => {
    it('should handle URL verification challenge', async () => {
      const challengePayload = {
        type: 'url_verification',
        challenge: 'test-challenge-token'
      };

      const response = await request(app)
        .post('/slack/events')
        .send(challengePayload)
        .expect(200);

      expect(response.body).toEqual({
        challenge: 'test-challenge-token'
      });
    });

    it('should handle Slack message events', async () => {
      const messageEventPayload = {
        type: 'event_callback',
        team_id: 'T123456',
        event: {
          type: 'message',
          user: 'U123456',
          channel: 'C123456',
          text: 'Hello assistant!',
          ts: '1234567890.123'
        }
      };

      const response = await request(app)
        .post('/slack/events')
        .send(messageEventPayload)
        .expect(200);

      expect(response.body).toEqual({ ok: true });
    });

    it('should handle Slack app mention events', async () => {
      const mentionEventPayload = {
        type: 'event_callback',
        team_id: 'T123456',
        event: {
          type: 'app_mention',
          user: 'U123456',
          channel: 'C123456',
          text: '<@U987654> help me with email',
          ts: '1234567890.123'
        }
      };

      const response = await request(app)
        .post('/slack/events')
        .send(mentionEventPayload)
        .expect(200);

      expect(response.body).toEqual({ ok: true });
    });

    it('should handle slash commands', async () => {
      const slashCommandPayload = {
        command: '/assistant',
        text: 'help me with email',
        user_id: 'U123456',
        channel_id: 'C123456',
        team_id: 'T123456'
      };

      const response = await request(app)
        .post('/slack/commands')
        .send(slashCommandPayload)
        .expect(200);

      expect(response.body).toEqual({ ok: true });
    });

    it('should handle interactive components', async () => {
      const interactivePayload = {
        payload: JSON.stringify({
          type: 'block_actions',
          user: { id: 'U123456', name: 'testuser' },
          actions: [{
            action_id: 'gmail_oauth',
            type: 'button'
          }]
        })
      };

      const response = await request(app)
        .post('/slack/interactive')
        .send(interactivePayload)
        .expect(200);

      expect(response.body).toEqual({ ok: true });
    });

    it('should return health status', async () => {
      const response = await request(app)
        .get('/slack/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'healthy',
        service: 'SlackInterface',
        details: {
          configured: true,
          message: 'Slack interface is properly configured and ready'
        }
      });
    });
  });

  describe('Service Health Integration', () => {
    it('should report service health correctly', () => {
      const health = slackInterfaceService.getHealth();
      
      expect(health.healthy).toBe(true);
      expect(health.details).toMatchObject({
        configured: true,
        development: true,
        hasClient: true,
        dependencies: {
          tokenManager: true,
          toolExecutorService: true,
          slackFormatterService: true
        }
      });
    });
  });

  describe('Event Processing Integration', () => {
    it('should process events through the service', async () => {
      const mockEvent = {
        type: 'message',
        user: 'U123456',
        channel: 'C123456',
        text: 'Test integration message',
        ts: '1234567890.123'
      };

      // This should not throw and should complete processing
      await expect(
        slackInterfaceService.handleEvent(mockEvent, 'T123456')
      ).resolves.not.toThrow();
    });

    it('should handle OAuth flow integration', async () => {
      const mockEvent = {
        type: 'message',
        user: 'U123456',
        channel: 'C123456',
        text: 'send an email to test@example.com',
        ts: '1234567890.123'
      };

      // This should process OAuth requirements
      await expect(
        slackInterfaceService.handleEvent(mockEvent, 'T123456')
      ).resolves.not.toThrow();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle service unavailability gracefully', async () => {
      // Create service with missing dependencies
      const limitedServiceManager = {
        getService: jest.fn().mockReturnValue(null)
      };

      const limitedService = new SlackInterfaceService(mockSlackConfig);
      
      // Should fail to initialize without required dependencies
      await expect(limitedService.initialize()).rejects.toThrow();
    });

    it('should handle malformed event payloads', async () => {
      const malformedPayload = {
        type: 'event_callback',
        // Missing required fields
      };

      const response = await request(app)
        .post('/slack/events')
        .send(malformedPayload)
        .expect(200);

      expect(response.body).toEqual({ ok: true });
    });
  });
});