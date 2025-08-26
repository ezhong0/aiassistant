import type { APIResponse, Message, ActionCard, User, BackendResponse } from '../types';

// Base repository interface for common operations
export interface IBaseRepository<T> {
  create(data: Partial<T>): Promise<APIResponse<T>>;
  update(id: string, data: Partial<T>): Promise<APIResponse<T>>;
  delete(id: string): Promise<APIResponse<boolean>>;
  findById(id: string): Promise<APIResponse<T>>;
}

// Chat repository interface - integrates with backend multi-agent system
export interface IChatRepository {
  // Main AI processing endpoint - all user interactions go through this
  sendMessage(message: string, sessionId?: string): Promise<APIResponse<BackendResponse>>;
  
  // Get conversation history from local storage
  getConversationHistory(limit?: number): Promise<APIResponse<Message[]>>;
  
  // Clear conversation history
  clearConversation(): Promise<APIResponse<boolean>>;
  
  // Get session information
  getSession(sessionId: string): Promise<APIResponse<BackendResponse>>;
}

// Action repository interface - handles action confirmation and execution
export interface IActionRepository {
  // Get action cards from agent responses
  getActionCards(): Promise<APIResponse<ActionCard[]>>;
  
  // Execute confirmed action through backend
  executeAction(actionId: string, data: any, sessionId?: string): Promise<APIResponse<BackendResponse>>;
  
  // Get specific action by ID
  getActionById(actionId: string): Promise<APIResponse<ActionCard>>;
  
  // Create custom action (if supported)
  createCustomAction(data: Partial<ActionCard>): Promise<APIResponse<ActionCard>>;
  
  // Confirm action before execution
  confirmAction(actionId: string, data: any, sessionId?: string): Promise<APIResponse<BackendResponse>>;
}

// User repository interface - handles authentication and user management
export interface IUserRepository {
  // Google Sign-In with backend
  signInWithGoogle(idToken: string): Promise<APIResponse<{ token: string; user: User }>>;
  
  // Sign out and clear session
  signOut(): Promise<APIResponse<boolean>>;
  
  // Get current authenticated user
  getCurrentUser(): Promise<APIResponse<User>>;
  
  // Update user profile
  updateProfile(data: Partial<User>): Promise<APIResponse<User>>;
  
  // Refresh authentication token
  refreshToken(): Promise<APIResponse<{ token: string }>>;
  
  // Validate session with backend
  validateSession(sessionId: string): Promise<APIResponse<boolean>>;
}

// Repository factory interface for dependency injection
export interface IRepositoryFactory {
  createChatRepository(): IChatRepository;
  createActionRepository(): IActionRepository;
  createUserRepository(): IUserRepository;
  
  // Method to set authentication token for all repositories
  setAuthToken(token: string | null): void;
  
  // Method to reset all repositories (useful for testing)
  resetRepositories(): void;
}
