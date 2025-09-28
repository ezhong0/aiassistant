# API Client Usage Examples

This document provides practical examples of how to use the standardized API clients in your application.

## Quick Start

```typescript
import { getAPIClient } from './services/api';

// Get a Google API client
const googleClient = await getAPIClient('google');

// Authenticate
await googleClient.authenticate({
  type: 'oauth2',
  accessToken: 'your-google-access-token'
});

// Make a request
const response = await googleClient.makeRequest({
  method: 'GET',
  endpoint: '/gmail/v1/users/me/messages',
  query: { maxResults: 10 }
});
```

## Google API Examples

### Gmail Operations

```typescript
import { getAPIClient } from './services/api';

const googleClient = await getAPIClient('google');
await googleClient.authenticate({
  type: 'oauth2',
  accessToken: 'your-token'
});

// Send an email
const sendResponse = await googleClient.makeRequest({
  method: 'POST',
  endpoint: '/gmail/v1/users/me/messages/send',
  data: {
    raw: Buffer.from(`
      To: recipient@example.com
      Subject: Test Email
      Content-Type: text/plain
      
      This is a test email.
    `).toString('base64')
  }
});

// Search emails
const searchResponse = await googleClient.makeRequest({
  method: 'GET',
  endpoint: '/gmail/v1/users/me/messages/list',
  query: {
    q: 'from:important@company.com',
    maxResults: 10
  }
});

// Get email details
const emailResponse = await googleClient.makeRequest({
  method: 'GET',
  endpoint: '/gmail/v1/users/me/messages/get',
  query: {
    id: 'message-id',
    format: 'full'
  }
});
```

### Calendar Operations

```typescript
// Create a calendar event
const eventResponse = await googleClient.makeRequest({
  method: 'POST',
  endpoint: '/calendar/v3/calendars/primary/events/insert',
  data: {
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
  }
});

// List calendar events
const eventsResponse = await googleClient.makeRequest({
  method: 'GET',
  endpoint: '/calendar/v3/calendars/primary/events/list',
  query: {
    timeMin: '2024-01-01T00:00:00Z',
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime'
  }
});

// Check availability
const availabilityResponse = await googleClient.makeRequest({
  method: 'POST',
  endpoint: '/calendar/v3/freebusy/query',
  data: {
    timeMin: '2024-01-15T09:00:00Z',
    timeMax: '2024-01-15T17:00:00Z',
    items: [{ id: 'primary' }]
  }
});
```

### Contacts Operations

```typescript
// List contacts
const contactsResponse = await googleClient.makeRequest({
  method: 'GET',
  endpoint: '/people/v1/people/me/connections',
  query: {
    personFields: 'names,emailAddresses,phoneNumbers',
    pageSize: 100
  }
});

// Create a contact
const createContactResponse = await googleClient.makeRequest({
  method: 'POST',
  endpoint: '/people/v1/people:createContact',
  data: {
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
  }
});
```

## Slack API Examples

```typescript
import { getAPIClient } from './services/api';

const slackClient = await getAPIClient('slack');
await slackClient.authenticate({
  type: 'bearer',
  accessToken: 'xoxb-your-slack-bot-token'
});

// Send a message
const messageResponse = await slackClient.makeRequest({
  method: 'POST',
  endpoint: '/chat.postMessage',
  data: {
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
  }
});

// Get channel history
const historyResponse = await slackClient.makeRequest({
  method: 'GET',
  endpoint: '/conversations.history',
  query: {
    channel: 'C1234567890',
    limit: 10
  }
});

// Get user info
const userResponse = await slackClient.makeRequest({
  method: 'GET',
  endpoint: '/users.info',
  query: {
    user: 'U1234567890'
  }
});

// Upload a file
const fileResponse = await slackClient.makeRequest({
  method: 'POST',
  endpoint: '/files.upload',
  data: {
    channels: '#general',
    content: 'File content here',
    filename: 'example.txt',
    title: 'Example File'
  }
});
```

## OpenAI API Examples

```typescript
import { getAPIClient } from './services/api';

const openaiClient = await getAPIClient('openai');
await openaiClient.authenticate({
  type: 'api_key',
  apiKey: 'sk-your-openai-api-key'
});

// Chat completion
const chatResponse = await openaiClient.makeRequest({
  method: 'POST',
  endpoint: '/chat/completions',
  data: {
    model: 'gpt-4',
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
    temperature: 0.7,
    max_tokens: 150
  }
});

// Text completion
const textResponse = await openaiClient.makeRequest({
  method: 'POST',
  endpoint: '/completions',
  data: {
    model: 'text-davinci-003',
    prompt: 'The future of AI is',
    max_tokens: 100,
    temperature: 0.7
  }
});

// Generate embeddings
const embeddingResponse = await openaiClient.makeRequest({
  method: 'POST',
  endpoint: '/embeddings',
  data: {
    model: 'text-embedding-ada-002',
    input: 'The quick brown fox jumps over the lazy dog.'
  }
});

// Generate images
const imageResponse = await openaiClient.makeRequest({
  method: 'POST',
  endpoint: '/images/generations',
  data: {
    prompt: 'A beautiful sunset over the ocean',
    n: 1,
    size: '1024x1024'
  }
});
```

## Error Handling

```typescript
import { getAPIClient } from './services/api';

try {
  const client = await getAPIClient('google');
  await client.authenticate({ type: 'oauth2', accessToken: 'token' });
  
  const response = await client.makeRequest({
    method: 'GET',
    endpoint: '/gmail/v1/users/me/messages'
  });
  
  console.log('Success:', response.data);
} catch (error) {
  if (error.code === 'GOOGLE_AUTH_FAILED') {
    console.log('Authentication failed - please reconnect your Google account');
  } else if (error.code === 'GOOGLE_RATE_LIMIT') {
    console.log('Rate limit exceeded - please try again later');
  } else if (error.category === 'network') {
    console.log('Network error - please check your connection');
  } else {
    console.log('Unexpected error:', error.message);
  }
}
```

## Health Monitoring

```typescript
import { getAPIClientHealth, testAllAPIConnections } from './services/api';

// Check health of all API clients
const health = await getAPIClientHealth();
console.log('API Health:', health);

// Test all connections
const connections = await testAllAPIConnections();
console.log('Connection Tests:', connections);

// Check individual client health
const googleClient = await getAPIClient('google');
const clientHealth = googleClient.getHealth();
console.log('Google Client Health:', clientHealth);
```

## Configuration Override

```typescript
import { getAPIClient } from './services/api';

// Get client with custom configuration
const customClient = await getAPIClient('openai', {
  timeout: 120000, // 2 minutes
  retry: {
    maxAttempts: 5,
    baseDelay: 2000
  }
});
```

## Best Practices

1. **Always handle errors**: Use try-catch blocks and check error codes
2. **Authenticate before requests**: Ensure clients are authenticated
3. **Use appropriate timeouts**: Set reasonable timeouts for different APIs
4. **Monitor health**: Regularly check client health status
5. **Handle rate limits**: Implement backoff strategies for rate-limited APIs
6. **Log requests**: Use the built-in logging for debugging
7. **Test connections**: Verify API connectivity before making requests

## Migration from Old Services

```typescript
// Old way (direct service usage)
import { GmailService } from './services/email/gmail.service';
const gmailService = new GmailService();
await gmailService.initialize();
const emails = await gmailService.searchEmails(accessToken, query);

// New way (standardized API client)
import { getAPIClient } from './services/api';
const googleClient = await getAPIClient('google');
await googleClient.authenticate({ type: 'oauth2', accessToken });
const response = await googleClient.makeRequest({
  method: 'GET',
  endpoint: '/gmail/v1/users/me/messages/list',
  query: { q: query }
});
```
