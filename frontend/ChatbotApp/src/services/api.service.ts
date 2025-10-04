import { supabase } from '../config/supabase';

const API_BASE_URL = __DEV__
  ? 'http://localhost:3000/api'
  : 'https://your-production-url.com/api';

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ChatContext {
  conversationHistory: ConversationMessage[];
  masterState?: any;
  subAgentStates?: any;
}

export interface ChatMessageRequest {
  message: string;
  context?: ChatContext;
}

export interface ChatMessageResponse {
  message: string;
  context: ChatContext;
  metadata?: {
    tools_used?: string[];
    processing_time?: number;
    tokens_used?: number;
    layers?: string[];
  };
}

class ApiService {
  /**
   * Initialize the API service
   * Supabase handles session restoration automatically via AsyncStorage
   */
  async initialize(): Promise<void> {
    // Check if we have an existing session
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      console.log('Existing Supabase session found');
    } else {
      console.log('No Supabase session - user needs to sign in');
    }
  }

  /**
   * Get current session token from Supabase
   */
  private async getAccessToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  }

  /**
   * Get current user
   */
  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }

  /**
   * Sign in with email and password
   */
  async signInWithPassword(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  }

  /**
   * Sign up with email and password
   */
  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;
    return data;
  }

  /**
   * Sign in with Google OAuth
   */
  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Add any OAuth scopes needed for Gmail/Calendar
        scopes: 'email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly',
      },
    });

    if (error) throw error;
    return data;
  }

  /**
   * Sign out
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  /**
   * Refresh the session
   */
  async refreshSession() {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) throw error;
    return data;
  }

  /**
   * Make authenticated request to backend
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Get fresh access token from Supabase session
    const accessToken = await this.getAccessToken();

    if (!accessToken) {
      throw new Error('Not authenticated - please sign in');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      ...(options.headers as Record<string, string> || {}),
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      // If unauthorized, try refreshing the session once
      if (response.status === 401) {
        try {
          await this.refreshSession();
          const newToken = await this.getAccessToken();

          if (newToken) {
            // Retry request with new token
            headers['Authorization'] = `Bearer ${newToken}`;
            const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
              ...options,
              headers,
            });

            if (!retryResponse.ok) {
              const errorData = await retryResponse.json().catch(() => ({}));
              throw new Error(
                errorData.message || `HTTP error! status: ${retryResponse.status}`
              );
            }

            return retryResponse.json();
          }
        } catch (refreshError) {
          console.error('Session refresh failed:', refreshError);
          throw new Error('Session expired - please sign in again');
        }
      }

      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `HTTP error! status: ${response.status}`
      );
    }

    return response.json();
  }

  /**
   * Send a chat message to the backend
   */
  async sendMessage(
    message: string,
    context?: ChatContext
  ): Promise<ChatMessageResponse> {
    const requestBody: ChatMessageRequest = {
      message,
      context,
    };

    return this.makeRequest<ChatMessageResponse>('/chat/message', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<{ status: string }> {
    return this.makeRequest<{ status: string }>('/health');
  }
}

export const apiService = new ApiService();
