# Testing Strategy

The AI Assistant Platform implements a comprehensive testing strategy with unit tests, integration tests, and behavior tests. This document outlines the testing approach, frameworks, and best practices.

## 🧪 **Testing Overview**

### **Testing Philosophy**

The platform follows a **test-driven development** approach with:

- **Unit Tests**: Test individual components in isolation
- **Integration Tests**: Test component interactions and workflows
- **Behavior Tests**: Test AI agent behavior and decision-making
- **End-to-End Tests**: Test complete user workflows

### **Testing Pyramid**

```
        ┌─────────────────┐
        │   E2E Tests     │  ← Few, high-level tests
        │   (Manual)      │
        └─────────────────┘
       ┌─────────────────────┐
       │  Integration Tests  │  ← Some, component interaction tests
       │   (Automated)       │
       └─────────────────────┘
      ┌─────────────────────────┐
      │     Unit Tests          │  ← Many, isolated component tests
      │     (Automated)         │
      └─────────────────────────┘
```

## 🔧 **Testing Framework**

### **Jest Configuration**

The platform uses **Jest** as the primary testing framework:

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
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
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  clearMocks: true,
  restoreMocks: true
};
```

### **Test Environment Setup**

```typescript
// tests/setup.ts
import dotenv from 'dotenv';
import path from 'path';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.DISABLE_RATE_LIMITING = 'true';
process.env.LOG_LEVEL = 'error';

// Load test environment variables
const envPath = path.resolve(__dirname, '../.env.test');
dotenv.config({ path: envPath });

// Mock external services
jest.mock('../src/services/openai.service');
jest.mock('../src/services/gmail.service');
jest.mock('../src/services/calendar.service');
jest.mock('../src/services/slack.service');

// Global test utilities
global.testUtils = {
  createMockUser: () => ({
    userId: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User'
  }),
  
  createMockSession: () => ({
    sessionId: 'test-session-123',
    userId: 'test-user-123',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000)
  }),
  
  createMockSlackContext: () => ({
    channelId: 'C1234567890',
    teamId: 'T1234567890',
    userId: 'U1234567890',
    accessToken: 'xoxb-test-token'
  })
};
```

## 🧩 **Unit Testing**

### **Service Unit Tests**

Test individual services in isolation with mocked dependencies:

```typescript
// tests/unit/services/email.service.test.ts
import { EmailService } from '../../../src/services/email.service';
import { GmailService } from '../../../src/services/gmail.service';
import { CacheService } from '../../../src/services/cache.service';

describe('EmailService', () => {
  let emailService: EmailService;
  let mockGmailService: jest.Mocked<GmailService>;
  let mockCacheService: jest.Mocked<CacheService>;
  
  beforeEach(() => {
    mockGmailService = createMockGmailService();
    mockCacheService = createMockCacheService();
    
    emailService = new EmailService();
    emailService['gmailService'] = mockGmailService;
    emailService['cacheService'] = mockCacheService;
  });
  
  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      // Arrange
      const params = {
        to: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test Body',
        accessToken: 'valid-token'
      };
      
      mockGmailService.sendEmail.mockResolvedValue({
        id: 'email-123',
        threadId: 'thread-123'
      });
      
      // Act
      const result = await emailService.sendEmail(params);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.data.id).toBe('email-123');
      expect(mockGmailService.sendEmail).toHaveBeenCalledWith(params);
    });
    
    it('should handle Gmail API errors', async () => {
      // Arrange
      const params = {
        to: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test Body',
        accessToken: 'invalid-token'
      };
      
      mockGmailService.sendEmail.mockRejectedValue(
        new Error('Invalid credentials')
      );
      
      // Act & Assert
      await expect(emailService.sendEmail(params))
        .rejects
        .toThrow('Failed to send email');
    });
    
    it('should validate email parameters', async () => {
      // Arrange
      const invalidParams = {
        to: 'invalid-email',
        subject: '',
        body: '',
        accessToken: 'token'
      };
      
      // Act & Assert
      await expect(emailService.sendEmail(invalidParams))
        .rejects
        .toThrow('Email validation failed');
    });
  });
  
  describe('searchEmails', () => {
    it('should return cached results when available', async () => {
      // Arrange
      const query = 'test query';
      const cachedResults = [
        { id: 'email-1', subject: 'Cached Email' }
      ];
      
      mockCacheService.get.mockResolvedValue(cachedResults);
      
      // Act
      const result = await emailService.searchEmails(query, 10, 'token');
      
      // Assert
      expect(result).toEqual(cachedResults);
      expect(mockCacheService.get).toHaveBeenCalledWith(
        expect.stringContaining('email:search:')
      );
    });
    
    it('should fetch from API when cache miss', async () => {
      // Arrange
      const query = 'test query';
      const apiResults = [
        { id: 'email-1', subject: 'API Email' }
      ];
      
      mockCacheService.get.mockResolvedValue(null);
      mockGmailService.searchEmails.mockResolvedValue(apiResults);
      
      // Act
      const result = await emailService.searchEmails(query, 10, 'token');
      
      // Assert
      expect(result).toEqual(apiResults);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('email:search:'),
        apiResults,
        3600
      );
    });
  });
});
```

### **Agent Unit Tests**

Test AI agents with mocked AI services:

```typescript
// tests/unit/agents/email.agent.test.ts
import { EmailAgent } from '../../../src/agents/email.agent';
import { OpenAIService } from '../../../src/services/openai.service';

describe('EmailAgent', () => {
  let emailAgent: EmailAgent;
  let mockOpenAIService: jest.Mocked<OpenAIService>;
  
  beforeEach(() => {
    mockOpenAIService = createMockOpenAIService();
    
    emailAgent = new EmailAgent();
    emailAgent['openaiService'] = mockOpenAIService;
  });
  
  describe('processQuery', () => {
    it('should process email send request', async () => {
      // Arrange
      const params = {
        operation: 'send',
        contactEmail: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test Body',
        accessToken: 'token'
      };
      
      mockOpenAIService.generateStructuredData.mockResolvedValue({
        steps: [
          {
            id: 'step-1',
            agent: 'emailAgent',
            operation: 'send',
            parameters: params
          }
        ],
        dependencies: [],
        estimatedTime: 1000
      });
      
      // Act
      const result = await emailAgent.processQuery(params);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.metadata.operation).toBe('send');
    });
    
    it('should handle AI planning failures', async () => {
      // Arrange
      const params = {
        operation: 'send',
        contactEmail: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test Body',
        accessToken: 'token'
      };
      
      mockOpenAIService.generateStructuredData.mockRejectedValue(
        new Error('AI service unavailable')
      );
      
      // Act & Assert
      await expect(emailAgent.processQuery(params))
        .rejects
        .toThrow('AI planning failed');
    });
  });
});
```

### **Utility Unit Tests**

Test utility functions and helpers:

```typescript
// tests/unit/utils/validation.util.test.ts
import { validateEmail, sanitizeInput } from '../../../src/utils/validation.util';

describe('Validation Utils', () => {
  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.uk')).toBe(true);
      expect(validateEmail('user+tag@example.org')).toBe(true);
    });
    
    it('should reject invalid email addresses', () => {
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });
  });
  
  describe('sanitizeInput', () => {
    it('should remove dangerous HTML', () => {
      const input = '<script>alert("xss")</script>Hello World';
      const result = sanitizeInput(input);
      expect(result).toBe('Hello World');
    });
    
    it('should preserve safe HTML', () => {
      const input = '<p>Hello <strong>World</strong></p>';
      const result = sanitizeInput(input);
      expect(result).toBe('<p>Hello <strong>World</strong></p>');
    });
  });
});
```

## 🔗 **Integration Testing**

### **Service Integration Tests**

Test service interactions and data flow:

```typescript
// tests/integration/services/email-integration.test.ts
import { EmailService } from '../../../src/services/email.service';
import { GmailService } from '../../../src/services/gmail.service';
import { CacheService } from '../../../src/services/cache.service';
import { DatabaseService } from '../../../src/services/database.service';

describe('Email Service Integration', () => {
  let emailService: EmailService;
  let gmailService: GmailService;
  let cacheService: CacheService;
  let databaseService: DatabaseService;
  
  beforeAll(async () => {
    // Initialize real services for integration testing
    gmailService = new GmailService();
    cacheService = new CacheService();
    databaseService = new DatabaseService();
    
    await gmailService.initialize();
    await cacheService.initialize();
    await databaseService.initialize();
    
    emailService = new EmailService();
    emailService['gmailService'] = gmailService;
    emailService['cacheService'] = cacheService;
    emailService['databaseService'] = databaseService;
    
    await emailService.initialize();
  });
  
  afterAll(async () => {
    await emailService.destroy();
    await gmailService.destroy();
    await cacheService.destroy();
    await databaseService.destroy();
  });
  
  describe('Email Workflow', () => {
    it('should complete email send workflow', async () => {
      // Arrange
      const params = {
        to: 'test@example.com',
        subject: 'Integration Test',
        body: 'This is an integration test',
        accessToken: 'test-token'
      };
      
      // Mock Gmail API response
      jest.spyOn(gmailService, 'sendEmail').mockResolvedValue({
        id: 'email-123',
        threadId: 'thread-123'
      });
      
      // Act
      const result = await emailService.sendEmail(params);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.data.id).toBe('email-123');
      
      // Verify cache was updated
      const cached = await cacheService.get(`email:send:${params.to}`);
      expect(cached).toBeDefined();
    });
    
    it('should handle cache and database integration', async () => {
      // Arrange
      const query = 'test query';
      const accessToken = 'test-token';
      
      // Mock Gmail API response
      jest.spyOn(gmailService, 'searchEmails').mockResolvedValue([
        { id: 'email-1', subject: 'Test Email' }
      ]);
      
      // Act
      const result = await emailService.searchEmails(query, 10, accessToken);
      
      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].subject).toBe('Test Email');
      
      // Verify cache was populated
      const cacheKey = `email:search:${query}:10`;
      const cached = await cacheService.get(cacheKey);
      expect(cached).toEqual(result);
    });
  });
});
```

### **API Integration Tests**

Test API endpoints with real services:

```typescript
// tests/integration/api/assistant-api.test.ts
import request from 'supertest';
import { app } from '../../../src/index';
import { createTestUser, createTestToken } from '../../test-utils';

describe('Assistant API Integration', () => {
  let testUser: any;
  let authToken: string;
  
  beforeAll(async () => {
    testUser = await createTestUser();
    authToken = await createTestToken(testUser);
  });
  
  describe('POST /assistant/text-command', () => {
    it('should process email command', async () => {
      // Arrange
      const command = {
        command: 'send email to test@example.com about meeting',
        sessionId: 'test-session-123',
        accessToken: 'gmail-test-token'
      };
      
      // Act
      const response = await request(app)
        .post('/assistant/text-command')
        .set('Authorization', `Bearer ${authToken}`)
        .send(command)
        .expect(200);
      
      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.type).toBe('confirmation_required');
      expect(response.body.data.toolCalls).toHaveLength(1);
      expect(response.body.data.toolCalls[0].name).toBe('manage_emails');
    });
    
    it('should process calendar command', async () => {
      // Arrange
      const command = {
        command: 'schedule meeting tomorrow at 2pm',
        sessionId: 'test-session-123',
        accessToken: 'calendar-test-token'
      };
      
      // Act
      const response = await request(app)
        .post('/assistant/text-command')
        .set('Authorization', `Bearer ${authToken}`)
        .send(command)
        .expect(200);
      
      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.toolCalls[0].name).toBe('manage_calendar');
    });
    
    it('should handle authentication errors', async () => {
      // Act
      const response = await request(app)
        .post('/assistant/text-command')
        .send({ command: 'test command' })
        .expect(401);
      
      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access token required');
    });
  });
});
```

## 🤖 **Behavior Testing**

### **AI Agent Behavior Tests**

Test AI agent decision-making and behavior:

```typescript
// tests/integration/agent-behavior/email-agent-behavior.test.ts
import { EmailAgent } from '../../../src/agents/email.agent';
import { MasterAgent } from '../../../src/agents/master.agent';

describe('Email Agent Behavior', () => {
  let emailAgent: EmailAgent;
  let masterAgent: MasterAgent;
  
  beforeEach(() => {
    emailAgent = new EmailAgent();
    masterAgent = new MasterAgent();
  });
  
  describe('Email Operation Detection', () => {
    it('should detect send email intent', async () => {
      // Arrange
      const userInput = 'send email to john@example.com about project update';
      
      // Act
      const result = await emailAgent.processQuery({
        userInput,
        sessionId: 'test-session'
      });
      
      // Assert
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe('manage_emails');
      expect(result.toolCalls[0].parameters.operation).toBe('send');
      expect(result.toolCalls[0].parameters.contactEmail).toBe('john@example.com');
    });
    
    it('should detect search email intent', async () => {
      // Arrange
      const userInput = 'find me emails from john@example.com';
      
      // Act
      const result = await emailAgent.processQuery({
        userInput,
        sessionId: 'test-session'
      });
      
      // Assert
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].parameters.operation).toBe('search');
      expect(result.toolCalls[0].parameters.query).toContain('john@example.com');
    });
    
    it('should handle ambiguous requests', async () => {
      // Arrange
      const userInput = 'email john';
      
      // Act
      const result = await emailAgent.processQuery({
        userInput,
        sessionId: 'test-session'
      });
      
      // Assert
      expect(result.type).toBe('confirmation_required');
      expect(result.proposal).toBeDefined();
      expect(result.proposal.details).toContain('john');
    });
  });
  
  describe('Context Understanding', () => {
    it('should understand follow-up requests', async () => {
      // Arrange
      const firstRequest = 'send email to john@example.com about meeting';
      const followUpRequest = 'make it urgent';
      
      // Act
      const firstResult = await emailAgent.processQuery({
        userInput: firstRequest,
        sessionId: 'test-session'
      });
      
      const followUpResult = await emailAgent.processQuery({
        userInput: followUpRequest,
        sessionId: 'test-session',
        context: {
          previousToolCalls: firstResult.toolCalls
        }
      });
      
      // Assert
      expect(followUpResult.toolCalls[0].parameters.subject).toContain('URGENT');
    });
  });
});
```

### **Master Agent Orchestration Tests**

Test Master Agent coordination:

```typescript
// tests/integration/agent-behavior/master-agent-orchestration.test.ts
import { MasterAgent } from '../../../src/agents/master.agent';

describe('Master Agent Orchestration', () => {
  let masterAgent: MasterAgent;
  
  beforeEach(() => {
    masterAgent = new MasterAgent();
  });
  
  describe('Multi-Agent Coordination', () => {
    it('should coordinate email and calendar agents', async () => {
      // Arrange
      const userInput = 'send email to john@example.com about meeting and schedule follow-up call';
      
      // Act
      const result = await masterAgent.processUserInput(
        userInput,
        'test-session'
      );
      
      // Assert
      expect(result.toolCalls).toHaveLength(2);
      expect(result.toolCalls[0].name).toBe('manage_emails');
      expect(result.toolCalls[1].name).toBe('manage_calendar');
    });
    
    it('should handle complex workflows', async () => {
      // Arrange
      const userInput = 'find contact for Sarah, send her an email about the project, and schedule a meeting';
      
      // Act
      const result = await masterAgent.processUserInput(
        userInput,
        'test-session'
      );
      
      // Assert
      expect(result.toolCalls).toHaveLength(3);
      expect(result.toolCalls[0].name).toBe('search_contacts');
      expect(result.toolCalls[1].name).toBe('manage_emails');
      expect(result.toolCalls[2].name).toBe('manage_calendar');
    });
  });
  
  describe('Context Management', () => {
    it('should maintain context across requests', async () => {
      // Arrange
      const firstRequest = 'send email to john@example.com about project';
      const secondRequest = 'what about the meeting time?';
      
      // Act
      const firstResult = await masterAgent.processUserInput(
        firstRequest,
        'test-session'
      );
      
      const secondResult = await masterAgent.processUserInput(
        secondRequest,
        'test-session',
        undefined,
        {
          previousToolCalls: firstResult.toolCalls
        }
      );
      
      // Assert
      expect(secondResult.toolCalls[0].parameters).toMatchObject({
        operation: 'create',
        attendees: ['john@example.com']
      });
    });
  });
});
```

## 🛠️ **Test Utilities**

### **Mock Factories**

Create reusable mock factories:

```typescript
// tests/test-utils/mock-factories.ts
export const createMockGmailService = (): jest.Mocked<GmailService> => ({
  searchEmails: jest.fn(),
  getEmail: jest.fn(),
  sendEmail: jest.fn(),
  replyToEmail: jest.fn(),
  isReady: jest.fn().mockReturnValue(true),
  getHealth: jest.fn().mockReturnValue({ healthy: true })
});

export const createMockOpenAIService = (): jest.Mocked<OpenAIService> => ({
  generateResponse: jest.fn(),
  generateToolCalls: jest.fn(),
  generateStructuredData: jest.fn(),
  isReady: jest.fn().mockReturnValue(true),
  getHealth: jest.fn().mockReturnValue({ healthy: true })
});

export const createMockCacheService = (): jest.Mocked<CacheService> => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  isConnected: jest.fn().mockReturnValue(true),
  getHealth: jest.fn().mockReturnValue({ healthy: true })
});
```

### **Test Data Builders**

Create test data with builders:

```typescript
// tests/test-utils/data-builders.ts
export class EmailParamsBuilder {
  private params: Partial<EmailParams> = {};
  
  withOperation(operation: string): this {
    this.params.operation = operation;
    return this;
  }
  
  withRecipient(email: string): this {
    this.params.contactEmail = email;
    return this;
  }
  
  withSubject(subject: string): this {
    this.params.subject = subject;
    return this;
  }
  
  withBody(body: string): this {
    this.params.body = body;
    return this;
  }
  
  withAccessToken(token: string): this {
    this.params.accessToken = token;
    return this;
  }
  
  build(): EmailParams {
    return {
      operation: 'send',
      contactEmail: 'test@example.com',
      subject: 'Test Subject',
      body: 'Test Body',
      accessToken: 'test-token',
      ...this.params
    } as EmailParams;
  }
}

// Usage
const emailParams = new EmailParamsBuilder()
  .withOperation('send')
  .withRecipient('john@example.com')
  .withSubject('Project Update')
  .build();
```

### **Test Helpers**

Common test helper functions:

```typescript
// tests/test-utils/helpers.ts
export const createTestUser = async (): Promise<User> => {
  return {
    userId: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/avatar.jpg',
    createdAt: new Date(),
    updatedAt: new Date()
  };
};

export const createTestToken = async (user: User): Promise<string> => {
  const authService = new AuthService();
  return authService.generateJWT({
    userId: user.userId,
    email: user.email,
    name: user.name,
    picture: user.picture
  });
};

export const createTestSession = (): Session => {
  return {
    sessionId: 'test-session-123',
    userId: 'test-user-123',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000),
    lastActivity: new Date(),
    conversationHistory: [],
    toolCalls: [],
    toolResults: []
  };
};

export const waitForService = async (service: IService, timeout = 5000): Promise<void> => {
  const start = Date.now();
  while (!service.isReady() && (Date.now() - start) < timeout) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!service.isReady()) {
    throw new Error(`Service ${service.name} did not become ready within ${timeout}ms`);
  }
};
```

## 📊 **Test Coverage**

### **Coverage Configuration**

```javascript
// jest.config.js
module.exports = {
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/services/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  }
};
```

### **Coverage Reports**

```bash
# Generate coverage report
npm run test:coverage

# View HTML coverage report
open coverage/lcov-report/index.html

# Coverage for specific files
npm run test:coverage -- --collectCoverageFrom="src/services/**/*.ts"
```

## 🚀 **Running Tests**

### **Test Commands**

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test files
npm test -- tests/unit/services/email.service.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="Email"

# Run tests in specific directory
npm test -- tests/unit/

# Run integration tests only
npm run test:integration

# Run unit tests only
npm run test:unit
```

### **CI/CD Integration**

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v1
        with:
          file: ./coverage/lcov.info
```

## 📝 **Testing Best Practices**

### **Test Organization**

1. **Arrange-Act-Assert**: Structure tests with clear sections
2. **Descriptive Names**: Use clear, descriptive test names
3. **One Assertion**: Focus on one behavior per test
4. **Mock External Dependencies**: Isolate units under test
5. **Test Edge Cases**: Include error conditions and edge cases

### **Test Data Management**

1. **Use Builders**: Create test data with builders
2. **Avoid Magic Numbers**: Use named constants
3. **Clean Up**: Clean up test data after each test
4. **Isolate Tests**: Each test should be independent

### **Performance Testing**

1. **Test Timeouts**: Set appropriate timeouts
2. **Async Testing**: Properly handle async operations
3. **Memory Leaks**: Check for memory leaks in tests
4. **Resource Cleanup**: Clean up resources after tests

---

**Next**: [Unit Testing](./testing/unit-testing.md) - Service and agent unit tests
