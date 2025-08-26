import { ChatUseCase } from './chat.usecase';
import { ActionUseCase } from './action.usecase';
import { UserUseCase } from './user.usecase';
import { repositoryFactory } from '../../repositories';

export class UseCaseFactory {
  private static instance: UseCaseFactory;
  private chatUseCase: ChatUseCase | null = null;
  private actionUseCase: ActionUseCase | null = null;
  private userUseCase: UserUseCase | null = null;

  private constructor() {}

  static getInstance(): UseCaseFactory {
    if (!UseCaseFactory.instance) {
      UseCaseFactory.instance = new UseCaseFactory();
    }
    return UseCaseFactory.instance;
  }

  createChatUseCase(): ChatUseCase {
    if (!this.chatUseCase) {
      this.chatUseCase = new ChatUseCase(repositoryFactory.createChatRepository());
    }
    return this.chatUseCase;
  }

  createActionUseCase(): ActionUseCase {
    if (!this.actionUseCase) {
      this.actionUseCase = new ActionUseCase(repositoryFactory.createActionRepository());
    }
    return this.actionUseCase;
  }

  createUserUseCase(): UserUseCase {
    if (!this.userUseCase) {
      this.userUseCase = new UserUseCase(repositoryFactory.createUserRepository());
    }
    return this.userUseCase;
  }

  // Method to reset use cases (useful for testing)
  resetUseCases(): void {
    this.chatUseCase = null;
    this.actionUseCase = null;
    this.userUseCase = null;
  }
}

// Export singleton instance
export const useCaseFactory = UseCaseFactory.getInstance();
