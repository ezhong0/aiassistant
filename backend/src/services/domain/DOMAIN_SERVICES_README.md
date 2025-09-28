# Domain Services

This module provides high-level business logic services that wrap the standardized API clients. These services offer clean, domain-specific interfaces for agents and other application components.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Layer                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │ Email Agent │ │Calendar Agent│ │ Slack Agent │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                Domain Service Layer                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │Email Service│ │Calendar Svc │ │ Slack Svc   │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                API Client Layer                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │Google Client│ │Slack Client │ │OpenAI Client│          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

## Available Services

### 1. EmailDomainService

High-level email operations using Google Gmail API.

**Features:**
- Send emails with rich formatting and attachments
- Search emails with advanced query capabilities
- Retrieve email details and threads
- Manage email drafts and replies
- Handle attachments and file operations

**Usage:**
```typescript
import { EmailDomainService } from './services/domain';

const emailService = new EmailDomainService();
await emailService.initialize();

// Authenticate
await emailService.authenticate(accessToken, refreshToken);

// Send email
const result = await emailService.sendEmail({
  to: 'recipient@example.com',
  subject: 'Test Email',
  body: 'This is a test email.',
  attachments: [{
    filename: 'document.pdf',
    content: 'base64-encoded-content',
    contentType: 'application/pdf'
  }]
});

// Search emails
const emails = await emailService.searchEmails({
  query: 'from:important@company.com',
  maxResults: 10
});

// Get email details
const email = await emailService.getEmail(messageId);
```

### 2. CalendarDomainService

High-level calendar operations using Google Calendar API.

**Features:**
- Create, update, and delete calendar events
- List events with filtering and pagination
- Check availability and find free time slots
- Manage multiple calendars
- Handle recurring events and conference data

**Usage:**
```typescript
import { CalendarDomainService } from './services/domain';

const calendarService = new CalendarDomainService();
await calendarService.initialize();

// Authenticate
await calendarService.authenticate(accessToken, refreshToken);

// Create event
const event = await calendarService.createEvent({
  summary: 'Team Meeting',
  start: {
    dateTime: '2024-01-15T10:00:00-07:00',
    timeZone: 'America/Los_Angeles'
  },
  end: {
    dateTime: '2024-01-15T11:00:00-07:00',
    timeZone: 'America/Los_Angeles'
  },
  attendees: [
    { email: 'attendee1@example.com' },
    { email: 'attendee2@example.com' }
  ]
});

// Check availability
const availability = await calendarService.checkAvailability({
  timeMin: '2024-01-15T09:00:00Z',
  timeMax: '2024-01-15T17:00:00Z',
  calendarIds: ['primary']
});

// Find available slots
const slots = await calendarService.findAvailableSlots({
  startDate: '2024-01-15T09:00:00Z',
  endDate: '2024-01-15T17:00:00Z',
  durationMinutes: 60
});
```

### 3. ContactsDomainService

High-level contacts operations using Google People API.

**Features:**
- Create, update, and delete contacts
- Search and list contacts with filtering
- Manage contact groups and labels
- Handle contact photos and metadata

**Usage:**
```typescript
import { ContactsDomainService } from './services/domain';

const contactsService = new ContactsDomainService();
await contactsService.initialize();

// Authenticate
await contactsService.authenticate(accessToken, refreshToken);

// Create contact
const contact = await contactsService.createContact({
  names: [{
    givenName: 'John',
    familyName: 'Doe'
  }],
  emailAddresses: [{
    value: 'john.doe@example.com',
    type: 'work'
  }],
  phoneNumbers: [{
    value: '+1-555-123-4567',
    type: 'work'
  }]
});

// List contacts
const contacts = await contactsService.listContacts({
  pageSize: 100,
  personFields: ['names', 'emailAddresses', 'phoneNumbers']
});

// Search contacts
const searchResults = await contactsService.searchContacts({
  query: 'John',
  pageSize: 50
});
```

### 4. SlackDomainService

High-level Slack operations using Slack Web API.

**Features:**
- Send and manage messages
- Channel and conversation operations
- User and team information
- File uploads and management

**Usage:**
```typescript
import { SlackDomainService } from './services/domain';

const slackService = new SlackDomainService();
await slackService.initialize();

// Authenticate
await slackService.authenticate(botToken);

// Send message
const message = await slackService.sendMessage({
  channel: '#general',
  text: 'Hello from the assistant!',
  blocks: [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Bold text* and _italic text_'
      }
    }
  ]
});

// Get channel history
const history = await slackService.getChannelHistory({
  channel: 'C1234567890',
  limit: 10
});

// Upload file
const file = await slackService.uploadFile({
  channels: '#general',
  content: 'File content here',
  filename: 'example.txt',
  title: 'Example File'
});
```

### 5. AIDomainService

High-level AI operations using OpenAI API.

**Features:**
- Chat completions with GPT models
- Text completions and generation
- Embeddings for semantic search
- Image generation with DALL-E
- Audio transcription and translation

**Usage:**
```typescript
import { AIDomainService } from './services/domain';

const aiService = new AIDomainService();
await aiService.initialize();

// Authenticate
await aiService.authenticate(apiKey);

// Generate chat completion
const chatResponse = await aiService.generateChatCompletion({
  messages: [
    {
      role: 'system',
      content: 'You are a helpful assistant.'
    },
    {
      role: 'user',
      content: 'What is the capital of France?'
    }
  ],
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 150
});

// Generate embeddings
const embeddings = await aiService.generateEmbeddings({
  input: 'The quick brown fox jumps over the lazy dog.',
  model: 'text-embedding-ada-002'
});

// Generate images
const images = await aiService.generateImages({
  prompt: 'A beautiful sunset over the ocean',
  n: 1,
  size: '1024x1024'
});

// Transcribe audio
const transcription = await aiService.transcribeAudio({
  file: audioBuffer,
  model: 'whisper-1',
  language: 'en'
});
```

## Service Lifecycle

All domain services follow the same lifecycle pattern:

```typescript
// 1. Create service instance
const service = new EmailDomainService();

// 2. Initialize (sets up API clients)
await service.initialize();

// 3. Authenticate (if required)
await service.authenticate(credentials);

// 4. Use service methods
const result = await service.someMethod(params);

// 5. Cleanup (when done)
await service.destroy();
```

## Error Handling

All services provide consistent error handling:

```typescript
try {
  const result = await service.someMethod(params);
  // Handle success
} catch (error) {
  if (error.code === 'AUTH_FAILED') {
    // Handle authentication error
  } else if (error.code === 'RATE_LIMIT') {
    // Handle rate limit
  } else if (error.category === 'network') {
    // Handle network errors
  } else {
    // Handle other errors
  }
}
```

## Health Monitoring

All services provide health status:

```typescript
const health = service.getHealth();
console.log('Service healthy:', health.healthy);
console.log('Details:', health.details);
```

## Benefits

1. **Clean Interface**: Simple, domain-specific methods
2. **Consistent Patterns**: All services follow the same patterns
3. **Error Handling**: Standardized error handling across all services
4. **Type Safety**: Full TypeScript support with proper types
5. **Logging**: Comprehensive logging for debugging and monitoring
6. **Health Monitoring**: Built-in health checks for all services
7. **Authentication**: Consistent authentication patterns
8. **Lifecycle Management**: Proper initialization and cleanup

## Migration from Old Services

```typescript
// Old way (direct service usage)
import { GmailService } from './services/email/gmail.service';
const gmailService = new GmailService();
await gmailService.initialize();
const emails = await gmailService.searchEmails(accessToken, query);

// New way (domain service)
import { EmailDomainService } from './services/domain';
const emailService = new EmailDomainService();
await emailService.initialize();
await emailService.authenticate(accessToken);
const emails = await emailService.searchEmails({ query });
```

## Next Steps

1. **Create Tool Methods**: Wrap domain service methods in standardized tool interfaces
2. **Update Agents**: Modify agents to use the new domain services
3. **Remove Old Services**: Clean up old service implementations
4. **Add Tests**: Create comprehensive tests for all domain services
5. **Documentation**: Add detailed API documentation for each service
