import logger from '../utils/logger';

/**
 * Simple workflow state management (replaces complex WorkflowCacheService)
 */
export interface SimpleWorkflowState {
  workflowId: string;
  sessionId: string;
  status: 'active' | 'completed' | 'cancelled';
  currentStep: number;
  totalSteps: number;
  context: any;
  createdAt: Date;
  lastActivity: Date;
}

export interface SimpleWorkflowStep {
  stepId: string;
  stepNumber: number;
  description: string;
  status: 'pending' | 'completed' | 'failed';
  result?: any;
}

/**
 * WorkflowOrchestrator - Manages workflow state and execution tracking
 *
 * Extracted from MasterAgent to provide focused workflow management.
 * Uses simple in-memory state instead of complex caching systems.
 */
export class WorkflowOrchestrator {
  private workflows: Map<string, SimpleWorkflowState> = new Map();
  private sessionWorkflows: Map<string, string[]> = new Map(); // sessionId -> workflowIds[]
  private lastMemoryCheck: number = Date.now();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly maxWorkflows = 1000; // Maximum workflows to prevent memory bloat
  private readonly maxSessions = 500; // Maximum sessions to track

  /**
   * Create a new workflow
   */
  createWorkflow(workflow: SimpleWorkflowState): void {
    this.workflows.set(workflow.workflowId, workflow);

    // Track workflows by session
    const sessionWorkflows = this.sessionWorkflows.get(workflow.sessionId) || [];
    sessionWorkflows.push(workflow.workflowId);
    this.sessionWorkflows.set(workflow.sessionId, sessionWorkflows);

    logger.debug('Workflow created', {
      workflowId: workflow.workflowId,
      sessionId: workflow.sessionId,
      totalSteps: workflow.totalSteps
    });
  }

  /**
   * Update workflow state
   */
  updateWorkflow(workflowId: string, updates: Partial<SimpleWorkflowState>): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      logger.warn('Workflow not found for update', { workflowId });
      return false;
    }

    const updated = {
      ...workflow,
      ...updates,
      lastActivity: new Date()
    };

    this.workflows.set(workflowId, updated);

    logger.debug('Workflow updated', {
      workflowId,
      status: updated.status,
      currentStep: updated.currentStep
    });

    return true;
  }

  /**
   * Get workflow by ID
   */
  getWorkflow(workflowId: string): SimpleWorkflowState | null {
    return this.workflows.get(workflowId) || null;
  }

  /**
   * Get workflows for session
   */
  getSessionWorkflows(sessionId: string): SimpleWorkflowState[] {
    const workflowIds = this.sessionWorkflows.get(sessionId) || [];
    return workflowIds
      .map(id => this.workflows.get(id))
      .filter((workflow): workflow is SimpleWorkflowState => workflow !== undefined);
  }

  /**
   * Complete workflow
   */
  completeWorkflow(workflowId: string): boolean {
    return this.updateWorkflow(workflowId, {
      status: 'completed',
      currentStep: this.getWorkflow(workflowId)?.totalSteps || 0
    });
  }

  /**
   * Cancel workflow
   */
  cancelWorkflow(workflowId: string): boolean {
    return this.updateWorkflow(workflowId, { status: 'cancelled' });
  }

  /**
   * Start automatic cleanup process
   */
  startCleanup(): void {
    if (this.cleanupInterval) {
      return; // Already running
    }

    // Clean up every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldWorkflows();
    }, 5 * 60 * 1000);

    logger.debug('WorkflowOrchestrator cleanup started', {
      correlationId: `workflow-cleanup-start-${Date.now()}`,
      operation: 'cleanup_start'
    });
  }

  /**
   * Stop automatic cleanup process
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      
      logger.debug('WorkflowOrchestrator cleanup stopped', {
        correlationId: `workflow-cleanup-stop-${Date.now()}`,
        operation: 'cleanup_stop'
      });
    }
  }

  /**
   * Clean up old workflows (memory management)
   */
  cleanupOldWorkflows(): void {
    const now = Date.now();

    // Only check memory every 5 minutes
    if (now - this.lastMemoryCheck < 300000) {
      return;
    }

    const cutoffTime = new Date(now - 24 * 60 * 60 * 1000); // 24 hours ago
    let cleanedCount = 0;

    // First, clean up old/completed workflows
    for (const [workflowId, workflow] of this.workflows.entries()) {
      if (workflow.lastActivity < cutoffTime || workflow.status === 'completed') {
        // Remove from main map
        this.workflows.delete(workflowId);

        // Remove from session tracking
        const sessionWorkflows = this.sessionWorkflows.get(workflow.sessionId) || [];
        const updatedSessionWorkflows = sessionWorkflows.filter(id => id !== workflowId);

        if (updatedSessionWorkflows.length === 0) {
          this.sessionWorkflows.delete(workflow.sessionId);
        } else {
          this.sessionWorkflows.set(workflow.sessionId, updatedSessionWorkflows);
        }

        cleanedCount++;
      }
    }

    // If still over limits, remove oldest workflows
    if (this.workflows.size > this.maxWorkflows) {
      const sortedWorkflows = Array.from(this.workflows.entries())
        .sort((a, b) => a[1].lastActivity.getTime() - b[1].lastActivity.getTime());
      
      const toRemove = sortedWorkflows.slice(0, this.workflows.size - this.maxWorkflows);
      for (const [workflowId, workflow] of toRemove) {
        this.workflows.delete(workflowId);
        
        // Remove from session tracking
        const sessionWorkflows = this.sessionWorkflows.get(workflow.sessionId) || [];
        const updatedSessionWorkflows = sessionWorkflows.filter(id => id !== workflowId);
        
        if (updatedSessionWorkflows.length === 0) {
          this.sessionWorkflows.delete(workflow.sessionId);
        } else {
          this.sessionWorkflows.set(workflow.sessionId, updatedSessionWorkflows);
        }
        
        cleanedCount++;
      }
    }

    // Clean up old sessions if over limit
    if (this.sessionWorkflows.size > this.maxSessions) {
      const sortedSessions = Array.from(this.sessionWorkflows.entries())
        .sort((a, b) => {
          const aWorkflows = a[1].map(id => this.workflows.get(id)).filter(Boolean);
          const bWorkflows = b[1].map(id => this.workflows.get(id)).filter(Boolean);
          const aLastActivity = Math.max(...aWorkflows.map(w => w!.lastActivity.getTime()));
          const bLastActivity = Math.max(...bWorkflows.map(w => w!.lastActivity.getTime()));
          return aLastActivity - bLastActivity;
        });
      
      const toRemove = sortedSessions.slice(0, this.sessionWorkflows.size - this.maxSessions);
      for (const [sessionId] of toRemove) {
        this.sessionWorkflows.delete(sessionId);
        cleanedCount++;
      }
    }

    this.lastMemoryCheck = now;

    if (cleanedCount > 0) {
      logger.debug('Workflow cleanup completed', {
        correlationId: `workflow-cleanup-${Date.now()}`,
        operation: 'cleanup_completed',
        metadata: {
          cleanedWorkflows: cleanedCount,
          remainingWorkflows: this.workflows.size,
          remainingSessions: this.sessionWorkflows.size
        }
      });
    }
  }

  /**
   * Get workflow statistics
   */
  getStats(): {
    totalWorkflows: number;
    activeSessions: number;
    activeWorkflows: number;
    completedWorkflows: number;
    memoryUsage: {
      workflows: number;
      sessions: number;
      maxWorkflows: number;
      maxSessions: number;
    };
  } {
    const workflows = Array.from(this.workflows.values());

    return {
      totalWorkflows: workflows.length,
      activeSessions: this.sessionWorkflows.size,
      activeWorkflows: workflows.filter(w => w.status === 'active').length,
      completedWorkflows: workflows.filter(w => w.status === 'completed').length,
      memoryUsage: {
        workflows: this.workflows.size,
        sessions: this.sessionWorkflows.size,
        maxWorkflows: this.maxWorkflows,
        maxSessions: this.maxSessions
      }
    };
  }

  /**
   * Destroy the orchestrator and clean up resources
   */
  destroy(): void {
    this.stopCleanup();
    this.workflows.clear();
    this.sessionWorkflows.clear();
    
    logger.debug('WorkflowOrchestrator destroyed', {
      correlationId: `workflow-destroy-${Date.now()}`,
      operation: 'orchestrator_destroy'
    });
  }

  /**
   * Generate workflow ID
   */
  generateWorkflowId(sessionId: string): string {
    return `workflow-${sessionId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
}