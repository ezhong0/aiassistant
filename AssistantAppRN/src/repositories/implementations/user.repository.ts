import type { IUserRepository } from '../interfaces';
import type { APIResponse, User } from '../../types';
import { BaseRepository } from '../base.repository';
import { httpService, type HTTPService } from '../../services/http.service';

export class UserRepository extends BaseRepository implements IUserRepository {
  private httpService: HTTPService;

  constructor(httpServiceInstance?: HTTPService) {
    super(
      { maxRetries: 3, retryDelay: 1000, backoffMultiplier: 2 },
      { ttl: 15 * 60 * 1000, maxSize: 20 } // 15 minutes cache, 20 items max
    );
    this.httpService = httpServiceInstance || httpService;
  }

  async signInWithGoogle(idToken: string): Promise<APIResponse<{ token: string; user: User }>> {
    const cacheKey = `auth_google_${idToken.substring(0, 10)}`;
    
    return this.executeWithRetry(async () => {
      try {
        // Check cache first
        const cached = this.getCache<{ token: string; user: User }>(cacheKey);
        if (cached) {
          return { success: true, data: cached };
        }

        // Sign in with Google through backend
        const response = await this.httpService.post<{ token: string; user: User }>('/api/auth/google', {
          idToken,
          timestamp: new Date().toISOString(),
        });

        // Set auth token for future requests
        this.httpService.setAuthToken(response.data.token);

        // Cache the response
        this.setCache(cacheKey, response.data);

        return { success: true, data: response.data };
      } catch (error) {
        throw error;
      }
    }, 'signInWithGoogle', { idToken });
  }

  async signOut(): Promise<APIResponse<boolean>> {
    return this.executeWithRetry(async () => {
      try {
        // Clear auth token
        this.httpService.setAuthToken(null);
        
        // Clear auth cache
        this.clearCache();
        
        // TODO: Call backend sign out endpoint if needed
        // For now, just return success
        
        return { success: true, data: true };
      } catch (error) {
        throw error;
      }
    }, 'signOut');
  }

  async getCurrentUser(): Promise<APIResponse<User>> {
    const cacheKey = 'current_user';
    
    return this.executeWithRetry(async () => {
      try {
        // Check cache first
        const cached = this.getCache<User>(cacheKey);
        if (cached) {
          return { success: true, data: cached };
        }

        // Get current user from backend
        const response = await this.httpService.get<User>('/api/auth/me');
        
        // Cache the response
        this.setCache(cacheKey, response.data);
        
        return { success: true, data: response.data };
      } catch (error) {
        throw error;
      }
    }, 'getCurrentUser');
  }

  async updateProfile(data: Partial<User>): Promise<APIResponse<User>> {
    const cacheKey = 'current_user';
    
    return this.executeWithRetry(async () => {
      try {
        // Update profile through backend
        const response = await this.httpService.put<User>('/api/auth/profile', data);
        
        // Update cache
        this.setCache(cacheKey, response.data);
        
        return { success: true, data: response.data };
      } catch (error) {
        throw error;
      }
    }, 'updateProfile', { data });
  }

  async refreshToken(): Promise<APIResponse<{ token: string }>> {
    const cacheKey = 'auth_refresh';
    
    return this.executeWithRetry(async () => {
      try {
        // Check cache first
        const cached = this.getCache<{ token: string }>(cacheKey);
        if (cached) {
          return { success: true, data: cached };
        }

        // Refresh token through backend
        const response = await this.httpService.post<{ token: string }>('/api/auth/refresh');
        
        // Set new auth token
        this.httpService.setAuthToken(response.data.token);
        
        // Cache the response
        this.setCache(cacheKey, response.data);
        
        return { success: true, data: response.data };
      } catch (error) {
        throw error;
      }
    }, 'refreshToken');
  }

  async validateSession(sessionId: string): Promise<APIResponse<boolean>> {
    const cacheKey = `session_validation_${sessionId}`;
    
    return this.executeWithRetry(async () => {
      try {
        // Check cache first
        const cached = this.getCache<boolean>(cacheKey);
        if (cached !== null) {
          return { success: true, data: cached };
        }

        // Validate session through backend
        const response = await this.httpService.get<{ valid: boolean }>(`/api/assistant/session/${sessionId}/validate`);
        
        const isValid = response.data.valid;
        
        // Cache the result
        this.setCache(cacheKey, isValid);
        
        return { success: true, data: isValid };
      } catch (error) {
        throw error;
      }
    }, 'validateSession', { sessionId });
  }

  /**
   * Process offline queue item for user repository
   */
  protected async processOfflineItem(item: any): Promise<void> {
    // User repository operations are typically not queued offline
    // Authentication requires network connectivity
    console.log('User repository offline item processing not implemented:', item);
  }
}
