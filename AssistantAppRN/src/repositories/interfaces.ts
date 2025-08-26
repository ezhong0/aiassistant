import type { APIResponse, Message, ActionCard, User } from '../types';

// Base repository interface for common operations
export interface IBaseRepository<T> {
  create(data: Partial<T>): Promise<APIResponse<T>>;
  update(id: string, data: Partial<T>): Promise<APIResponse<T>>;
  delete(id: string): Promise<APIResponse<boolean>>;
  findById(id: string): Promise<APIResponse<T>>;
}

// Chat repository interface
export interface IChatRepository {
  sendMessage(message: string): Promise<APIResponse<Message>>;
  getConversationHistory(limit?: number): Promise<APIResponse<Message[]>>;
  clearConversation(): Promise<APIResponse<boolean>>;
}

// Action repository interface
export interface IActionRepository {
  getActionCards(): Promise<APIResponse<ActionCard[]>>;
  executeAction(actionId: string, data: any): Promise<APIResponse<any>>;
  getActionById(actionId: string): Promise<APIResponse<ActionCard>>;
  createCustomAction(data: Partial<ActionCard>): Promise<APIResponse<ActionCard>>;
}

// User repository interface
export interface IUserRepository {
  signInWithGoogle(idToken: string): Promise<APIResponse<{ token: string; user: User }>>;
  signOut(): Promise<APIResponse<boolean>>;
  getCurrentUser(): Promise<APIResponse<User>>;
  updateProfile(data: Partial<User>): Promise<APIResponse<User>>;
  refreshToken(): Promise<APIResponse<{ token: string }>>;
}

// Repository factory interface for dependency injection
export interface IRepositoryFactory {
  createChatRepository(): IChatRepository;
  createActionRepository(): IActionRepository;
  createUserRepository(): IUserRepository;
}
