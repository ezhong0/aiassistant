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
      generateToolCalls: async (userInput: string) => {
        // Generate realistic tool calls based on user input
        const toolCalls = [];
        
        if (userInput.includes('email') || userInput.includes('send')) {
          if (userInput.includes('@')) {
            toolCalls.push({ name: 'emailAgent', parameters: { query: userInput } });
          } else {
            toolCalls.push({ name: 'contactAgent', parameters: { query: userInput } });
            toolCalls.push({ name: 'emailAgent', parameters: { query: userInput } });
          }
        }
        
        if (userInput.includes('schedule') || userInput.includes('meeting') || userInput.includes('calendar')) {
          toolCalls.push({ name: 'calendarAgent', parameters: { query: userInput } });
        }
        
        if (userInput.includes('contact') || userInput.includes('find')) {
          toolCalls.push({ name: 'contactAgent', parameters: { query: userInput } });
        }
        
        // Always include Think tool as specified in MasterAgent rules
        toolCalls.push({ name: 'Think', parameters: { query: `Verify completion of: ${userInput}` } });
        
        return {
          toolCalls,
          message: 'I will help you with that request.'
        };
      }
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

// Mock service registry
jest.mock('../../src/services/service-manager', () => {
  const mockServices = new Map();
  
  // Create mock services
  const mockSessionService = {
    isReady: () => true,
    initialize: async () => {},
    destroy: async () => {},
    getOrCreateSession: jest.fn((sessionId: string, userId: string) => ({
      id: sessionId,
      userId,
      createdAt: new Date(),
      lastActivity: new Date()
    }))
  };
  
  const mockToolExecutorService = {
    isReady: () => true,
    initialize: async () => {},
    destroy: async () => {},
    executeTool: jest.fn(async () => ({ success: true, result: 'Mock result' }))
  };
  
  const mockSlackFormatterService = {
    isReady: () => true,
    initialize: async () => {},
    destroy: async () => {},
    formatAgentResponse: jest.fn(async () => ({ text: 'Mock formatted response' }))
  };
  
  // Populate mock services
  mockServices.set('sessionService', mockSessionService);
  mockServices.set('toolExecutorService', mockToolExecutorService);
  mockServices.set('slackFormatterService', mockSlackFormatterService);
  
  return {
    serviceManager: {
      registerService: jest.fn(),
      getService: jest.fn((serviceName: string) => mockServices.get(serviceName)),
      initializeAllServices: jest.fn(async () => {}),
      getServiceCount: jest.fn(() => mockServices.size),
      getRegisteredServices: jest.fn(() => Array.from(mockServices.keys()))
    },
    getService: jest.fn((serviceName: string) => mockServices.get(serviceName))
  };
});

export {};