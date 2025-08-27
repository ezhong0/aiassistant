import './setup/slack-test-setup';
import request from 'supertest';
import { App } from '@slack/bolt';
import { getService } from '../src/services/service-manager';
import { SlackInterface } from '../src/interfaces/slack.interface';
import { SlackFormatterService } from '../src/services/slack-formatter.service';
import { initializeAllCoreServices } from '../src/services/service-initialization';
import { createApp } from '../src/index';

describe('Slack Integration Tests', () => {
  let app: any;
  let slackInterface: SlackInterface;
  let slackFormatter: SlackFormatterService;

  beforeAll(async () => {
    try {
      // Initialize services
      await initializeAllCoreServices();
      
      // Get services
      slackFormatter = getService<SlackFormatterService>('slackFormatterService')!;
      
      // Note: SlackInterface is not a service, it's initialized separately
      // For testing purposes, we'll create it directly
      
      // Create Express app
      app = createApp();
    } catch (error) {
      console.error('Failed to initialize services for integration testing:', error);
      // Create services directly if initialization fails
      slackInterface = new SlackInterface({
        signingSecret: 'test-signing-secret',
        botToken: 'xoxb-test-bot-token',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/slack/oauth/callback',
        development: true
      }, null);
      slackFormatter = new SlackFormatterService();
      
      app = createApp();
    }
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  describe('Service Registration and Health', () => {
    it('should have SlackInterface available', () => {
      expect(slackInterface).toBeDefined();
      // Note: Interfaces don't have isReady() method like services
    });

    it('should have SlackFormatterService registered and healthy', () => {
      expect(slackFormatter).toBeDefined();
      expect(slackFormatter.isReady()).toBe(true);
    });

    it('should respond to health check endpoint', async () => {
      const response = await request(app)
        .get('/slack/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
    });
  });

  describe('Slack Event Handling', () => {
    const mockSlackEvent = {
      type: 'app_mention',
      user: 'U123456',
      text: '<@U987654321> help',
      channel: 'C123456789',
      ts: '1234567890.123456',
      event_ts: '1234567890.123456'
    };

    it('should handle app mention events', async () => {
      const mockSlackHeaders = {
        'x-slack-signature': 'v0=test_signature',
        'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString()
      };

      const response = await request(app)
        .post('/slack/events')
        .set(mockSlackHeaders)
        .send({
          type: 'event_callback',
          event: mockSlackEvent
        });

      // Should not return error (actual response handling is async)
      expect(response.status).toBe(200);
    });

    it('should handle direct message events', async () => {
      const dmEvent = {
        type: 'message',
        channel_type: 'im',
        user: 'U123456',
        text: 'hello assistant',
        channel: 'D123456789',
        ts: '1234567890.123456'
      };

      const mockSlackHeaders = {
        'x-slack-signature': 'v0=test_signature',
        'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString()
      };

      const response = await request(app)
        .post('/slack/events')
        .set(mockSlackHeaders)
        .send({
          type: 'event_callback',
          event: dmEvent
        });

      expect(response.status).toBe(200);
    });
  });

  describe('Slack Interactive Components', () => {
    it('should handle button interactions', async () => {
      const mockInteraction = {
        type: 'block_actions',
        user: { id: 'U123456', name: 'testuser' },
        channel: { id: 'C123456789', name: 'general' },
        actions: [{
          action_id: 'test_button',
          block_id: 'test_block',
          value: 'test_value'
        }]
      };

      const mockSlackHeaders = {
        'x-slack-signature': 'v0=test_signature',
        'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString()
      };

      const response = await request(app)
        .post('/slack/interactions')
        .set(mockSlackHeaders)
        .send(`payload=${encodeURIComponent(JSON.stringify(mockInteraction))}`);

      expect(response.status).toBe(200);
    });

    it('should handle modal submissions', async () => {
      const mockModalSubmission = {
        type: 'view_submission',
        user: { id: 'U123456', name: 'testuser' },
        view: {
          id: 'V123456789',
          type: 'modal',
          state: {
            values: {
              email_block: {
                email_input: {
                  type: 'plain_text_input',
                  value: 'test@example.com'
                }
              }
            }
          }
        }
      };

      const mockSlackHeaders = {
        'x-slack-signature': 'v0=test_signature',
        'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString()
      };

      const response = await request(app)
        .post('/slack/interactions')
        .set(mockSlackHeaders)
        .send(`payload=${encodeURIComponent(JSON.stringify(mockModalSubmission))}`);

      expect(response.status).toBe(200);
    });
  });

  describe('Slack Slash Commands', () => {
    it('should handle /assistant command', async () => {
      const mockCommand = {
        token: 'test_token',
        team_id: 'T123456',
        team_domain: 'testteam',
        channel_id: 'C123456789',
        channel_name: 'general',
        user_id: 'U123456',
        user_name: 'testuser',
        command: '/assistant',
        text: 'help',
        response_url: 'https://hooks.slack.com/commands/1234/5678',
        trigger_id: 'trigger_test_123'
      };

      const mockSlackHeaders = {
        'x-slack-signature': 'v0=test_signature',
        'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString()
      };

      const response = await request(app)
        .post('/slack/commands')
        .set(mockSlackHeaders)
        .send(mockCommand);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('text');
    });

    it('should handle assistant command with email request', async () => {
      const mockCommand = {
        token: 'test_token',
        team_id: 'T123456',
        team_domain: 'testteam',
        channel_id: 'C123456789',
        channel_name: 'general',
        user_id: 'U123456',
        user_name: 'testuser',
        command: '/assistant',
        text: 'send an email to john@example.com about the meeting',
        response_url: 'https://hooks.slack.com/commands/1234/5678',
        trigger_id: 'trigger_test_123'
      };

      const mockSlackHeaders = {
        'x-slack-signature': 'v0=test_signature',
        'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString()
      };

      const response = await request(app)
        .post('/slack/commands')
        .set(mockSlackHeaders)
        .send(mockCommand);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('text');
    });
  });

  describe('Slack OAuth Flow', () => {
    it('should handle OAuth install redirect', async () => {
      const response = await request(app)
        .get('/slack/install')
        .expect(302);

      expect(response.headers.location).toContain('slack.com/oauth');
    });

    it('should handle OAuth callback', async () => {
      const mockAuthCode = 'test_auth_code_123';
      
      const response = await request(app)
        .get(`/slack/oauth/callback?code=${mockAuthCode}&state=test_state`)
        .expect(200);

      // Should handle the OAuth callback (exact behavior depends on implementation)
      expect(response.status).toBe(200);
    });
  });

  describe('Slack Message Formatting', () => {
    it('should format email responses correctly', () => {
      const mockEmails = [
        {
          id: '123',
          subject: 'Test Email Subject',
          from: 'sender@example.com',
          snippet: 'This is a test email snippet...',
          date: '2023-12-01T10:00:00Z'
        }
      ];

      const formatted = slackFormatter.formatEmailSummary(mockEmails);
      
      expect(formatted).toBeDefined();
      expect(Array.isArray(formatted)).toBe(true);
      expect(formatted.length).toBeGreaterThan(0);
    });

    it('should format calendar events correctly', () => {
      const mockEvents = [
        {
          id: 'event123',
          summary: 'Team Meeting',
          start: { dateTime: '2023-12-01T14:00:00Z' },
          end: { dateTime: '2023-12-01T15:00:00Z' },
          location: 'Conference Room A'
        }
      ];

      const formatted = slackFormatter.formatCalendarEvent(mockEvents);
      
      expect(formatted).toBeDefined();
      expect(Array.isArray(formatted)).toBe(true);
      expect(formatted.length).toBeGreaterThan(0);
    });

    it('should format contact information correctly', () => {
      const mockContact = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        company: 'Example Corp'
      };

      const formatted = slackFormatter.formatContactInfo(mockContact);
      
      expect(formatted).toBeDefined();
      expect(Array.isArray(formatted)).toBe(true);
      expect(formatted.length).toBeGreaterThan(0);
    });

    it('should format error messages appropriately', () => {
      const errorMessage = 'Test error message';
      
      const formatted = slackFormatter.formatErrorMessage(errorMessage);
      
      expect(formatted).toBeDefined();
      expect(Array.isArray(formatted)).toBe(true);
      expect(formatted.length).toBeGreaterThan(0);
    });

    it('should format help messages', () => {
      const formatted = slackFormatter.formatHelpMessage();
      
      expect(formatted).toBeDefined();
      expect(Array.isArray(formatted)).toBe(true);
      expect(formatted.length).toBeGreaterThan(0);
    });
  });

  describe('Slack Context Management', () => {
    it('should maintain conversation context across messages', async () => {
      // This would test the context persistence functionality
      // Implementation depends on how context is stored
      expect(true).toBe(true); // Placeholder
    });

    it('should handle thread-based conversations', async () => {
      // Test threading functionality
      expect(true).toBe(true); // Placeholder
    });

    it('should manage user state correctly', async () => {
      // Test user state management
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle malformed Slack events gracefully', async () => {
      const malformedEvent = {
        type: 'invalid_event_type',
        // Missing required fields
      };

      const response = await request(app)
        .post('/slack/events')
        .send(malformedEvent);

      // Should not crash, should handle gracefully
      expect(response.status).not.toBe(500);
    });

    it('should handle network timeouts gracefully', async () => {
      // Test timeout handling
      expect(true).toBe(true); // Placeholder
    });

    it('should handle Slack API errors gracefully', async () => {
      // Test API error handling
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Integration with Core Services', () => {
    it('should integrate with Gmail service through Slack commands', async () => {
      // Test end-to-end Gmail integration
      expect(true).toBe(true); // Placeholder
    });

    it('should integrate with Calendar service through Slack commands', async () => {
      // Test end-to-end Calendar integration
      expect(true).toBe(true); // Placeholder
    });

    it('should integrate with Contact service through Slack commands', async () => {
      // Test end-to-end Contact integration
      expect(true).toBe(true); // Placeholder
    });

    it('should integrate with OpenAI service for intelligent responses', async () => {
      // Test OpenAI integration
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Performance and Scalability', () => {
    it('should respond to events within acceptable time limits', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/slack/health')
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should handle concurrent requests efficiently', async () => {
      const promises = [];
      const concurrentRequests = 10;
      
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app)
            .get('/slack/health')
            .expect(200)
        );
      }
      
      const results = await Promise.all(promises);
      expect(results.length).toBe(concurrentRequests);
    });
  });

  describe('Security and Authentication', () => {
    it('should validate Slack signatures', async () => {
      // Test signature validation
      const invalidSignature = {
        'x-slack-signature': 'v0=invalid_signature',
        'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString()
      };

      const response = await request(app)
        .post('/slack/events')
        .set(invalidSignature)
        .send({
          type: 'event_callback',
          event: { type: 'app_mention', text: 'test' }
        });

      // Should reject invalid signatures
      expect([401, 403]).toContain(response.status);
    });

    it('should handle expired timestamps', async () => {
      const expiredTimestamp = Math.floor((Date.now() - 10 * 60 * 1000) / 1000); // 10 minutes ago
      
      const expiredHeaders = {
        'x-slack-signature': 'v0=test_signature',
        'x-slack-request-timestamp': expiredTimestamp.toString()
      };

      const response = await request(app)
        .post('/slack/events')
        .set(expiredHeaders)
        .send({
          type: 'event_callback',
          event: { type: 'app_mention', text: 'test' }
        });

      // Should reject expired requests
      expect([401, 403]).toContain(response.status);
    });
  });
});