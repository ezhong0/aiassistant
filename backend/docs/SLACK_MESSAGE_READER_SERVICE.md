# SlackMessageReaderService

A dedicated service for reading Slack message history with proper error handling, rate limiting, and privacy controls. This service extends the BaseService pattern and integrates seamlessly with the existing service architecture.

## Features

- **Safe Message Reading**: Read message history from Slack channels and DMs
- **Rate Limiting**: Built-in rate limiting to respect Slack API quotas
- **Message Filtering**: Filter messages by user, content, date range, and sensitive content
- **Privacy Controls**: Automatic redaction of sensitive information (emails, passwords, etc.)
- **Caching**: Optional message caching for improved performance
- **Thread Support**: Read messages from specific threads
- **Search Functionality**: Search messages across channels
- **Error Handling**: Comprehensive error handling with specific Slack error types
- **Audit Logging**: Optional audit trail for message reading operations
- **Service Integration**: Full integration with the service manager and dependency injection

## Architecture

The SlackMessageReaderService follows the established service architecture patterns:

- Extends `BaseService` for consistent lifecycle management
- Implements proper dependency injection through `ServiceManager`
- Uses established logging patterns
- Follows error handling conventions
- Integrates with `CacheService` and `DatabaseService` when available

## Installation

The service is automatically registered when Slack is configured. No additional installation is required.

## Configuration

The service uses the Slack bot token from environment configuration:

```typescript
// Automatically configured when Slack is enabled
const service = serviceManager.getService('slackMessageReaderService') as SlackMessageReaderService;
```

## Usage

### Basic Message Reading

```typescript
import { SlackMessageReaderService } from './services/slack-message-reader.service';

const service = new SlackMessageReaderService(botToken);
await service.initialize();

// Read recent messages
const messages = await service.readMessageHistory('C123456789', {
  limit: 20
});

console.log(`Found ${messages.length} messages`);
```

### Message Filtering

```typescript
const messages = await service.readMessageHistory('C123456789', {
  limit: 50,
  filter: {
    excludeBotMessages: true,
    excludeSystemMessages: true,
    excludeKeywords: ['spam', 'test'],
    userIds: ['U123456789'], // Only messages from specific user
    dateAfter: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
  }
});
```

### Thread Messages

```typescript
const threadMessages = await service.readThreadMessages('C123456789', '1234567890.123456', {
  limit: 100
});
```

### Message Search

```typescript
const searchResults = await service.searchMessages('project update', {
  channels: ['C123456789', 'C987654321'],
  limit: 30,
  sort: 'timestamp',
  sortDir: 'desc'
});
```

### Channel Information

```typescript
const channelInfo = await service.getChannelInfo('C123456789');
console.log(`Channel: ${channelInfo.name} (${channelInfo.type})`);
```

## API Reference

### Methods

#### `readMessageHistory(channelId: string, options?: SlackMessageHistoryOptions): Promise<SlackMessage[]>`

Reads message history from a Slack channel.

**Parameters:**
- `channelId`: The Slack channel ID
- `options`: Optional configuration object

**Returns:** Array of `SlackMessage` objects

#### `readRecentMessages(channelId: string, count?: number, options?: Omit<SlackMessageHistoryOptions, 'limit'>): Promise<SlackMessage[]>`

Reads the most recent messages from a channel.

**Parameters:**
- `channelId`: The Slack channel ID
- `count`: Number of recent messages to read (default: 10)
- `options`: Optional configuration object

#### `readThreadMessages(channelId: string, threadTs: string, options?: SlackMessageHistoryOptions): Promise<SlackMessage[]>`

Reads messages from a specific thread.

**Parameters:**
- `channelId`: The Slack channel ID
- `threadTs`: The thread timestamp
- `options`: Optional configuration object

#### `searchMessages(query: string, options?: SlackMessageSearchOptions): Promise<SlackMessage[]>`

Searches for messages across channels.

**Parameters:**
- `query`: Search query string
- `options`: Optional search configuration

#### `getChannelInfo(channelId: string): Promise<SlackChannelInfo>`

Gets information about a Slack channel.

**Parameters:**
- `channelId`: The Slack channel ID

**Returns:** `SlackChannelInfo` object

### Types

#### `SlackMessage`

```typescript
interface SlackMessage {
  id: string; // Message timestamp (ts)
  channelId: string;
  userId: string;
  text: string;
  timestamp: Date;
  threadTs?: string;
  isThreadReply: boolean;
  subtype?: string;
  botId?: string;
  attachments: SlackAttachment[];
  files: SlackFile[];
  reactions: SlackReaction[];
  edited?: {
    user: string;
    timestamp: Date;
  };
  metadata: {
    clientMsgId?: string;
    type: string;
    hasMore?: boolean;
  };
}
```

#### `SlackMessageFilter`

```typescript
interface SlackMessageFilter {
  excludeBotMessages?: boolean;
  excludeSystemMessages?: boolean;
  excludeSensitiveContent?: boolean;
  excludeKeywords?: string[];
  userIds?: string[]; // Only include messages from these users
  dateAfter?: Date;
  dateBefore?: Date;
}
```

#### `SlackMessageHistoryOptions`

```typescript
interface SlackMessageHistoryOptions {
  limit?: number;
  oldest?: string; // Timestamp
  latest?: string; // Timestamp
  inclusive?: boolean;
  includeAllMetadata?: boolean;
  filter?: SlackMessageFilter;
}
```

## Error Handling

The service provides comprehensive error handling with specific error types:

```typescript
import { SlackMessageReaderError, SlackMessageReaderErrorCode } from './types/slack-message-reader.types';

try {
  const messages = await service.readMessageHistory('C123456789');
} catch (error) {
  if (error instanceof SlackMessageReaderError) {
    switch (error.code) {
      case SlackMessageReaderErrorCode.AUTHENTICATION_FAILED:
        console.error('Authentication failed - check bot token');
        break;
      case SlackMessageReaderErrorCode.NOT_FOUND:
        console.error('Channel not found or not accessible');
        break;
      case SlackMessageReaderErrorCode.PERMISSION_DENIED:
        console.error('Insufficient permissions to read channel');
        break;
      case SlackMessageReaderErrorCode.RATE_LIMIT_EXCEEDED:
        console.error('Rate limit exceeded - wait before retrying');
        break;
      default:
        console.error(`Slack error: ${error.message}`);
    }
  }
}
```

## Rate Limiting

The service implements built-in rate limiting to respect Slack API quotas:

- **Per Minute**: 50 requests (configurable)
- **Per Hour**: 1000 requests (configurable)
- **Per Request**: 100 messages maximum (configurable)

Rate limits are automatically enforced and will throw `SlackMessageReaderError` with code `RATE_LIMIT_EXCEEDED` when exceeded.

## Privacy and Security

### Sensitive Content Detection

The service automatically detects and handles sensitive content:

- Credit card numbers
- Social Security Numbers
- Email addresses
- IP addresses
- Passwords and tokens
- API keys

### Content Redaction

By default, sensitive content is redacted rather than excluded:

```typescript
// Original: "My email is john@example.com and password is secret123"
// Redacted: "My email is [REDACTED-EMAIL] and password: [REDACTED]"
```

### Filtering Options

You can configure filtering behavior:

```typescript
const messages = await service.readMessageHistory('C123456789', {
  filter: {
    excludeSensitiveContent: true, // Exclude instead of redact
    excludeKeywords: ['password', 'secret', 'private']
  }
});
```

## Caching

The service integrates with the `CacheService` when available:

- Messages are cached for 5 minutes by default
- Cache keys include channel ID and options
- Cache expiration is configurable
- Graceful degradation when cache is unavailable

## Audit Logging

When `DatabaseService` is available, the service logs audit information:

- Request ID
- Channel ID
- Message count
- Processing time
- Timestamp
- Success/failure status

## Service Health

Monitor service health and status:

```typescript
const health = service.getHealth();
console.log('Service healthy:', health.healthy);
console.log('Rate limits:', health.details?.rateLimits);
console.log('Dependencies:', health.details?.dependencies);
```

## Testing

The service includes comprehensive test coverage:

- **Unit Tests**: Test individual methods and error handling
- **Integration Tests**: Test service integration and dependencies
- **Mock Support**: Full mocking support for Slack API calls

Run tests:

```bash
# Unit tests
npm test -- slack-message-reader.service.test.ts

# Integration tests
npm test -- slack-message-reader-integration.test.ts
```

## Examples

See `examples/slack-message-reader-examples.ts` for comprehensive usage examples including:

- Basic message reading
- Filtered message reading
- Thread message reading
- Message search
- Channel information
- Error handling patterns
- Service monitoring

## Dependencies

- `@slack/web-api`: Slack Web API client
- `BaseService`: Service lifecycle management
- `CacheService`: Optional message caching
- `DatabaseService`: Optional audit logging
- `ServiceManager`: Dependency injection

## Environment Variables

- `SLACK_BOT_TOKEN`: Required bot token for Slack API access
- `DISABLE_REDIS`: Set to 'true' to disable caching
- `SLACK_MIGRATION_MODE`: Migration mode for Slack integration

## Contributing

When contributing to the SlackMessageReaderService:

1. Follow the established service patterns
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Ensure proper error handling
5. Consider privacy and security implications

## License

This service is part of the AssistantApp project and follows the same licensing terms.
