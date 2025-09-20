import { BaseService } from './base-service';
import { CacheService } from './cache.service';
import { getService } from './service-manager';
import { EnhancedLogger, LogContext } from '../utils/enhanced-logger';

/**
 * Workflow state interface for Redis-based workflow management
 */
export interface WorkflowState {
  workflowId: string;
  sessionId: string;
  userId?: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  currentStep: number;
  totalSteps: number;
  plan: WorkflowStep[];
  completedSteps: WorkflowStep[];
  pendingStep: WorkflowStep | null;
  context: {
    originalRequest: string;
    userIntent: string;
    gatheredData: Record<string, any>;
  };
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
}

/**
 * Workflow step interface
 */
export interface WorkflowStep {
  stepId: string;
  stepNumber: number;
  description: string;
  toolCall: {
    name: string;
    parameters: Record<string, any>;
  };
  status: 'pending' | 'awaiting_confirmation' | 'confirmed' | 'executed' | 'failed' | 'skipped';
  result?: any;
  confirmationData?: any;
  retryCount: number;
  maxRetries: number;
}

/**
 * WorkflowCacheService - Redis-based workflow state management
 * 
 * Provides fast, reliable workflow state management using Redis cache
 * with automatic cleanup and TTL strategies.
 */
export class WorkflowCacheService extends BaseService {
  private cacheService: CacheService | null = null;
  
  // TTL Strategy
  private readonly WORKFLOW_TTL = 3600;        // 1 hour - active workflows
  private readonly COMPLETED_TTL = 86400;       // 24 hours - completed workflows  
  private readonly PENDING_CONFIRMATION_TTL = 1800;  // 30 minutes - pending confirmations
  private readonly SESSION_CONTEXT_TTL = 1800;      // 30 minutes - session context

  constructor() {
    super('workflowCacheService');
  }

  protected async onInitialize(): Promise<void> {
    try {
      this.cacheService = getService<CacheService>('cacheService') || null;
      
      if (!this.cacheService) {
        throw new Error('CacheService is required but not available');
      }

      EnhancedLogger.debug('WorkflowCacheService initialized', {
        correlationId: `workflow-cache-init-${Date.now()}`,
        operation: 'workflow_cache_init',
        metadata: {
          service: 'workflowCacheService',
          hasCacheService: !!this.cacheService,
          ttlStrategy: {
            activeWorkflow: this.WORKFLOW_TTL,
            completedWorkflow: this.COMPLETED_TTL,
            pendingConfirmation: this.PENDING_CONFIRMATION_TTL,
            sessionContext: this.SESSION_CONTEXT_TTL
          }
        }
      });
    } catch (error) {
      EnhancedLogger.error('Failed to initialize WorkflowCacheService', error as Error, {
        correlationId: `workflow-cache-init-error-${Date.now()}`,
        operation: 'workflow_cache_init_error',
        metadata: { service: 'workflowCacheService' }
      });
      throw error;
    }
  }

  /**
   * Create a new workflow in cache
   */
  async createWorkflow(workflow: WorkflowState): Promise<void> {
    if (!this.cacheService) {
      throw new Error('CacheService not available');
    }

    try {
      const key = this.generateWorkflowKey(workflow.workflowId);
      await this.cacheService.set(key, workflow, this.WORKFLOW_TTL);
      
      // Add to session's active workflows list
      await this.addToSessionActiveWorkflows(workflow.sessionId, workflow.workflowId);
      
      EnhancedLogger.debug('Workflow created in cache', {
        correlationId: `workflow-create-${Date.now()}`,
        operation: 'workflow_create',
        metadata: {
          workflowId: workflow.workflowId,
          sessionId: workflow.sessionId,
          totalSteps: workflow.totalSteps,
          ttl: this.WORKFLOW_TTL
        }
      });
    } catch (error) {
      EnhancedLogger.error('Failed to create workflow in cache', error as Error, {
        correlationId: `workflow-create-error-${Date.now()}`,
        operation: 'workflow_create_error',
        metadata: { workflowId: workflow.workflowId }
      });
      throw error;
    }
  }

  /**
   * Get workflow with fallback
   */
  async getWorkflow(workflowId: string): Promise<WorkflowState | null> {
    if (!this.cacheService) {
      return null;
    }

    try {
      const key = this.generateWorkflowKey(workflowId);
      const workflow = await this.cacheService.get<WorkflowState>(key);
      
      if (workflow) {
        EnhancedLogger.debug('Workflow retrieved from cache', {
          correlationId: `workflow-get-${Date.now()}`,
          operation: 'workflow_get',
          metadata: {
            workflowId,
            status: workflow.status,
            currentStep: workflow.currentStep,
            totalSteps: workflow.totalSteps
          }
        });
      }
      
      return workflow;
    } catch (error) {
      EnhancedLogger.error('Failed to get workflow from cache', error as Error, {
        correlationId: `workflow-get-error-${Date.now()}`,
        operation: 'workflow_get_error',
        metadata: { workflowId }
      });
      return null;
    }
  }

  /**
   * Update workflow state
   */
  async updateWorkflow(workflowId: string, updates: Partial<WorkflowState>): Promise<void> {
    if (!this.cacheService) {
      throw new Error('CacheService not available');
    }

    try {
      const workflow = await this.getWorkflow(workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }
      
      const updatedWorkflow = { 
        ...workflow, 
        ...updates, 
        lastActivity: new Date() 
      };
      
      const key = this.generateWorkflowKey(workflowId);
      await this.cacheService.set(key, updatedWorkflow, this.WORKFLOW_TTL);
      
      EnhancedLogger.debug('Workflow updated in cache', {
        correlationId: `workflow-update-${Date.now()}`,
        operation: 'workflow_update',
        metadata: {
          workflowId,
          updates: Object.keys(updates),
          status: updatedWorkflow.status
        }
      });
    } catch (error) {
      EnhancedLogger.error('Failed to update workflow in cache', error as Error, {
        correlationId: `workflow-update-error-${Date.now()}`,
        operation: 'workflow_update_error',
        metadata: { workflowId }
      });
      throw error;
    }
  }

  /**
   * Get all active workflows for a session
   */
  async getActiveWorkflows(sessionId: string): Promise<WorkflowState[]> {
    if (!this.cacheService) {
      return [];
    }

    try {
      const activeWorkflowIds = await this.cacheService.get<string[]>(
        this.generateSessionKey(sessionId)
      ) || [];
      
      const workflows: WorkflowState[] = [];
      for (const workflowId of activeWorkflowIds) {
        const workflow = await this.getWorkflow(workflowId);
        if (workflow && workflow.status === 'active') {
          workflows.push(workflow);
        }
      }
      
      EnhancedLogger.debug('Active workflows retrieved', {
        correlationId: `workflow-active-${Date.now()}`,
        operation: 'workflow_get_active',
        metadata: {
          sessionId,
          activeCount: workflows.length,
          workflowIds: workflows.map(w => w.workflowId)
        }
      });
      
      return workflows;
    } catch (error) {
      EnhancedLogger.error('Failed to get active workflows', error as Error, {
        correlationId: `workflow-active-error-${Date.now()}`,
        operation: 'workflow_get_active_error',
        metadata: { sessionId }
      });
      return [];
    }
  }

  /**
   * Handle workflow completion
   */
  async completeWorkflow(workflowId: string): Promise<void> {
    if (!this.cacheService) {
      throw new Error('CacheService not available');
    }

    try {
      const workflow = await this.getWorkflow(workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }
      
      // Update status
      await this.updateWorkflow(workflowId, { 
        status: 'completed',
        lastActivity: new Date()
      });
      
      // Remove from active workflows
      await this.removeFromSessionActiveWorkflows(workflow.sessionId, workflowId);
      
      // Set longer TTL for completed workflow (for potential resume)
      const key = this.generateWorkflowKey(workflowId);
      await this.cacheService.set(key, { ...workflow, status: 'completed' }, this.COMPLETED_TTL);
      
      EnhancedLogger.debug('Workflow completed', {
        correlationId: `workflow-complete-${Date.now()}`,
        operation: 'workflow_complete',
        metadata: {
          workflowId,
          sessionId: workflow.sessionId,
          totalSteps: workflow.totalSteps,
          completedSteps: workflow.completedSteps.length
        }
      });
    } catch (error) {
      EnhancedLogger.error('Failed to complete workflow', error as Error, {
        correlationId: `workflow-complete-error-${Date.now()}`,
        operation: 'workflow_complete_error',
        metadata: { workflowId }
      });
      throw error;
    }
  }

  /**
   * Cancel workflow
   */
  async cancelWorkflow(workflowId: string): Promise<void> {
    if (!this.cacheService) {
      throw new Error('CacheService not available');
    }

    try {
      const workflow = await this.getWorkflow(workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }
      
      // Update status
      await this.updateWorkflow(workflowId, { 
        status: 'cancelled',
        lastActivity: new Date()
      });
      
      // Remove from active workflows
      await this.removeFromSessionActiveWorkflows(workflow.sessionId, workflowId);
      
      EnhancedLogger.debug('Workflow cancelled', {
        correlationId: `workflow-cancel-${Date.now()}`,
        operation: 'workflow_cancel',
        metadata: {
          workflowId,
          sessionId: workflow.sessionId
        }
      });
    } catch (error) {
      EnhancedLogger.error('Failed to cancel workflow', error as Error, {
        correlationId: `workflow-cancel-error-${Date.now()}`,
        operation: 'workflow_cancel_error',
        metadata: { workflowId }
      });
      throw error;
    }
  }

  /**
   * Generate workflow cache key
   */
  private generateWorkflowKey(workflowId: string): string {
    return `workflow:${workflowId}`;
  }

  /**
   * Generate session cache key
   */
  private generateSessionKey(sessionId: string): string {
    return `session:${sessionId}:active_workflows`;
  }

  /**
   * Add workflow to session's active workflows list
   */
  private async addToSessionActiveWorkflows(sessionId: string, workflowId: string): Promise<void> {
    if (!this.cacheService) return;

    try {
      const sessionKey = this.generateSessionKey(sessionId);
      const activeWorkflows = await this.cacheService.get<string[]>(sessionKey) || [];
      
      if (!activeWorkflows.includes(workflowId)) {
        activeWorkflows.push(workflowId);
        await this.cacheService.set(sessionKey, activeWorkflows, this.SESSION_CONTEXT_TTL);
      }
    } catch (error) {
      EnhancedLogger.error('Failed to add workflow to session active workflows', error as Error, {
        correlationId: `workflow-session-add-error-${Date.now()}`,
        operation: 'workflow_session_add_error',
        metadata: { sessionId, workflowId }
      });
    }
  }

  /**
   * Remove workflow from session's active workflows list
   */
  private async removeFromSessionActiveWorkflows(sessionId: string, workflowId: string): Promise<void> {
    if (!this.cacheService) return;

    try {
      const sessionKey = this.generateSessionKey(sessionId);
      const activeWorkflows = await this.cacheService.get<string[]>(sessionKey) || [];
      
      const updatedWorkflows = activeWorkflows.filter(id => id !== workflowId);
      await this.cacheService.set(sessionKey, updatedWorkflows, this.SESSION_CONTEXT_TTL);
    } catch (error) {
      EnhancedLogger.error('Failed to remove workflow from session active workflows', error as Error, {
        correlationId: `workflow-session-remove-error-${Date.now()}`,
        operation: 'workflow_session_remove_error',
        metadata: { sessionId, workflowId }
      });
    }
  }

  /**
   * Cleanup resources
   */
  protected async onDestroy(): Promise<void> {
    // Cleanup any resources if needed
    EnhancedLogger.debug('WorkflowCacheService destroyed', {
      correlationId: `workflow-cache-destroy-${Date.now()}`,
      operation: 'workflow_cache_destroy',
      metadata: { service: 'workflowCacheService' }
    });
  }
  getHealth(): { healthy: boolean; details?: any } {
    return {
      healthy: this.isReady() && !!this.cacheService,
      details: {
        service: 'workflowCacheService',
        hasCacheService: !!this.cacheService,
        ttlStrategy: {
          activeWorkflow: this.WORKFLOW_TTL,
          completedWorkflow: this.COMPLETED_TTL,
          pendingConfirmation: this.PENDING_CONFIRMATION_TTL,
          sessionContext: this.SESSION_CONTEXT_TTL
        }
      }
    };
  }
}
