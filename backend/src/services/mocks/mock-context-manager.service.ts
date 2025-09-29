/**
 * Mock Context Manager Service for Testing
 * Provides mock implementations of context management operations
 */

import { BaseService } from '../base-service';
import { ServiceState } from '../../types/service.types';

export class MockContextManagerService extends BaseService {
  private contexts: Map<string, any> = new Map();

  constructor() {
    super('MockContextManagerService');
  }

  /**
   * Mock initialization - always succeeds
   */
  protected async onInitialize(): Promise<void> {
    this.logInfo('Mock Context Manager Service initialized for testing');
  }

  /**
   * Mock cleanup
   */
  protected async onDestroy(): Promise<void> {
    this.contexts.clear();
    this.logInfo('Mock Context Manager Service destroyed');
  }

  /**
   * Mock context gathering
   */
  async gatherContext(sessionId: string, userId: string): Promise<any> {
    this.logInfo('Mock context gathering', { sessionId, userId });
    
    return {
      success: true,
      context: {
        sessionId,
        userId,
        messageHistory: [],
        currentTime: new Date().toISOString(),
        mockData: true
      }
    };
  }

  /**
   * Mock context storage
   */
  async storeContext(sessionId: string, context: any): Promise<boolean> {
    this.logInfo('Mock context storage', { sessionId });
    this.contexts.set(sessionId, context);
    return true;
  }

  /**
   * Mock context retrieval
   */
  async getContext(sessionId: string): Promise<any> {
    this.logInfo('Mock context retrieval', { sessionId });
    return this.contexts.get(sessionId) || null;
  }

  /**
   * Mock health check
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    return {
      healthy: true,
      details: {
        service: 'MockContextManagerService',
        status: 'ready',
        mockMode: true,
        contextCount: this.contexts.size
      }
    };
  }

  /**
   * Mock connection status
   */
  isReady(): boolean {
    return true;
  }
}
