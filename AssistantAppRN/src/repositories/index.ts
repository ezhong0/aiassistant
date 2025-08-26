// Repository interfaces
export type {
  IBaseRepository,
  IChatRepository,
  IActionRepository,
  IUserRepository,
  IRepositoryFactory,
} from './interfaces';

// Base repository class
export { BaseRepository } from './base.repository';

// Repository implementations
export { ChatRepository } from './implementations/chat.repository';
export { ActionRepository } from './implementations/action.repository';
export { UserRepository } from './implementations/user.repository';

// Repository factory
export { RepositoryFactory, repositoryFactory } from './factory';

// Mock implementations for testing
export { MockChatRepository } from './mocks/mock-chat.repository';
export { MockActionRepository } from './mocks/mock-action.repository';
export { MockUserRepository } from './mocks/mock-user.repository';
export { MockRepositoryFactory, mockRepositoryFactory } from './mocks/mock-factory';

// HTTP service
export { HTTPService, httpService } from '../services/http.service';
export type { HTTPConfig, HTTPResponse, HTTPError } from '../services/http.service';
