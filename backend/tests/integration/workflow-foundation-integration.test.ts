import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { WorkflowCacheService, WorkflowState, WorkflowStep } from '../../src/services/workflow-cache.service';
import { IntentAnalysisService, IntentAnalysis } from '../../src/services/intent-analysis.service';
import { MasterAgent } from '../../src/agents/master.agent';
import { serviceManager } from '../../src/services/service-manager';
import { initializeAllCoreServices } from '../../src/services/service-initialization';
import { EnhancedLogger } from '../../src/utils/enhanced-logger';

describe('Workflow Foundation Integration Tests', () => {
  let workflowCacheService: WorkflowCacheService;
  let intentAnalysisService: IntentAnalysisService;
  let masterAgent: MasterAgent;

  beforeAll(async () => {
    // Initialize all services
    await initializeAllCoreServices();
    
    // Get service instances
    workflowCacheService = serviceManager.getService<WorkflowCacheService>('workflowCacheService')!;
    intentAnalysisService = serviceManager.getService<IntentAnalysisService>('intentAnalysisService')!;
    masterAgent = new MasterAgent();
  });

  afterAll(async () => {
    // Cleanup
    masterAgent.cleanup();
    await serviceManager.shutdownAllServices();
  });

  beforeEach(() => {
    // Clear any existing workflows before each test
    // Note: In a real test environment, you'd want to use test-specific Redis instances
  });

  describe('WorkflowCacheService', () => {
    it('should create and retrieve workflow state', async () => {
      const testWorkflow: WorkflowState = {
        workflowId: 'test-workflow-1',
        sessionId: 'test-session-1',
        userId: 'test-user-1',
        status: 'active',
        currentStep: 0,
        totalSteps: 2,
        plan: [
          {
            stepId: 'step_1',
            stepNumber: 1,
            description: 'Test step 1',
            toolCall: {
              name: 'testAgent',
              parameters: { test: 'value1' }
            },
            status: 'pending',
            retryCount: 0,
            maxRetries: 3
          },
          {
            stepId: 'step_2',
            stepNumber: 2,
            description: 'Test step 2',
            toolCall: {
              name: 'testAgent',
              parameters: { test: 'value2' }
            },
            status: 'pending',
            retryCount: 0,
            maxRetries: 3
          }
        ],
        completedSteps: [],
        pendingStep: null,
        context: {
          originalRequest: 'Test workflow request',
          userIntent: 'test_intent',
          gatheredData: {}
        },
        createdAt: new Date(),
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 3600000)
      };

      // Create workflow
      await workflowCacheService.createWorkflow(testWorkflow);

      // Retrieve workflow
      const retrievedWorkflow = await workflowCacheService.getWorkflow('test-workflow-1');
      
      expect(retrievedWorkflow).toBeDefined();
      expect(retrievedWorkflow?.workflowId).toBe('test-workflow-1');
      expect(retrievedWorkflow?.sessionId).toBe('test-session-1');
      expect(retrievedWorkflow?.status).toBe('active');
      expect(retrievedWorkflow?.totalSteps).toBe(2);
    });

    it('should update workflow state', async () => {
      const workflowId = 'test-workflow-update';
      const sessionId = 'test-session-update';
      
      const testWorkflow: WorkflowState = {
        workflowId,
        sessionId,
        status: 'active',
        currentStep: 0,
        totalSteps: 1,
        plan: [{
          stepId: 'step_1',
          stepNumber: 1,
          description: 'Test step',
          toolCall: {
            name: 'testAgent',
            parameters: { test: 'value' }
          },
          status: 'pending',
          retryCount: 0,
          maxRetries: 3
        }],
        completedSteps: [],
        pendingStep: null,
        context: {
          originalRequest: 'Test request',
          userIntent: 'test_intent',
          gatheredData: {}
        },
        createdAt: new Date(),
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 3600000)
      };

      // Create workflow
      await workflowCacheService.createWorkflow(testWorkflow);

      // Update workflow
      await workflowCacheService.updateWorkflow(workflowId, {
        currentStep: 1,
        status: 'paused'
      });

      // Verify update
      const updatedWorkflow = await workflowCacheService.getWorkflow(workflowId);
      expect(updatedWorkflow?.currentStep).toBe(1);
      expect(updatedWorkflow?.status).toBe('paused');
    });

    it('should get active workflows for session', async () => {
      const sessionId = 'test-session-active';
      
      const testWorkflow1: WorkflowState = {
        workflowId: 'test-workflow-active-1',
        sessionId,
        status: 'active',
        currentStep: 0,
        totalSteps: 1,
        plan: [{
          stepId: 'step_1',
          stepNumber: 1,
          description: 'Test step',
          toolCall: {
            name: 'testAgent',
            parameters: { test: 'value' }
          },
          status: 'pending',
          retryCount: 0,
          maxRetries: 3
        }],
        completedSteps: [],
        pendingStep: null,
        context: {
          originalRequest: 'Test request 1',
          userIntent: 'test_intent',
          gatheredData: {}
        },
        createdAt: new Date(),
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 3600000)
      };

      const testWorkflow2: WorkflowState = {
        workflowId: 'test-workflow-active-2',
        sessionId,
        status: 'completed',
        currentStep: 1,
        totalSteps: 1,
        plan: [{
          stepId: 'step_1',
          stepNumber: 1,
          description: 'Test step',
          toolCall: {
            name: 'testAgent',
            parameters: { test: 'value' }
          },
          status: 'executed',
          retryCount: 0,
          maxRetries: 3
        }],
        completedSteps: [],
        pendingStep: null,
        context: {
          originalRequest: 'Test request 2',
          userIntent: 'test_intent',
          gatheredData: {}
        },
        createdAt: new Date(),
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 3600000)
      };

      // Create workflows
      await workflowCacheService.createWorkflow(testWorkflow1);
      await workflowCacheService.createWorkflow(testWorkflow2);

      // Get active workflows
      const activeWorkflows = await workflowCacheService.getActiveWorkflows(sessionId);
      
      expect(activeWorkflows).toHaveLength(1);
      expect(activeWorkflows[0].workflowId).toBe('test-workflow-active-1');
      expect(activeWorkflows[0].status).toBe('active');
    });

    it('should complete workflow', async () => {
      const workflowId = 'test-workflow-complete';
      const sessionId = 'test-session-complete';
      
      const testWorkflow: WorkflowState = {
        workflowId,
        sessionId,
        status: 'active',
        currentStep: 1,
        totalSteps: 1,
        plan: [{
          stepId: 'step_1',
          stepNumber: 1,
          description: 'Test step',
          toolCall: {
            name: 'testAgent',
            parameters: { test: 'value' }
          },
          status: 'executed',
          retryCount: 0,
          maxRetries: 3
        }],
        completedSteps: [],
        pendingStep: null,
        context: {
          originalRequest: 'Test request',
          userIntent: 'test_intent',
          gatheredData: {}
        },
        createdAt: new Date(),
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 3600000)
      };

      // Create workflow
      await workflowCacheService.createWorkflow(testWorkflow);

      // Complete workflow
      await workflowCacheService.completeWorkflow(workflowId);

      // Verify completion
      const completedWorkflow = await workflowCacheService.getWorkflow(workflowId);
      expect(completedWorkflow?.status).toBe('completed');

      // Verify it's not in active workflows
      const activeWorkflows = await workflowCacheService.getActiveWorkflows(sessionId);
      expect(activeWorkflows).toHaveLength(0);
    });

    it('should cancel workflow', async () => {
      const workflowId = 'test-workflow-cancel';
      const sessionId = 'test-session-cancel';
      
      const testWorkflow: WorkflowState = {
        workflowId,
        sessionId,
        status: 'active',
        currentStep: 0,
        totalSteps: 1,
        plan: [{
          stepId: 'step_1',
          stepNumber: 1,
          description: 'Test step',
          toolCall: {
            name: 'testAgent',
            parameters: { test: 'value' }
          },
          status: 'pending',
          retryCount: 0,
          maxRetries: 3
        }],
        completedSteps: [],
        pendingStep: null,
        context: {
          originalRequest: 'Test request',
          userIntent: 'test_intent',
          gatheredData: {}
        },
        createdAt: new Date(),
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 3600000)
      };

      // Create workflow
      await workflowCacheService.createWorkflow(testWorkflow);

      // Cancel workflow
      await workflowCacheService.cancelWorkflow(workflowId);

      // Verify cancellation
      const cancelledWorkflow = await workflowCacheService.getWorkflow(workflowId);
      expect(cancelledWorkflow?.status).toBe('cancelled');

      // Verify it's not in active workflows
      const activeWorkflows = await workflowCacheService.getActiveWorkflows(sessionId);
      expect(activeWorkflows).toHaveLength(0);
    });
  });

  describe('IntentAnalysisService', () => {
    it('should analyze email search intent', async () => {
      const userInput = 'Find the email about the project proposal from last month';
      
      const analysis = await intentAnalysisService.analyzeIntent(userInput);
      
      expect(analysis).toBeDefined();
      expect(analysis.intent).toBeDefined();
      expect(analysis.entities).toBeDefined();
      expect(analysis.confidence).toBeGreaterThan(0);
      expect(analysis.plan).toBeDefined();
      expect(analysis.naturalLanguageDescription).toBeDefined();
      
      // Should have a plan with steps
      expect(analysis.plan.length).toBeGreaterThan(0);
      expect(analysis.plan[0].stepNumber).toBe(1);
      expect(analysis.plan[0].toolCall).toBeDefined();
    });

    it('should analyze meeting scheduling intent', async () => {
      const userInput = 'Schedule a meeting with John and Sarah next Tuesday at 2pm';
      
      const analysis = await intentAnalysisService.analyzeIntent(userInput);
      
      expect(analysis).toBeDefined();
      expect(analysis.intent).toBeDefined();
      expect(analysis.entities).toBeDefined();
      expect(analysis.confidence).toBeGreaterThan(0);
      expect(analysis.plan).toBeDefined();
      
      // Should have a plan with multiple steps
      expect(analysis.plan.length).toBeGreaterThan(1);
    });

    it('should create execution plan from intent', async () => {
      const userInput = 'Find contact information for John Smith';
      
      const analysis = await intentAnalysisService.analyzeIntent(userInput);
      const executionPlan = await intentAnalysisService.createExecutionPlan(analysis);
      
      expect(executionPlan).toBeDefined();
      expect(executionPlan.length).toBeGreaterThan(0);
      
      // Each step should have required fields
      executionPlan.forEach((step, index) => {
        expect(step.stepId).toBeDefined();
        expect(step.stepNumber).toBe(index + 1);
        expect(step.description).toBeDefined();
        expect(step.toolCall).toBeDefined();
        expect(step.toolCall.name).toBeDefined();
        expect(step.toolCall.parameters).toBeDefined();
        expect(step.status).toBe('pending');
        expect(step.retryCount).toBe(0);
        expect(step.maxRetries).toBe(3);
      });
    });

    it('should generate natural language description', async () => {
      const plan: WorkflowStep[] = [
        {
          stepId: 'step_1',
          stepNumber: 1,
          description: 'Search for emails',
          toolCall: {
            name: 'emailAgent',
            parameters: { operation: 'search' }
          },
          status: 'pending',
          retryCount: 0,
          maxRetries: 3
        },
        {
          stepId: 'step_2',
          stepNumber: 2,
          description: 'Analyze results',
          toolCall: {
            name: 'thinkAgent',
            parameters: { query: 'Analyze results' }
          },
          status: 'pending',
          retryCount: 0,
          maxRetries: 3
        }
      ];
      
      const description = await intentAnalysisService.generateNaturalLanguageDescription(plan);
      
      expect(description).toBeDefined();
      expect(description).toContain('1. Search for emails');
      expect(description).toContain('2. Analyze results');
    });

    it('should get available templates', async () => {
      const templates = intentAnalysisService.getAvailableTemplates();
      
      expect(templates).toBeDefined();
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
      
      // Should include common templates
      expect(templates).toContain('email_search');
      expect(templates).toContain('meeting_scheduling');
      expect(templates).toContain('contact_lookup');
      expect(templates).toContain('calendar_query');
    });
  });

  describe('MasterAgent Workflow Integration', () => {
    it('should handle workflow-aware processing', async () => {
      const userInput = 'Find the email about the project proposal';
      const sessionId = 'test-session-master-agent';
      const userId = 'test-user-master-agent';
      
      // Process user input with workflow-aware MasterAgent
      const response = await masterAgent.processUserInput(userInput, sessionId, userId);
      
      expect(response).toBeDefined();
      expect(response.message).toBeDefined();
      expect(response.executionMetadata).toBeDefined();
      
      // Should have workflow-related metadata
      expect(response.executionMetadata?.workflowAction).toBeDefined();
    });

    it('should handle workflow interruption', async () => {
      const sessionId = 'test-session-interruption';
      const userId = 'test-user-interruption';
      
      // First, create an active workflow
      const testWorkflow: WorkflowState = {
        workflowId: 'test-workflow-interruption',
        sessionId,
        userId,
        status: 'active',
        currentStep: 0,
        totalSteps: 2,
        plan: [
          {
            stepId: 'step_1',
            stepNumber: 1,
            description: 'Search for emails',
            toolCall: {
              name: 'emailAgent',
              parameters: { operation: 'search' }
            },
            status: 'pending',
            retryCount: 0,
            maxRetries: 3
          },
          {
            stepId: 'step_2',
            stepNumber: 2,
            description: 'Analyze results',
            toolCall: {
              name: 'thinkAgent',
              parameters: { query: 'Analyze results' }
            },
            status: 'pending',
            retryCount: 0,
            maxRetries: 3
          }
        ],
        completedSteps: [],
        pendingStep: null,
        context: {
          originalRequest: 'Find emails about project',
          userIntent: 'email_search',
          gatheredData: {}
        },
        createdAt: new Date(),
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 3600000)
      };
      
      await workflowCacheService.createWorkflow(testWorkflow);
      
      // Now process a new input that should trigger workflow interruption handling
      const newInput = 'Actually, cancel that search';
      const response = await masterAgent.processUserInput(newInput, sessionId, userId);
      
      expect(response).toBeDefined();
      expect(response.message).toBeDefined();
      expect(response.executionMetadata?.workflowAction).toBeDefined();
    });
  });

  describe('Service Health Checks', () => {
    it('should have healthy WorkflowCacheService', () => {
      const health = workflowCacheService.getHealth();
      
      expect(health.healthy).toBe(true);
      expect(health.details).toBeDefined();
      expect(health.details?.service).toBe('workflowCacheService');
      expect(health.details?.hasCacheService).toBe(true);
    });

    it('should have healthy IntentAnalysisService', () => {
      const health = intentAnalysisService.getHealth();
      
      expect(health.healthy).toBe(true);
      expect(health.details).toBeDefined();
      expect(health.details?.service).toBe('intentAnalysisService');
      expect(health.details?.hasOpenAIService).toBe(true);
    });
  });
});
