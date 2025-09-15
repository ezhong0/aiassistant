# 🧪 Testing Guide

Comprehensive testing guide for the AI Assistant Platform, covering unit tests, integration tests, and quality assurance strategies.

## 🎯 **Testing Overview**

The platform uses **Jest** as the primary testing framework with comprehensive test coverage across all components.

### **Test Structure**

```
tests/
├── unit/                    # Unit tests for individual components
│   ├── agents/             # Agent unit tests
│   ├── services/           # Service unit tests
│   ├── utils/              # Utility function tests
│   └── types/              # Type validation tests
├── integration/            # Integration tests for workflows
├── fixtures/               # Test data and mock files
├── setup.ts               # Global test setup
├── test-setup.ts          # Test environment configuration
└── test-utils.ts          # Shared testing utilities
```

### **Test Categories**

| **Test Type** | **Purpose** | **Scope** | **Speed** |
|---------------|-------------|-----------|-----------|
| **Unit Tests** | Test individual components | Single component | Fast |
| **Integration Tests** | Test component interactions | Multiple components | Medium |
| **End-to-End Tests** | Test complete workflows | Full system | Slow |

## 🚀 **Quick Start**

### **Run All Tests**

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### **Run Specific Test Suites**

```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Specific test file
npm test -- tests/unit/agents/master-agent.test.ts

# Tests matching pattern
npm test -- --testNamePattern="Email"
```

## 🧪 **Unit Testing**

### **Agent Unit Tests**

Test individual agents in isolation:

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { EmailAgent } from '../../src/agents/email.agent';
import { TestUtils, TestMocks } from '../test-utils';

describe('EmailAgent', () => {
  let emailAgent: EmailAgent;

  beforeEach(async () => {
    emailAgent = new EmailAgent();
    await TestUtils.runWithCleanup(async () => {
      // Setup for each test
    });
  });

  describe('Email Operations', () => {
    it('should send email with natural language', async () => {
      const result = await emailAgent.execute({
        query: 'Send an email to john@example.com about the meeting'
      }, TestMocks.createMockContext());

      expect(result.success).toBe(true);
      expect(result.result.messageId).toBeDefined();
    });

    it('should handle invalid email addresses', async () => {
      const result = await emailAgent.execute({
        query: 'Send an email to invalid-email about the meeting'
      }, TestMocks.createMockContext());

      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid email');
    });
  });
});
```

### **Service Unit Tests**

Test services with mocked dependencies:

```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GmailService } from '../../src/services/gmail.service';

// Mock external dependencies
jest.mock('googleapis');

describe('GmailService', () => {
  let gmailService: GmailService;

  beforeEach(() => {
    gmailService = new GmailService();
  });

  describe('Email Sending', () => {
    it('should send email successfully', async () => {
      const mockGmail = {
        users: {
          messages: {
            send: jest.fn().mockResolvedValue({
              data: { id: 'message123', threadId: 'thread123' }
            })
          }
        }
      };

      // Mock the gmail service
      (gmailService as any).gmailService = mockGmail;

      const result = await gmailService.sendEmail(
        'access-token',
        'test@example.com',
        'Test Subject',
        'Test Body'
      );

      expect(result.messageId).toBe('message123');
      expect(result.threadId).toBe('thread123');
    });
  });
});
```

### **Utility Function Tests**

Test utility functions with various inputs:

```typescript
import { describe, it, expect } from '@jest/globals';
import { sanitizeString } from '../../src/utils/string-utils';

describe('String Utils', () => {
  describe('sanitizeString', () => {
    it('should remove dangerous characters', () => {
      const input = '<script>alert("xss")</script>';
      const result = sanitizeString(input);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });

    it('should preserve safe content', () => {
      const input = 'Hello, world!';
      const result = sanitizeString(input);
      expect(result).toBe('Hello, world!');
    });

    it('should handle empty strings', () => {
      const result = sanitizeString('');
      expect(result).toBe('');
    });
  });
});
```

## 🔗 **Integration Testing**

### **Multi-Agent Workflows**

Test complete workflows involving multiple agents:

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { MasterAgent } from '../../src/agents/master.agent';
import { TestUtils, TestMocks } from '../test-utils';

describe('Multi-Agent Integration', () => {
  let masterAgent: MasterAgent;

  beforeEach(async () => {
    await TestUtils.runWithCleanup(async () => {
      masterAgent = new MasterAgent({
        openaiApiKey: process.env.OPENAI_API_KEY
      });
    }, { useServices: true });
  });

  describe('Email Workflow', () => {
    it('should find contact and send email', async () => {
      const result = await masterAgent.processUserInput(
        'Send an email to John about the meeting',
        TestMocks.createTestSessionId(),
        TestMocks.createTestUserId()
      );

      expect(result.toolCalls).toContain('contactAgent');
      expect(result.toolCalls).toContain('emailAgent');
      expect(result.toolCalls).toContain('Think');
    });

    it('should handle confirmation workflows', async () => {
      const result = await masterAgent.processUserInput(
        'Send an email to the entire team about the project update',
        TestMocks.createTestSessionId(),
        TestMocks.createTestUserId()
      );

      expect(result.requiresConfirmation).toBe(true);
      expect(result.confirmationMessage).toBeDefined();
    });
  });
});
```

### **API Integration Tests**

Test API endpoints with real service interactions:

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/index';
import { TestMocks } from '../test-utils';

describe('API Integration', () => {
  describe('POST /api/assistant/text-command', () => {
    it('should process text command successfully', async () => {
      const response = await request(app)
        .post('/api/assistant/text-command')
        .set('Authorization', `Bearer ${TestMocks.createMockJWT()}`)
        .send({
          command: 'Hello, can you help me?',
          sessionId: TestMocks.createTestSessionId()
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBeDefined();
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/assistant/text-command')
        .send({
          command: 'Hello, can you help me?'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });
  });
});
```

### **Database Integration Tests**

Test database operations with real database:

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { DatabaseService } from '../../src/services/database.service';
import { TestUtils } from '../test-utils';

describe('Database Integration', () => {
  let databaseService: DatabaseService;

  beforeEach(async () => {
    await TestUtils.runWithCleanup(async () => {
      databaseService = new DatabaseService();
      await databaseService.initialize();
    }, { useServices: true });
  });

  afterEach(async () => {
    await TestUtils.cleanupServices();
  });

  describe('User Tokens', () => {
    it('should store and retrieve user tokens', async () => {
      const userId = 'test-user-123';
      const tokens = {
        google: {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_at: new Date(Date.now() + 3600000)
        }
      };

      await databaseService.storeUserTokens(userId, tokens);
      const retrieved = await databaseService.getUserTokens(userId);

      expect(retrieved).toBeDefined();
      expect(retrieved.google.access_token).toBe('test-access-token');
    });
  });
});
```

## 🛠️ **Test Utilities**

### **TestUtils Class**

Comprehensive testing utilities:

```typescript
export class TestUtils {
  // Session management
  static createTestSessionId(prefix: string = 'test'): string
  static createTestUserId(): string
  
  // Async operations
  static async waitForAsyncOperations(ms: number): Promise<void>
  static async runWithCleanup<T>(testFn: () => Promise<T>, options?: { useServices?: boolean }): Promise<T>
  
  // Service management
  static async initializeServices(): Promise<void>
  static async cleanupServices(): Promise<void>
  static async getService<T>(serviceName: string): Promise<T | undefined>
  
  // Memory management
  static forceGC(): void
  static getMemoryUsage(): void
}
```

### **TestMocks Class**

Mock data and objects:

```typescript
export class TestMocks {
  // OAuth tokens
  static createMockOAuthTokens(): OAuthTokens
  
  // Sessions
  static createMockSession(teamId?: string, userId?: string): Session
  
  // JWT tokens
  static createMockJWT(userId?: string): string
  
  // Slack context
  static createMockSlackContext(): SlackContext
  
  // Tool execution context
  static createMockContext(): ToolExecutionContext
}
```

### **TestAssertions Class**

Domain-specific assertions:

```typescript
export class TestAssertions {
  // Agent assertions
  static assertThinkToolIncluded(toolCalls: any[]): void
  static assertValidOAuthTokens(tokens: any): void
  static assertValidSession(session: any): void
  static assertServiceReady(service: any): void
}
```

## 📊 **Test Coverage**

### **Coverage Goals**

- **Unit Tests**: 90%+ coverage
- **Integration Tests**: 80%+ coverage
- **Critical Paths**: 100% coverage

### **Coverage Reports**

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/lcov-report/index.html

# Coverage for specific files
npm test -- --coverage --collectCoverageFrom="src/agents/**/*.ts"
```

### **Coverage Configuration**

```javascript
// jest.config.js
module.exports = {
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

## 🧪 **Test Data Management**

### **Fixtures**

Organize test data in fixtures:

```typescript
// tests/fixtures/email-fixtures.ts
export const emailFixtures = {
  validEmail: {
    to: 'test@example.com',
    subject: 'Test Subject',
    body: 'Test Body'
  },
  invalidEmail: {
    to: 'invalid-email',
    subject: 'Test Subject',
    body: 'Test Body'
  },
  emailWithAttachments: {
    to: 'test@example.com',
    subject: 'Test with Attachments',
    body: 'Test Body',
    attachments: [
      {
        filename: 'test.txt',
        content: 'test content',
        contentType: 'text/plain'
      }
    ]
  }
};
```

### **Mock Services**

Create mock services for testing:

```typescript
// tests/mocks/gmail-service.mock.ts
export class MockGmailService {
  async sendEmail() {
    return {
      messageId: 'mock-message-id',
      threadId: 'mock-thread-id'
    };
  }

  async searchEmails() {
    return {
      messages: [
        { id: 'msg1', threadId: 'thread1' },
        { id: 'msg2', threadId: 'thread2' }
      ]
    };
  }
}
```

## 🚀 **Performance Testing**

### **Load Testing**

Test system performance under load:

```typescript
import { describe, it, expect } from '@jest/globals';
import { performance } from 'perf_hooks';

describe('Performance Tests', () => {
  it('should process requests within acceptable time', async () => {
    const startTime = performance.now();
    
    const result = await masterAgent.processUserInput(
      'Send an email to john@example.com about the meeting',
      TestMocks.createTestSessionId(),
      TestMocks.createTestUserId()
    );
    
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    
    expect(result.success).toBe(true);
    expect(executionTime).toBeLessThan(5000); // 5 seconds max
  });
});
```

### **Memory Testing**

Test memory usage and leaks:

```typescript
describe('Memory Tests', () => {
  it('should not leak memory during repeated operations', async () => {
    const initialMemory = process.memoryUsage();
    
    // Perform repeated operations
    for (let i = 0; i < 100; i++) {
      await masterAgent.processUserInput(
        `Test command ${i}`,
        TestMocks.createTestSessionId(),
        TestMocks.createTestUserId()
      );
    }
    
    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    
    // Memory increase should be reasonable
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB max
  });
});
```

## 🔧 **Test Configuration**

### **Jest Configuration**

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      sourceMap: false,
      tsconfig: 'tsconfig.test.json'
    }]
  },
  
  testMatch: [
    '**/tests/unit/**/*.(test|spec).(ts|tsx|js|jsx)',
    '**/tests/**/*.test.(ts|tsx|js|jsx)'
  ],
  
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  globalSetup: '<rootDir>/tests/test-setup.ts',
  
  testTimeout: 30000,
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true
};
```

### **Test Environment**

```typescript
// tests/setup.ts
import { TestUtils } from './test-utils';

beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

afterEach(async () => {
  // Cleanup after each test
  await TestUtils.cleanupServices();
  TestUtils.forceGC();
});
```

## 🚨 **Testing Best Practices**

### **Test Organization**

1. **Arrange-Act-Assert Pattern**:
   ```typescript
   it('should send email successfully', async () => {
     // Arrange
     const emailAgent = new EmailAgent();
     const mockContext = TestMocks.createMockContext();
     
     // Act
     const result = await emailAgent.execute({
       query: 'Send an email to test@example.com'
     }, mockContext);
     
     // Assert
     expect(result.success).toBe(true);
     expect(result.result.messageId).toBeDefined();
   });
   ```

2. **Descriptive Test Names**:
   ```typescript
   // Good
   it('should send email with valid recipient and subject')
   
   // Bad
   it('should work')
   ```

3. **One Assertion Per Test**:
   ```typescript
   // Good
   it('should return success true', () => {
     expect(result.success).toBe(true);
   });
   
   it('should return message ID', () => {
     expect(result.messageId).toBeDefined();
   });
   ```

### **Mocking Strategy**

1. **Mock External Dependencies**:
   ```typescript
   jest.mock('googleapis');
   jest.mock('openai');
   ```

2. **Mock at the Right Level**:
   ```typescript
   // Mock the service, not the HTTP client
   jest.mock('../../src/services/gmail.service');
   ```

3. **Use Real Dependencies When Possible**:
   ```typescript
   // Use real database for integration tests
   // Mock only external APIs
   ```

### **Error Testing**

1. **Test Error Cases**:
   ```typescript
   it('should handle invalid email address', async () => {
     const result = await emailAgent.execute({
       query: 'Send an email to invalid-email'
     }, mockContext);
     
     expect(result.success).toBe(false);
     expect(result.error).toContain('invalid email');
   });
   ```

2. **Test Edge Cases**:
   ```typescript
   it('should handle empty query', async () => {
     const result = await emailAgent.execute({
       query: ''
     }, mockContext);
     
     expect(result.success).toBe(false);
     expect(result.error).toContain('query is required');
   });
   ```

## 📚 **Next Steps**

After setting up testing:

1. **[Development Setup](./development-setup.md)** - Local development environment
2. **[Production Deployment](./production-deployment.md)** - Deploy to production
3. **[Monitoring & Logging](./monitoring-logging.md)** - Set up observability
4. **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions

---

**🧪 With comprehensive testing in place, you can confidently develop and deploy the AI Assistant Platform with high quality and reliability!**
