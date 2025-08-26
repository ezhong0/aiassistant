# Redux Store Implementation

This document describes the Redux Toolkit implementation for the Assistant App, following clean architecture principles and integrating with the repository pattern.

## Architecture Overview

The Redux store is organized into four main slices, each handling a specific domain:

- **Chat Slice**: Manages conversation state, messages, and session information
- **Actions Slice**: Handles action cards, confirmations, and execution states
- **User Slice**: Manages authentication, user profile, and session state
- **Voice Slice**: Controls voice recording, processing, and transcription

## Store Structure

```
src/store/
├── index.ts              # Main store configuration
├── api.ts                # RTK Query API configuration
├── slices/               # Redux slices
│   ├── index.ts         # Slice exports
│   ├── chatSlice.ts     # Chat state management
│   ├── actionsSlice.ts  # Actions state management
│   ├── userSlice.ts     # User state management
│   └── voiceSlice.ts    # Voice state management
├── selectors.ts          # Memoized selectors
├── hooks.ts              # Custom Redux hooks
└── __tests__/            # Test files
    └── store.test.ts     # Store and slice tests
```

## Key Features

### 1. State Persistence
- Uses `redux-persist` with AsyncStorage for offline data persistence
- Automatically transforms dates between ISO strings and Date objects
- Excludes voice state from persistence (audio data is not serializable)

### 2. RTK Query Integration
- Handles API calls with automatic caching and invalidation
- Includes retry logic for network failures
- Optimistic updates for better user experience
- Supports both text and voice commands

### 3. Type Safety
- Full TypeScript support with proper typing
- Memoized selectors for performance optimization
- Custom hooks for common Redux operations

### 4. Offline Support
- Queues actions when offline
- Syncs pending actions when connection is restored
- Handles network state changes gracefully

## Usage Examples

### Basic State Access

```typescript
import { useAppSelector } from '../store/hooks';
import { selectMessages, selectIsLoading } from '../store/selectors';

function ChatComponent() {
  const messages = useAppSelector(selectMessages);
  const isLoading = useAppSelector(selectIsLoading);
  
  // Component logic...
}
```

### Using Custom Hooks

```typescript
import { useChat, useActions, useUser } from '../store/hooks';

function ChatScreen() {
  const { messages, addUserMessage, isLoading } = useChat();
  const { actionCards, addActionCard } = useActions();
  const { user, isAuthenticated } = useUser();
  
  const handleSendMessage = (text: string) => {
    addUserMessage(text);
    // Additional logic...
  };
  
  // Component logic...
}
```

### Dispatching Actions

```typescript
import { useAppDispatch } from '../store/hooks';
import { addMessage, setLoading } from '../store/slices';

function SomeComponent() {
  const dispatch = useAppDispatch();
  
  const handleAction = () => {
    dispatch(setLoading(true));
    dispatch(addMessage({
      id: 'msg-1',
      text: 'Hello',
      isUser: true,
      timestamp: new Date(),
    }));
  };
  
  // Component logic...
}
```

### RTK Query Mutations

```typescript
import { useSendTextCommandMutation } from '../store/api';

function ChatInput() {
  const [sendTextCommand, { isLoading, error }] = useSendTextCommandMutation();
  
  const handleSubmit = async (message: string) => {
    try {
      const result = await sendTextCommand({ message }).unwrap();
      // Handle success
    } catch (error) {
      // Handle error
    }
  };
  
  // Component logic...
}
```

## State Management Patterns

### 1. Chat State
- Messages are stored as an array with timestamps
- Session ID is maintained for conversation continuity
- Loading and typing states for better UX
- Error handling for failed operations

### 2. Actions State
- Action cards are categorized by status (pending, completed, failed)
- Execution status tracking for action lifecycle
- Selected action management for UI interactions
- Automatic state updates based on backend responses

### 3. User State
- Authentication state with token management
- User profile information
- Online/offline status tracking
- Pending actions queue for offline scenarios

### 4. Voice State
- Recording state management
- Audio processing pipeline
- Transcription handling
- Settings and preferences

## Integration with Repository Pattern

The Redux store integrates seamlessly with the repository pattern:

```typescript
// Repository layer handles data access
const chatRepository = repositoryFactory.createChatRepository();

// Redux manages UI state
const { messages, addMessage } = useChat();

// Components use both together
const handleSendMessage = async (text: string) => {
  addMessage({ text, isUser: true, timestamp: new Date() });
  
  try {
    const response = await chatRepository.sendMessage(text);
    if (response.success) {
      addMessage({ text: response.data.message, isUser: false, timestamp: new Date() });
    }
  } catch (error) {
    // Handle error
  }
};
```

## Performance Optimizations

### 1. Memoized Selectors
- Use `createSelector` for expensive computations
- Selectors only recalculate when dependencies change
- Prevents unnecessary re-renders

### 2. Action Batching
- Multiple state updates can be batched
- Use `batch` from React for multiple dispatches
- Consider using `useReducer` for complex state logic

### 3. Normalized State
- Actions and messages use normalized IDs
- Efficient updates and lookups
- Prevents duplicate data

## Testing

The store includes comprehensive tests:

```bash
# Run store tests
npm test src/store/__tests__/store.test.ts

# Run all tests
npm test
```

Test coverage includes:
- Store configuration
- Slice actions and reducers
- State transformations
- Action dispatching
- Error handling

## Best Practices

### 1. State Structure
- Keep state flat and normalized
- Use IDs for relationships
- Avoid nested objects when possible

### 2. Action Design
- Use descriptive action names
- Keep payloads minimal
- Handle side effects in thunks or RTK Query

### 3. Selector Usage
- Use selectors for all state access
- Memoize expensive computations
- Keep selectors pure and testable

### 4. Error Handling
- Centralize error state management
- Provide user-friendly error messages
- Implement retry mechanisms

## Migration Guide

### From Previous Implementation
1. Update imports to use new slice structure
2. Replace direct state access with selectors
3. Use custom hooks for common operations
4. Update tests to use new store configuration

### Adding New Features
1. Create new slice in `slices/` directory
2. Add to root reducer in `index.ts`
3. Create selectors in `selectors.ts`
4. Add custom hooks in `hooks.ts`
5. Write tests in `__tests__/` directory

## Troubleshooting

### Common Issues

1. **State not persisting**: Check AsyncStorage permissions and persist configuration
2. **Performance issues**: Verify selector memoization and avoid unnecessary re-renders
3. **Type errors**: Ensure proper TypeScript configuration and type imports
4. **Test failures**: Check test environment setup and mock configurations

### Debug Tools

- Redux DevTools for development
- Console logging for state changes
- Performance profiling for optimization
- Network tab for API debugging

## Future Enhancements

- [ ] Add middleware for analytics tracking
- [ ] Implement state synchronization across tabs
- [ ] Add support for real-time updates
- [ ] Enhance offline capabilities
- [ ] Add state migration for version updates
