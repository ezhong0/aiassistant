# Repository Pattern Implementation

This directory contains the implementation of the repository pattern for the Assistant App React Native project, following clean architecture principles.

## Overview

The repository pattern provides a clean abstraction layer between the data access logic and business logic, making the code more testable, maintainable, and following the dependency inversion principle.

## Architecture

```
src/repositories/
├── interfaces/           # Repository interfaces (contracts)
├── implementations/      # Concrete implementations
├── mocks/               # Mock implementations for testing
├── factory.ts           # Repository factory for dependency injection
└── index.ts             # Public exports
```

## Core Components

### 1. Repository Interfaces

- **`IBaseRepository<T>`**: Generic interface for common CRUD operations
- **`IChatRepository`**: Chat and messaging operations
- **`IActionRepository`**: Action card management and execution
- **`IUserRepository`**: User authentication and profile management
- **`IRepositoryFactory`**: Factory interface for dependency injection

### 2. Concrete Implementations

- **`ChatRepository`**: Implements chat operations using RTK Query
- **`ActionRepository`**: Handles action cards and execution
- **`UserRepository`**: Manages user authentication and profiles

### 3. Mock Implementations

- **`MockChatRepository`**: In-memory chat operations for testing
- **`MockActionRepository`**: Mock action card operations
- **`MockUserRepository`**: Simulated user authentication
- **`MockRepositoryFactory`**: Factory providing mock implementations

### 4. Repository Factory

The `RepositoryFactory` implements the singleton pattern and provides:
- Centralized repository creation
- Dependency injection support
- Easy switching between real and mock implementations

## Usage Examples

### Basic Repository Usage

```typescript
import { repositoryFactory } from '../repositories';

// Get repository instances
const chatRepo = repositoryFactory.createChatRepository();
const actionRepo = repositoryFactory.createActionRepository();
const userRepo = repositoryFactory.createUserRepository();

// Use repositories
const result = await chatRepo.sendMessage('Hello, AI!');
const actions = await actionRepo.getActionCards();
const user = await userRepo.getCurrentUser();
```

### Using RTK Query Hooks

```typescript
import { useSendMessageMutation, useGetActionCardsQuery } from '../store/api';

function ChatComponent() {
  const [sendMessage, { isLoading }] = useSendMessageMutation();
  const { data: actions, isLoading: actionsLoading } = useGetActionCardsQuery();

  const handleSendMessage = async (message: string) => {
    try {
      const result = await sendMessage({ message }).unwrap();
      console.log('Message sent:', result);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  // Component JSX...
}
```

### Testing with Mock Repositories

```typescript
import { mockRepositoryFactory } from '../repositories/mocks/mock-factory';

describe('Chat Repository Tests', () => {
  let chatRepo: IChatRepository;

  beforeEach(() => {
    mockRepositoryFactory.resetAllMocks();
    chatRepo = mockRepositoryFactory.createChatRepository();
  });

  it('should send message successfully', async () => {
    const result = await chatRepo.sendMessage('Test message');
    expect(result.success).toBe(true);
  });
});
```

## Benefits

1. **Separation of Concerns**: Clear separation between data access and business logic
2. **Testability**: Easy to mock repositories for unit testing
3. **Maintainability**: Centralized data access logic
4. **Flexibility**: Easy to switch implementations (real API vs mock)
5. **Dependency Injection**: Loose coupling between components
6. **Type Safety**: Full TypeScript support with proper interfaces

## Integration with RTK Query

The repositories are designed to work seamlessly with RTK Query:
- Automatic caching and invalidation
- Optimistic updates
- Background refetching
- Error handling and retry logic

## Error Handling

All repository methods return `APIResponse<T>` which includes:
- `success`: Boolean indicating operation success
- `data`: The actual data on success
- `error`: Error message on failure

## Future Enhancements

1. **Offline Support**: Implement offline-first architecture with local storage
2. **Caching Strategy**: Advanced caching with TTL and invalidation
3. **Retry Logic**: Exponential backoff for failed requests
4. **Real-time Updates**: WebSocket integration for live data
5. **Background Sync**: Sync data when app comes online

## Testing

Run the repository tests:

```bash
npm test -- src/repositories/__tests__/repository-pattern.test.ts
```

## Contributing

When adding new repositories:
1. Define the interface in `interfaces.ts`
2. Implement the concrete class in `implementations/`
3. Create mock implementation in `mocks/`
4. Add to the factory
5. Write comprehensive tests
6. Update this documentation
