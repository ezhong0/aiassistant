import type { IUserRepository } from '../interfaces';
import type { APIResponse, User } from '../../types';

export class MockUserRepository implements IUserRepository {
  private mockUser: User | null = null;
  private mockToken: string | null = null;
  private isAuthenticated: boolean = false;

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData(): void {
    // Mock user data
    this.mockUser = {
      id: 'user_123',
      email: 'john.doe@example.com',
      name: 'John Doe',
      avatar: 'https://example.com/avatar.jpg',
    };
    
    this.mockToken = 'mock_jwt_token_12345';
    this.isAuthenticated = false;
  }

  async signInWithGoogle(idToken: string): Promise<APIResponse<{ token: string; user: User }>> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 150));

    // Validate mock Google ID token
    if (!idToken || idToken.length < 10) {
      return {
        success: false,
        error: 'Invalid Google ID token',
      };
    }

    // Simulate successful authentication
    this.isAuthenticated = true;
    
    const response = {
      token: this.mockToken!,
      user: this.mockUser!,
    };

    return { success: true, data: response };
  }

  async signOut(): Promise<APIResponse<boolean>> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Clear authentication state
    this.isAuthenticated = false;
    this.mockToken = null;

    return { success: true, data: true };
  }

  async getCurrentUser(): Promise<APIResponse<User>> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 50));

    if (!this.isAuthenticated || !this.mockUser) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    return { success: true, data: this.mockUser };
  }

  async updateProfile(data: Partial<User>): Promise<APIResponse<User>> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    if (!this.isAuthenticated || !this.mockUser) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    // Update mock user data
    const updatedUser: User = {
      ...this.mockUser,
      ...data,
    };

    this.mockUser = updatedUser;

    return { success: true, data: updatedUser };
  }

  async refreshToken(): Promise<APIResponse<{ token: string }>> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 80));

    if (!this.isAuthenticated) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    // Generate new mock token
    this.mockToken = `mock_jwt_token_${Date.now()}`;

    return { success: true, data: { token: this.mockToken } };
  }

  async validateSession(sessionId: string): Promise<APIResponse<boolean>> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 60));

    if (!this.isAuthenticated) {
      return { success: true, data: false };
    }

    // Mock session validation - always valid for authenticated users
    const isValid = this.isAuthenticated && sessionId.length > 0;

    return { success: true, data: isValid };
  }

  // Helper methods for testing
  getMockUser(): User | null {
    return this.mockUser ? { ...this.mockUser } : null;
  }

  setMockUser(user: User | null): void {
    this.mockUser = user ? { ...user } : null;
  }

  getMockToken(): string | null {
    return this.mockToken;
  }

  setMockToken(token: string | null): void {
    this.mockToken = token;
  }

  isUserAuthenticated(): boolean {
    return this.isAuthenticated;
  }

  setAuthenticationState(authenticated: boolean): void {
    this.isAuthenticated = authenticated;
  }

  resetMockData(): void {
    this.mockUser = null;
    this.mockToken = null;
    this.isAuthenticated = false;
  }
}
