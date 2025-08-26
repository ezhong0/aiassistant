# Repository Pattern Implementation

This directory contains the complete repository pattern implementation for the React Native AI Assistant app, following clean architecture principles and integrating with the backend multi-agent system.

## Architecture Overview

The repository pattern provides a clean abstraction layer between the data access logic and business logic, enabling:

- **Separation of Concerns**: Clear boundaries between data access and business logic
- **Testability**: Easy mocking and testing with mock implementations
- **Flexibility**: Easy switching between different data sources
- **Offline Support**: Built-in caching and offline queuing
- **Error Handling**: Comprehensive error handling with retry logic

## Repository Structure

```
src/repositories/
├── base.repository.ts          # Base repository with common functionality
├── interfaces.ts               # Repository interfaces and contracts
├── factory.ts                  # Repository factory for dependency injection
├── implementations/            # Concrete repository implementations
│   ├── chat.repository.ts      # Chat and AI interaction repository
│   ├── action.repository.ts    # Action execution repository
│   └── user.repository.ts      # User authentication repository
├── mocks/                      # Mock implementations for testing
│   ├── mock-chat.repository.ts
│   ├── mock-action.repository.ts
│   ├── mock-user.repository.ts
│   └── mock-factory.ts
├── __tests__/                  # Repository tests
└── index.ts                    # Public exports
```

## Core Components

### 1. BaseRepository

The `BaseRepository` class provides common functionality for all repositories:

- **Retry Logic**: Automatic retry with exponential backoff
- **Caching**: In-memory caching with TTL and size limits
- **Offline Queuing**: Queue operations when offline
- **Error Handling**: Standardized error types and handling

```typescript
export abstract class BaseRepository {
  protected retryConfig: RetryConfig;
  protected cacheConfig: CacheConfig;
  protected offlineQueue: OfflineQueueItem[];
  
  // Execute operations with retry logic
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: any
  ): Promise<T>;
}
```

### 2. Repository Interfaces

Clear contracts for each repository type:

```typescript
export interface IChatRepository {
  sendMessage(message: string, sessionId?: string): Promise<APIResponse<BackendResponse>>;
  getConversationHistory(limit?: number): Promise<APIResponse<Message[]>>;
  clearConversation(): Promise<APIResponse<boolean>>;
  getSession(sessionId: string): Promise<APIResponse<BackendResponse>>;
}

export interface IActionRepository {
  getActionCards(): Promise<APIResponse<ActionCard[]>>;
  executeAction(actionId: string, data: any, sessionId?: string): Promise<APIResponse<BackendResponse>>;
  confirmAction(actionId: string, data: any, sessionId?: string): Promise<APIResponse<BackendResponse>>;
  // ... other methods
}
```

### 3. HTTP Service

Centralized HTTP client with:

- **Authentication**: Automatic token management
- **Error Handling**: HTTP status code handling
- **Timeout Management**: Configurable request timeouts
- **Header Management**: Automatic content-type and auth headers

```typescript
export class HTTPService {
  async request<T>(method: string, url: string, data?: any): Promise<HTTPResponse<T>>;
  setAuthToken(token: string | null): void;
  // ... other methods
}
```

## Usage Examples

### Basic Repository Usage

```typescript
import { repositoryFactory } from '../repositories';

// Get repository instances
const chatRepo = repositoryFactory.createChatRepository();
const actionRepo = repositoryFactory.createActionRepository();
const userRepo = repositoryFactory.createUserRepository();

// Send message to AI assistant
const response = await chatRepo.sendMessage('Schedule a meeting tomorrow');
if (response.success && response.data?.actions) {
  // Handle action cards from AI response
  const actions = response.data.actions;
  // Display action cards to user
}
```

### Authentication Integration

```typescript
// Set auth token for all repositories
repositoryFactory.setAuthToken('user_jwt_token');

// Now all repository calls will include authentication
const user = await userRepo.getCurrentUser();
```

### Error Handling

```typescript
try {
  const result = await chatRepo.sendMessage('Hello');
  // Handle success
} catch (error) {
  if (error.retryable) {
    // Operation can be retried
    console.log('Retryable error:', error.message);
  } else {
    // Non-retryable error
    console.log('Fatal error:', error.message);
  }
}
```

## Backend Integration

The repositories integrate with the backend multi-agent system through these endpoints:

- **`/api/assistant/text-command`**: Main AI processing endpoint (all user interactions)
- **`/api/assistant/confirm-action`**: Action confirmation and execution
- **`/api/assistant/session/:id`**: Session management and validation
- **`/api/auth/*`**: Authentication endpoints

### Agent-Based Architecture

**Important**: All operations go through the agent system, not direct API calls:

1. **User Input** → Frontend → `/api/assistant/text-command`
2. **AI Processing** → Backend routes to appropriate agent (email, calendar, contacts)
3. **Action Proposal** → Agent returns action cards for user confirmation
4. **User Confirmation** → Frontend → `/api/assistant/confirm-action`
5. **Action Execution** → Backend executes through agent system

## Testing

### Mock Repositories

Use mock repositories for testing:

```typescript
import { mockRepositoryFactory } from '../repositories';

// Get mock repositories
const mockChatRepo = mockRepositoryFactory.getMockChatRepository();
const mockActionRepo = mockRepositoryFactory.getMockActionRepository();

// Set up test data
mockChatRepo.setMockMessages([/* test messages */]);
mockActionRepo.setMockActionCards([/* test actions */]);

// Run tests
const result = await mockChatRepo.sendMessage('test message');
expect(result.success).toBe(true);
```

### Running Tests

```bash
# Run repository tests
npm test -- src/repositories/__tests__/repository-pattern.test.ts

# Run all tests
npm test
```

## Configuration

### Retry Configuration

```typescript
const repository = new ChatRepository(
  {
    maxRetries: 3,
    retryDelay: 1000,
    backoffMultiplier: 2,
  },
  {
    ttl: 5 * 60 * 1000, // 5 minutes
    maxSize: 50,
  }
);
```

### HTTP Service Configuration

```typescript
import { HTTPService } from '../services/http.service';

const httpService = new HTTPService({
  baseURL: 'http://localhost:3000',
  timeout: 30000, // 30 seconds
  headers: {
    'X-Client-Version': '1.0.0',
  },
});
```

## Offline Support

The repository pattern includes built-in offline support:

- **Offline Queuing**: Operations are queued when offline
- **Automatic Sync**: Queued operations execute when back online
- **Cache Management**: Intelligent caching with TTL and size limits
- **Data Persistence**: TODO: AsyncStorage integration for offline data

## Performance Considerations

- **Caching**: Responses are cached to reduce API calls
- **Lazy Loading**: Repositories are created on-demand
- **Connection Pooling**: HTTP service manages connection reuse
- **Request Batching**: TODO: Implement request batching for multiple operations

## Security Features

- **Token Management**: Secure token storage and refresh
- **Request Validation**: Input validation and sanitization
- **Error Sanitization**: Sensitive information is not exposed in errors
- **HTTPS Only**: All API calls use secure connections

## Future Enhancements

- [ ] **AsyncStorage Integration**: Persistent offline queue and cache
- [ ] **Request Batching**: Batch multiple operations for efficiency
- [ ] **Background Sync**: Automatic background synchronization
- [ ] **Conflict Resolution**: Handle data conflicts when syncing
- [ ] **Metrics Collection**: Performance and usage metrics
- [ ] **Circuit Breaker**: Prevent cascade failures

## Contributing

When adding new repositories:

1. **Extend BaseRepository**: Inherit from BaseRepository for common functionality
2. **Implement Interface**: Follow the established interface patterns
3. **Add Tests**: Include comprehensive tests for new functionality
4. **Update Documentation**: Keep this README up to date
5. **Follow Patterns**: Use established error handling and retry patterns

## Dependencies

- **TypeScript**: For type safety and interfaces
- **React Native**: For platform-specific functionality
- **Jest**: For testing framework
- **React Native Testing Library**: For component testing

## Related Documentation

- [Architecture Overview](../docs/ARCHITECTURE.md)
- [Testing Strategy](../docs/TESTING.md)
- [Development Workflow](../docs/DEVELOPMENT.md)
- [API Documentation](../docs/SERVICES.md)
