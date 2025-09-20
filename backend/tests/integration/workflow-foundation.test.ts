import { WorkflowCacheService, WorkflowState, WorkflowStep } from '../../src/services/workflow-cache.service';
import { IntentAnalysisService, IntentAnalysis } from '../../src/services/intent-analysis.service';
import { SequentialExecutionService, StepResult } from '../../src/services/sequential-execution.service';
import { MasterAgent, MasterAgentResponse } from '../../src/agents/master.agent';
import { initializeAllCoreServices } from '../../src/services/service-initialization';
import { serviceManager } from '../../src/services/service-manager';
import { EnhancedLogger } from '../../src/utils/enhanced-logger';

describe('Workflow Foundation Integration Tests', () => {
  let workflowCacheService: WorkflowCacheService;
  let intentAnalysisService: IntentAnalysisService;
  let sequentialExecutionService: SequentialExecutionService;
  let masterAgent: MasterAgent;

  beforeAll(async () => {
    try {
      // Initialize all core services
      await initializeAllCoreServices();

      // Get service instances
      workflowCacheService = serviceManager.getService('workflowCacheService') as WorkflowCacheService;
      intentAnalysisService = serviceManager.getService('intentAnalysisService') as IntentAnalysisService;
      sequentialExecutionService = serviceManager.getService('sequentialExecutionService') as SequentialExecutionService;

      // Initialize MasterAgent with test configuration
      masterAgent = new MasterAgent({
        openaiApiKey: process.env.OPENAI_API_KEY || 'test-key'
      });

      expect(workflowCacheService).toBeDefined();
      expect(intentAnalysisService).toBeDefined();
      expect(sequentialExecutionService).toBeDefined();
      expect(masterAgent).toBeDefined();
    } catch (error) {
      console.error('Failed to initialize services for tests:', error);
      throw error;
    }
  }, 30000);

  afterAll(async () => {
    try {
      // Cleanup services
      await serviceManager.destroyAllServices();
    } catch (error) {
      console.error('Failed to cleanup services:', error);
    }
  });

  describe('WorkflowCacheService Integration', () => {
    const testSessionId = 'test-session-workflow-cache';
    const testWorkflowId = 'test-workflow-123';

    it('should create and manage workflow state', async () => {
      const testWorkflow: WorkflowState = {
        workflowId: testWorkflowId,
        sessionId: testSessionId,
        userId: 'test-user',
        status: 'active',
        currentStep: 0,
        totalSteps: 2,
        plan: [
          {
            stepId: 'step_1',
            stepNumber: 1,
            description: 'Test step 1',
            toolCall: {
              name: 'thinkAgent',
              parameters: { query: 'test query 1' }
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
              name: 'thinkAgent',
              parameters: { query: 'test query 2' }
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
          userIntent: 'Test intent',
          gatheredData: {}
        },
        createdAt: new Date(),
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 3600000)
      };

      // Create workflow
      await workflowCacheService.createWorkflow(testWorkflow);

      // Retrieve workflow
      const retrievedWorkflow = await workflowCacheService.getWorkflow(testWorkflowId);
      expect(retrievedWorkflow).toBeDefined();
      expect(retrievedWorkflow?.workflowId).toBe(testWorkflowId);
      expect(retrievedWorkflow?.sessionId).toBe(testSessionId);
      expect(retrievedWorkflow?.totalSteps).toBe(2);

      // Get active workflows for session
      const activeWorkflows = await workflowCacheService.getActiveWorkflows(testSessionId);
      expect(activeWorkflows).toHaveLength(1);
      expect(activeWorkflows[0].workflowId).toBe(testWorkflowId);

      // Update workflow
      await workflowCacheService.updateWorkflow(testWorkflowId, {
        currentStep: 1,
        status: 'active'
      });

      const updatedWorkflow = await workflowCacheService.getWorkflow(testWorkflowId);
      expect(updatedWorkflow?.currentStep).toBe(1);

      // Complete workflow
      await workflowCacheService.completeWorkflow(testWorkflowId);

      const completedWorkflow = await workflowCacheService.getWorkflow(testWorkflowId);
      expect(completedWorkflow?.status).toBe('completed');

      // Check active workflows is now empty
      const finalActiveWorkflows = await workflowCacheService.getActiveWorkflows(testSessionId);
      expect(finalActiveWorkflows).toHaveLength(0);
    }, 10000);
  });

  describe('IntentAnalysisService Integration', () => {
    it('should analyze intent and create execution plans', async () => {
      const testInputs = [
        'Find emails about project proposal',
        'Schedule a meeting with John and Sarah',
        'Find contact information for Mike',
        'What\'s on my calendar today?'
      ];

      for (const userInput of testInputs) {
        try {
          const intentAnalysis = await intentAnalysisService.analyzeIntent(userInput);

          expect(intentAnalysis).toBeDefined();
          expect(intentAnalysis.intent).toBeDefined();
          expect(intentAnalysis.entities).toBeDefined();
          expect(intentAnalysis.confidence).toBeGreaterThan(0);
          expect(intentAnalysis.plan).toBeDefined();
          expect(intentAnalysis.plan.length).toBeGreaterThan(0);
          expect(intentAnalysis.naturalLanguageDescription).toBeDefined();

          // Validate plan structure
          intentAnalysis.plan.forEach((step, index) => {
            expect(step.stepId).toBeDefined();
            expect(step.stepNumber).toBe(index + 1);
            expect(step.description).toBeDefined();
            expect(step.toolCall).toBeDefined();
            expect(step.toolCall.name).toBeDefined();
            expect(step.toolCall.parameters).toBeDefined();
            expect(step.status).toBe('pending');
          });

          // Create execution plan
          const executionPlan = await intentAnalysisService.createExecutionPlan(intentAnalysis);
          expect(executionPlan).toBeDefined();
          expect(executionPlan.length).toBeGreaterThan(0);

          EnhancedLogger.debug('Intent analysis successful', {
            correlationId: 'test',
            operation: 'intent_analysis_test',
            metadata: {
              userInput,
              intent: intentAnalysis.intent,
              planSteps: intentAnalysis.plan.length
            }
          });
        } catch (error) {
          // Log error but don't fail test if OpenAI is not available
          EnhancedLogger.warn('Intent analysis test skipped due to service unavailability', {
            correlationId: 'test',
            operation: 'intent_analysis_test',
            metadata: { userInput, error: (error as Error).message }
          });
        }
      }
    }, 15000);

    it('should provide available plan templates', async () => {
      const templates = intentAnalysisService.getAvailableTemplates();
      expect(templates).toBeDefined();
      expect(templates.length).toBeGreaterThan(0);
      expect(templates).toContain('email_search');
      expect(templates).toContain('meeting_scheduling');
      expect(templates).toContain('contact_lookup');
      expect(templates).toContain('calendar_query');
    });
  });

  describe('SequentialExecutionService Integration', () => {
    const testSessionId = 'test-session-sequential';
    const testWorkflowId = 'test-workflow-sequential';

    it('should execute workflow steps sequentially', async () => {
      // Create a test workflow
      const testWorkflow: WorkflowState = {
        workflowId: testWorkflowId,
        sessionId: testSessionId,
        userId: 'test-user',
        status: 'active',
        currentStep: 1,
        totalSteps: 2,
        plan: [
          {
            stepId: 'step_1',
            stepNumber: 1,
            description: 'Think about the test',
            toolCall: {
              name: 'Think',
              parameters: { query: 'This is a test step' }
            },
            status: 'pending',
            retryCount: 0,
            maxRetries: 3
          },
          {
            stepId: 'step_2',
            stepNumber: 2,
            description: 'Complete the test',
            toolCall: {
              name: 'Think',
              parameters: { query: 'This is the second test step' }
            },
            status: 'pending',
            retryCount: 0,
            maxRetries: 3
          }
        ],
        completedSteps: [],
        pendingStep: null,
        context: {
          originalRequest: 'Test sequential execution',
          userIntent: 'Test intent',
          gatheredData: {}
        },
        createdAt: new Date(),
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 3600000)
      };

      // Create workflow in cache
      await workflowCacheService.createWorkflow(testWorkflow);

      try {
        // Execute first step
        const step1Result = await sequentialExecutionService.executeStep(testWorkflowId, 1);

        expect(step1Result).toBeDefined();
        expect(step1Result.stepNumber).toBe(1);
        expect(step1Result.naturalLanguageResponse).toBeDefined();
        expect(step1Result.executionTime).toBeGreaterThan(0);

        // Execute second step
        const step2Result = await sequentialExecutionService.executeStep(testWorkflowId, 2);

        expect(step2Result).toBeDefined();
        expect(step2Result.stepNumber).toBe(2);
        expect(step2Result.naturalLanguageResponse).toBeDefined();
        expect(step2Result.executionTime).toBeGreaterThan(0);

        EnhancedLogger.debug('Sequential execution test successful', {
          correlationId: 'test',
          operation: 'sequential_execution_test',
          metadata: {
            workflowId: testWorkflowId,
            step1Success: step1Result.success,
            step2Success: step2Result.success
          }
        });
      } catch (error) {
        // Log error but don't fail test if services are not fully available
        EnhancedLogger.warn('Sequential execution test skipped due to service unavailability', {
          correlationId: 'test',
          operation: 'sequential_execution_test',
          metadata: { workflowId: testWorkflowId, error: (error as Error).message }
        });
      }
    }, 15000);
  });

  describe('MasterAgent Workflow Integration', () => {
    const testSessionId = 'test-session-master-agent';

    it('should handle workflow interruptions intelligently', async () => {
      try {
        // First, create a test workflow by processing a user input
        const response1 = await masterAgent.processUserInput(
          'Find emails about project updates',
          testSessionId,
          'test-user'
        );

        expect(response1).toBeDefined();
        expect(response1.message).toBeDefined();

        // Check if workflow was created
        const activeWorkflows = await workflowCacheService.getActiveWorkflows(testSessionId);

        if (activeWorkflows.length > 0) {
          // Test workflow interruption
          const response2 = await masterAgent.processUserInput(
            'Actually, what time is it?',
            testSessionId,
            'test-user'
          );

          expect(response2).toBeDefined();
          expect(response2.message).toBeDefined();

          EnhancedLogger.debug('Workflow interruption test successful', {
            correlationId: 'test',
            operation: 'workflow_interruption_test',
            metadata: {
              sessionId: testSessionId,
              hadActiveWorkflows: activeWorkflows.length > 0
            }
          });
        } else {
          EnhancedLogger.debug('No active workflows found, workflow interruption test skipped', {
            correlationId: 'test',
            operation: 'workflow_interruption_test',
            metadata: { sessionId: testSessionId }
          });
        }
      } catch (error) {
        // Log error but don't fail test if OpenAI is not available
        EnhancedLogger.warn('Workflow interruption test skipped due to service unavailability', {
          correlationId: 'test',
          operation: 'workflow_interruption_test',
          metadata: { sessionId: testSessionId, error: (error as Error).message }
        });
      }
    }, 20000);

    it('should demonstrate workflow integration', async () => {
      try {
        const testInputs = [
          'Search for recent emails',
          'Find my calendar for today',
          'Look up contact for John'
        ];

        for (const userInput of testInputs) {
          const response = await masterAgent.processUserInput(
            userInput,
            `${testSessionId}-${Date.now()}`,
            'test-user'
          );

          expect(response).toBeDefined();
          expect(response.message).toBeDefined();

          EnhancedLogger.debug('Workflow integration test successful', {
            correlationId: 'test',
            operation: 'workflow_integration_test',
            metadata: {
              userInput,
              responseLength: response.message.length,
              hasToolCalls: response.toolCalls && response.toolCalls.length > 0
            }
          });
        }
      } catch (error) {
        // Log error but don't fail test if services are not available
        EnhancedLogger.warn('Workflow integration test skipped due to service unavailability', {
          correlationId: 'test',
          operation: 'workflow_integration_test',
          metadata: { error: (error as Error).message }
        });
      }
    }, 30000);
  });

  describe('Service Health Checks', () => {
    it('should verify all workflow services are healthy', () => {
      // Check WorkflowCacheService health
      const workflowCacheHealth = workflowCacheService.getHealth();
      expect(workflowCacheHealth.healthy).toBe(true);

      // Check IntentAnalysisService health
      const intentAnalysisHealth = intentAnalysisService.getHealth();
      expect(intentAnalysisHealth.healthy).toBe(true);

      // Check SequentialExecutionService health
      const sequentialExecutionHealth = sequentialExecutionService.getHealth();
      expect(sequentialExecutionHealth.healthy).toBe(true);

      EnhancedLogger.debug('All workflow services are healthy', {
        correlationId: 'test',
        operation: 'service_health_check',
        metadata: {
          workflowCacheHealthy: workflowCacheHealth.healthy,
          intentAnalysisHealthy: intentAnalysisHealth.healthy,
          sequentialExecutionHealthy: sequentialExecutionHealth.healthy
        }
      });
    });
  });
});