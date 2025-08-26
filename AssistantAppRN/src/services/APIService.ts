import type { APIResponse, Message, ActionCard } from '../types';

class APIService {
  private baseURL: string;
  private authToken: string | null = null;

  constructor() {
    // TODO: Configure based on environment
    this.baseURL = 'http://localhost:3000'; // Your backend URL
  }

  setAuthToken(token: string) {
    this.authToken = token;
  }

  clearAuthToken() {
    this.authToken = null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      if (this.authToken) {
        headers.Authorization = `Bearer ${this.authToken}`;
      }

      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Request failed',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // Authentication
  async signInWithGoogle(idToken: string): Promise<APIResponse<{ token: string; user: any }>> {
    return this.request('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
  }

  // Chat
  async sendMessage(message: string): Promise<APIResponse<Message>> {
    return this.request('/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  // Action Cards
  async getActionCards(): Promise<APIResponse<ActionCard[]>> {
    return this.request('/assistant/actions');
  }

  async executeAction(actionId: string, data: any): Promise<APIResponse<any>> {
    return this.request(`/assistant/actions/${actionId}/execute`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Health check
  async healthCheck(): Promise<APIResponse<{ status: string }>> {
    return this.request('/health');
  }
}

export default new APIService();
