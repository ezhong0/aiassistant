import { BaseService } from './base-service';
import { 
  IConfirmationService,
  ConfirmationFlow,
  ConfirmationRequest,
  ConfirmationResponse,
  ConfirmationStatus,
  ConfirmationStats,
  ConfirmationError,
  ConfirmationErrorCode,
  ConfirmationFlowResult,
  ExecutionResult,
  ConfirmationRecord
} from '../types/confirmation.types';
import { 
  ActionPreview, 
  PreviewGenerationResult,
  ActionRiskAssessment
} from '../types/api.types';
import { ToolCall, ToolResult, ToolExecutionContext } from '../types/tools';
import { getService } from './service-manager';
import { DatabaseService } from './database.service';
import { ToolExecutorService } from './tool-executor.service';
import { AgentFactory } from '../framework/agent-factory';
import logger from '../utils/logger';
import crypto from 'crypto';

/**
 * ConfirmationService - Manages confirmation workflows for user-facing actions
 * 
 * This service serves as the backbone for all user-facing actions that require confirmation.
 * It integrates with existing AIAgent framework, service registry patterns, and Slack interface
 * while following established error handling and dependency injection patterns.
 */
export class ConfirmationService extends BaseService implements IConfirmationService {
  private databaseService: DatabaseService | null = null;
  private toolExecutorService: ToolExecutorService | null = null;
  private confirmationCache: Map<string, ConfirmationFlow> = new Map();
  private readonly defaultExpirationMinutes = 30;
  private readonly cleanupIntervalMs = 5 * 60 * 1000; // 5 minutes
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    super('confirmationService');
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      // Get dependencies from service registry
      this.databaseService = getService<DatabaseService>('databaseService') || null;
      this.toolExecutorService = getService<ToolExecutorService>('toolExecutorService') || null;

      if (!this.toolExecutorService) {
        throw new Error('ToolExecutorService is required for ConfirmationService');
      }

      // Check database health if available
      let databaseHealthy = false;
      if (this.databaseService) {
        try {
          // Test database connection with a simple query
          await this.databaseService.query('SELECT 1 as test');
          databaseHealthy = true;
          this.logDebug('Database connection verified for ConfirmationService');
        } catch (error) {
          this.logWarn('Database unavailable - ConfirmationService will run in cache-only mode', { 
            error: error instanceof Error ? error.message : error 
          });
          // Don't fail initialization, just run without database
        }
      }

      // Set up periodic cleanup of expired confirmations
      this.setupCleanupTimer();

      this.logInfo('ConfirmationService initialized', {
        hasDatabase: !!this.databaseService,
        databaseHealthy,
        hasToolExecutor: !!this.toolExecutorService,
        cleanupInterval: this.cleanupIntervalMs,
        mode: databaseHealthy ? 'database + cache' : 'cache-only'
      });
    } catch (error) {
      this.logError('Failed to initialize ConfirmationService', error);
      throw error;
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      // Clear cleanup timer
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }

      // Clear cache
      this.confirmationCache.clear();

      this.logInfo('ConfirmationService destroyed');
    } catch (error) {
      this.logError('Error destroying ConfirmationService', error);
      throw error;
    }
  }

  /**
   * Create a new confirmation flow
   */
  async createConfirmation(request: ConfirmationRequest): Promise<ConfirmationFlow> {
    this.assertReady();
    
    try {
      this.logDebug('Creating confirmation flow', {
        sessionId: request.sessionId,
        toolName: request.toolCall.name,
        hasSlackContext: !!request.context.slackContext
      });

      // Generate confirmation ID
      const confirmationId = this.generateConfirmationId();
      
      // Calculate expiration
      const expirationMinutes = request.expirationMinutes || this.defaultExpirationMinutes;
      const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);

      // Generate action preview
      const preview = await this.generateActionPreview(request.toolCall, request.context);
      
      if (!preview.success || !preview.preview) {
        throw new ConfirmationError(
          ConfirmationErrorCode.PREVIEW_GENERATION_FAILED,
          preview.error || 'Failed to generate action preview',
          { toolCall: request.toolCall }
        );
      }

      // Create confirmation flow
      const confirmationFlow: ConfirmationFlow = {
        confirmationId,
        sessionId: request.sessionId,
        userId: request.userId,
        actionPreview: preview.preview,
        originalToolCall: request.toolCall,
        status: ConfirmationStatus.PENDING,
        createdAt: new Date(),
        expiresAt,
        slackContext: request.context.slackContext
      };

      // Store in database if available, otherwise use cache
      await this.storeConfirmation(confirmationFlow);

      this.logInfo('Confirmation flow created', {
        confirmationId,
        sessionId: request.sessionId,
        toolName: request.toolCall.name,
        actionType: preview.preview.actionType,
        riskLevel: preview.preview.riskAssessment.level,
        expiresAt: expiresAt.toISOString()
      });

      return confirmationFlow;
    } catch (error) {
      this.handleError(error, 'createConfirmation');
    }
  }

  /**
   * Get confirmation by ID
   */
  async getConfirmation(confirmationId: string): Promise<ConfirmationFlow | null> {
    this.assertReady();
    
    try {
      // Check cache first
      let confirmation = this.confirmationCache.get(confirmationId);
      
      if (!confirmation && this.databaseService) {
        // Query database
        confirmation = await this.loadConfirmationFromDatabase(confirmationId);
        if (confirmation) {
          this.confirmationCache.set(confirmationId, confirmation);
        }
      }

      // Check expiration
      if (confirmation && this.isExpired(confirmation)) {
        await this.markConfirmationExpired(confirmation);
        return null;
      }

      return confirmation || null;
    } catch (error) {
      this.logError('Failed to get confirmation', error, { confirmationId });
      throw new ConfirmationError(
        ConfirmationErrorCode.DATABASE_ERROR,
        'Failed to retrieve confirmation',
        { confirmationId, error }
      );
    }
  }

  /**
   * Respond to a confirmation (confirm/reject)
   */
  async respondToConfirmation(
    confirmationId: string, 
    response: ConfirmationResponse
  ): Promise<ConfirmationFlow> {
    this.assertReady();
    
    try {
      this.logDebug('Processing confirmation response', {
        confirmationId,
        confirmed: response.confirmed,
        hasUserContext: !!response.userContext
      });

      const confirmation = await this.getConfirmation(confirmationId);
      
      if (!confirmation) {
        throw new ConfirmationError(
          ConfirmationErrorCode.CONFIRMATION_NOT_FOUND,
          'Confirmation not found or expired',
          { confirmationId }
        );
      }

      // Check if already responded
      if (confirmation.status !== ConfirmationStatus.PENDING) {
        throw new ConfirmationError(
          ConfirmationErrorCode.CONFIRMATION_ALREADY_RESPONDED,
          `Confirmation already ${confirmation.status}`,
          { confirmationId, currentStatus: confirmation.status }
        );
      }

      // Update confirmation status
      confirmation.status = response.confirmed 
        ? ConfirmationStatus.CONFIRMED 
        : ConfirmationStatus.REJECTED;
      confirmation.confirmedAt = response.respondedAt;

      // Store the response context for Slack integration
      if (response.userContext && confirmation.slackContext) {
        confirmation.slackContext = {
          ...confirmation.slackContext,
          // Store response context if needed for follow-up messages
        };
      }

      // Update storage
      await this.updateConfirmation(confirmation);

      this.logInfo('Confirmation responded', {
        confirmationId,
        confirmed: response.confirmed,
        sessionId: confirmation.sessionId,
        toolName: confirmation.originalToolCall.name,
        responseTime: Date.now() - confirmation.createdAt.getTime()
      });

      return confirmation;
    } catch (error) {
      if (error instanceof ConfirmationError) {
        throw error;
      }
      this.handleError(error, 'respondToConfirmation');
    }
  }

  /**
   * Execute a confirmed action
   */
  async executeConfirmedAction(confirmationId: string): Promise<ToolResult> {
    this.assertReady();
    
    try {
      this.logDebug('Executing confirmed action', { confirmationId });

      const confirmation = await this.getConfirmation(confirmationId);
      
      if (!confirmation) {
        throw new ConfirmationError(
          ConfirmationErrorCode.CONFIRMATION_NOT_FOUND,
          'Confirmation not found',
          { confirmationId }
        );
      }

      if (confirmation.status !== ConfirmationStatus.CONFIRMED) {
        throw new ConfirmationError(
          ConfirmationErrorCode.CONFIRMATION_EXECUTION_FAILED,
          `Cannot execute action with status: ${confirmation.status}`,
          { confirmationId, status: confirmation.status }
        );
      }

      // Create execution context
      const context: ToolExecutionContext = {
        sessionId: confirmation.sessionId,
        userId: confirmation.userId,
        timestamp: new Date(),
        slackContext: confirmation.slackContext
      };

      // Execute the tool using ToolExecutorService
      const result = await this.toolExecutorService!.executeTool(
        confirmation.originalToolCall,
        context,
        undefined, // accessToken will be retrieved by the agent
        { preview: false } // Execute for real, not preview mode
      );

      // Update confirmation with execution result
      confirmation.status = result.success 
        ? ConfirmationStatus.EXECUTED 
        : ConfirmationStatus.FAILED;
      confirmation.executedAt = new Date();
      confirmation.executionResult = result;

      await this.updateConfirmation(confirmation);

      this.logInfo('Confirmed action executed', {
        confirmationId,
        success: result.success,
        toolName: result.toolName,
        executionTime: result.executionTime,
        sessionId: confirmation.sessionId
      });

      return result;
    } catch (error) {
      if (error instanceof ConfirmationError) {
        throw error;
      }
      this.handleError(error, 'executeConfirmedAction');
    }
  }

  /**
   * Clean up expired confirmations
   */
  async cleanupExpiredConfirmations(): Promise<number> {
    this.assertReady();
    
    try {
      let cleanedCount = 0;
      const now = new Date();

      // Clean up cache
      for (const [id, confirmation] of this.confirmationCache) {
        if (confirmation.expiresAt <= now) {
          await this.markConfirmationExpired(confirmation);
          cleanedCount++;
        }
      }

      // Clean up database if available
      if (this.databaseService) {
        const dbCleanedCount = await this.cleanupExpiredFromDatabase();
        cleanedCount += dbCleanedCount;
      }

      if (cleanedCount > 0) {
        this.logInfo('Cleaned up expired confirmations', { cleanedCount });
      }

      return cleanedCount;
    } catch (error) {
      this.logError('Error cleaning up expired confirmations', error);
      return 0;
    }
  }

  /**
   * Get pending confirmations for a session
   */
  async getPendingConfirmations(sessionId: string): Promise<ConfirmationFlow[]> {
    this.assertReady();
    
    try {
      const pendingConfirmations: ConfirmationFlow[] = [];

      // Check cache
      for (const confirmation of this.confirmationCache.values()) {
        if (confirmation.sessionId === sessionId && 
            confirmation.status === ConfirmationStatus.PENDING &&
            !this.isExpired(confirmation)) {
          pendingConfirmations.push(confirmation);
        }
      }

      // Check database if available
      if (this.databaseService) {
        const dbConfirmations = await this.loadPendingFromDatabase(sessionId);
        
        // Merge with cache, avoiding duplicates
        for (const dbConfirmation of dbConfirmations) {
          if (!pendingConfirmations.find(c => c.confirmationId === dbConfirmation.confirmationId)) {
            pendingConfirmations.push(dbConfirmation);
            this.confirmationCache.set(dbConfirmation.confirmationId, dbConfirmation);
          }
        }
      }

      return pendingConfirmations;
    } catch (error) {
      this.logError('Failed to get pending confirmations', error, { sessionId });
      return []; // Return empty array on error rather than throwing
    }
  }

  /**
   * Get confirmation statistics
   */
  async getConfirmationStats(sessionId?: string): Promise<ConfirmationStats> {
    this.assertReady();
    
    try {
      // Implementation depends on whether we have database or just cache
      if (this.databaseService) {
        return await this.getStatsFromDatabase(sessionId);
      } else {
        return this.getStatsFromCache(sessionId);
      }
    } catch (error) {
      this.logError('Failed to get confirmation stats', error, { sessionId });
      return {
        total: 0,
        pending: 0,
        confirmed: 0,
        rejected: 0,
        expired: 0,
        executed: 0,
        failed: 0
      };
    }
  }

  // PRIVATE HELPER METHODS

  /**
   * Generate action preview using existing agent framework
   */
  private async generateActionPreview(
    toolCall: ToolCall, 
    context: any
  ): Promise<PreviewGenerationResult> {
    try {
      const agent = AgentFactory.getAgent(toolCall.name);
      
      if (!agent) {
        return {
          success: false,
          error: `Agent not found: ${toolCall.name}`,
          fallbackMessage: `Confirmation required for ${toolCall.name} operation`
        };
      }

      // Check if agent supports preview generation
      if (typeof (agent as any).generatePreview === 'function') {
        const executionContext: ToolExecutionContext = {
          sessionId: context.sessionId || 'unknown',
          userId: context.userId,
          timestamp: new Date(),
          slackContext: context.slackContext
        };

        return await (agent as any).generatePreview(toolCall.parameters, executionContext);
      } else {
        // Fallback for agents that don't support preview
        return this.generateFallbackPreview(toolCall);
      }
    } catch (error) {
      this.logError('Error generating action preview', error, { toolName: toolCall.name });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        fallbackMessage: `Confirmation required for ${toolCall.name} operation`
      };
    }
  }

  /**
   * Generate fallback preview for agents that don't support preview generation
   */
  private generateFallbackPreview(toolCall: ToolCall): PreviewGenerationResult {
    const actionId = this.generateConfirmationId();
    
    const preview: ActionPreview = {
      actionId,
      actionType: this.mapToolToActionType(toolCall.name),
      title: this.generateFallbackTitle(toolCall),
      description: this.generateFallbackDescription(toolCall),
      riskAssessment: this.generateFallbackRiskAssessment(toolCall),
      estimatedExecutionTime: '2-5 seconds',
      reversible: false,
      requiresConfirmation: true,
      awaitingConfirmation: true,
      previewData: {
        operation: toolCall.name,
        parameters: Object.keys(toolCall.parameters).reduce((safe, key) => {
          // Sanitize sensitive parameters
          if (key.toLowerCase().includes('token') || key.toLowerCase().includes('password')) {
            safe[key] = '[REDACTED]';
          } else {
            safe[key] = toolCall.parameters[key];
          }
          return safe;
        }, {} as Record<string, unknown>)
      },
      originalQuery: toolCall.parameters.query || `${toolCall.name} operation`,
      parameters: toolCall.parameters
    };

    return {
      success: true,
      preview
    };
  }

  private mapToolToActionType(toolName: string): ActionPreview['actionType'] {
    switch (toolName) {
      case 'emailAgent':
        return 'email';
      case 'calendarAgent':
        return 'calendar';
      case 'contactAgent':
        return 'contact';
      case 'slackAgent':
        return 'slack';
      default:
        return 'contact'; // Default fallback
    }
  }

  private generateFallbackTitle(toolCall: ToolCall): string {
    switch (toolCall.name) {
      case 'emailAgent':
        return 'Email Operation';
      case 'calendarAgent':
        return 'Calendar Operation';
      case 'contactAgent':
        return 'Contact Operation';
      case 'slackAgent':
        return 'Slack Operation';
      default:
        return `${toolCall.name} Operation`;
    }
  }

  private generateFallbackDescription(toolCall: ToolCall): string {
    const query = toolCall.parameters.query || 'operation';
    return `Execute ${toolCall.name}: ${query}`;
  }

  private generateFallbackRiskAssessment(toolCall: ToolCall): ActionRiskAssessment {
    // Conservative fallback - assume medium risk for unknown tools
    return {
      level: 'medium',
      factors: ['Unknown operation type', 'Requires manual verification'],
      warnings: [`Please verify this ${toolCall.name} operation before confirming`]
    };
  }

  private generateConfirmationId(): string {
    return 'conf_' + crypto.randomBytes(16).toString('hex');
  }

  private isExpired(confirmation: ConfirmationFlow): boolean {
    return confirmation.expiresAt <= new Date();
  }

  private async markConfirmationExpired(confirmation: ConfirmationFlow): Promise<void> {
    confirmation.status = ConfirmationStatus.EXPIRED;
    await this.updateConfirmation(confirmation);
  }

  private setupCleanupTimer(): void {
    this.cleanupTimer = setInterval(async () => {
      try {
        await this.cleanupExpiredConfirmations();
      } catch (error) {
        this.logError('Error in cleanup timer', error);
      }
    }, this.cleanupIntervalMs);
  }

  // DATABASE INTEGRATION METHODS

  private async storeConfirmation(confirmation: ConfirmationFlow): Promise<void> {
    // Store in cache
    this.confirmationCache.set(confirmation.confirmationId, confirmation);

    // Store in database if available
    if (this.databaseService) {
      try {
        await this.saveConfirmationToDatabase(confirmation);
      } catch (error) {
        this.logWarn('Failed to save confirmation to database, using cache only', { 
          confirmationId: confirmation.confirmationId,
          error 
        });
      }
    }
  }

  private async updateConfirmation(confirmation: ConfirmationFlow): Promise<void> {
    // Update cache
    this.confirmationCache.set(confirmation.confirmationId, confirmation);

    // Update database if available
    if (this.databaseService) {
      try {
        await this.updateConfirmationInDatabase(confirmation);
      } catch (error) {
        this.logWarn('Failed to update confirmation in database', { 
          confirmationId: confirmation.confirmationId,
          error 
        });
      }
    }
  }

  private async saveConfirmationToDatabase(confirmation: ConfirmationFlow): Promise<void> {
    if (!this.databaseService) return;

    const record: Partial<ConfirmationRecord> = {
      id: confirmation.confirmationId,
      session_id: confirmation.sessionId,
      user_id: confirmation.userId,
      action_preview: confirmation.actionPreview,
      original_tool_call: confirmation.originalToolCall,
      status: confirmation.status,
      created_at: confirmation.createdAt,
      expires_at: confirmation.expiresAt,
      confirmed_at: confirmation.confirmedAt,
      executed_at: confirmation.executedAt,
      execution_result: confirmation.executionResult,
      slack_context: confirmation.slackContext ? {
        team_id: confirmation.slackContext.teamId,
        channel_id: confirmation.slackContext.channelId,
        user_id: confirmation.slackContext.userId,
        thread_ts: confirmation.slackContext.threadTs,
        message_ts: confirmation.slackContext.messageTs,
        is_direct_message: confirmation.slackContext.isDirectMessage
      } : undefined
    };

    await this.databaseService.query(
      `INSERT INTO confirmations (
        id, session_id, user_id, action_preview, original_tool_call, 
        status, created_at, expires_at, confirmed_at, executed_at, 
        execution_result, slack_context
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        record.id, record.session_id, record.user_id, 
        JSON.stringify(record.action_preview),
        JSON.stringify(record.original_tool_call),
        record.status, record.created_at, record.expires_at,
        record.confirmed_at, record.executed_at,
        record.execution_result ? JSON.stringify(record.execution_result) : null,
        record.slack_context ? JSON.stringify(record.slack_context) : null
      ]
    );
  }

  private async updateConfirmationInDatabase(confirmation: ConfirmationFlow): Promise<void> {
    if (!this.databaseService) return;

    await this.databaseService.query(
      `UPDATE confirmations SET 
        status = $2, confirmed_at = $3, executed_at = $4, 
        execution_result = $5, slack_context = $6
      WHERE id = $1`,
      [
        confirmation.confirmationId,
        confirmation.status,
        confirmation.confirmedAt,
        confirmation.executedAt,
        confirmation.executionResult ? JSON.stringify(confirmation.executionResult) : null,
        confirmation.slackContext ? JSON.stringify({
          team_id: confirmation.slackContext.teamId,
          channel_id: confirmation.slackContext.channelId,
          user_id: confirmation.slackContext.userId,
          thread_ts: confirmation.slackContext.threadTs,
          message_ts: confirmation.slackContext.messageTs,
          is_direct_message: confirmation.slackContext.isDirectMessage
        }) : null
      ]
    );
  }

  private async loadConfirmationFromDatabase(confirmationId: string): Promise<ConfirmationFlow | undefined> {
    if (!this.databaseService) return undefined;

    try {
      const result = await this.databaseService.query(
        'SELECT * FROM confirmations WHERE id = $1',
        [confirmationId]
      );

      if (!result.rows || result.rows.length === 0) {
        return undefined;
      }

      return this.mapDatabaseRecordToConfirmation(result.rows[0]);
    } catch (error) {
      this.logWarn('Failed to load confirmation from database', { 
        confirmationId,
        error: error instanceof Error ? error.message : error 
      });
      return undefined;
    }
  }

  private async loadPendingFromDatabase(sessionId: string): Promise<ConfirmationFlow[]> {
    if (!this.databaseService) return [];

    try {
      const result = await this.databaseService.query(
        'SELECT * FROM confirmations WHERE session_id = $1 AND status = $2 AND expires_at > NOW()',
        [sessionId, ConfirmationStatus.PENDING]
      );

      return (result.rows || []).map(row => this.mapDatabaseRecordToConfirmation(row));
    } catch (error) {
      this.logWarn('Failed to load pending confirmations from database', { 
        sessionId,
        error: error instanceof Error ? error.message : error 
      });
      return [];
    }
  }

  private async cleanupExpiredFromDatabase(): Promise<number> {
    if (!this.databaseService) return 0;

    try {
      const result = await this.databaseService.query(
        'UPDATE confirmations SET status = $1 WHERE expires_at <= NOW() AND status = $2 RETURNING id',
        [ConfirmationStatus.EXPIRED, ConfirmationStatus.PENDING]
      );

      return result.rows?.length || 0;
    } catch (error) {
      this.logWarn('Database cleanup failed, continuing with cache-only mode', { 
        error: error instanceof Error ? error.message : error 
      });
      return 0;
    }
  }

  private async getStatsFromDatabase(sessionId?: string): Promise<ConfirmationStats> {
    if (!this.databaseService) return this.getStatsFromCache(sessionId);

    try {
      const whereClause = sessionId ? 'WHERE session_id = $1' : '';
      const params = sessionId ? [sessionId] : [];

      const result = await this.databaseService.query(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
          SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
          SUM(CASE WHEN status = 'executed' THEN 1 ELSE 0 END) as executed,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          AVG(EXTRACT(EPOCH FROM (confirmed_at - created_at))) as avg_response_time
        FROM confirmations ${whereClause}`,
        params
      );

      const row = result.rows?.[0];
      if (!row) {
        return {
          total: 0, pending: 0, confirmed: 0, rejected: 0,
          expired: 0, executed: 0, failed: 0
        };
      }

      const total = parseInt(row.total) || 0;
      const confirmed = parseInt(row.confirmed) || 0;

      return {
        total,
        pending: parseInt(row.pending) || 0,
        confirmed,
        rejected: parseInt(row.rejected) || 0,
        expired: parseInt(row.expired) || 0,
        executed: parseInt(row.executed) || 0,
        failed: parseInt(row.failed) || 0,
        averageResponseTime: row.avg_response_time ? parseFloat(row.avg_response_time) : undefined,
        confirmationRate: total > 0 ? (confirmed / total) * 100 : undefined
      };
    } catch (error) {
      this.logWarn('Failed to get stats from database, falling back to cache', { 
        sessionId,
        error: error instanceof Error ? error.message : error 
      });
      return this.getStatsFromCache(sessionId);
    }
  }

  private getStatsFromCache(sessionId?: string): ConfirmationStats {
    let confirmations = Array.from(this.confirmationCache.values());
    
    if (sessionId) {
      confirmations = confirmations.filter(c => c.sessionId === sessionId);
    }

    const total = confirmations.length;
    const confirmed = confirmations.filter(c => c.status === ConfirmationStatus.CONFIRMED).length;
    
    const responseTimes = confirmations
      .filter(c => c.confirmedAt)
      .map(c => (c.confirmedAt!.getTime() - c.createdAt.getTime()) / 1000);
    
    return {
      total,
      pending: confirmations.filter(c => c.status === ConfirmationStatus.PENDING).length,
      confirmed,
      rejected: confirmations.filter(c => c.status === ConfirmationStatus.REJECTED).length,
      expired: confirmations.filter(c => c.status === ConfirmationStatus.EXPIRED).length,
      executed: confirmations.filter(c => c.status === ConfirmationStatus.EXECUTED).length,
      failed: confirmations.filter(c => c.status === ConfirmationStatus.FAILED).length,
      averageResponseTime: responseTimes.length > 0 
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : undefined,
      confirmationRate: total > 0 ? (confirmed / total) * 100 : undefined
    };
  }

  private mapDatabaseRecordToConfirmation(record: any): ConfirmationFlow {
    return {
      confirmationId: record.id,
      sessionId: record.session_id,
      userId: record.user_id,
      actionPreview: typeof record.action_preview === 'string' 
        ? JSON.parse(record.action_preview) 
        : record.action_preview,
      originalToolCall: typeof record.original_tool_call === 'string'
        ? JSON.parse(record.original_tool_call)
        : record.original_tool_call,
      status: record.status,
      createdAt: new Date(record.created_at),
      expiresAt: new Date(record.expires_at),
      confirmedAt: record.confirmed_at ? new Date(record.confirmed_at) : undefined,
      executedAt: record.executed_at ? new Date(record.executed_at) : undefined,
      executionResult: record.execution_result 
        ? (typeof record.execution_result === 'string' 
            ? JSON.parse(record.execution_result) 
            : record.execution_result)
        : undefined,
      slackContext: record.slack_context
        ? (() => {
            const context = typeof record.slack_context === 'string'
              ? JSON.parse(record.slack_context)
              : record.slack_context;
            return {
              teamId: context.team_id,
              channelId: context.channel_id,
              userId: context.user_id,
              threadTs: context.thread_ts,
              messageTs: context.message_ts,
              isDirectMessage: context.is_direct_message
            };
          })()
        : undefined
    };
  }
}