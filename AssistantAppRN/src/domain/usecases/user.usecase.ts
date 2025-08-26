import type { User, UserPreferences } from '../entities';
import type { IUserRepository } from '../../repositories/interfaces';

export interface SignInRequest {
  idToken: string;
  provider: 'google' | 'apple' | 'email';
}

export interface SignInResponse {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

export interface UpdateProfileRequest {
  userId: string;
  updates: Partial<User>;
}

export interface UpdateProfileResponse {
  success: boolean;
  user?: User;
  error?: string;
}

export interface UpdatePreferencesRequest {
  userId: string;
  preferences: Partial<UserPreferences>;
}

export interface UpdatePreferencesResponse {
  success: boolean;
  preferences?: UserPreferences;
  error?: string;
}

export class UserUseCase {
  constructor(private userRepository: IUserRepository) {}

  async signIn(request: SignInRequest): Promise<SignInResponse> {
    try {
      // Validate input
      if (!request.idToken) {
        return {
          success: false,
          error: 'ID token is required',
        };
      }

      if (!request.provider) {
        return {
          success: false,
          error: 'Authentication provider is required',
        };
      }

      // Handle different providers
      let result;
      switch (request.provider) {
        case 'google':
          result = await this.userRepository.signInWithGoogle(request.idToken);
          break;
        case 'apple':
          // TODO: Implement Apple sign-in
          return {
            success: false,
            error: 'Apple sign-in not implemented yet',
          };
        case 'email':
          // TODO: Implement email sign-in
          return {
            success: false,
            error: 'Email sign-in not implemented yet',
          };
        default:
          return {
            success: false,
            error: 'Unsupported authentication provider',
          };
      }

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Authentication failed',
        };
      }

      return {
        success: true,
        user: result.data?.user,
        token: result.data?.token,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async signOut(): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.userRepository.signOut();
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to sign out',
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async getCurrentUser(): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const result = await this.userRepository.getCurrentUser();
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to get current user',
        };
      }

      return {
        success: true,
        user: result.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async updateProfile(request: UpdateProfileRequest): Promise<UpdateProfileResponse> {
    try {
      // Validate input
      if (!request.userId) {
        return {
          success: false,
          error: 'User ID is required',
        };
      }

      if (!request.updates || Object.keys(request.updates).length === 0) {
        return {
          success: false,
          error: 'No updates provided',
        };
      }

      // Validate email format if updating email
      if (request.updates.email && !this.isValidEmail(request.updates.email)) {
        return {
          success: false,
          error: 'Invalid email format',
        };
      }

      const result = await this.userRepository.updateProfile(request.updates);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to update profile',
        };
      }

      return {
        success: true,
        user: result.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async refreshToken(): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
      const result = await this.userRepository.refreshToken();
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to refresh token',
        };
      }

      return {
        success: true,
        token: result.data?.token,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
