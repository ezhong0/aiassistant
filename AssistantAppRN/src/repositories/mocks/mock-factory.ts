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

  // Method to reset all mock repositories
  resetAllMocks(): void {
    this.chatRepository = null;
    this.actionRepository = null;
    this.userRepository = null;
  }

  // Method to get specific mock instances for advanced testing
  getMockChatRepository(): MockChatRepository {
    return this.createChatRepository() as MockChatRepository;
  }

  getMockActionRepository(): MockActionRepository {
    return this.createActionRepository() as MockActionRepository;
  }

  getMockUserRepository(): MockUserRepository {
    return this.createUserRepository() as MockUserRepository;
  }
}

// Export singleton instance for testing
export const mockRepositoryFactory = new MockRepositoryFactory();
