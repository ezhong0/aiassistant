import { BaseService } from './base-service';
import { CacheService } from './cache.service';
import { ToolExecutorService } from './tool-executor.service';
import { ToolCall, ToolResult, ToolExecutionContext } from '../types/tools';
import { getService } from './service-manager';
import { EnhancedLogger, LogContext } from '../utils/enhanced-logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Draft interface for pending write operations
 */
export interface Draft {
  id: string;
  sessionId: string;
  type: 'email' | 'calendar' | 'contact' | 'slack' | 'other';
  operation: string;
  parameters: any;
  previewData: {
    description: string;
    details: Record<string, any>;
  };
  toolCall: ToolCall;
  confirmationReason: string;
  riskLevel: 'low' | 'medium' | 'high';
  createdAt: Date;
  awaitingConfirmation: boolean;
}

/**
 * Write operation for draft creation
 */
export interface WriteOperation {
  type: 'email' | 'calendar' | 'contact' | 'slack' | 'other';
  operation: string;
  parameters: any;
  toolCall: ToolCall;
  confirmationReason: string;
  riskLevel: 'low' | 'medium' | 'high';
  previewDescription: string;
}

/**
 * DraftManager - Handles draft creation, storage, modification, and execution
 *
 * This service manages the complete lifecycle of draft operations:
 * - Creating drafts for write operations that need confirmation
 * - Storing drafts in cache for persistence across requests
 * - Updating draft parameters when users request modifications
 * - Executing confirmed drafts through ToolExecutorService
 * - Managing draft cleanup and expiration
 */
export class DraftManager extends BaseService {
  private cacheService: CacheService | null = null;
  private toolExecutorService: ToolExecutorService | null = null;

  constructor() {
    super('DraftManager');
  }

  /**
   * Service initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.cacheService = getService('cacheService') as CacheService;
      this.toolExecutorService = getService('toolExecutorService') as ToolExecutorService;

      if (!this.cacheService) {
        throw new Error('CacheService is required for DraftManager');
      }

      if (!this.toolExecutorService) {
        throw new Error('ToolExecutorService is required for DraftManager');
      }

      this.logInfo('DraftManager initialized successfully');
    } catch (error) {
      this.handleError(error, 'onInitialize');
    }
  }

  /**
   * Service cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.cacheService = null;
      this.toolExecutorService = null;
      this.logInfo('DraftManager destroyed successfully');
    } catch (error) {
      this.logError('Error during DraftManager destruction', error);
    }
  }

  /**
   * Create a new draft for a write operation
   */
  async createDraft(sessionId: string, operation: WriteOperation): Promise<Draft> {
    const logContext: LogContext = {
      correlationId: `draft-create-${Date.now()}`,
      sessionId,
      operation: 'createDraft',
      metadata: { operationType: operation.type, operation: operation.operation }
    };

    try {
      const draft: Draft = {
        id: uuidv4(),
        sessionId,
        type: operation.type,
        operation: operation.operation,
        parameters: operation.parameters,
        previewData: {
          description: operation.previewDescription,
          details: operation.parameters
        },
        toolCall: operation.toolCall,
        confirmationReason: operation.confirmationReason,
        riskLevel: operation.riskLevel,
        createdAt: new Date(),
        awaitingConfirmation: true
      };

      // Store draft in cache
      await this.storeDraft(draft);

      this.logInfo('Draft created successfully', {
        ...logContext,
        metadata: {
          ...logContext.metadata,
          draftId: draft.id,
          riskLevel: draft.riskLevel
        }
      });

      return draft;

    } catch (error) {
      this.logError('Failed to create draft', error, logContext);
      throw error;
    }
  }

  /**
   * Update an existing draft with new parameters
   */
  async updateDraft(draftId: string, updates: Partial<Draft>): Promise<Draft> {
    const logContext: LogContext = {
      correlationId: `draft-update-${Date.now()}`,
      operation: 'updateDraft',
      metadata: { draftId }
    };

    try {
      const existingDraft = await this.getDraft(draftId);
      if (!existingDraft) {
        throw new Error(`Draft with ID ${draftId} not found`);
      }

      const updatedDraft: Draft = {
        ...existingDraft,
        ...updates,
        id: draftId, // Ensure ID doesn't change
        awaitingConfirmation: true // Reset confirmation status
      };

      await this.storeDraft(updatedDraft);

      this.logInfo('Draft updated successfully', {
        ...logContext,
        metadata: {
          ...logContext.metadata,
          updatedFields: Object.keys(updates)
        }
      });

      return updatedDraft;

    } catch (error) {
      this.logError('Failed to update draft', error, logContext);
      throw error;
    }
  }

  /**
   * Execute a confirmed draft
   */
  async executeDraft(draftId: string): Promise<ToolResult> {
    const logContext: LogContext = {
      correlationId: `draft-execute-${Date.now()}`,
      operation: 'executeDraft',
      metadata: { draftId }
    };

    try {
      const draft = await this.getDraft(draftId);
      if (!draft) {
        throw new Error(`Draft with ID ${draftId} not found`);
      }

      // Create execution context
      const context: ToolExecutionContext = {
        sessionId: draft.sessionId,
        userId: 'system', // Will be overridden by actual execution
        correlationId: logContext.correlationId!,
        metadata: {
          draftId: draft.id,
          operationType: draft.type,
          confirmationStatus: 'confirmed'
        }
      };

      // Execute the tool call
      const result = await this.toolExecutorService!.executeTool(draft.toolCall, context);

      // Remove draft from cache after successful execution
      await this.removeDraft(draftId);

      this.logInfo('Draft executed successfully', {
        ...logContext,
        metadata: {
          ...logContext.metadata,
          success: result.success,
          operationType: draft.type
        }
      });

      return result;

    } catch (error) {
      this.logError('Failed to execute draft', error, logContext);
      throw error;
    }
  }

  /**
   * Get all drafts for a session
   */
  async getSessionDrafts(sessionId: string): Promise<Draft[]> {
    try {
      const cacheKey = this.getDraftsCacheKey(sessionId);
      const cachedDrafts = await this.cacheService!.get(cacheKey);

      if (!cachedDrafts) {
        return [];
      }

      // Parse and return drafts
      const drafts: Draft[] = JSON.parse(cachedDrafts).map((draft: any) => ({
        ...draft,
        createdAt: new Date(draft.createdAt)
      }));

      return drafts;

    } catch (error) {
      this.logError('Failed to get session drafts', error, {
        correlationId: `drafts-get-${Date.now()}`,
        sessionId,
        operation: 'getSessionDrafts'
      });
      return [];
    }
  }

  /**
   * Get a specific draft by ID
   */
  async getDraft(draftId: string): Promise<Draft | null> {
    try {
      // We need to search through all sessions since we only have the draft ID
      // This could be optimized with a separate draft ID -> session mapping
      const cacheKey = this.getDraftCacheKey(draftId);
      const cachedDraft = await this.cacheService!.get(cacheKey);

      if (!cachedDraft) {
        return null;
      }

      const draft = JSON.parse(cachedDraft);
      return {
        ...draft,
        createdAt: new Date(draft.createdAt)
      };

    } catch (error) {
      this.logError('Failed to get draft', error, {
        correlationId: `draft-get-${Date.now()}`,
        operation: 'getDraft',
        metadata: { draftId }
      });
      return null;
    }
  }

  /**
   * Clear all drafts for a session
   */
  async clearSessionDrafts(sessionId: string): Promise<void> {
    const logContext: LogContext = {
      correlationId: `drafts-clear-${Date.now()}`,
      sessionId,
      operation: 'clearSessionDrafts'
    };

    try {
      // Get existing drafts to clean up individual cache entries
      const existingDrafts = await this.getSessionDrafts(sessionId);

      // Remove session drafts list
      const cacheKey = this.getDraftsCacheKey(sessionId);
      await this.cacheService!.del(cacheKey);

      // Remove individual draft cache entries
      for (const draft of existingDrafts) {
        const draftCacheKey = this.getDraftCacheKey(draft.id);
        await this.cacheService!.del(draftCacheKey);
      }

      this.logInfo('Session drafts cleared successfully', {
        ...logContext,
        metadata: { clearedDraftsCount: existingDrafts.length }
      });

    } catch (error) {
      this.logError('Failed to clear session drafts', error, logContext);
      throw error;
    }
  }

  /**
   * Remove a specific draft
   */
  async removeDraft(draftId: string): Promise<void> {
    try {
      const draft = await this.getDraft(draftId);
      if (!draft) {
        return; // Draft doesn't exist, nothing to remove
      }

      // Remove from session drafts list
      const sessionDrafts = await this.getSessionDrafts(draft.sessionId);
      const updatedDrafts = sessionDrafts.filter(d => d.id !== draftId);

      const sessionCacheKey = this.getDraftsCacheKey(draft.sessionId);
      if (updatedDrafts.length > 0) {
        await this.cacheService!.set(sessionCacheKey, JSON.stringify(updatedDrafts), 3600); // 1 hour TTL
      } else {
        await this.cacheService!.del(sessionCacheKey);
      }

      // Remove individual draft cache entry
      const draftCacheKey = this.getDraftCacheKey(draftId);
      await this.cacheService!.del(draftCacheKey);

    } catch (error) {
      this.logError('Failed to remove draft', error, {
        correlationId: `draft-remove-${Date.now()}`,
        operation: 'removeDraft',
        metadata: { draftId }
      });
      throw error;
    }
  }

  /**
   * Store a draft in cache
   */
  private async storeDraft(draft: Draft): Promise<void> {
    // Store individual draft
    const draftCacheKey = this.getDraftCacheKey(draft.id);
    await this.cacheService!.set(draftCacheKey, JSON.stringify(draft), 3600); // 1 hour TTL

    // Update session drafts list
    const sessionDrafts = await this.getSessionDrafts(draft.sessionId);
    const existingIndex = sessionDrafts.findIndex(d => d.id === draft.id);

    if (existingIndex >= 0) {
      sessionDrafts[existingIndex] = draft;
    } else {
      sessionDrafts.push(draft);
    }

    const sessionCacheKey = this.getDraftsCacheKey(draft.sessionId);
    await this.cacheService!.set(sessionCacheKey, JSON.stringify(sessionDrafts), 3600); // 1 hour TTL
  }

  /**
   * Generate cache key for session drafts
   */
  private getDraftsCacheKey(sessionId: string): string {
    return `drafts:session:${sessionId}`;
  }

  /**
   * Generate cache key for individual draft
   */
  private getDraftCacheKey(draftId: string): string {
    return `draft:${draftId}`;
  }
}