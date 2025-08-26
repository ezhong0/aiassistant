import type { IUserRepository } from '../interfaces';
import type { APIResponse, User } from '../../types';

export class MockUserRepository implements IUserRepository {
  private currentUser: User | null = null;
  private authToken: string | null = null;

  async signInWithGoogle(idToken: string): Promise<APIResponse<{ token: string; user: User }>> {
    // Simulate successful Google sign-in
    const mockUser: User = {
      id: 'user_123',
      email: 'test@example.com',
      name: 'Test User',
      avatar: 'https://via.placeholder.com/150',
    };

    const mockToken = 'mock_jwt_token_' + Date.now();
    
    this.currentUser = mockUser;
    this.authToken = mockToken;

    return {
      success: true,
      data: { token: mockToken, user: mockUser },
    };
  }

  async signOut(): Promise<APIResponse<boolean>> {
    this.currentUser = null;
    this.authToken = null;
    return { success: true, data: true };
  }

  async getCurrentUser(): Promise<APIResponse<User>> {
    if (!this.currentUser) {
      return { success: false, error: 'No user signed in' };
    }
    return { success: true, data: this.currentUser };
  }

  async updateProfile(data: Partial<User>): Promise<APIResponse<User>> {
    if (!this.currentUser) {
      return { success: false, error: 'No user signed in' };
    }

    const updatedUser = { ...this.currentUser, ...data };
    this.currentUser = updatedUser;

    return { success: true, data: updatedUser };
  }

  async refreshToken(): Promise<APIResponse<{ token: string }>> {
    if (!this.authToken) {
      return { success: false, error: 'No token to refresh' };
    }

    // Simulate token refresh
    const newToken = 'mock_jwt_token_refreshed_' + Date.now();
    this.authToken = newToken;

    return { success: true, data: { token: newToken } };
  }

  // Helper methods for testing
  isAuthenticated(): boolean {
    return this.currentUser !== null && this.authToken !== null;
  }

  getCurrentToken(): string | null {
    return this.authToken;
  }

  setMockUser(user: User): void {
    this.currentUser = user;
  }

  setMockToken(token: string): void {
    this.authToken = token;
  }
}
