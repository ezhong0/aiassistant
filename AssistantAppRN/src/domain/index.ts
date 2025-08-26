// Domain entities
export type {
  User,
  UserPreferences,
  NotificationSettings,
  Message,
  MessageMetadata,
  Attachment,
  ActionCard,
  Conversation,
  ConversationMetadata,
} from './entities';

// Use cases
export { ChatUseCase } from './usecases/chat.usecase';
export { ActionUseCase } from './usecases/action.usecase';
export { UserUseCase } from './usecases/user.usecase';

// Use case types
export type {
  SendMessageRequest,
  SendMessageResponse,
  GetConversationHistoryRequest,
  GetConversationHistoryResponse,
  ExecuteActionRequest,
  ExecuteActionResponse,
  CreateActionRequest,
  CreateActionResponse,
  SignInRequest,
  SignInResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
  UpdatePreferencesRequest,
  UpdatePreferencesResponse,
} from './usecases';

// Factory
export { UseCaseFactory, useCaseFactory } from './usecases/factory';
