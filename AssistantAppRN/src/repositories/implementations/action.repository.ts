import type { IActionRepository } from '../interfaces';
import type { APIResponse, ActionCard, BackendResponse } from '../../types';
import { BaseRepository } from '../base.repository';
import { httpService, type HTTPService } from '../../services/http.service';

export class ActionRepository extends BaseRepository implements IActionRepository {
  private httpService: HTTPService;

  constructor(httpServiceInstance?: HTTPService) {
    super(
      { maxRetries: 3, retryDelay: 1000, backoffMultiplier: 2 },
      { ttl: 10 * 60 * 1000, maxSize: 100 } // 10 minutes cache, 100 items max
    );
    this.httpService = httpServiceInstance || httpService;
  }

  async getActionCards(): Promise<APIResponse<ActionCard[]>> {
    const cacheKey = 'action_cards_all';
    
    return this.executeWithRetry(async () => {
      try {
        // Check cache first
        const cached = this.getCache<ActionCard[]>(cacheKey);
        if (cached) {
          return { success: true, data: cached };
        }

        // TODO: Action cards come from agent responses, not direct API calls
        // This method should return cached action cards from previous agent responses
        const actionCards: ActionCard[] = [];
        
        // Cache the result
        this.setCache(cacheKey, actionCards);
        
        return { success: true, data: actionCards };
      } catch (error) {
        throw error;
      }
    }, 'getActionCards');
  }

  async executeAction(actionId: string, data: any, sessionId?: string): Promise<APIResponse<BackendResponse>> {
    const cacheKey = `action_execution_${actionId}_${sessionId || 'default'}`;
    
    return this.executeWithRetry(async () => {
      try {
        // Check cache first
        const cached = this.getCache<BackendResponse>(cacheKey);
        if (cached) {
          return { success: true, data: cached };
        }

        // Execute action through backend multi-agent system
        const response = await this.httpService.post<BackendResponse>('/api/assistant/confirm-action', {
          actionId,
          data,
          sessionId,
          timestamp: new Date().toISOString(),
        });

        // Cache the response
        this.setCache(cacheKey, response.data);

        return { success: true, data: response.data };
      } catch (error) {
        // Add to offline queue if network error
        if (error instanceof Error && error.message.includes('NETWORK_ERROR')) {
          this.addToOfflineQueue('executeAction', { actionId, data, sessionId });
        }
        throw error;
      }
    }, 'executeAction', { actionId, data, sessionId });
  }

  async getActionById(actionId: string): Promise<APIResponse<ActionCard>> {
    const cacheKey = `action_${actionId}`;
    
    return this.executeWithRetry(async () => {
      try {
        // Check cache first
        const cached = this.getCache<ActionCard>(cacheKey);
        if (cached) {
          return { success: true, data: cached };
        }

        // TODO: Actions are stored locally from agent responses
        // This should return from local storage or cache
        throw new Error('Action not found - actions are stored locally from agent responses');
      } catch (error) {
        throw error;
      }
    }, 'getActionById', { actionId });
  }

  async createCustomAction(data: Partial<ActionCard>): Promise<APIResponse<ActionCard>> {
    return this.executeWithRetry(async () => {
      try {
        // TODO: Custom actions may be supported in the future
        // For now, throw error as this is not implemented
        throw new Error('Custom action creation not supported in current version');
      } catch (error) {
        throw error;
      }
    }, 'createCustomAction', { data });
  }

  async confirmAction(actionId: string, data: any, sessionId?: string): Promise<APIResponse<BackendResponse>> {
    const cacheKey = `action_confirmation_${actionId}_${sessionId || 'default'}`;
    
    return this.executeWithRetry(async () => {
      try {
        // Check cache first
        const cached = this.getCache<BackendResponse>(cacheKey);
        if (cached) {
          return { success: true, data: cached };
        }

        // Confirm action through backend multi-agent system
        const response = await this.httpService.post<BackendResponse>('/api/assistant/confirm-action', {
          actionId,
          data,
          sessionId,
          timestamp: new Date().toISOString(),
          confirmed: true,
        });

        // Cache the response
        this.setCache(cacheKey, response.data);

        return { success: true, data: response.data };
      } catch (error) {
        // Add to offline queue if network error
        if (error instanceof Error && error.message.includes('NETWORK_ERROR')) {
          this.addToOfflineQueue('confirmAction', { actionId, data, sessionId });
        }
        throw error;
      }
    }, 'confirmAction', { actionId, data, sessionId });
  }

  /**
   * Process offline queue item for action repository
   */
  protected async processOfflineItem(item: any): Promise<void> {
    if (item.action === 'executeAction') {
      await this.executeAction(item.data.actionId, item.data.data, item.data.sessionId);
    } else if (item.action === 'confirmAction') {
      await this.confirmAction(item.data.actionId, item.data.data, item.data.sessionId);
    }
  }
}
