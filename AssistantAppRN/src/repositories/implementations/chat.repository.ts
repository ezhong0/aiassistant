import type { IChatRepository } from '../interfaces';
import type { APIResponse, Message, BackendResponse } from '../../types';
import { BaseRepository } from '../base.repository';
import { httpService, type HTTPService } from '../../services/http.service';

export class ChatRepository extends BaseRepository implements IChatRepository {
  private httpService: HTTPService;

  constructor(httpServiceInstance?: HTTPService) {
    super(
      { maxRetries: 3, retryDelay: 1000, backoffMultiplier: 2 },
      { ttl: 5 * 60 * 1000, maxSize: 50 } // 5 minutes cache, 50 items max
    );
    this.httpService = httpServiceInstance || httpService;
  }

  async sendMessage(message: string, sessionId?: string): Promise<APIResponse<BackendResponse>> {
    const cacheKey = `message_${sessionId || 'default'}_${Date.now()}`;
    
    return this.executeWithRetry(async () => {
      try {
        // Check cache first
        const cached = this.getCache<BackendResponse>(cacheKey);
        if (cached) {
          return { success: true, data: cached };
        }

        // Send message to backend multi-agent system
        const response = await this.httpService.post<BackendResponse>('/api/assistant/text-command', {
          message,
          sessionId,
          timestamp: new Date().toISOString(),
        });

        // Cache the response
        this.setCache(cacheKey, response.data);

        return { success: true, data: response.data };
      } catch (error) {
        // Add to offline queue if network error
        if (error instanceof Error && error.message.includes('NETWORK_ERROR')) {
          this.addToOfflineQueue('sendMessage', { message, sessionId });
        }
        throw error;
      }
    }, 'sendMessage', { message, sessionId });
  }

  async getConversationHistory(limit: number = 50): Promise<APIResponse<Message[]>> {
    const cacheKey = `conversation_history_${limit}`;
    
    return this.executeWithRetry(async () => {
      try {
        // Check cache first
        const cached = this.getCache<Message[]>(cacheKey);
        if (cached) {
          return { success: true, data: cached };
        }

        // TODO: Implement local storage for conversation history
        // For now, return empty array
        const history: Message[] = [];
        
        // Cache the result
        this.setCache(cacheKey, history);
        
        return { success: true, data: history };
      } catch (error) {
        throw error;
      }
    }, 'getConversationHistory', { limit });
  }

  async clearConversation(): Promise<APIResponse<boolean>> {
    return this.executeWithRetry(async () => {
      try {
        // Clear cache
        this.clearCache();
        
        // TODO: Clear local storage conversation history
        
        return { success: true, data: true };
      } catch (error) {
        throw error;
      }
    }, 'clearConversation');
  }

  async getSession(sessionId: string): Promise<APIResponse<BackendResponse>> {
    const cacheKey = `session_${sessionId}`;
    
    return this.executeWithRetry(async () => {
      try {
        // Check cache first
        const cached = this.getCache<BackendResponse>(cacheKey);
        if (cached) {
          return { success: true, data: cached };
        }

        // Get session from backend
        const response = await this.httpService.get<BackendResponse>(`/api/assistant/session/${sessionId}`);
        
        // Cache the response
        this.setCache(cacheKey, response.data);
        
        return { success: true, data: response.data };
      } catch (error) {
        throw error;
      }
    }, 'getSession', { sessionId });
  }

  /**
   * Process offline queue item for chat repository
   */
  protected async processOfflineItem(item: any): Promise<void> {
    if (item.action === 'sendMessage') {
      await this.sendMessage(item.data.message, item.data.sessionId);
    }
  }
}
