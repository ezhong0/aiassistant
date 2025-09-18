# Structured Error Handling - Detailed Implementation Plan

## Overview

This document provides a comprehensive plan to implement structured error handling that improves debugging, monitoring, and user experience through rich error context and automated recovery mechanisms.

## Problem Analysis

### Current Error Handling Issues

The existing error handler in `middleware/errorHandler.ts` is basic and loses important context:

```typescript
// Current: Basic error with minimal context
export const errorHandler = (err: AppError, req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Limited error information
  const responseMessage = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Something went wrong!'
    : message;

  res.status(statusCode).json({
    success: false,
    error: { message: responseMessage },
    timestamp: new Date().toISOString(),
  });
};
```

### Problems This Creates
1. **Poor Debugging:** Errors lack context about what operation was being performed
2. **Generic User Messages:** Users get unhelpful "Something went wrong" messages
3. **No Recovery Guidance:** No indication if errors are retryable or how to fix them
4. **Monitoring Blind Spots:** Can't categorize or alert on different types of errors
5. **Lost Request Context:** Error doesn't include user ID, session, or operation details

## Technical Design

### Structured Error System

```typescript
export enum ErrorCategory {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  EXTERNAL_SERVICE = 'external_service',
  BUSINESS_LOGIC = 'business_logic',
  SYSTEM = 'system',
  RATE_LIMIT = 'rate_limit',
  NETWORK = 'network',
  DATABASE = 'database'
}

export enum ErrorSeverity {
  LOW = 'low',         // Doesn't affect core functionality
  MEDIUM = 'medium',   // Affects some functionality
  HIGH = 'high',       // Affects core functionality
  CRITICAL = 'critical' // System-wide impact
}

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  operationId?: string;
  requestPath?: string;
  userAgent?: string;
  ip?: string;
  timestamp?: Date;
  additionalData?: Record<string, any>;
}

export interface ErrorRecovery {
  retryable: boolean;
  retryAfter?: number; // seconds
  retryStrategy?: 'exponential' | 'fixed' | 'none';
  userActions?: string[];
  systemActions?: string[];
}

export class StructuredError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly category: ErrorCategory,
    public readonly severity: ErrorSeverity,
    public readonly context: ErrorContext = {},
    public readonly recovery: ErrorRecovery = { retryable: false },
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'StructuredError';

    // Maintain stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, StructuredError);
    }

    // Add timestamp if not provided
    if (!this.context.timestamp) {
      this.context.timestamp = new Date();
    }
  }

  // Utility methods
  isRetryable(): boolean {
    return this.recovery.retryable;
  }

  isCritical(): boolean {
    return this.severity === ErrorSeverity.CRITICAL;
  }

  shouldExpose(): boolean {
    // Determine if error details should be exposed to users
    return this.category !== ErrorCategory.SYSTEM &&
           this.severity !== ErrorSeverity.CRITICAL;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      severity: this.severity,
      context: this.context,
      recovery: this.recovery,
      stack: this.stack
    };
  }
}
```

### Error Factory Functions

```typescript
export class ErrorFactory {
  static validation(
    message: string,
    field: string,
    value: any,
    context: Partial<ErrorContext> = {}
  ): StructuredError {
    return new StructuredError(
      message,
      `VALIDATION_${field.toUpperCase()}_INVALID`,
      ErrorCategory.VALIDATION,
      ErrorSeverity.LOW,
      { ...context, additionalData: { field, value } },
      {
        retryable: false,
        userActions: [`Please check the ${field} field and try again`]
      }
    );
  }

  static authentication(
    message: string,
    reason: string,
    context: Partial<ErrorContext> = {}
  ): StructuredError {
    return new StructuredError(
      message,
      `AUTH_${reason.toUpperCase()}`,
      ErrorCategory.AUTHENTICATION,
      ErrorSeverity.MEDIUM,
      { ...context, additionalData: { reason } },
      {
        retryable: false,
        userActions: ['Please log in again', 'Check your credentials']
      }
    );
  }

  static externalService(
    service: string,
    operation: string,
    message: string,
    context: Partial<ErrorContext> = {},
    cause?: Error
  ): StructuredError {
    return new StructuredError(
      `${service} service error: ${message}`,
      `EXT_${service.toUpperCase()}_${operation.toUpperCase()}_FAILED`,
      ErrorCategory.EXTERNAL_SERVICE,
      ErrorSeverity.HIGH,
      { ...context, additionalData: { service, operation } },
      {
        retryable: true,
        retryAfter: 30,
        retryStrategy: 'exponential',
        userActions: ['Please try again in a moment'],
        systemActions: ['Check service health', 'Review API rate limits']
      },
      cause
    );
  }

  static businessLogic(
    operation: string,
    reason: string,
    message: string,
    context: Partial<ErrorContext> = {}
  ): StructuredError {
    return new StructuredError(
      message,
      `BUSINESS_${operation.toUpperCase()}_${reason.toUpperCase()}`,
      ErrorCategory.BUSINESS_LOGIC,
      ErrorSeverity.MEDIUM,
      { ...context, additionalData: { operation, reason } },
      {
        retryable: false,
        userActions: [message] // Usually contains user-friendly guidance
      }
    );
  }

  static system(
    component: string,
    message: string,
    context: Partial<ErrorContext> = {},
    cause?: Error
  ): StructuredError {
    return new StructuredError(
      `System error in ${component}: ${message}`,
      `SYS_${component.toUpperCase()}_ERROR`,
      ErrorCategory.SYSTEM,
      ErrorSeverity.CRITICAL,
      { ...context, additionalData: { component } },
      {
        retryable: true,
        retryAfter: 60,
        retryStrategy: 'exponential',
        userActions: ['Please try again later'],
        systemActions: ['Check system health', 'Review logs', 'Alert operations team']
      },
      cause
    );
  }

  static rateLimit(
    operation: string,
    limit: number,
    windowMs: number,
    context: Partial<ErrorContext> = {}
  ): StructuredError {
    const resetTime = Math.ceil(windowMs / 1000);

    return new StructuredError(
      `Rate limit exceeded for ${operation}. Please try again in ${resetTime} seconds.`,
      `RATE_LIMIT_${operation.toUpperCase()}_EXCEEDED`,
      ErrorCategory.RATE_LIMIT,
      ErrorSeverity.LOW,
      { ...context, additionalData: { operation, limit, windowMs } },
      {
        retryable: true,
        retryAfter: resetTime,
        retryStrategy: 'fixed',
        userActions: [`Please wait ${resetTime} seconds before trying again`]
      }
    );
  }
}
```

## Implementation Details

### Phase 1: Core Error System

#### File: `backend/src/types/errors.ts`

```typescript
export * from './structured-error';
export * from './error-factory';

// Error type guards
export function isStructuredError(error: any): error is StructuredError {
  return error instanceof StructuredError;
}

export function isRetryableError(error: Error): boolean {
  if (isStructuredError(error)) {
    return error.isRetryable();
  }

  // Default retry logic for non-structured errors
  const retryablePatterns = [
    /timeout/i,
    /connection/i,
    /network/i,
    /temporary/i,
    /rate limit/i
  ];

  return retryablePatterns.some(pattern => pattern.test(error.message));
}

export function getCriticalErrors(errors: Error[]): StructuredError[] {
  return errors
    .filter(isStructuredError)
    .filter(error => error.isCritical());
}
```

#### File: `backend/src/middleware/enhanced-error-handler.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { StructuredError, isStructuredError, ErrorSeverity, ErrorCategory } from '../types/errors';
import logger from '../utils/logger';

export interface ErrorHandlerConfig {
  exposeStackTrace: boolean;
  includeRequestDetails: boolean;
  sanitizeSensitiveData: boolean;
  enableRecoveryHints: boolean;
}

export class EnhancedErrorHandler {
  private config: ErrorHandlerConfig;

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = {
      exposeStackTrace: process.env.NODE_ENV !== 'production',
      includeRequestDetails: true,
      sanitizeSensitiveData: true,
      enableRecoveryHints: true,
      ...config
    };
  }

  handle = (err: Error, req: Request, res: Response, next: NextFunction): void => {
    // Convert to structured error if not already
    const structuredError = this.normalizeError(err, req);

    // Log the error with appropriate level
    this.logError(structuredError, req);

    // Generate user-friendly response
    const response = this.createErrorResponse(structuredError, req);

    // Set appropriate status code
    const statusCode = this.getHttpStatusCode(structuredError);

    // Send response
    res.status(statusCode).json(response);
  };

  private normalizeError(err: Error, req: Request): StructuredError {
    if (isStructuredError(err)) {
      // Add request context if not already present
      if (!err.context.requestPath) {
        err.context.requestPath = req.path;
        err.context.userAgent = req.get('User-Agent');
        err.context.ip = req.ip;
      }
      return err;
    }

    // Convert standard errors to structured errors
    return this.convertStandardError(err, req);
  }

  private convertStandardError(err: Error, req: Request): StructuredError {
    const context = {
      requestPath: req.path,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      timestamp: new Date()
    };

    // Try to classify the error
    if (err.name === 'ValidationError') {
      return new StructuredError(
        err.message,
        'VALIDATION_FAILED',
        ErrorCategory.VALIDATION,
        ErrorSeverity.LOW,
        context,
        { retryable: false, userActions: ['Please check your input and try again'] }
      );
    }

    if (err.message.includes('unauthorized') || err.message.includes('authentication')) {
      return new StructuredError(
        'Authentication failed',
        'AUTH_FAILED',
        ErrorCategory.AUTHENTICATION,
        ErrorSeverity.MEDIUM,
        context,
        { retryable: false, userActions: ['Please log in again'] }
      );
    }

    if (err.message.includes('timeout') || err.message.includes('connection')) {
      return new StructuredError(
        err.message,
        'NETWORK_ERROR',
        ErrorCategory.NETWORK,
        ErrorSeverity.HIGH,
        context,
        {
          retryable: true,
          retryAfter: 30,
          retryStrategy: 'exponential',
          userActions: ['Please try again in a moment']
        }
      );
    }

    // Default: system error
    return new StructuredError(
      err.message,
      'UNKNOWN_ERROR',
      ErrorCategory.SYSTEM,
      ErrorSeverity.HIGH,
      context,
      {
        retryable: true,
        retryAfter: 60,
        userActions: ['Please try again later']
      },
      err
    );
  }

  private logError(error: StructuredError, req: Request): void {
    const logData = {
      error: {
        code: error.code,
        message: error.message,
        category: error.category,
        severity: error.severity,
        stack: error.stack
      },
      context: error.context,
      request: {
        method: req.method,
        path: req.path,
        query: req.query,
        headers: this.sanitizeHeaders(req.headers),
        body: this.sanitizeBody(req.body)
      },
      recovery: error.recovery,
      timestamp: new Date().toISOString()
    };

    // Log with appropriate level based on severity
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        logger.error('Critical error occurred', logData);
        break;
      case ErrorSeverity.HIGH:
        logger.error('High severity error', logData);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn('Medium severity error', logData);
        break;
      case ErrorSeverity.LOW:
        logger.info('Low severity error', logData);
        break;
    }
  }

  private createErrorResponse(error: StructuredError, req: Request) {
    const baseResponse = {
      success: false,
      error: {
        code: error.code,
        message: this.getUserMessage(error),
        category: error.category,
        severity: error.severity,
        timestamp: new Date().toISOString()
      }
    };

    // Add recovery information if enabled
    if (this.config.enableRecoveryHints && error.recovery) {
      baseResponse.error['recovery'] = {
        retryable: error.recovery.retryable,
        retryAfter: error.recovery.retryAfter,
        userActions: error.recovery.userActions
      };
    }

    // Add request context if enabled
    if (this.config.includeRequestDetails) {
      baseResponse['requestId'] = req.headers['x-request-id'] ||
                                  error.context.operationId ||
                                  'unknown';
    }

    // Add stack trace in development
    if (this.config.exposeStackTrace) {
      baseResponse.error['stack'] = error.stack;
      baseResponse.error['context'] = error.context;
    }

    return baseResponse;
  }

  private getUserMessage(error: StructuredError): string {
    // Use user-friendly message if error should be exposed
    if (error.shouldExpose()) {
      return error.message;
    }

    // Generic message for system errors in production
    const genericMessages = {
      [ErrorCategory.SYSTEM]: 'A system error occurred. Please try again later.',
      [ErrorCategory.EXTERNAL_SERVICE]: 'An external service is temporarily unavailable.',
      [ErrorCategory.DATABASE]: 'A database error occurred. Please try again.',
      [ErrorCategory.NETWORK]: 'A network error occurred. Please check your connection.'
    };

    return genericMessages[error.category] || 'An unexpected error occurred.';
  }

  private getHttpStatusCode(error: StructuredError): number {
    const statusCodeMap = {
      [ErrorCategory.VALIDATION]: 400,
      [ErrorCategory.AUTHENTICATION]: 401,
      [ErrorCategory.AUTHORIZATION]: 403,
      [ErrorCategory.BUSINESS_LOGIC]: 422,
      [ErrorCategory.RATE_LIMIT]: 429,
      [ErrorCategory.EXTERNAL_SERVICE]: 502,
      [ErrorCategory.SYSTEM]: 500,
      [ErrorCategory.DATABASE]: 500,
      [ErrorCategory.NETWORK]: 503
    };

    return statusCodeMap[error.category] || 500;
  }

  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];

    if (this.config.sanitizeSensitiveData) {
      sensitiveHeaders.forEach(header => {
        if (sanitized[header]) {
          sanitized[header] = '[REDACTED]';
        }
      });
    }

    return sanitized;
  }

  private sanitizeBody(body: any): any {
    if (!this.config.sanitizeSensitiveData || !body) {
      return body;
    }

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];

    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }
}

// Create singleton instance
export const enhancedErrorHandler = new EnhancedErrorHandler();

// Export middleware function
export const errorHandler = enhancedErrorHandler.handle;
```

### Phase 2: Service Integration

#### File: `backend/src/services/base-service.ts` (Enhanced)

```typescript
import { IService, ServiceState } from './service-manager';
import { StructuredError, ErrorFactory, ErrorContext } from '../types/errors';
import logger from '../utils/logger';

export abstract class BaseService implements IService {
  protected _state: ServiceState = ServiceState.INITIALIZING;
  protected _name: string;
  protected initialized = false;

  constructor(name: string) {
    this._name = name;
  }

  get name(): string {
    return this._name;
  }

  get state(): ServiceState {
    return this._state;
  }

  async initialize(): Promise<void> {
    try {
      this._state = ServiceState.INITIALIZING;
      logger.debug(`Initializing service: ${this._name}`);

      await this.onInitialize();

      this._state = ServiceState.READY;
      this.initialized = true;
      logger.info(`Service initialized successfully: ${this._name}`);
    } catch (error) {
      this._state = ServiceState.ERROR;

      const structuredError = ErrorFactory.system(
        this._name,
        `Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { additionalData: { serviceName: this._name } },
        error instanceof Error ? error : undefined
      );

      logger.error(`Service initialization failed: ${this._name}`, structuredError.toJSON());
      throw structuredError;
    }
  }

  async destroy(): Promise<void> {
    try {
      this._state = ServiceState.SHUTTING_DOWN;
      logger.debug(`Destroying service: ${this._name}`);

      await this.onDestroy();

      this._state = ServiceState.DESTROYED;
      this.initialized = false;
      logger.info(`Service destroyed: ${this._name}`);
    } catch (error) {
      const structuredError = ErrorFactory.system(
        this._name,
        `Failed to destroy: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { additionalData: { serviceName: this._name } },
        error instanceof Error ? error : undefined
      );

      logger.error(`Service destruction failed: ${this._name}`, structuredError.toJSON());
      throw structuredError;
    }
  }

  isReady(): boolean {
    return this._state === ServiceState.READY && this.initialized;
  }

  getHealth(): { healthy: boolean; details?: any } {
    return {
      healthy: this.isReady(),
      details: {
        state: this._state,
        initialized: this.initialized,
        name: this._name
      }
    };
  }

  // Helper methods for services to create structured errors
  protected createError(
    message: string,
    operation: string,
    context: Partial<ErrorContext> = {}
  ): StructuredError {
    return ErrorFactory.businessLogic(
      operation,
      'operation_failed',
      message,
      { ...context, additionalData: { serviceName: this._name } }
    );
  }

  protected createExternalServiceError(
    externalService: string,
    operation: string,
    message: string,
    context: Partial<ErrorContext> = {},
    cause?: Error
  ): StructuredError {
    return ErrorFactory.externalService(
      externalService,
      operation,
      message,
      { ...context, additionalData: { callingService: this._name } },
      cause
    );
  }

  protected createValidationError(
    field: string,
    value: any,
    message: string,
    context: Partial<ErrorContext> = {}
  ): StructuredError {
    return ErrorFactory.validation(
      message,
      field,
      value,
      { ...context, additionalData: { serviceName: this._name } }
    );
  }

  protected abstract onInitialize(): Promise<void>;
  protected abstract onDestroy(): Promise<void>;
}
```

### Phase 3: Route Integration

#### File: `backend/src/routes/assistant.routes.ts` (Enhanced Error Handling)

```typescript
// Add imports
import { ErrorFactory, StructuredError } from '../types/errors';

// Example integration in text-command route
router.post('/text-command',
  authenticateToken,
  userRateLimit(
    RATE_LIMITS.assistant.textCommand.maxRequests,
    RATE_LIMITS.assistant.textCommand.windowMs
  ),
  validateRequest({ body: textCommandSchema }),
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { command, sessionId, accessToken, context } = req.validatedBody as z.infer<typeof textCommandSchema>;
    const user = req.user!;

    const operationId = `text-command-${user.userId}-${Date.now()}`;
    const errorContext = {
      userId: user.userId,
      sessionId: sessionId || 'unknown',
      operationId,
      requestPath: req.path
    };

    const finalSessionId = String(sessionId || `session-${user.userId}-${Date.now()}`);
    const commandString = String(command);

    logger.info('Processing assistant text command', {
      userId: user.userId,
      operationId,
      command: commandString.substring(0, 100) + (commandString.length > 100 ? '...' : ''),
      sessionId: finalSessionId
    });

    // Get Master Agent response
    if (!masterAgent) {
      throw ErrorFactory.system(
        'master_agent',
        'Assistant service is currently unavailable',
        errorContext
      );
    }

    let masterResponse;
    try {
      masterResponse = await masterAgent.processUserInput(commandString, finalSessionId, user.userId);
    } catch (error) {
      throw ErrorFactory.externalService(
        'openai',
        'process_input',
        'Failed to process user input with AI service',
        errorContext,
        error instanceof Error ? error : new Error('Unknown AI service error')
      );
    }

    // Tool execution with enhanced error handling
    if (masterResponse.toolCalls && masterResponse.toolCalls.length > 0) {
      const executionContext: ToolExecutionContext = {
        sessionId: finalSessionId,
        userId: user.userId,
        timestamp: new Date()
      };

      const toolExecutorService = getService<ToolExecutorService>('toolExecutorService');
      if (!toolExecutorService) {
        throw ErrorFactory.system(
          'tool_executor',
          'Tool execution service is not available',
          errorContext
        );
      }

      try {
        // Preview mode execution
        const previewResults = await toolExecutorService.executeTools(
          masterResponse.toolCalls,
          executionContext,
          accessToken as string | undefined,
          { preview: true }
        );

        // Rest of existing logic...

      } catch (error) {
        if (error instanceof StructuredError) {
          throw error; // Re-throw structured errors
        }

        throw ErrorFactory.system(
          'tool_executor',
          `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          errorContext,
          error instanceof Error ? error : undefined
        );
      }
    }

    // Return success response...

  } catch (error) {
    // Enhanced error is automatically handled by the error handler middleware
    throw error;
  }
});
```

## Testing Strategy

### Unit Tests
```typescript
describe('StructuredError', () => {
  it('should create error with all properties', () => {
    const error = new StructuredError(
      'Test error',
      'TEST_ERROR',
      ErrorCategory.VALIDATION,
      ErrorSeverity.LOW,
      { userId: 'user123' },
      { retryable: true, retryAfter: 30 }
    );

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.category).toBe(ErrorCategory.VALIDATION);
    expect(error.severity).toBe(ErrorSeverity.LOW);
    expect(error.context.userId).toBe('user123');
    expect(error.isRetryable()).toBe(true);
  });

  it('should serialize to JSON correctly', () => {
    const error = ErrorFactory.validation('Invalid email', 'email', 'not-an-email');
    const json = error.toJSON();

    expect(json).toHaveProperty('code');
    expect(json).toHaveProperty('category');
    expect(json).toHaveProperty('severity');
    expect(json).toHaveProperty('context');
    expect(json).toHaveProperty('recovery');
  });
});

describe('ErrorFactory', () => {
  it('should create validation errors correctly', () => {
    const error = ErrorFactory.validation('Invalid email format', 'email', 'invalid-email');

    expect(error.category).toBe(ErrorCategory.VALIDATION);
    expect(error.severity).toBe(ErrorSeverity.LOW);
    expect(error.code).toBe('VALIDATION_EMAIL_INVALID');
    expect(error.recovery.retryable).toBe(false);
  });

  it('should create external service errors with retry logic', () => {
    const error = ErrorFactory.externalService('openai', 'completion', 'API timeout');

    expect(error.category).toBe(ErrorCategory.EXTERNAL_SERVICE);
    expect(error.severity).toBe(ErrorSeverity.HIGH);
    expect(error.recovery.retryable).toBe(true);
    expect(error.recovery.retryStrategy).toBe('exponential');
  });
});

describe('EnhancedErrorHandler', () => {
  it('should convert standard errors to structured errors', () => {
    const handler = new EnhancedErrorHandler();
    const req = { path: '/test', get: () => 'test-agent', ip: '127.0.0.1' } as any;
    const standardError = new Error('Connection timeout');

    const structuredError = handler['convertStandardError'](standardError, req);

    expect(structuredError).toBeInstanceOf(StructuredError);
    expect(structuredError.category).toBe(ErrorCategory.NETWORK);
    expect(structuredError.recovery.retryable).toBe(true);
  });

  it('should create appropriate HTTP status codes', () => {
    const handler = new EnhancedErrorHandler();

    const validationError = ErrorFactory.validation('Invalid input', 'field', 'value');
    const authError = ErrorFactory.authentication('Unauthorized', 'invalid_token');
    const systemError = ErrorFactory.system('database', 'Connection failed');

    expect(handler['getHttpStatusCode'](validationError)).toBe(400);
    expect(handler['getHttpStatusCode'](authError)).toBe(401);
    expect(handler['getHttpStatusCode'](systemError)).toBe(500);
  });
});
```

### Integration Tests
```typescript
describe('Error Handling Integration', () => {
  it('should handle service errors end-to-end', async () => {
    // Mock service that throws structured error
    const mockService = {
      async processRequest() {
        throw ErrorFactory.externalService(
          'openai',
          'completion',
          'API rate limit exceeded',
          { userId: 'test-user' }
        );
      }
    };

    const response = await request(app)
      .post('/api/assistant/text-command')
      .send({ command: 'test command' })
      .expect(502);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('EXT_OPENAI_COMPLETION_FAILED');
    expect(response.body.error.category).toBe('external_service');
    expect(response.body.error.recovery.retryable).toBe(true);
  });

  it('should sanitize sensitive data in error responses', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'secret123' })
      .expect(401);

    // Password should not appear in error response
    expect(JSON.stringify(response.body)).not.toContain('secret123');
  });
});
```

## Monitoring & Metrics

### Error Metrics Collection
```typescript
// Error metrics for monitoring
const errorMetrics = {
  'errors_total': {
    type: 'counter',
    help: 'Total number of errors by category and severity',
    labelNames: ['category', 'severity', 'code', 'service']
  },
  'error_recovery_attempts': {
    type: 'counter',
    help: 'Number of error recovery attempts',
    labelNames: ['category', 'success']
  },
  'error_resolution_time': {
    type: 'histogram',
    help: 'Time to resolve errors',
    labelNames: ['category', 'severity']
  }
};

// In error handler, increment metrics
errorMetrics.errors_total.inc({
  category: error.category,
  severity: error.severity,
  code: error.code,
  service: error.context.serviceName || 'unknown'
});
```

### Alerting Rules
- **Critical Errors:** Immediate alert for any CRITICAL severity errors
- **High Error Rate:** Alert if error rate >5% for any category in 5 minutes
- **Service Degradation:** Alert if specific service errors >10/minute
- **Retry Failures:** Alert if retryable errors consistently fail after retries

## Migration Strategy

### Week 1: Foundation
1. **Day 1:** Implement `StructuredError` class and error factory
2. **Day 2:** Create `EnhancedErrorHandler` middleware
3. **Day 3:** Update `BaseService` to use structured errors
4. **Day 4-5:** Comprehensive testing of error system

### Week 2: Service Integration
1. **Day 1-2:** Migrate key services to use structured errors
2. **Day 3-4:** Update route handlers with enhanced error handling
3. **Day 5:** Add error monitoring and metrics

### Week 3: Optimization
1. **Day 1-2:** Fine-tune error categorization and recovery hints
2. **Day 3:** Add error analytics dashboard
3. **Day 4-5:** Performance optimization and production deployment

## Success Criteria

### Developer Experience
- **Debug Time:** 50% reduction in average issue resolution time
- **Error Context:** 100% of errors include operation context and user ID
- **Recovery Guidance:** 80% of errors include actionable recovery steps

### User Experience
- **Error Clarity:** User-friendly messages for all non-system errors
- **Recovery Success:** 70% of retryable errors succeed on retry
- **Support Reduction:** 30% reduction in error-related support tickets

### Operational Excellence
- **Error Categorization:** 100% of errors properly categorized
- **Alert Accuracy:** <5% false positive rate for critical error alerts
- **Error Tracking:** Complete error audit trail for compliance

This implementation provides a comprehensive, production-ready structured error handling system that significantly improves debugging, monitoring, and user experience while maintaining system reliability and security.