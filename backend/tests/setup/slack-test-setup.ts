import { jest } from '@jest/globals';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-key-123';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/google/callback';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-long-enough';

// Mock Slack environment variables
process.env.SLACK_SIGNING_SECRET = 'test-signing-secret';
process.env.SLACK_BOT_TOKEN = 'xoxb-test-bot-token';
process.env.SLACK_CLIENT_ID = 'test-slack-client-id';
process.env.SLACK_CLIENT_SECRET = 'test-slack-client-secret';
process.env.SLACK_OAUTH_REDIRECT_URI = 'http://localhost:3000/slack/oauth/callback';

// Mock OpenAI service to avoid real API calls
jest.mock('../../src/services/openai.service', () => {
  return {
    OpenAIService: jest.fn().mockImplementation(() => ({
      isReady: () => true,
      initialize: async () => {},
      destroy: async () => {},
      generateToolCalls: async () => ({
        toolCalls: [],
        message: 'Test response'
      })
    }))
  };
});

// Mock Google APIs to avoid real API calls
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn()
      }))
    },
    gmail: jest.fn(() => ({
      users: {
        messages: {
          list: jest.fn(),
          get: jest.fn(),
          send: jest.fn()
        }
      }
    })),
    calendar: jest.fn(() => ({
      events: {
        list: jest.fn(),
        insert: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn()
      },
      freebusy: {
        query: jest.fn()
      },
      calendarList: {
        list: jest.fn()
      }
    })),
    people: jest.fn(() => ({
      people: {
        searchContacts: jest.fn(),
        get: jest.fn()
      }
    }))
  }
}));

// Mock Slack Bolt SDK
jest.mock('@slack/bolt', () => ({
  App: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    message: jest.fn(),
    command: jest.fn(),
    event: jest.fn(),
    action: jest.fn(),
    client: {
      chat: {
        postMessage: jest.fn(),
        update: jest.fn()
      },
      views: {
        open: jest.fn()
      }
    }
  }))
}));

export {};