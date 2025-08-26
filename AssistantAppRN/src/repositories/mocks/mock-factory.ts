import type { IRepositoryFactory, IChatRepository, IActionRepository, IUserRepository } from '../interfaces';
import { MockChatRepository } from './mock-chat.repository';
import { MockActionRepository } from './mock-action.repository';
import { MockUserRepository } from './mock-user.repository';

export class MockRepositoryFactory implements IRepositoryFactory {
  private chatRepository: IChatRepository | null = null;
  private actionRepository: IActionRepository | null = null;
  private userRepository: IUserRepository | null = null;

  createChatRepository(): IChatRepository {
    if (!this.chatRepository) {
      this.chatRepository = new MockChatRepository();
    }
    return this.chatRepository;
  }

  createActionRepository(): IActionRepository {
    if (!this.actionRepository) {
      this.actionRepository = new MockActionRepository();
    }
    return this.actionRepository;
  }

  createUserRepository(): IUserRepository {
    if (!this.userRepository) {
      this.userRepository = new MockUserRepository();
    }
    return this.userRepository;
  }

  /**
   * Set authentication token for all repositories (no-op for mocks)
   */
  setAuthToken(token: string | null): void {
    // Mock repositories don't need real authentication
    console.log('Mock factory: Setting auth token:', token ? '***' : 'null');
  }

  /**
   * Reset all repositories (useful for testing)
   */
  resetRepositories(): void {
    this.chatRepository = null;
    this.actionRepository = null;
    this.userRepository = null;
  }

  /**
   * Get mock repository instances for direct testing
   */
  getMockChatRepository(): MockChatRepository {
    return this.createChatRepository() as MockChatRepository;
  }

  getMockActionRepository(): MockActionRepository {
    return this.createActionRepository() as MockActionRepository;
  }

  getMockUserRepository(): MockUserRepository {
    return this.createUserRepository() as MockUserRepository;
  }

  /**
   * Reset all mock data in repositories
   */
  resetAllMockData(): void {
    if (this.chatRepository) {
      (this.chatRepository as MockChatRepository).setMockMessages([]);
      (this.chatRepository as MockChatRepository).setMockResponses([]);
    }
    
    if (this.actionRepository) {
      (this.actionRepository as MockActionRepository).resetMockData();
    }
    
    if (this.userRepository) {
      (this.userRepository as MockUserRepository).resetMockData();
    }
  }
}

// Export singleton instance for testing
export const mockRepositoryFactory = new MockRepositoryFactory();
