import { AIAgent, AIAgentWithPreview, AIPlanningConfig, AIPlan, AIPlanStep, AITool } from '../../../src/framework/ai-agent';
import { ToolExecutionContext, AgentConfig } from '../../../src/types/tools';
import { OpenAIService } from '../../../src/services/openai.service';
import { getService } from '../../../src/services/service-manager';
import logger from '../../../src/utils/logger';

// Mock dependencies
jest.mock('../../../src/services/service-manager');
jest.mock('../../../src/utils/logger');

const mockGetService = getService as jest.MockedFunction<typeof getService>;
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => mockLogger)
};

// Test AIAgent implementation
interface TestParams {
  query: string;
  testParam?: string;
}

interface TestResult {
  success: boolean;
  data?: any;
  aiPlanExecuted?: boolean;
  executionSummary?: string;
}

class TestAIAgent extends AIAgent<TestParams, TestResult> {
  public testToolRegistry = this.toolRegistry;
  public testPlanCache = this.planCache;

  constructor(config?: Partial<AgentConfig & { aiPlanning?: AIPlanningConfig }>) {
    super({
      name: 'testAIAgent',
      description: 'Test AI agent for unit tests',
      enabled: true,
      timeout: 10000,
      retryCount: 1,
      ...config
    });
  }

  protected async executeManually(params: TestParams, context: ToolExecutionContext): Promise<TestResult> {
    return {
      success: true,
      data: 'manual_execution',
      aiPlanExecuted: false
    };
  }

  protected buildFinalResult(
    summary: any,
    successfulResults: any[],
    failedResults: any[],
    params: TestParams,
    context: ToolExecutionContext
  ): TestResult {
    return {
      success: successfulResults.length > 0,
      data: successfulResults,
      aiPlanExecuted: true,
      executionSummary: `Executed ${successfulResults.length} steps successfully`
    };
  }

  // Expose protected methods for testing
  public async testGenerateExecutionPlan(params: TestParams, context: ToolExecutionContext) {
    return this.generateExecutionPlan(params, context);
  }

  public async testExecutePlan(plan: AIPlan, params: TestParams, context: ToolExecutionContext) {
    return this.executePlan(plan, params, context);
  }

  public async testExecuteCustomTool(toolName: string, parameters: any, context: ToolExecutionContext) {
    return this.executeCustomTool(toolName, parameters, context);
  }

  public testCanUseAIPlanning(params: TestParams): boolean {
    return this.canUseAIPlanning(params);
  }

  public testValidateAndEnhancePlan(plan: AIPlan, params: TestParams, context: ToolExecutionContext) {
    return this.validateAndEnhancePlan(plan, params, context);
  }

  public registerTestTool(tool: AITool): void {
    this.registerTool(tool);
  }
}

// Test AIAgentWithPreview implementation
class TestAIAgentWithPreview extends AIAgentWithPreview<TestParams, TestResult> {
  constructor() {
    super({
      name: 'testAIAgentWithPreview',
      description: 'Test AI agent with preview for unit tests',
      enabled: true
    });
  }

  protected async executeManually(params: TestParams, context: ToolExecutionContext): Promise<TestResult> {
    return {
      success: true,
      data: 'manual_execution_with_preview'
    };
  }

  protected buildFinalResult(summary: any, successfulResults: any[], failedResults: any[]): TestResult {
    return {
      success: true,
      data: 'preview_result'
    };
  }

  protected getActionType(params: TestParams): string {
    return 'TEST_ACTION';
  }
}

describe('AIAgent Framework', () => {
  let testAgent: TestAIAgent;
  let mockOpenAIService: jest.Mocked<OpenAIService>;
  let testContext: ToolExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock logger
    (logger as any) = mockLogger;
    mockLogger.child.mockReturnValue(mockLogger);

    // Setup mock OpenAI service
    mockOpenAIService = {
      generateStructuredData: jest.fn(),
      generateText: jest.fn(),
      createChatCompletion: jest.fn(),
      isReady: jest.fn(() => true)
    } as any;

    mockGetService.mockImplementation((serviceName: string) => {
      if (serviceName === 'openaiService') {
        return mockOpenAIService;
      }
      return undefined;
    });

    testAgent = new TestAIAgent();
    testContext = {
      sessionId: 'test-session-123',
      userId: 'test-user-456'
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('AIAgent Base Functionality', () => {
    it('should initialize with default AI configuration', () => {
      const config = testAgent.getAIConfig();
      
      expect(config.enableAIPlanning).toBe(true);
      expect(config.maxPlanningSteps).toBe(10);
      expect(config.planningTimeout).toBe(30000);
      expect(config.cachePlans).toBe(true);
      expect(config.planningTemperature).toBe(0.1);
      expect(config.planningMaxTokens).toBe(2000);
    });

    it('should allow custom AI configuration', () => {
      const customAgent = new TestAIAgent({
        aiPlanning: {
          enableAIPlanning: false,
          maxPlanningSteps: 5,
          planningTimeout: 15000
        }
      });

      const config = customAgent.getAIConfig();
      
      expect(config.enableAIPlanning).toBe(false);
      expect(config.maxPlanningSteps).toBe(5);
      expect(config.planningTimeout).toBe(15000);
      expect(config.cachePlans).toBe(true); // Should keep defaults for unspecified values
    });

    it('should disable AI planning when OpenAI service is not available', () => {
      mockGetService.mockReturnValue(undefined);
      const agent = new TestAIAgent();
      
      const config = agent.getAIConfig();
      expect(config.enableAIPlanning).toBe(false);
    });

    it('should register default tools', () => {
      const tools = testAgent.getRegisteredTools();
      
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('think');
      expect(tools[0].description).toContain('Analyze and reason');
      expect(tools[0].requiresConfirmation).toBe(false);
    });

    it('should allow registering custom tools', () => {
      const customTool: AITool = {
        name: 'customTool',
        description: 'A custom test tool',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          }
        },
        estimatedExecutionTime: 1000,
        requiresConfirmation: true,
        capabilities: ['testing'],
        limitations: ['test-only']
      };

      testAgent.registerTestTool(customTool);
      const tools = testAgent.getRegisteredTools();
      
      expect(tools).toHaveLength(2);
      expect(tools.find(t => t.name === 'customTool')).toBeDefined();
    });

    it('should update AI configuration', () => {
      testAgent.updateAIConfig({
        planningTemperature: 0.5,
        maxPlanningSteps: 15
      });

      const config = testAgent.getAIConfig();
      expect(config.planningTemperature).toBe(0.5);
      expect(config.maxPlanningSteps).toBe(15);
      expect(config.enableAIPlanning).toBe(true); // Unchanged
    });
  });

  describe('AI Planning', () => {
    const mockPlan: AIPlan = {
      id: 'test-plan-123',
      query: 'test query',
      steps: [
        {
          id: 'step1',
          tool: 'think',
          description: 'Analyze the request',
          parameters: { query: 'test analysis' },
          estimatedTime: 2000,
          requiresConfirmation: false
        },
        {
          id: 'step2',
          tool: 'customTool',
          description: 'Execute custom action',
          parameters: { input: 'test input' },
          dependencies: ['step1'],
          estimatedTime: 3000,
          requiresConfirmation: false
        }
      ],
      totalEstimatedTime: 5000,
      requiresConfirmation: false,
      confidence: 0.8,
      reasoning: 'Test reasoning',
      fallbackStrategy: 'manual'
    };

    it('should generate execution plan successfully', async () => {
      mockOpenAIService.generateStructuredData.mockResolvedValue(mockPlan);

      const result = await testAgent.testGenerateExecutionPlan(
        { query: 'test query' },
        testContext
      );

      expect(result.success).toBe(true);
      expect(result.plan).toBeDefined();
      expect(result.plan!.id).toBe('test-plan-123');
      expect(result.plan!.steps).toHaveLength(2);
    });

    it('should handle plan generation failure', async () => {
      mockOpenAIService.generateStructuredData.mockRejectedValue(new Error('OpenAI error'));

      const result = await testAgent.testGenerateExecutionPlan(
        { query: 'test query' },
        testContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('OpenAI error');
      expect(result.fallbackToManual).toBe(true);
    });

    it('should use cached plans when available', async () => {
      mockOpenAIService.generateStructuredData.mockResolvedValue(mockPlan);

      // First call should generate plan
      const firstResult = await testAgent.testGenerateExecutionPlan(
        { query: 'test query' },
        testContext
      );

      expect(mockOpenAIService.generateStructuredData).toHaveBeenCalledTimes(1);

      // Second call with same params should use cache
      const secondResult = await testAgent.testGenerateExecutionPlan(
        { query: 'test query' },
        testContext
      );

      expect(mockOpenAIService.generateStructuredData).toHaveBeenCalledTimes(1); // Still only 1
      expect(secondResult.success).toBe(true);
      expect(secondResult.plan!.id).toBe('test-plan-123');
    });

    it('should validate and enhance generated plans', () => {
      const incomplePlan = {
        steps: [
          {
            id: 'step1',
            tool: 'think',
            description: 'Test step',
            parameters: {}
          }
        ]
      } as any;

      const enhanced = testAgent.testValidateAndEnhancePlan(
        incomplePlan,
        { query: 'test' },
        testContext
      );

      expect(enhanced.id).toBeDefined();
      expect(enhanced.confidence).toBeGreaterThanOrEqual(0);
      expect(enhanced.confidence).toBeLessThanOrEqual(1);
      expect(enhanced.totalEstimatedTime).toBeGreaterThan(0);
      expect(enhanced.requiresConfirmation).toBeDefined();
    });

    it('should throw error for invalid plan structure', () => {
      const invalidPlan = { id: 'test' } as any;

      expect(() => {
        testAgent.testValidateAndEnhancePlan(invalidPlan, { query: 'test' }, testContext);
      }).toThrow('Invalid plan structure');
    });
  });

  describe('Plan Execution', () => {
    const mockPlan: AIPlan = {
      id: 'test-plan-123',
      query: 'test query',
      steps: [
        {
          id: 'step1',
          tool: 'think',
          description: 'Analyze the request',
          parameters: { query: 'test analysis' },
          estimatedTime: 1000,
          requiresConfirmation: false
        }
      ],
      totalEstimatedTime: 1000,
      requiresConfirmation: false,
      confidence: 0.8
    };

    it('should execute plan steps successfully', async () => {
      mockOpenAIService.generateText.mockResolvedValue('Test analysis result');

      const results = await testAgent.testExecutePlan(mockPlan, { query: 'test' }, testContext);

      expect(results.size).toBe(1);
      expect(results.get('step1')).toBeDefined();
      expect(results.get('step1').success).toBe(true);
      expect(results.get('step1').analysis).toBe('Test analysis result');
    });

    it('should handle step execution failure', async () => {
      const planWithFailingStep: AIPlan = {
        ...mockPlan,
        steps: [
          {
            id: 'step1',
            tool: 'nonexistent',
            description: 'This will fail',
            parameters: {},
            requiresConfirmation: false
          }
        ]
      };

      const results = await testAgent.testExecutePlan(planWithFailingStep, { query: 'test' }, testContext);

      expect(results.size).toBe(1);
      expect(results.get('step1')).toBeDefined();
      expect(results.get('step1').success).toBe(false);
      expect(results.get('step1').error).toContain('Unknown tool');
    });

    it('should respect step dependencies', async () => {
      const planWithDependencies: AIPlan = {
        ...mockPlan,
        steps: [
          {
            id: 'step1',
            tool: 'think',
            description: 'First step',
            parameters: { query: 'first' },
            requiresConfirmation: false
          },
          {
            id: 'step2',
            tool: 'think',
            description: 'Second step',
            parameters: { query: 'second' },
            dependencies: ['step1'],
            requiresConfirmation: false
          }
        ]
      };

      mockOpenAIService.generateText.mockResolvedValue('Analysis result');

      const results = await testAgent.testExecutePlan(planWithDependencies, { query: 'test' }, testContext);

      expect(results.size).toBe(2);
      expect(results.get('step1')).toBeDefined();
      expect(results.get('step2')).toBeDefined();
    });

    it('should handle circular dependencies', async () => {
      const planWithCircularDeps: AIPlan = {
        ...mockPlan,
        steps: [
          {
            id: 'step1',
            tool: 'think',
            description: 'First step',
            parameters: { query: 'first' },
            dependencies: ['step2'],
            requiresConfirmation: false
          },
          {
            id: 'step2',
            tool: 'think',
            description: 'Second step',
            parameters: { query: 'second' },
            dependencies: ['step1'],
            requiresConfirmation: false
          }
        ]
      };

      await expect(
        testAgent.testExecutePlan(planWithCircularDeps, { query: 'test' }, testContext)
      ).rejects.toThrow(/dependency/i);
    });
  });

  describe('Tool Execution', () => {
    it('should execute built-in think tool', async () => {
      mockOpenAIService.generateText.mockResolvedValue('Thoughtful analysis');

      const result = await testAgent.testExecuteCustomTool(
        'think',
        { query: 'What should I think about?' },
        testContext
      );

      expect(result.success).toBe(true);
      expect(result.analysis).toBe('Thoughtful analysis');
      expect(result.reasoning).toBe('Thoughtful analysis');
    });

    it('should handle unknown tools', async () => {
      const result = await testAgent.testExecuteCustomTool(
        'unknownTool',
        { input: 'test' },
        testContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool: unknownTool');
    });

    it('should handle think tool failure', async () => {
      mockOpenAIService.generateText.mockRejectedValue(new Error('OpenAI failure'));

      const result = await testAgent.testExecuteCustomTool(
        'think',
        { query: 'test' },
        testContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('OpenAI failure');
    });
  });

  describe('processQuery Method', () => {
    it('should use AI planning when enabled and suitable', async () => {
      const mockPlan: AIPlan = {
        id: 'test-plan',
        query: 'complex query',
        steps: [
          {
            id: 'step1',
            tool: 'think',
            description: 'Analyze request',
            parameters: { query: 'complex query' },
            requiresConfirmation: false
          }
        ],
        totalEstimatedTime: 2000,
        requiresConfirmation: false,
        confidence: 0.9
      };

      mockOpenAIService.generateStructuredData.mockResolvedValue(mockPlan);
      mockOpenAIService.generateText.mockResolvedValue('AI analysis result');

      // Override canUseAIPlanning to return true
      jest.spyOn(testAgent, 'testCanUseAIPlanning').mockReturnValue(true);

      const result = await testAgent.execute({ query: 'complex query' }, testContext);

      expect(result.success).toBe(true);
      expect(result.result.aiPlanExecuted).toBe(true);
      expect(mockOpenAIService.generateStructuredData).toHaveBeenCalled();
    });

    it('should fall back to manual execution when AI planning fails', async () => {
      mockOpenAIService.generateStructuredData.mockRejectedValue(new Error('Planning failed'));

      const result = await testAgent.execute({ query: 'test query' }, testContext);

      expect(result.success).toBe(true);
      expect(result.result.aiPlanExecuted).toBe(false);
      expect(result.result.data).toBe('manual_execution');
    });

    it('should use manual execution when AI planning is disabled', async () => {
      testAgent.updateAIConfig({ enableAIPlanning: false });

      const result = await testAgent.execute({ query: 'test query' }, testContext);

      expect(result.success).toBe(true);
      expect(result.result.aiPlanExecuted).toBe(false);
      expect(result.result.data).toBe('manual_execution');
      expect(mockOpenAIService.generateStructuredData).not.toHaveBeenCalled();
    });

    it('should use manual execution when query is not suitable for AI planning', async () => {
      jest.spyOn(testAgent, 'testCanUseAIPlanning').mockReturnValue(false);

      const result = await testAgent.execute({ query: 'simple query' }, testContext);

      expect(result.success).toBe(true);
      expect(result.result.aiPlanExecuted).toBe(false);
      expect(result.result.data).toBe('manual_execution');
      expect(mockOpenAIService.generateStructuredData).not.toHaveBeenCalled();
    });
  });

  describe('Cache Management', () => {
    it('should clear plan cache', () => {
      // Simulate cached plan
      const cacheKey = testAgent['generateCacheKey']({ query: 'test' });
      testAgent.testPlanCache.set(cacheKey, {} as AIPlan);

      expect(testAgent.getPlanCacheStats().size).toBe(1);

      testAgent.clearPlanCache();

      expect(testAgent.getPlanCacheStats().size).toBe(0);
    });

    it('should provide cache statistics', () => {
      const plan: AIPlan = {
        id: 'cached-plan',
        query: 'test',
        steps: [],
        totalEstimatedTime: 0,
        requiresConfirmation: false,
        confidence: 1
      };

      const cacheKey = testAgent['generateCacheKey']({ query: 'test' });
      testAgent.testPlanCache.set(cacheKey, plan);

      const stats = testAgent.getPlanCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.keys).toContain(cacheKey);
    });
  });

  describe('Utility Methods', () => {
    it('should generate consistent cache keys', () => {
      const key1 = testAgent['generateCacheKey']({ query: 'test query' });
      const key2 = testAgent['generateCacheKey']({ query: 'test query' });
      const key3 = testAgent['generateCacheKey']({ query: 'different query' });

      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
    });

    it('should calculate plan execution time', () => {
      const steps: AIPlanStep[] = [
        {
          id: 'step1',
          tool: 'think',
          description: 'Test',
          parameters: {},
          estimatedTime: 1000,
          requiresConfirmation: false
        },
        {
          id: 'step2',
          tool: 'custom',
          description: 'Test',
          parameters: {},
          requiresConfirmation: false
          // No estimatedTime - should use default
        }
      ];

      const totalTime = testAgent['estimatePlanTime'](steps);
      expect(totalTime).toBe(6000); // 1000 + 5000 (default)
    });

    it('should detect if plan requires confirmation', () => {
      const stepsWithConfirmation: AIPlanStep[] = [
        {
          id: 'step1',
          tool: 'think',
          description: 'Test',
          parameters: {},
          requiresConfirmation: true
        }
      ];

      const stepsWithoutConfirmation: AIPlanStep[] = [
        {
          id: 'step1',
          tool: 'think',
          description: 'Test',
          parameters: {},
          requiresConfirmation: false
        }
      ];

      expect(testAgent['planRequiresConfirmation'](stepsWithConfirmation)).toBe(true);
      expect(testAgent['planRequiresConfirmation'](stepsWithoutConfirmation)).toBe(false);
    });

    it('should identify built-in tools', () => {
      expect(testAgent['isBuiltinTool']('think')).toBe(true);
      expect(testAgent['isBuiltinTool']('customTool')).toBe(false);
    });

    it('should resolve step parameters with context', () => {
      const step: AIPlanStep = {
        id: 'step2',
        tool: 'test',
        description: 'Test step',
        parameters: {
          input: '{{step1.output}}',
          static: 'value'
        },
        requiresConfirmation: false
      };

      const previousResults = new Map([
        ['step1', { success: true, output: 'resolved_value' }]
      ]);

      const resolved = testAgent['resolveStepParameters'](step, previousResults, { query: 'test' });

      expect(resolved.input).toBe('resolved_value');
      expect(resolved.static).toBe('value');
    });
  });
});

describe('AIAgentWithPreview', () => {
  let previewAgent: TestAIAgentWithPreview;
  let mockOpenAIService: jest.Mocked<OpenAIService>;
  let testContext: ToolExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockOpenAIService = {
      generateStructuredData: jest.fn(),
      generateText: jest.fn(),
      isReady: jest.fn(() => true)
    } as any;

    mockGetService.mockReturnValue(mockOpenAIService);

    previewAgent = new TestAIAgentWithPreview();
    testContext = {
      sessionId: 'test-session-123',
      userId: 'test-user-456'
    };
  });

  it('should generate preview from AI plan', async () => {
    const mockPlan: AIPlan = {
      id: 'preview-plan',
      query: 'test preview query',
      steps: [
        {
          id: 'step1',
          tool: 'think',
          description: 'Analyze the request',
          parameters: { query: 'test' },
          estimatedTime: 2000,
          requiresConfirmation: false
        }
      ],
      totalEstimatedTime: 2000,
      requiresConfirmation: true,
      confidence: 0.8
    };

    mockOpenAIService.generateStructuredData.mockResolvedValue(mockPlan);

    const result = await previewAgent.executePreview(
      { query: 'test preview query' },
      testContext
    );

    expect(result.success).toBe(true);
    expect(result.result.awaitingConfirmation).toBe(true);
    expect(result.result.preview).toBeDefined();
    expect(result.result.preview!.actionType).toBe('TEST_ACTION');
    expect(result.result.preview!.requiresConfirmation).toBe(true);
  });

  it('should handle preview generation failure', async () => {
    mockOpenAIService.generateStructuredData.mockRejectedValue(new Error('Preview failed'));

    const result = await previewAgent.executePreview(
      { query: 'test query' },
      testContext
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Preview failed');
  });

  it('should assess risk levels correctly', () => {
    const lowRiskPlan: AIPlan = {
      id: 'low-risk',
      query: 'simple query',
      steps: [{ id: 'step1', tool: 'think', description: 'Simple', parameters: {}, requiresConfirmation: false }],
      totalEstimatedTime: 1000,
      requiresConfirmation: false,
      confidence: 0.9
    };

    const highRiskPlan: AIPlan = {
      id: 'high-risk',
      query: 'complex query',
      steps: [
        { id: 'step1', tool: 'dangerous', description: 'Risky', parameters: {}, requiresConfirmation: true },
        { id: 'step2', tool: 'external', description: 'External', parameters: {}, requiresConfirmation: false },
        { id: 'step3', tool: 'another', description: 'More steps', parameters: {}, requiresConfirmation: false },
        { id: 'step4', tool: 'final', description: 'Even more', parameters: {}, requiresConfirmation: false }
      ],
      totalEstimatedTime: 10000,
      requiresConfirmation: true,
      confidence: 0.3
    };

    const lowRisk = previewAgent['assessRisk'](lowRiskPlan, { query: 'simple' });
    const highRisk = previewAgent['assessRisk'](highRiskPlan, { query: 'complex' });

    expect(lowRisk.level).toBe('low');
    expect(highRisk.level).toBe('high');
    expect(highRisk.reasons).toContain('AI confidence below 70%');
    expect(highRisk.reasons).toContain('Complex multi-step operation');
    expect(highRisk.reasons).toContain('Contains actions that require confirmation');
  });
});