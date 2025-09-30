/**
 * Component Tests for API Mock Manager
 * Tests the API mocking functionality in isolation
 */

import { ApiMockManager } from '../framework/api-mock-manager';
import { APIRequest, APIResponse } from '../../../src/types/api/api-client.types';

describe('API Mock Manager Component Tests', () => {
  let mockManager: ApiMockManager;

  beforeEach(() => {
    mockManager = ApiMockManager.getInstance();
    mockManager.clearCallRecords();
    
    // Set up test context
    mockManager.setMockContext({
      testScenarioId: 'test_api_mock_manager',
      userId: 'test_user_123',
      userEmail: 'test@example.com',
      currentTime: new Date('2025-01-15T10:00:00Z'),
      slackUserId: 'U123TEST',
      slackTeamId: 'T123TEST',
      slackChannelId: 'C123TEST'
    });
  });

  afterEach(() => {
    mockManager.clearCallRecords();
  });

  describe('Google API Mocking', () => {
    test('should mock Gmail search request', async () => {
      const request: APIRequest = {
        endpoint: '/gmail/v1/users/me/messages',
        method: 'GET',
        query: { q: 'from:john@example.com' },
        headers: {},
        requiresAuth: true
      };

      const response = await ApiMockManager.interceptRequest('GoogleAPIClient', request);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.metadata.requestId).toBeDefined();
      expect(response.status).toBe(200);
    });

    test('should mock Gmail send request', async () => {
      const request: APIRequest = {
        endpoint: '/gmail/v1/users/me/messages/send',
        method: 'POST',
        data: {
          raw: 'VG86IGpvaG5AZXhhbXBsZS5jb20KU3ViamVjdDogVGVzdCBFbWFpbApNZXNzYWdlOiBUaGlzIGlzIGEgdGVzdCBlbWFpbC4='
        },
        headers: {},
        requiresAuth: true
      };

      const response = await ApiMockManager.interceptRequest('GoogleAPIClient', request);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.metadata.requestId).toBeDefined();
    });

    test('should mock Calendar event creation', async () => {
      const request: APIRequest = {
        endpoint: '/calendar/v3/calendars/primary/events',
        method: 'POST',
        data: {
          summary: 'Test Meeting',
          start: { dateTime: '2025-01-16T14:00:00Z' },
          end: { dateTime: '2025-01-16T15:00:00Z' }
        },
        headers: {},
        requiresAuth: true
      };

      const response = await ApiMockManager.interceptRequest('GoogleAPIClient', request);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.summary).toBe('Test Meeting');
    });

    test('should mock Contacts search', async () => {
      const request: APIRequest = {
        endpoint: '/people/v1/people:searchContacts',
        method: 'GET',
        query: { query: 'John Smith' },
        headers: {},
        requiresAuth: true
      };

      const response = await ApiMockManager.interceptRequest('GoogleAPIClient', request);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });
  });

  describe('Slack API Mocking', () => {
    test('should mock message posting', async () => {
      const request: APIRequest = {
        endpoint: '/chat.postMessage',
        method: 'POST',
        data: {
          channel: 'C123TEST',
          text: 'Hello from test!'
        },
        headers: {},
        requiresAuth: true
      };

      const response = await ApiMockManager.interceptRequest('SlackAPIClient', request);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.ok).toBe(true);
    });

    test('should mock conversation history', async () => {
      const request: APIRequest = {
        endpoint: '/conversations.history',
        method: 'GET',
        data: {
          channel: 'C123TEST',
          limit: 10
        },
        headers: {},
        requiresAuth: true
      };

      const response = await ApiMockManager.interceptRequest('SlackAPIClient', request);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.messages).toBeInstanceOf(Array);
    });

    test('should mock user info retrieval', async () => {
      const request: APIRequest = {
        endpoint: '/users.info',
        method: 'GET',
        data: {
          user: 'U123TEST'
        },
        headers: {},
        requiresAuth: true
      };

      const response = await ApiMockManager.interceptRequest('SlackAPIClient', request);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.user).toBeDefined();
    });
  });

  describe('OpenAI API Mocking', () => {
    test('should mock chat completion', async () => {
      const request: APIRequest = {
        endpoint: '/chat/completions',
        method: 'POST',
        data: {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'user', content: 'Hello, how are you?' }
          ],
          temperature: 0.7,
          max_tokens: 100
        },
        headers: {},
        requiresAuth: true
      };

      const response = await ApiMockManager.interceptRequest('OpenAIClient', request);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.choices).toBeInstanceOf(Array);
      expect(response.data.choices[0].message).toBeDefined();
    });

    test('should mock embeddings generation', async () => {
      const request: APIRequest = {
        endpoint: '/embeddings',
        method: 'POST',
        data: {
          model: 'text-embedding-ada-002',
          input: 'This is a test text for embedding'
        },
        headers: {},
        requiresAuth: true
      };

      const response = await ApiMockManager.interceptRequest('OpenAIClient', request);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.data).toBeInstanceOf(Array);
      expect(response.data.data[0].embedding).toBeInstanceOf(Array);
    });
  });

  describe('API Call Recording', () => {
    test('should record all API calls', async () => {
      const requests = [
        {
          client: 'GoogleAPIClient',
          request: {
            endpoint: '/gmail/v1/users/me/messages',
            method: 'GET',
            query: { q: 'test' },
            headers: {},
            requiresAuth: true
          } as APIRequest
        },
        {
          client: 'SlackAPIClient',
          request: {
            endpoint: '/chat.postMessage',
            method: 'POST',
            data: { channel: 'C123', text: 'test' },
            headers: {},
            requiresAuth: true
          } as APIRequest
        },
        {
          client: 'OpenAIClient',
          request: {
            endpoint: '/chat/completions',
            method: 'POST',
            data: { model: 'gpt-4o-mini', messages: [] },
            headers: {},
            requiresAuth: true
          } as APIRequest
        }
      ];

      // Make all requests
      for (const req of requests) {
        await ApiMockManager.interceptRequest(req.client, req.request);
      }

      // Check recordings
      const records = mockManager.getApiCallRecords();
      expect(records.length).toBeGreaterThanOrEqual(2); // At least 2 should succeed

      // Verify each record
      records.forEach((record) => {
        expect(record.timestamp).toBeInstanceOf(Date);
        expect(record.clientName).toBeDefined();
        expect(record.request).toBeDefined();
        expect(record.response).toBeDefined();
        expect(record.duration).toBeGreaterThan(0);
      });
    });

    test('should provide call statistics', async () => {
      // Make some API calls
      await ApiMockManager.interceptRequest('GoogleAPIClient', {
        endpoint: '/gmail/v1/users/me/messages',
        method: 'GET',
        query: { q: 'test' },
        headers: {},
        requiresAuth: true
      });

      await ApiMockManager.interceptRequest('SlackAPIClient', {
        endpoint: '/chat.postMessage',
        method: 'POST',
        data: { channel: 'C123', text: 'test' },
        headers: {},
        requiresAuth: true
      });

      const stats = mockManager.getCallStatistics();
      
      expect(stats.totalCalls).toBe(2);
      expect(stats.averageDuration).toBeGreaterThan(0);
      expect(stats.clientBreakdown).toHaveProperty('GoogleAPIClient');
      expect(stats.clientBreakdown).toHaveProperty('SlackAPIClient');
      expect(stats.endpointBreakdown).toHaveProperty('/gmail/v1/users/me/messages');
      expect(stats.endpointBreakdown['/chat.postMessage']).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle unknown client gracefully', async () => {
      const request: APIRequest = {
        endpoint: '/unknown/endpoint',
        method: 'GET',
        headers: {},
        requiresAuth: true
      };

      const response = await ApiMockManager.interceptRequest('UnknownClient', request);
      expect(response.success).toBe(false);
      expect(response.status).toBe(500);
      expect(response.statusText).toBe('Mock Error');
    });

    test('should handle malformed requests', async () => {
      const request: APIRequest = {
        endpoint: '/gmail/v1/users/me/messages',
        method: 'GET',
        headers: {},
        requiresAuth: true
      };

      // This should still work even with minimal data
      const response = await ApiMockManager.interceptRequest('GoogleAPIClient', request);
      expect(response.success).toBe(true);
    });
  });

  describe('Performance', () => {
    test('should complete requests within reasonable time', async () => {
      const request: APIRequest = {
        endpoint: '/chat/completions',
        method: 'POST',
        data: {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Test' }]
        },
        headers: {},
        requiresAuth: true
      };

      const startTime = Date.now();
      const response = await ApiMockManager.interceptRequest('OpenAIClient', request);
      const duration = Date.now() - startTime;

      expect(response.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle multiple concurrent requests', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => 
        ApiMockManager.interceptRequest('OpenAIClient', {
          endpoint: '/chat/completions',
          method: 'POST',
          data: {
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: `Test ${i}` }]
          },
          headers: {},
          requiresAuth: true
        })
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      expect(responses).toHaveLength(10);
      responses.forEach(response => {
        expect(response.success).toBe(true);
      });
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});
