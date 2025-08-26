import type { IUserRepository } from '../interfaces';
import type { APIResponse, User } from '../../types';

export class UserRepository implements IUserRepository {
  async signInWithGoogle(idToken: string): Promise<APIResponse<{ token: string; user: User }>> {
    try {
      const response = await fetch('http://localhost:3000/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      
      const data = await response.json();
      return { success: response.ok, data, error: response.ok ? undefined : data.error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sign in with Google',
      };
    }
  }

  async signOut(): Promise<APIResponse<boolean>> {
    try {
      // TODO: Implement sign out endpoint
      // For now, just return success
      return { success: true, data: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sign out',
      };
    }
  }

  async getCurrentUser(): Promise<APIResponse<User>> {
    try {
      const response = await fetch('http://localhost:3000/auth/me', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const data = await response.json();
      return { success: response.ok, data, error: response.ok ? undefined : data.error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get current user',
      };
    }
  }

  async updateProfile(data: Partial<User>): Promise<APIResponse<User>> {
    try {
      const response = await fetch('http://localhost:3000/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      const result = await response.json();
      return { success: response.ok, data: result, error: response.ok ? undefined : result.error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update profile',
      };
    }
  }

  async refreshToken(): Promise<APIResponse<{ token: string }>> {
    try {
      const response = await fetch('http://localhost:3000/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const data = await response.json();
      return { success: response.ok, data, error: response.ok ? undefined : data.error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refresh token',
      };
    }
  }
}
