import type { IRepositoryFactory, IChatRepository, IActionRepository, IUserRepository } from './interfaces';
import { ChatRepository } from './implementations/chat.repository';
import { ActionRepository } from './implementations/action.repository';
import { UserRepository } from './implementations/user.repository';

export class RepositoryFactory implements IRepositoryFactory {
  private static instance: RepositoryFactory;
  private chatRepository: IChatRepository | null = null;
  private actionRepository: IActionRepository | null = null;
  private userRepository: IUserRepository | null = null;

  private constructor() {}

  static getInstance(): RepositoryFactory {
    if (!RepositoryFactory.instance) {
      RepositoryFactory.instance = new RepositoryFactory();
    }
    return RepositoryFactory.instance;
  }

  createChatRepository(): IChatRepository {
    if (!this.chatRepository) {
      this.chatRepository = new ChatRepository();
    }
    return this.chatRepository;
  }

  createActionRepository(): IActionRepository {
    if (!this.actionRepository) {
      this.actionRepository = new ActionRepository();
    }
    return this.actionRepository;
  }

  createUserRepository(): IUserRepository {
    if (!this.userRepository) {
      this.userRepository = new UserRepository();
    }
    return this.userRepository;
  }

  // Method to reset repositories (useful for testing)
  resetRepositories(): void {
    this.chatRepository = null;
    this.actionRepository = null;
    this.userRepository = null;
  }
}

// Export singleton instance
export const repositoryFactory = RepositoryFactory.getInstance();
