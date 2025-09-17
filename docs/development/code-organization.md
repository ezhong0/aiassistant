# Code Organization

This document outlines the project structure, coding conventions, and organizational patterns used in the AI Assistant Platform.

## 📁 **Project Structure**

### **Root Directory**

```
assistantapp/
├── backend/                 # Backend application
├── docs/                   # Documentation
├── resume/                 # Resume and job search materials
├── Dockerfile             # Docker configuration
├── Procfile               # Railway deployment configuration
├── package.json           # Root package.json
└── README.md              # Project overview
```

### **Backend Directory Structure**

```
backend/
├── src/                   # Source code
│   ├── agents/            # AI agents
│   ├── config/            # Configuration files
│   ├── framework/         # Core framework
│   ├── middleware/        # Express middleware
│   ├── routes/            # API routes
│   ├── schemas/           # Zod validation schemas
│   ├── services/          # Business logic services
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions
│   └── index.ts           # Application entry point
├── tests/                 # Test files
├── scripts/               # Utility scripts
├── migrations/             # Database migrations
├── logs/                  # Log files
├── config/                # Configuration files
├── data/                  # Data files
├── examples/              # Example code
├── dev-tools/             # Development tools
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── jest.config.js         # Jest test configuration
├── eslint.config.js       # ESLint configuration
└── README.md              # Backend documentation
```

## 🏗️ **Architecture Patterns**

### **Service-Oriented Architecture**

The application follows a **service-oriented architecture** with clear separation of concerns:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Routes    │    │   Middleware    │    │   Services      │
│                 │    │                 │    │                 │
│ • assistant     │───▶│ • auth          │───▶│ • email         │
│ • auth          │    │ • validation    │    │ • calendar      │
│ • slack         │    │ • rate limiting │    │ • contact       │
│ • protected     │    │ • logging       │    │ • cache         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **Agent-Based Architecture**

AI agents are organized by domain responsibility:

```
┌─────────────────┐
│  Master Agent   │  ← Central orchestrator
└─────────────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌───▼───┐ ┌───▼───┐ ┌───▼───┐
│ Email │ │Calendar│ │Contact│ │ Slack │
│ Agent │ │ Agent  │ │ Agent │ │ Agent │
└───────┘ └────────┘ └───────┘ └───────┘
```

## 📝 **Coding Conventions**

### **TypeScript Standards**

**File Naming:**
- **Services**: `kebab-case.service.ts` (e.g., `email-operation-handler.service.ts`)
- **Agents**: `kebab-case.agent.ts` (e.g., `master.agent.ts`)
- **Types**: `kebab-case.types.ts` (e.g., `api-response.types.ts`)
- **Schemas**: `kebab-case.schemas.ts` (e.g., `email.schemas.ts`)
- **Utils**: `kebab-case.util.ts` (e.g., `response-validation.util.ts`)

**Class Naming:**
- **Services**: `PascalCase` + `Service` suffix (e.g., `EmailOperationHandlerService`)
- **Agents**: `PascalCase` + `Agent` suffix (e.g., `MasterAgent`)
- **Types**: `PascalCase` (e.g., `EmailParams`, `CalendarResult`)
- **Interfaces**: `PascalCase` with `I` prefix (e.g., `IService`)

**Method Naming:**
- **Public methods**: `camelCase` (e.g., `processUserInput`)
- **Private methods**: `camelCase` with `_` prefix (e.g., `_validateInput`)
- **Async methods**: `camelCase` with `async` keyword (e.g., `async sendEmail`)

### **Import Organization**

```typescript
// 1. Node.js built-in modules
import { createClient } from 'redis';
import { Pool } from 'pg';

// 2. External libraries
import express from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';

// 3. Internal modules (absolute imports)
import { BaseService } from '../base-service';
import { ServiceManager } from '../service-manager';
import { EmailParams } from '../../types/email/email.types';

// 4. Relative imports
import logger from '../utils/logger';
import { validateEmail } from './validation.util';
```

### **Error Handling Patterns**

```typescript
// Service error handling
export class EmailService extends BaseService {
  async sendEmail(params: SendEmailParams): Promise<EmailResult> {
    try {
      // Implementation
      const result = await this.gmailService.sendEmail(params);
      
      this.logInfo('Email sent successfully', {
        recipient: params.to,
        subject: params.subject
      });
      
      return result;
    } catch (error) {
      this.logError('Failed to send email', error);
      throw this.createError(
        'Failed to send email. Please try again.',
        'EMAIL_SEND_FAILED'
      );
    }
  }
  
  private createError(message: string, code: string): Error {
    const error = new Error(message);
    (error as any).code = code;
    return error;
  }
}
```

### **Logging Patterns**

```typescript
// Structured logging
this.logInfo('Operation completed', {
  operation: 'sendEmail',
  recipient: params.to,
  subject: params.subject,
  duration: Date.now() - startTime,
  success: true
});

this.logError('Operation failed', {
  operation: 'sendEmail',
  error: error.message,
  stack: error.stack,
  params: {
    recipient: params.to,
    subject: params.subject
  }
});

this.logDebug('Debug information', {
  cacheKey: 'email:search:abc123',
  hitRate: 0.85,
  ttl: 3600
});
```

## 🔧 **Service Patterns**

### **Base Service Implementation**

All services extend `BaseService` for consistent lifecycle management:

```typescript
export abstract class BaseService implements IService {
  public readonly name: string;
  public readonly state: ServiceState = ServiceState.INITIALIZING;
  
  protected logger: Logger;
  protected serviceManager: ServiceManager;
  
  constructor(name: string) {
    this.name = name;
    this.logger = logger.child({ service: name });
    this.serviceManager = ServiceManager.getInstance();
  }
  
  // Abstract methods to implement
  protected abstract onInitialize(): Promise<void>;
  protected abstract onDestroy(): Promise<void>;
  
  // Common lifecycle methods
  async initialize(): Promise<void> {
    try {
      await this.onInitialize();
      this.state = ServiceState.READY;
      this.logger.info(`${this.name} initialized successfully`);
    } catch (error) {
      this.state = ServiceState.ERROR;
      this.logger.error(`${this.name} initialization failed`, error);
      throw error;
    }
  }
  
  async destroy(): Promise<void> {
    try {
      this.state = ServiceState.SHUTTING_DOWN;
      await this.onDestroy();
      this.state = ServiceState.DESTROYED;
      this.logger.info(`${this.name} destroyed successfully`);
    } catch (error) {
      this.logger.error(`${this.name} destruction failed`, error);
      throw error;
    }
  }
  
  isReady(): boolean {
    return this.state === ServiceState.READY;
  }
  
  getHealth(): { healthy: boolean; details?: any } {
    return {
      healthy: this.state === ServiceState.READY,
      details: {
        state: this.state,
        name: this.name
      }
    };
  }
}
```

### **Service Registration Pattern**

```typescript
// Service registration in service-initialization.ts
const registerCoreServices = async (): Promise<void> => {
  // Infrastructure services (Priority 1-10)
  const configService = new ConfigService();
  serviceManager.registerService('configService', configService, {
    priority: 1,
    autoStart: true
  });
  
  // Domain services (Priority 20-35)
  const emailService = new EmailService();
  serviceManager.registerService('emailService', emailService, {
    dependencies: ['databaseService', 'cacheService'],
    priority: 25,
    autoStart: true
  });
  
  // Cache services (Priority 98-101)
  const emailCacheService = new EmailCacheService();
  serviceManager.registerService('emailCacheService', emailCacheService, {
    dependencies: ['cacheService', 'emailService'],
    priority: 98,
    autoStart: true
  });
};
```

## 🎯 **Agent Patterns**

### **Agent Implementation Pattern**

```typescript
export class EmailAgent extends AIAgent<EmailParams, EmailResult> {
  constructor() {
    super({
      name: 'emailAgent',
      description: 'Handles email operations including send, search, read, reply',
      capabilities: ['send', 'search', 'read', 'reply', 'forward'],
      limitations: ['cannot handle attachments larger than 25MB'],
      aiPlanning: {
        enableAIPlanning: true,
        maxPlanningSteps: 5
      }
    });
  }
  
  protected async processQuery(params: EmailParams): Promise<EmailResult> {
    // AI-powered email operation planning
    const plan = await this.generateExecutionPlan(params);
    
    // Execute email operations
    const results = await this.executePlan(plan);
    
    // Format and return results
    return this.formatEmailResults(results);
  }
  
  // Tool schema definition
  getToolSchema(): ToolMetadata {
    return {
      name: 'manage_emails',
      description: 'Handle email operations including send, search, read, reply',
      parameters: {
        type: 'object',
        properties: {
          operation: { 
            type: 'string', 
            enum: ['send', 'search', 'read', 'reply', 'forward'] 
          },
          // ... other properties
        },
        required: ['operation']
      },
      requiresConfirmation: true,
      isCritical: true
    };
  }
}
```

## 📊 **Type Definitions**

### **Type Organization**

Types are organized by domain and functionality:

```
types/
├── agents/                 # Agent-specific types
│   ├── agent.types.ts     # Base agent types
│   ├── contact.types.ts   # Contact agent types
│   └── ...
├── api/                   # API-related types
│   ├── api.types.ts       # Base API types
│   ├── api-response.types.ts # Response types
│   └── ...
├── auth.types.ts          # Authentication types
├── calendar/              # Calendar types
├── email/                 # Email types
├── slack/                 # Slack types
└── tools.ts               # Tool execution types
```

### **Type Definition Patterns**

```typescript
// Base response type
export interface BaseApiResponse {
  success: boolean;
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

// Specific response types
export interface EmailResult extends BaseApiResponse {
  data: EmailData;
  metadata: {
    operation: 'send' | 'search' | 'read' | 'reply';
    recipientCount?: number;
    hasAttachments?: boolean;
  };
}

// Parameter types
export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Attachment[];
  accessToken: string;
}

// Zod schemas for validation
export const SendEmailParamsSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(998),
  body: z.string().min(1),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  attachments: z.array(AttachmentSchema).optional(),
  accessToken: z.string().min(1)
});
```

## 🧪 **Testing Patterns**

### **Test Organization**

```
tests/
├── unit/                   # Unit tests
│   ├── agents/            # Agent unit tests
│   ├── services/          # Service unit tests
│   ├── utils/             # Utility unit tests
│   └── ...
├── integration/            # Integration tests
│   ├── agent-behavior/     # Agent behavior tests
│   ├── api/               # API integration tests
│   └── ...
├── fixtures/               # Test data
├── setup.ts               # Test setup
└── test-utils.ts          # Test utilities
```

### **Test Patterns**

```typescript
// Service unit test pattern
describe('EmailService', () => {
  let emailService: EmailService;
  let mockGmailService: jest.Mocked<GmailService>;
  
  beforeEach(() => {
    mockGmailService = createMockGmailService();
    emailService = new EmailService();
    emailService['gmailService'] = mockGmailService;
  });
  
  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      // Arrange
      const params: SendEmailParams = {
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
      const params: SendEmailParams = {
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
  });
});
```

## 📚 **Documentation Patterns**

### **JSDoc Standards**

```typescript
/**
 * Sends an email using the Gmail API
 * 
 * @param params - Email parameters including recipient, subject, and body
 * @param params.to - Recipient email address
 * @param params.subject - Email subject line
 * @param params.body - Email body content
 * @param params.cc - Optional CC recipients
 * @param params.bcc - Optional BCC recipients
 * @param params.accessToken - Gmail API access token
 * @returns Promise resolving to email send result
 * 
 * @throws {Error} When Gmail API returns an error
 * @throws {ValidationError} When email parameters are invalid
 * 
 * @example
 * ```typescript
 * const result = await emailService.sendEmail({
 *   to: 'user@example.com',
 *   subject: 'Hello',
 *   body: 'This is a test email',
 *   accessToken: 'gmail-access-token'
 * });
 * 
 * console.log(result.success); // true
 * console.log(result.data.id); // 'email-123'
 * ```
 */
async sendEmail(params: SendEmailParams): Promise<EmailResult> {
  // Implementation
}
```

### **README Structure**

Each major component should have a README with:

1. **Overview**: What the component does
2. **Installation**: How to set it up
3. **Usage**: How to use it
4. **API**: Available methods and parameters
5. **Examples**: Code examples
6. **Configuration**: Configuration options
7. **Troubleshooting**: Common issues and solutions

## 🔄 **Git Workflow**

### **Branch Naming**

- **Features**: `feature/description` (e.g., `feature/email-attachments`)
- **Bugs**: `bugfix/description` (e.g., `bugfix/calendar-timezone`)
- **Hotfixes**: `hotfix/description` (e.g., `hotfix/auth-token-expiry`)
- **Refactoring**: `refactor/description` (e.g., `refactor/service-initialization`)

### **Commit Messages**

Follow conventional commit format:

```
type(scope): description

feat(email): add attachment support for email sending
fix(calendar): resolve timezone handling issues
docs(api): update REST API documentation
test(agents): add integration tests for email agent
refactor(services): simplify service initialization
```

### **Pull Request Template**

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project conventions
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

---

**Next**: [Contributing](./development/contributing.md) - Development guidelines and best practices
