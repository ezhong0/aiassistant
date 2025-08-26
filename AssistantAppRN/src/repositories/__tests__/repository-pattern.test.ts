import { mockRepositoryFactory } from '../mocks/mock-factory';
import type { IChatRepository, IActionRepository, IUserRepository } from '../interfaces';

describe('Repository Pattern Implementation', () => {
  let chatRepository: IChatRepository;
  let actionRepository: IActionRepository;
  let userRepository: IUserRepository;

  beforeEach(() => {
    mockRepositoryFactory.resetAllMocks();
    chatRepository = mockRepositoryFactory.createChatRepository();
    actionRepository = mockRepositoryFactory.createActionRepository();
    userRepository = mockRepositoryFactory.createUserRepository();
  });

  describe('Chat Repository', () => {
    it('should send a message and return AI response', async () => {
      const result = await chatRepository.sendMessage('Hello, AI!');
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.text).toContain('Mock AI response');
    });

    it('should get conversation history', async () => {
      // Send a message first
      await chatRepository.sendMessage('Test message');
      
      const history = await chatRepository.getConversationHistory();
      expect(history.success).toBe(true);
      expect(history.data).toHaveLength(2); // User message + AI response
    });

    it('should clear conversation', async () => {
      await chatRepository.sendMessage('Test message');
      const clearResult = await chatRepository.clearConversation();
      
      expect(clearResult.success).toBe(true);
      
      const history = await chatRepository.getConversationHistory();
      expect(history.data).toHaveLength(0);
    });
  });

  describe('Action Repository', () => {
    it('should get action cards', async () => {
      const result = await actionRepository.getActionCards();
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3); // Default mock actions
      expect(result.data?.[0].type).toBe('email');
    });

    it('should execute an action', async () => {
      const result = await actionRepository.executeAction('action_1', { test: 'data' });
      
      expect(result.success).toBe(true);
      expect(result.data?.actionId).toBe('action_1');
      expect(result.data?.status).toBe('completed');
    });

    it('should get action by ID', async () => {
      const result = await actionRepository.getActionById('action_2');
      
      expect(result.success).toBe(true);
      expect(result.data?.type).toBe('calendar');
      expect(result.data?.title).toBe('Schedule Meeting');
    });

    it('should create custom action', async () => {
      const customAction = {
        type: 'general' as const,
        title: 'Custom Test Action',
        description: 'A test action',
        icon: '🧪',
        data: { test: true },
      };

      const result = await actionRepository.createCustomAction(customAction);
      
      expect(result.success).toBe(true);
      expect(result.data?.title).toBe('Custom Test Action');
      expect(result.data?.id).toMatch(/^action_\d+$/);
    });
  });

  describe('User Repository', () => {
    it('should sign in with Google', async () => {
      const result = await userRepository.signInWithGoogle('mock_google_token');
      
      expect(result.success).toBe(true);
      expect(result.data?.token).toBeDefined();
      expect(result.data?.user.email).toBe('test@example.com');
    });

    it('should get current user after sign in', async () => {
      await userRepository.signInWithGoogle('mock_google_token');
      const result = await userRepository.getCurrentUser();
      
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Test User');
    });

    it('should update user profile', async () => {
      await userRepository.signInWithGoogle('mock_google_token');
      
      const updateResult = await userRepository.updateProfile({ name: 'Updated Name' });
      expect(updateResult.success).toBe(true);
      expect(updateResult.data?.name).toBe('Updated Name');
    });

    it('should sign out user', async () => {
      await userRepository.signInWithGoogle('mock_google_token');
      const signOutResult = await userRepository.signOut();
      
      expect(signOutResult.success).toBe(true);
      
      const currentUser = await userRepository.getCurrentUser();
      expect(currentUser.success).toBe(false);
    });

    it('should refresh token', async () => {
      await userRepository.signInWithGoogle('mock_google_token');
      const refreshResult = await userRepository.refreshToken();
      
      expect(refreshResult.success).toBe(true);
      expect(refreshResult.data?.token).toContain('refreshed');
    });
  });

  describe('Repository Factory', () => {
    it('should create singleton instances', () => {
      const factory1 = mockRepositoryFactory;
      const factory2 = mockRepositoryFactory;
      
      expect(factory1).toBe(factory2);
    });

    it('should create different repository instances', () => {
      const chatRepo1 = mockRepositoryFactory.createChatRepository();
      const chatRepo2 = mockRepositoryFactory.createChatRepository();
      
      expect(chatRepo1).toBe(chatRepo2); // Same instance due to singleton pattern
    });
  });
});
