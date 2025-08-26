import {
  ChatRepository,
  ActionRepository,
  UserRepository,
  MockChatRepository,
  MockActionRepository,
  MockUserRepository,
  mockRepositoryFactory,
} from '../index';
import type { AppError } from '../../types';

// Mock the HTTP service
jest.mock('../../services/http.service', () => ({
  httpService: {
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
    setAuthToken: jest.fn(),
  },
}));

describe('Repository Pattern Implementation', () => {
  describe('Base Repository Functionality', () => {
    let chatRepository: ChatRepository;

    beforeEach(() => {
      chatRepository = new ChatRepository();
    });

    it('should handle retry logic correctly', async () => {
      // Test retry mechanism with a failing operation
      const failingOperation = jest.fn().mockRejectedValue(new Error('NETWORK_ERROR'));
      
      // Create a test repository to access protected method
      const testRepo = new ChatRepository();
      
      await expect(
        testRepo['executeWithRetry'](failingOperation, 'testOperation')
      ).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        message: 'testOperation failed: NETWORK_ERROR',
        retryable: true,
      });
      
      // Should have retried multiple times
      expect(failingOperation).toHaveBeenCalledTimes(4); // Initial + 3 retries
    }, 10000); // Increase timeout for retry test

    it('should cache responses correctly', () => {
      const testData = { test: 'data' };
      const cacheKey = 'test_key';
      
      // Set cache
      chatRepository['setCache'](cacheKey, testData);
      
      // Get from cache
      const cached = chatRepository['getCache'](cacheKey);
      expect(cached).toEqual(testData);
    });

    it('should clear cache correctly', () => {
      const testData = { test: 'data' };
      const cacheKey = 'test_key';
      
      // Set cache
      chatRepository['setCache'](cacheKey, testData);
      
      // Clear cache
      chatRepository['clearCache']();
      
      // Cache should be empty
      const cached = chatRepository['getCache'](cacheKey);
      expect(cached).toBeNull();
    });
  });

  describe('Chat Repository', () => {
    let chatRepository: ChatRepository;

    beforeEach(() => {
      chatRepository = new ChatRepository();
    });

    it('should send message successfully', async () => {
      // Mock HTTP service
      const mockHttpService = {
        post: jest.fn().mockResolvedValue({
          data: {
            success: true,
            message: 'Test response',
            responseType: 'session_data',
            sessionId: 'test_session',
          },
        }),
      };

      // Replace HTTP service
      (chatRepository as any).httpService = mockHttpService;

      const result = await chatRepository.sendMessage('Hello', 'test_session');
      
      expect(result.success).toBe(true);
      expect(result.data?.message).toBe('Test response');
      expect(result.data?.sessionId).toBe('test_session');
    });

    it('should get conversation history', async () => {
      const result = await chatRepository.getConversationHistory(10);
      
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should clear conversation', async () => {
      const result = await chatRepository.clearConversation();
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it('should get session information', async () => {
      // Mock HTTP service
      const mockHttpService = {
        get: jest.fn().mockResolvedValue({
          data: {
            success: true,
            message: 'Session retrieved',
            responseType: 'session_data',
            sessionId: 'test_session',
          },
        }),
      };

      // Replace HTTP service
      (chatRepository as any).httpService = mockHttpService;

      const result = await chatRepository.getSession('test_session');
      
      expect(result.success).toBe(true);
      expect(result.data?.sessionId).toBe('test_session');
    });
  });

  describe('Action Repository', () => {
    let actionRepository: ActionRepository;

    beforeEach(() => {
      actionRepository = new ActionRepository();
    });

    it('should get action cards', async () => {
      const result = await actionRepository.getActionCards();
      
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should execute action successfully', async () => {
      // Mock HTTP service
      const mockHttpService = {
        post: jest.fn().mockResolvedValue({
          data: {
            success: true,
            message: 'Action executed',
            responseType: 'action_completed',
            sessionId: 'test_session',
          },
        }),
      };

      // Replace HTTP service
      (actionRepository as any).httpService = mockHttpService;

      const result = await actionRepository.executeAction('action_1', { test: 'data' }, 'test_session');
      
      expect(result.success).toBe(true);
      expect(result.data?.responseType).toBe('action_completed');
    });

    it('should confirm action successfully', async () => {
      // Mock HTTP service
      const mockHttpService = {
        post: jest.fn().mockResolvedValue({
          data: {
            success: true,
            message: 'Action confirmed',
            responseType: 'confirmation_required',
            sessionId: 'test_session',
          },
        }),
      };

      // Replace HTTP service
      (actionRepository as any).httpService = mockHttpService;

      const result = await actionRepository.confirmAction('action_1', { test: 'data' }, 'test_session');
      
      expect(result.success).toBe(true);
      expect(result.data?.responseType).toBe('confirmation_required');
    });

    it('should handle action not found', async () => {
      await expect(actionRepository.getActionById('nonexistent_action')).rejects.toMatchObject({
        code: 'UNKNOWN_ERROR',
        message: 'getActionById failed: Action not found - actions are stored locally from agent responses',
        retryable: false,
      });
    });
  });

  describe('User Repository', () => {
    let userRepository: UserRepository;

    beforeEach(() => {
      userRepository = new UserRepository();
    });

    it('should sign in with Google successfully', async () => {
      // Mock HTTP service
      const mockHttpService = {
        post: jest.fn().mockResolvedValue({
          data: {
            token: 'test_token',
            user: {
              id: 'user_1',
              email: 'test@example.com',
              name: 'Test User',
            },
          },
        }),
        setAuthToken: jest.fn(),
      };

      // Replace HTTP service
      (userRepository as any).httpService = mockHttpService;

      const result = await userRepository.signInWithGoogle('google_id_token');
      
      expect(result.success).toBe(true);
      expect(result.data?.token).toBe('test_token');
      expect(result.data?.user.email).toBe('test@example.com');
    });

    it('should get current user', async () => {
      // Mock HTTP service
      const mockHttpService = {
        get: jest.fn().mockResolvedValue({
          data: {
            id: 'user_1',
            email: 'test@example.com',
            name: 'Test User',
          },
        }),
      };

      // Replace HTTP service
      (userRepository as any).httpService = mockHttpService;

      const result = await userRepository.getCurrentUser();
      
      expect(result.success).toBe(true);
      expect(result.data?.email).toBe('test@example.com');
    });

    it('should update profile successfully', async () => {
      // Mock HTTP service
      const mockHttpService = {
        put: jest.fn().mockResolvedValue({
          data: {
            id: 'user_1',
            email: 'test@example.com',
            name: 'Updated Name',
          },
        }),
      };

      // Replace HTTP service
      (userRepository as any).httpService = mockHttpService;

      const result = await userRepository.updateProfile({ name: 'Updated Name' });
      
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Updated Name');
    });

    it('should refresh token successfully', async () => {
      // Mock HTTP service
      const mockHttpService = {
        post: jest.fn().mockResolvedValue({
          data: {
            token: 'new_token',
          },
        }),
        setAuthToken: jest.fn(),
      };

      // Replace HTTP service
      (userRepository as any).httpService = mockHttpService;

      const result = await userRepository.refreshToken();
      
      expect(result.success).toBe(true);
      expect(result.data?.token).toBe('new_token');
    });
  });

  describe('Mock Repository Factory', () => {
    beforeEach(() => {
      mockRepositoryFactory.resetRepositories();
    });

    it('should create mock repositories', () => {
      const chatRepo = mockRepositoryFactory.createChatRepository();
      const actionRepo = mockRepositoryFactory.createActionRepository();
      const userRepo = mockRepositoryFactory.createUserRepository();

      expect(chatRepo).toBeInstanceOf(MockChatRepository);
      expect(actionRepo).toBeInstanceOf(MockActionRepository);
      expect(userRepo).toBeInstanceOf(MockUserRepository);
    });

    it('should provide access to mock instances', () => {
      const mockChat = mockRepositoryFactory.getMockChatRepository();
      const mockAction = mockRepositoryFactory.getMockActionRepository();
      const mockUser = mockRepositoryFactory.getMockUserRepository();

      expect(mockChat).toBeInstanceOf(MockChatRepository);
      expect(mockAction).toBeInstanceOf(MockActionRepository);
      expect(mockUser).toBeInstanceOf(MockUserRepository);
    });

    it('should reset all mock data', () => {
      const mockChat = mockRepositoryFactory.getMockChatRepository();
      const mockAction = mockRepositoryFactory.getMockActionRepository();
      const mockUser = mockRepositoryFactory.getMockUserRepository();

      // Add some test data
      mockChat.setMockMessages([{ id: '1', text: 'test', isUser: true, timestamp: new Date() } as any]);
      mockAction.addMockAction({ id: '1', type: 'email', title: 'test', description: 'test', icon: '📧', data: {}, timestamp: new Date() } as any);
      mockUser.setMockUser({ id: '1', email: 'test@test.com', name: 'Test' });

      // Reset all data
      mockRepositoryFactory.resetAllMockData();

      // Verify data is reset
      expect(mockChat.getMockMessages()).toEqual([]);
      expect(mockAction.getMockActionCards()).toEqual([]);
      expect(mockUser.getMockUser()).toBeNull();
    });
  });

  describe('Error Handling', () => {
    let chatRepository: ChatRepository;

    beforeEach(() => {
      chatRepository = new ChatRepository();
    });

    it('should handle network errors gracefully', async () => {
      // Mock HTTP service to throw network error
      const mockHttpService = {
        post: jest.fn().mockRejectedValue(new Error('NETWORK_ERROR')),
      };

      // Replace HTTP service
      (chatRepository as any).httpService = mockHttpService;

      // Should add to offline queue and throw error
      await expect(chatRepository.sendMessage('test')).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        message: 'sendMessage failed: NETWORK_ERROR',
        retryable: true,
      });
    }, 10000); // Increase timeout

    it('should handle timeout errors', async () => {
      // Mock HTTP service to throw timeout error
      const mockHttpService = {
        post: jest.fn().mockRejectedValue(new Error('TIMEOUT')),
      };

      // Replace HTTP service
      (chatRepository as any).httpService = mockHttpService;

      // Should throw timeout error
      await expect(chatRepository.sendMessage('test')).rejects.toMatchObject({
        code: 'TIMEOUT',
        message: 'sendMessage failed: TIMEOUT',
        retryable: true,
      });
    }, 10000); // Increase timeout
  });
});

