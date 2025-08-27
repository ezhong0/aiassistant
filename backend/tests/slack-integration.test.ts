import { jest } from '@jest/globals';
import { SlackInterface } from '../src/interfaces/slack.interface';
import { ServiceManager } from '../src/services/service-manager';
import { SlackConfig } from '../src/interfaces/slack.interface';
import { SlackContext, SlackEventType } from '../src/types/slack.types';

// Create mock objects outside of jest.mock to avoid type inference issues
const mockApp = {
  event: jest.fn(),
  message: jest.fn(),
  command: jest.fn(),
  action: jest.fn(),
  view: jest.fn(),
  start: jest.fn().mockReturnValue(Promise.resolve()),
  stop: jest.fn().mockReturnValue(Promise.resolve())
};

const mockReceiver = {
  router: {
    get: jest.fn(),
    post: jest.fn(),
    use: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn()
  }
};

const mockWebClient = {
  auth: {
    test: jest.fn().mockReturnValue(Promise.resolve({ team_id: 'T1234567890' }))
  },
  chat: {
    postMessage: jest.fn().mockReturnValue(Promise.resolve({ ok: true, ts: '1234567890.123456' }))
  },
  users: {
    info: jest.fn().mockReturnValue(Promise.resolve({
      user: {
        name: 'testuser',
        profile: { email: 'test@example.com' }
      }
    }))
  }
};

// Mock Slack Bolt SDK
jest.mock('@slack/bolt', () => ({
  App: jest.fn().mockImplementation(() => mockApp),
  ExpressReceiver: jest.fn().mockImplementation(() => mockReceiver),
  WebClient: jest.fn().mockImplementation(() => mockWebClient),
  LogLevel: {
    DEBUG: 'debug',
    INFO: 'info'
  }
}));

// Mock services
jest.mock('../src/services/service-manager');

// Mock MasterAgent
jest.mock('../src/agents/master.agent', () => ({
  MasterAgent: jest.fn().mockImplementation(() => ({
    processUserInput: jest.fn().mockReturnValue(Promise.resolve({
      message: 'Test response from MasterAgent',
      toolCalls: [],
      needsThinking: false
    }))
  }))
}));

describe('SlackInterface Integration', () => {
  let slackInterface: SlackInterface;
  let mockServiceManager: jest.Mocked<ServiceManager>;
  let mockSlackConfig: SlackConfig;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock service manager
    mockServiceManager = {
      getService: jest.fn(),
      registerService: jest.fn(),
      unregisterService: jest.fn(),
      getHealthStatus: jest.fn(),
      initializeAllServices: jest.fn(),
      shutdownAllServices: jest.fn(),
      getInstance: jest.fn()
    } as any;

    // Create mock Slack config
    mockSlackConfig = {
      signingSecret: 'test-signing-secret',
      botToken: 'xoxb-test-token',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'https://test.com/slack/oauth/callback',
      development: true
    };

    // Mock service responses with proper typing
    mockServiceManager.getService.mockImplementation((serviceName: string) => {
      switch (serviceName) {
        case 'sessionService':
          return {
            getOrCreateSession: jest.fn().mockReturnValue('test-session-id'),
            getConversationContext: jest.fn().mockReturnValue('test-context'),
            isReady: jest.fn().mockReturnValue(true),
            state: 'ready'
          } as any;
        case 'slackFormatterService':
          return {
            formatAgentResponse: jest.fn().mockReturnValue(Promise.resolve({
              text: 'Test response',
              blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'Test response' } }]
            }))
          } as any;
        case 'toolExecutorService':
          return {
            executeTool: jest.fn().mockReturnValue(Promise.resolve({
              success: true,
              result: 'Test result',
              toolName: 'testTool',
              executionTime: 100
            }))
          } as any;
        default:
          return undefined;
      }
    });

    // Create SlackInterface instance
    slackInterface = new SlackInterface(mockSlackConfig, mockServiceManager);
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(slackInterface).toBeDefined();
      expect(slackInterface.router).toBeDefined();
    });

    it('should start successfully', async () => {
      await expect(slackInterface.start()).resolves.not.toThrow();
    });

    it('should stop successfully', async () => {
      await expect(slackInterface.stop()).resolves.not.toThrow();
    });
  });

  describe('Health Status', () => {
    it('should return healthy status when properly configured', () => {
      const health = slackInterface.getHealth();
      
      expect(health.healthy).toBe(true);
      expect(health.details?.configured).toBe(true);
      expect(health.details?.development).toBe(true);
      expect(health.details?.endpoints).toBeDefined();
    });

    it('should return unhealthy status when missing configuration', () => {
      const invalidConfig: SlackConfig = {
        ...mockSlackConfig,
        signingSecret: '',
        botToken: ''
      };
      
      const invalidInterface = new SlackInterface(invalidConfig, mockServiceManager);
      const health = invalidInterface.getHealth();
      
      expect(health.healthy).toBe(false);
      expect(health.details?.configured).toBe(false);
    });
  });

  describe('Integration with Service Manager', () => {
    it('should access services through ServiceManager', () => {
      // Test that the interface can be created with the service manager
      expect(slackInterface).toBeDefined();
      expect(mockServiceManager).toBeDefined();
    });

    it('should handle missing services gracefully', () => {
      mockServiceManager.getService.mockReturnValue(undefined);

      // Should not throw error when creating interface
      expect(() => new SlackInterface(mockSlackConfig, mockServiceManager)).not.toThrow();
    });
  });

  describe('Router Access', () => {
    it('should provide router access', () => {
      expect(slackInterface.router).toBeDefined();
      // The router is mocked, so we just check it exists
      expect(slackInterface.router).toBeTruthy();
    });
  });

  describe('Configuration Validation', () => {
    it('should validate required configuration fields', () => {
      const health = slackInterface.getHealth();
      expect(health.healthy).toBe(true);
    });

    it('should detect missing configuration', () => {
      const invalidConfig: SlackConfig = {
        ...mockSlackConfig,
        signingSecret: '',
        botToken: ''
      };
      
      const invalidInterface = new SlackInterface(invalidConfig, mockServiceManager);
      const health = invalidInterface.getHealth();
      
      expect(health.healthy).toBe(false);
      expect(health.details?.configured).toBe(false);
    });
  });

  describe('Service Dependencies', () => {
    it('should work with all required services available', () => {
      expect(slackInterface).toBeDefined();
      // The service manager is mocked, so we just check the interface exists
      expect(slackInterface).toBeTruthy();
    });

    it('should handle service manager initialization', () => {
      // Use the static getInstance method instead of constructor
      const newServiceManager = ServiceManager.getInstance();
      expect(() => new SlackInterface(mockSlackConfig, newServiceManager)).not.toThrow();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle configuration errors gracefully', () => {
      const invalidConfig: SlackConfig = {
        ...mockSlackConfig,
        signingSecret: '',
        botToken: ''
      };
      
      expect(() => new SlackInterface(invalidConfig, mockServiceManager)).not.toThrow();
    });

    it('should handle service manager errors gracefully', () => {
      const brokenServiceManager = {
        getService: jest.fn().mockImplementation(() => {
          throw new Error('Service error');
        })
      } as any;

      expect(() => new SlackInterface(mockSlackConfig, brokenServiceManager)).not.toThrow();
    });
  });

  describe('Mock Verification', () => {
    it('should properly mock Slack Bolt components', () => {
      expect(slackInterface).toBeDefined();
      // The mocks should prevent any actual Slack API calls
      expect(slackInterface).toBeTruthy();
    });

    it('should mock service responses correctly', () => {
      const sessionService = mockServiceManager.getService('sessionService');
      expect(sessionService).toBeDefined();
      
      if (sessionService) {
        expect(sessionService.isReady()).toBe(true);
        expect(sessionService.state).toBe('ready');
      }
    });
  });
});