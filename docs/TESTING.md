# 🧪 Testing Strategy - AI Development Guide

## 🎯 **Testing Vision**

This document establishes the **comprehensive testing strategy** for the AI assistant platform. The testing approach validates both functional correctness and architectural integrity, ensuring the system maintains quality as it evolves with AI-assisted development.

## 🏗️ **Testing Architecture Overview**

### **Testing Pyramid**
```
                    ┌─────────────────┐
                    │   E2E Tests     │ ← Few, critical user journeys
                    │   (AI Behavior) │
                    └─────────────────┘
                           │
                    ┌─────────────────┐
                    │ Integration     │ ← Service interactions
                    │   Tests         │
                    └─────────────────┘
                           │
                    ┌─────────────────┐
                    │   Unit Tests    │ ← Individual components
                    │   (Fast)        │
                    └─────────────────┘
```

### **Testing Principles**
1. **Architecture Validation**: Tests enforce architectural boundaries
2. **AI Behavior Testing**: Validate intelligent routing and decision-making
3. **Comprehensive Coverage**: 80% minimum coverage with 100% for critical paths
4. **Fast Feedback**: Unit tests run in under 1 second
5. **Realistic Scenarios**: Test real-world usage patterns

## 🧪 **Test Structure and Organization**

### **Test Directory Structure**
```
tests/
├── unit/                    # Unit tests for individual components
│   ├── agents/             # Agent unit tests
│   │   ├── master-agent.test.ts
│   │   ├── email-agent.test.ts
│   │   ├── contact-agent.test.ts
│   │   └── think-agent.test.ts
│   ├── services/           # Service unit tests
│   │   ├── auth.service.test.ts
│   │   ├── gmail.service.test.ts
│   │   ├── contact.service.test.ts
│   │   └── session.service.test.ts
│   ├── framework/          # Framework component tests
│   │   ├── base-agent.test.ts
│   │   ├── agent-factory.test.ts
│   │   └── service-manager.test.ts
│   ├── middleware/         # Middleware tests
│   ├── routes/             # Route handler tests
│   └── utils/              # Utility function tests
├── integration/            # Integration tests for service interactions
│   ├── service-integration.test.ts
│   ├── agent-workflow.test.ts
│   └── api-endpoints.test.ts
├── ai-behavior/           # AI behavior validation tests
│   ├── context-continuity/    # Conversation context tests
│   │   └── conversation-memory.test.ts
│   ├── decision-quality/      # Agent decision validation
│   │   └── routing-intelligence.test.ts
│   ├── error-recovery/        # Error handling tests
│   │   └── fallback-behavior.test.ts
│   ├── intent-recognition/    # Intent understanding tests
│   │   └── intent-understanding.test.ts
│   └── workflow-validation/   # Multi-agent workflow tests
│       └── agent-orchestration.test.ts
├── fixtures/               # Test data and mocks
│   ├── conversations/      # Sample conversation data
│   ├── error-cases/        # Error scenario data
│   └── user-scenarios/     # Real-world user scenarios
└── setup/                  # Test configuration and setup
    ├── setup.ts            # Jest configuration
    ├── test-helper.ts      # Common test utilities
    └── mocks/              # Mock implementations
```

### **Test File Naming Conventions**
```
# Unit Tests
component-name.test.ts          # Individual component tests
component-name.integration.test.ts  # Component integration tests

# AI Behavior Tests
behavior-type.test.ts           # Specific behavior validation
workflow-name.test.ts           # Workflow-specific tests

# Test Categories
describe('ComponentName', () => {
  describe('when performing operation', () => {
    it('should behave correctly', () => {
      // Test implementation
    });
  });
});
```

## 🔧 **Unit Testing Strategy**

### **1. Agent Unit Testing**

#### **Base Agent Testing Pattern**
```typescript
describe('BaseAgent Framework', () => {
  let testAgent: TestAgent;
  
  beforeEach(() => {
    testAgent = new TestAgent();
  });
  
  describe('execute method', () => {
    it('should follow template method pattern', async () => {
      // Arrange
      const params = { query: 'test query' };
      const context = createTestContext();
      
      // Act
      const result = await testAgent.execute(params, context);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.executionTime).toBeGreaterThan(0);
    });
    
    it('should handle errors gracefully', async () => {
      // Arrange
      const params = { query: 'error query' };
      const context = createTestContext();
      
      // Act
      const result = await testAgent.execute(params, context);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
    
    it('should call lifecycle hooks in correct order', async () => {
      // Arrange
      const beforeExecutionSpy = jest.spyOn(testAgent, 'beforeExecution');
      const afterExecutionSpy = jest.spyOn(testAgent, 'afterExecution');
      const params = { query: 'test query' };
      const context = createTestContext();
      
      // Act
      await testAgent.execute(params, context);
      
      // Assert
      expect(beforeExecutionSpy).toHaveBeenCalledBefore(afterExecutionSpy);
    });
  });
  
  describe('parameter validation', () => {
    it('should validate required parameters', () => {
      // Arrange
      const invalidParams = {};
      
      // Act & Assert
      expect(() => testAgent.execute(invalidParams, createTestContext()))
        .toThrow('Parameters are required');
    });
    
    it('should sanitize parameters for logging', () => {
      // Arrange
      const sensitiveParams = { 
        query: 'test query',
        password: 'secret123',
        accessToken: 'token123'
      };
      
      // Act
      const sanitized = testAgent.sanitizeForLogging(sensitiveParams);
      
      // Assert
      expect(sanitized.password).toBeUndefined();
      expect(sanitized.accessToken).toBeUndefined();
      expect(sanitized.query).toBe('test query');
    });
  });
});

// Test implementation of BaseAgent
class TestAgent extends BaseAgent<TestParams, TestResult> {
  constructor() {
    super({
      name: 'testAgent',
      description: 'Test agent for testing BaseAgent framework',
      enabled: true,
      timeout: 5000,
      retryCount: 1
    });
  }
  
  protected async processQuery(params: TestParams, context: ToolExecutionContext): Promise<TestResult> {
    if (params.query === 'error query') {
      throw new Error('Simulated error');
    }
    
    return { success: true, data: 'test result' };
  }
  
  protected sanitizeForLogging(params: TestParams): any {
    const { password, accessToken, ...safeParams } = params;
    return safeParams;
  }
}
```

#### **Specialized Agent Testing**
```typescript
describe('EmailAgent', () => {
  let emailAgent: EmailAgent;
  let mockGmailService: jest.Mocked<GmailService>;
  
  beforeEach(() => {
    mockGmailService = createMockGmailService();
    emailAgent = new EmailAgent();
  });
  
  describe('when processing email queries', () => {
    it('should send email with valid parameters', async () => {
      // Arrange
      const params: EmailAgentRequest = {
        query: 'Send email to john@example.com about meeting',
        accessToken: 'valid-token'
      };
      
      mockGmailService.sendEmail.mockResolvedValue({
        success: true,
        messageId: 'msg123',
        threadId: 'thread123'
      });
      
      // Act
      const result = await emailAgent.execute(params, createTestContext());
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.messageId).toBe('msg123');
      expect(mockGmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['john@example.com'],
          subject: 'meeting'
        }),
        'valid-token'
      );
    });
    
    it('should handle Gmail service errors gracefully', async () => {
      // Arrange
      const params: EmailAgentRequest = {
        query: 'Send email to invalid@example.com',
        accessToken: 'valid-token'
      };
      
      mockGmailService.sendEmail.mockRejectedValue(
        new Error('Gmail service unavailable')
      );
      
      // Act
      const result = await emailAgent.execute(params, createTestContext());
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Gmail service unavailable');
    });
  });
  
  describe('when determining email actions', () => {
    it('should correctly identify send email intent', () => {
      // Arrange
      const query = 'Send an email to john about the quarterly review';
      
      // Act
      const action = emailAgent.determineAction(query);
      
      // Assert
      expect(action.type).toBe('SEND_EMAIL');
      expect(action.params.recipient).toBe('john');
      expect(action.params.subject).toContain('quarterly review');
    });
    
    it('should identify reply email intent', () => {
      // Arrange
      const query = 'Reply to the last email saying I will attend';
      
      // Act
      const action = emailAgent.determineAction(query);
      
      // Assert
      expect(action.type).toBe('REPLY_EMAIL');
      expect(action.params.body).toContain('I will attend');
    });
  });
});
```

### **2. Service Unit Testing**

#### **Service Interface Testing**
```typescript
describe('Service Interface Compliance', () => {
  describe('AuthService', () => {
    let authService: AuthService;
    
    beforeEach(() => {
      authService = new AuthService();
    });
    
    it('should implement IService interface', () => {
      // Assert
      expect(authService).toHaveProperty('name');
      expect(authService).toHaveProperty('state');
      expect(typeof authService.initialize).toBe('function');
      expect(typeof authService.isReady).toBe('function');
      expect(typeof authService.destroy).toBe('function');
      expect(typeof authService.getHealth).toBe('function');
    });
    
    it('should have correct service name', () => {
      expect(authService.name).toBe('authService');
    });
    
    it('should start in INITIALIZING state', () => {
      expect(authService.state).toBe(ServiceState.INITIALIZING);
    });
  });
  
  describe('Service Lifecycle', () => {
    let service: TestService;
    
    beforeEach(() => {
      service = new TestService();
    });
    
    it('should transition through lifecycle states correctly', async () => {
      // Initial state
      expect(service.state).toBe(ServiceState.INITIALIZING);
      
      // Initialize
      await service.initialize();
      expect(service.state).toBe(ServiceState.READY);
      expect(service.isReady()).toBe(true);
      
      // Destroy
      await service.destroy();
      expect(service.state).toBe(ServiceState.DESTROYED);
      expect(service.isReady()).toBe(false);
    });
    
    it('should handle initialization errors gracefully', async () => {
      // Arrange
      const errorService = new ErrorTestService();
      
      // Act
      await expect(errorService.initialize()).rejects.toThrow('Initialization failed');
      
      // Assert
      expect(errorService.state).toBe(ServiceState.ERROR);
      expect(errorService.isReady()).toBe(false);
    });
  });
});

// Test service implementations
class TestService implements IService {
  readonly name = 'testService';
  private _state: ServiceState = ServiceState.INITIALIZING;
  
  get state(): ServiceState { return this._state; }
  
  async initialize(): Promise<void> {
    this._state = ServiceState.READY;
  }
  
  isReady(): boolean { return this._state === ServiceState.READY; }
  
  async destroy(): Promise<void> {
    this._state = ServiceState.DESTROYED;
  }
  
  getHealth(): { healthy: boolean; details?: any } {
    return { healthy: this._state === ServiceState.READY };
  }
}

class ErrorTestService implements IService {
  readonly name = 'errorTestService';
  private _state: ServiceState = ServiceState.INITIALIZING;
  
  get state(): ServiceState { return this._state; }
  
  async initialize(): Promise<void> {
    this._state = ServiceState.ERROR;
    throw new Error('Initialization failed');
  }
  
  isReady(): boolean { return this._state === ServiceState.READY; }
  
  async destroy(): Promise<void> {
    this._state = ServiceState.DESTROYED;
  }
  
  getHealth(): { healthy: boolean; details?: any } {
    return { healthy: this._state === ServiceState.READY };
  }
}
```

## 🔗 **Integration Testing Strategy**

### **1. Service Integration Testing**

#### **Service Registry Testing**
```typescript
describe('Service Integration', () => {
  let serviceManager: ServiceManager;
  
  beforeEach(async () => {
    serviceManager = ServiceManager.getInstance();
    await serviceManager.initializeAllServices();
  });
  
  afterEach(async () => {
    await serviceManager.shutdown();
  });
  
  describe('Service Dependencies', () => {
    it('should initialize services in correct dependency order', async () => {
      // Arrange
      const sessionService = serviceManager.getService<SessionService>('sessionService');
      const toolExecutorService = serviceManager.getService<ToolExecutorService>('toolExecutorService');
      const authService = serviceManager.getService<AuthService>('authService');
      
      // Assert
      expect(sessionService?.state).toBe(ServiceState.READY);
      expect(toolExecutorService?.state).toBe(ServiceState.READY);
      expect(authService?.state).toBe(ServiceState.READY);
      
      // Verify dependency order (sessionService should initialize before toolExecutorService)
      expect(sessionService?.state).toBe(ServiceState.READY);
    });
    
    it('should handle service initialization failures gracefully', async () => {
      // Arrange
      const failingService = new FailingService();
      serviceManager.registerService('failingService', failingService, {
        priority: 5,
        autoStart: true
      });
      
      // Act
      await serviceManager.initializeAllServices();
      
      // Assert
      const otherServices = serviceManager.getService<SessionService>('sessionService');
      expect(otherServices?.state).toBe(ServiceState.READY);
      
      // Failing service should be in error state but not block others
      expect(failingService.state).toBe(ServiceState.ERROR);
    });
  });
  
  describe('Service Communication', () => {
    it('should allow services to communicate through registry', async () => {
      // Arrange
      const gmailService = serviceManager.getService<GmailService>('gmailService');
      const authService = serviceManager.getService<AuthService>('authService');
      
      // Act & Assert
      expect(gmailService).toBeDefined();
      expect(authService).toBeDefined();
      
      // Verify GmailService can access AuthService
      expect(gmailService.authService).toBe(authService);
    });
  });
});
```

#### **Agent-Service Integration Testing**
```typescript
describe('Agent-Service Integration', () => {
  let emailAgent: EmailAgent;
  let gmailService: GmailService;
  let sessionService: SessionService;
  
  beforeEach(async () => {
    await initializeAllCoreServices();
    
    emailAgent = new EmailAgent();
    gmailService = getService<GmailService>('gmailService')!;
    sessionService = getService<SessionService>('sessionService')!;
  });
  
  describe('Email Workflow Integration', () => {
    it('should complete email workflow end-to-end', async () => {
      // Arrange
      const sessionId = 'test-session-123';
      const params: EmailAgentRequest = {
        query: 'Send email to test@example.com about integration test',
        accessToken: 'valid-token'
      };
      
      // Mock Gmail API response
      jest.spyOn(gmailService, 'sendEmail').mockResolvedValue({
        success: true,
        messageId: 'msg123',
        threadId: 'thread123'
      });
      
      // Act
      const result = await emailAgent.execute(params, {
        sessionId,
        userId: 'test-user'
      });
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.messageId).toBe('msg123');
      
      // Verify session was updated
      const session = sessionService.getOrCreateSession(sessionId);
      expect(session.conversationHistory).toHaveLength(1);
      expect(session.conversationHistory[0].type).toBe('agent_execution');
    });
  });
});
```

### **2. API Endpoint Integration Testing**

#### **Route Integration Testing**
```typescript
describe('API Endpoint Integration', () => {
  let app: Express;
  
  beforeAll(async () => {
    app = createTestApp();
    await initializeAllCoreServices();
  });
  
  describe('POST /api/assistant/command', () => {
    it('should process voice commands through complete pipeline', async () => {
      // Arrange
      const command = 'Send an email to john about the meeting';
      const sessionId = 'test-session-456';
      
      // Mock OpenAI service
      const openaiService = getService<OpenAIService>('openaiService')!;
      jest.spyOn(openaiService, 'generateToolCalls').mockResolvedValue({
        message: 'I will send an email to John about the meeting',
        toolCalls: [
          {
            name: 'emailAgent',
            parameters: { query: 'Send email to john about meeting' }
          }
        ]
      });
      
      // Act
      const response = await request(app)
        .post('/api/assistant/command')
        .send({
          command,
          sessionId
        })
        .expect(200);
      
      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('send an email to John');
      expect(response.body.toolCalls).toHaveLength(1);
      expect(response.body.toolCalls[0].name).toBe('emailAgent');
    });
    
    it('should handle authentication errors properly', async () => {
      // Arrange
      const command = 'Send an email to john';
      
      // Act & Assert
      await request(app)
        .post('/api/assistant/command')
        .send({ command })
        .expect(401);
    });
  });
  
  describe('GET /health', () => {
    it('should return comprehensive health status', async () => {
      // Act
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      // Assert
      expect(response.body.status).toBe('healthy');
      expect(response.body.services).toBeDefined();
      expect(response.body.agents).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
      
      // Verify all services are healthy
      const allServicesHealthy = response.body.services.every(
        (service: any) => service.healthy
      );
      expect(allServicesHealthy).toBe(true);
    });
  });
});

// Test app creation utility
function createTestApp(): Express {
  const app = express();
  
  app.use(express.json());
  app.use('/api/assistant', assistantRoutes);
  app.use('/health', healthRoutes);
  
  return app;
}
```

## 🧠 **AI Behavior Testing Strategy**

### **1. Context Continuity Testing**

#### **Conversation Memory Testing**
```typescript
describe('AI Behavior - Context Continuity', () => {
  let masterAgent: MasterAgent;
  let sessionService: SessionService;
  
  beforeEach(async () => {
    await initializeAllCoreServices();
    masterAgent = new MasterAgent();
    sessionService = getService<SessionService>('sessionService')!;
  });
  
  describe('Conversation Context', () => {
    it('should maintain context across multiple interactions', async () => {
      // Arrange
      const sessionId = 'context-test-session';
      
      // First interaction
      const firstResponse = await masterAgent.processUserInput(
        'Send an email to john about the quarterly review meeting',
        sessionId
      );
      
      // Verify first interaction
      expect(firstResponse.toolCalls).toContainEqual(
        expect.objectContaining({ name: 'emailAgent' })
      );
      
      // Second interaction referencing first
      const secondResponse = await masterAgent.processUserInput(
        'Actually, make it about the Q4 launch instead',
        sessionId
      );
      
      // Verify context was maintained
      expect(secondResponse.toolCalls).toContainEqual(
        expect.objectContaining({ name: 'emailAgent' })
      );
      
      // Verify session has conversation history
      const session = sessionService.getOrCreateSession(sessionId);
      expect(session.conversationHistory).toHaveLength(2);
    });
    
    it('should handle context window expiration', async () => {
      // Arrange
      const sessionId = 'expired-context-session';
      
      // Add old conversation entry
      const oldEntry: ConversationEntry = {
        id: 'old-entry',
        type: 'user_input',
        content: 'Old conversation',
        timestamp: new Date(Date.now() - 31 * 60 * 1000), // 31 minutes ago
        metadata: {}
      };
      
      sessionService.addConversationEntry(sessionId, oldEntry);
      
      // Act
      const response = await masterAgent.processUserInput(
        'What was our last conversation about?',
        sessionId
      );
      
      // Assert
      // Should not reference old context
      expect(response.message).not.toContain('Old conversation');
    });
  });
});
```

### **2. Decision Quality Testing**

#### **Routing Intelligence Testing**
```typescript
describe('AI Behavior - Decision Quality', () => {
  let masterAgent: MasterAgent;
  
  beforeEach(async () => {
    await initializeAllCoreServices();
    masterAgent = new MasterAgent();
  });
  
  describe('Tool Selection Intelligence', () => {
    it('should select appropriate tools for email operations', async () => {
      // Arrange
      const emailQueries = [
        'Send an email to john about the meeting',
        'Reply to the last email',
        'Draft an email to the team',
        'Search for emails from sarah'
      ];
      
      for (const query of emailQueries) {
        // Act
        const response = await masterAgent.processUserInput(query, 'test-session');
        
        // Assert
        expect(response.toolCalls).toContainEqual(
          expect.objectContaining({ name: 'emailAgent' })
        );
      }
    });
    
    it('should include contact lookup when names are mentioned', async () => {
      // Arrange
      const nameBasedQueries = [
        'Send an email to john about the meeting',
        'Schedule a meeting with sarah tomorrow',
        'Invite mike to the team call'
      ];
      
      for (const query of nameBasedQueries) {
        // Act
        const response = await masterAgent.processUserInput(query, 'test-session');
        
        // Assert
        expect(response.toolCalls).toContainEqual(
          expect.objectContaining({ name: 'contactAgent' })
        );
      }
    });
    
    it('should not include contact lookup for email addresses', async () => {
      // Arrange
      const emailAddressQueries = [
        'Send an email to john@example.com about the meeting',
        'Reply to test@company.com',
        'Forward the email to admin@domain.org'
      ];
      
      for (const query of emailAddressQueries) {
        // Act
        const response = await masterAgent.processUserInput(query, 'test-session');
        
        // Assert
        const hasContactAgent = response.toolCalls.some(
          tool => tool.name === 'contactAgent'
        );
        expect(hasContactAgent).toBe(false);
      }
    });
  });
  
  describe('Multi-Step Workflow Intelligence', () => {
    it('should orchestrate complex workflows correctly', async () => {
      // Arrange
      const complexQuery = 'Schedule a meeting with the engineering team for next Tuesday and send them the agenda';
      
      // Act
      const response = await masterAgent.processUserInput(complexQuery, 'test-session');
      
      // Assert
      // Should include multiple agents
      expect(response.toolCalls.length).toBeGreaterThan(2);
      
      // Should include contact lookup for team
      expect(response.toolCalls).toContainEqual(
        expect.objectContaining({ name: 'contactAgent' })
      );
      
      // Should include calendar agent for scheduling
      expect(response.toolCalls).toContainEqual(
        expect.objectContaining({ name: 'calendarAgent' })
      );
      
      // Should include email agent for agenda
      expect(response.toolCalls).toContainEqual(
        expect.objectContaining({ name: 'emailAgent' })
      );
      
      // Should include Think agent for verification
      expect(response.toolCalls).toContainEqual(
        expect.objectContaining({ name: 'Think' })
      );
    });
  });
});
```

### **3. Error Recovery Testing**

#### **Fallback Behavior Testing**
```typescript
describe('AI Behavior - Error Recovery', () => {
  let masterAgent: MasterAgent;
  
  beforeEach(async () => {
    await initializeAllCoreServices();
    masterAgent = new MasterAgent();
  });
  
  describe('OpenAI Fallback', () => {
    it('should fall back to rule-based routing when OpenAI fails', async () => {
      // Arrange
      const openaiService = getService<OpenAIService>('openaiService')!;
      jest.spyOn(openaiService, 'generateToolCalls').mockRejectedValue(
        new Error('OpenAI service unavailable')
      );
      
      // Act
      const response = await masterAgent.processUserInput(
        'Send an email to john about the meeting',
        'test-session'
      );
      
      // Assert
      // Should still provide a response
      expect(response.message).toBeDefined();
      expect(response.toolCalls).toBeDefined();
      
      // Should use rule-based routing
      expect(response.toolCalls).toContainEqual(
        expect.objectContaining({ name: 'emailAgent' })
      );
    });
    
    it('should maintain functionality during OpenAI outages', async () => {
      // Arrange
      const openaiService = getService<OpenAIService>('openaiService')!;
      jest.spyOn(openaiService, 'generateToolCalls').mockRejectedValue(
        new Error('OpenAI service unavailable')
      );
      
      const testQueries = [
        'Send an email to john about the meeting',
        'Find contact information for sarah',
        'What is the weather today?'
      ];
      
      for (const query of testQueries) {
        // Act
        const response = await masterAgent.processUserInput(query, 'test-session');
        
        // Assert
        expect(response.toolCalls).toBeDefined();
        expect(response.toolCalls.length).toBeGreaterThan(0);
      }
    });
  });
  
  describe('Agent Failure Recovery', () => {
    it('should handle individual agent failures gracefully', async () => {
      // Arrange
      const toolExecutor = getService<ToolExecutorService>('toolExecutorService')!;
      
      // Mock email agent to fail
      const emailAgent = AgentFactory.getAgent('emailAgent')!;
      jest.spyOn(emailAgent, 'execute').mockRejectedValue(
        new Error('Email service unavailable')
      );
      
      // Act
      const response = await masterAgent.processUserInput(
        'Send an email to john about the meeting',
        'test-session'
      );
      
      // Assert
      // Should still provide a response
      expect(response.message).toBeDefined();
      
      // Should include Think agent for analysis
      expect(response.toolCalls).toContainEqual(
        expect.objectContaining({ name: 'Think' })
      );
    });
  });
});
```

## 📊 **Test Data Management**

### **1. Test Fixtures**

#### **Conversation Fixtures**
```typescript
// fixtures/conversations/sample-conversations.ts
export const sampleConversations = {
  emailWorkflow: [
    {
      role: 'user',
      content: 'Send an email to john about the quarterly review meeting',
      timestamp: new Date('2024-01-15T10:00:00Z')
    },
    {
      role: 'assistant',
      content: 'I will send an email to John about the quarterly review meeting.',
      timestamp: new Date('2024-01-15T10:00:01Z'),
      toolCalls: [
        {
          name: 'contactAgent',
          parameters: { query: 'get contact information for john' }
        },
        {
          name: 'emailAgent',
          parameters: { query: 'send email to john about quarterly review meeting' }
        }
      ]
    }
  ],
  
  calendarWorkflow: [
    {
      role: 'user',
      content: 'Schedule a meeting with the team for tomorrow at 2pm',
      timestamp: new Date('2024-01-15T11:00:00Z')
    },
    {
      role: 'assistant',
      content: 'I will schedule a meeting with the team for tomorrow at 2pm.',
      timestamp: new Date('2024-01-15T11:00:01Z'),
      toolCalls: [
        {
          name: 'contactAgent',
          parameters: { query: 'get team contact information' }
        },
        {
          name: 'calendarAgent',
          parameters: { query: 'schedule team meeting tomorrow 2pm' }
        }
      ]
    }
  ]
};
```

#### **Error Case Fixtures**
```typescript
// fixtures/error-cases/authentication-errors.ts
export const authenticationErrors = {
  expiredToken: {
    error: 'Token expired',
    statusCode: 401,
    details: {
      tokenType: 'access_token',
      expiresAt: new Date('2024-01-15T09:00:00Z'),
      currentTime: new Date('2024-01-15T10:00:00Z')
    }
  },
  
  invalidScope: {
    error: 'Insufficient permissions',
    statusCode: 403,
    details: {
      requiredScope: 'https://www.googleapis.com/auth/gmail.send',
      currentScopes: ['https://www.googleapis.com/auth/gmail.readonly']
    }
  },
  
  malformedToken: {
    error: 'Invalid token format',
    statusCode: 400,
    details: {
      tokenLength: 15,
      expectedFormat: 'JWT token'
    }
  }
};
```

### **2. Mock Implementations**

#### **Service Mocks**
```typescript
// setup/mocks/service-mocks.ts
export const createMockGmailService = (): jest.Mocked<GmailService> => ({
  sendEmail: jest.fn(),
  searchEmails: jest.fn(),
  getEmail: jest.fn(),
  createDraft: jest.fn(),
  name: 'gmailService',
  state: ServiceState.READY,
  initialize: jest.fn(),
  isReady: jest.fn(),
  destroy: jest.fn(),
  getHealth: jest.fn()
});

export const createMockAuthService = (): jest.Mocked<AuthService> => ({
  validateAccessToken: jest.fn(),
  refreshAccessToken: jest.fn(),
  exchangeMobileTokens: jest.fn(),
  name: 'authService',
  state: ServiceState.READY,
  initialize: jest.fn(),
  isReady: jest.fn(),
  destroy: jest.fn(),
  getHealth: jest.fn()
});

export const createMockSessionService = (): jest.Mocked<SessionService> => ({
  getOrCreateSession: jest.fn(),
  addConversationEntry: jest.fn(),
  getConversationContext: jest.fn(),
  name: 'sessionService',
  state: ServiceState.READY,
  initialize: jest.fn(),
  isReady: jest.fn(),
  destroy: jest.fn(),
  getHealth: jest.fn()
});
```

#### **Agent Mocks**
```typescript
// setup/mocks/agent-mocks.ts
export const createMockEmailAgent = (): jest.Mocked<EmailAgent> => ({
  execute: jest.fn(),
  getConfig: jest.fn(),
  isEnabled: jest.fn(),
  name: 'emailAgent',
  state: ServiceState.READY,
  initialize: jest.fn(),
  isReady: jest.fn(),
  destroy: jest.fn(),
  getHealth: jest.fn()
});

export const createMockContactAgent = (): jest.Mocked<ContactAgent> => ({
  execute: jest.fn(),
  getConfig: jest.fn(),
  isEnabled: jest.fn(),
  name: 'contactAgent',
  state: ServiceState.READY,
  initialize: jest.fn(),
  isReady: jest.fn(),
  destroy: jest.fn(),
  getHealth: jest.fn()
});
```

## 🚀 **Performance Testing**

### **1. Response Time Testing**

#### **Performance Benchmarks**
```typescript
describe('Performance Benchmarks', () => {
  let masterAgent: MasterAgent;
  
  beforeEach(async () => {
    await initializeAllCoreServices();
    masterAgent = new MasterAgent();
  });
  
  describe('Response Time Requirements', () => {
    it('should process simple queries within 500ms', async () => {
      // Arrange
      const simpleQueries = [
        'What is the weather?',
        'Find contact for john',
        'Show my emails'
      ];
      
      for (const query of simpleQueries) {
        const startTime = Date.now();
        
        // Act
        await masterAgent.processUserInput(query, 'perf-test-session');
        
        const executionTime = Date.now() - startTime;
        
        // Assert
        expect(executionTime).toBeLessThan(500);
      }
    });
    
    it('should process complex workflows within 2 seconds', async () => {
      // Arrange
      const complexQuery = 'Schedule a meeting with the team for tomorrow at 2pm and send them the agenda';
      const startTime = Date.now();
      
      // Act
      await masterAgent.processUserInput(complexQuery, 'perf-test-session');
      
      const executionTime = Date.now() - startTime;
      
      // Assert
      expect(executionTime).toBeLessThan(2000);
    });
  });
  
  describe('Memory Usage', () => {
    it('should not leak memory during multiple requests', async () => {
      // Arrange
      const initialMemory = process.memoryUsage().heapUsed;
      const sessionId = 'memory-test-session';
      
      // Act - Make multiple requests
      for (let i = 0; i < 100; i++) {
        await masterAgent.processUserInput(
          `Test query ${i}`,
          sessionId
        );
      }
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Assert - Memory increase should be reasonable (< 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});
```

### **2. Load Testing**

#### **Concurrent Request Testing**
```typescript
describe('Load Testing', () => {
  let app: Express;
  
  beforeAll(async () => {
    app = createTestApp();
    await initializeAllCoreServices();
  });
  
  it('should handle 10 concurrent requests', async () => {
    // Arrange
    const concurrentRequests = 10;
    const requests = Array.from({ length: concurrentRequests }, (_, i) => ({
      command: `Test command ${i}`,
      sessionId: `concurrent-session-${i}`
    }));
    
    // Act
    const startTime = Date.now();
    const responses = await Promise.all(
      requests.map(request =>
        request(app)
          .post('/api/assistant/command')
          .send(request)
      )
    );
    const totalTime = Date.now() - startTime;
    
    // Assert
    expect(responses).toHaveLength(concurrentRequests);
    
    // All requests should succeed
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
    
    // Should complete within reasonable time
    expect(totalTime).toBeLessThan(5000); // 5 seconds
  });
});
```

## 🔍 **Test Configuration and Setup**

### **1. Jest Configuration**

#### **Jest Setup**
```typescript
// setup/setup.ts
import { config } from 'dotenv';
import path from 'path';

// Load environment variables for testing
const envPath = path.resolve(__dirname, '../../.env');
config({ path: envPath });

// Global test setup
beforeAll(async () => {
  // Initialize test environment
  process.env.NODE_ENV = 'test';
  
  // Set up test database if needed
  // await setupTestDatabase();
});

afterAll(async () => {
  // Clean up test environment
  // await cleanupTestDatabase();
});

// Global test utilities
global.createTestContext = (overrides: Partial<ToolExecutionContext> = {}): ToolExecutionContext => ({
  sessionId: 'test-session-id',
  userId: 'test-user-id',
  ...overrides
});

global.createTestSession = (overrides: Partial<SessionData> = {}): SessionData => ({
  id: 'test-session-id',
  userId: 'test-user-id',
  createdAt: new Date(),
  lastActivity: new Date(),
  conversationHistory: [],
  context: {},
  ...overrides
});
```

#### **Jest Configuration**
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup/setup.ts'],
  testTimeout: 10000,
  maxWorkers: 1, // Run tests sequentially for integration tests
  verbose: true
};
```

### **2. Test Helper Functions**

#### **Common Test Utilities**
```typescript
// tests/setup/test-helper.ts
export const createMockRequest = (overrides: Partial<Request> = {}): Partial<Request> => ({
  body: {},
  headers: {},
  params: {},
  query: {},
  ...overrides
});

export const createMockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

export const createMockNextFunction = (): NextFunction => {
  return jest.fn();
};

export const waitForServiceReady = async (serviceName: string, timeoutMs: number = 5000): Promise<void> => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const service = getService(serviceName);
    if (service?.isReady()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error(`Service ${serviceName} did not become ready within ${timeoutMs}ms`);
};

export const cleanupTestData = async (): Promise<void> => {
  // Clean up any test data created during tests
  const sessionService = getService<SessionService>('sessionService');
  if (sessionService) {
    // Clear test sessions
    // Implementation depends on SessionService interface
  }
};
```

This comprehensive testing strategy ensures the AI assistant platform maintains quality and reliability while providing clear patterns for AI-assisted development and testing.
