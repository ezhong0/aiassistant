# Assistant App API Documentation

## Overview

The Assistant App API provides a comprehensive interface for natural language command processing, session management, and task automation. The API is built with TypeScript and follows RESTful principles with enhanced security, rate limiting, and comprehensive logging.

**Base URL:** `http://localhost:3000` (development)
**Version:** 1.0.0
**Authentication:** Bearer Token (JWT)

## Table of Contents

- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Error Handling](#error-handling)
- [API Endpoints](#api-endpoints)
  - [Text Command Processing](#text-command-processing)
  - [Action Confirmation](#action-confirmation)
  - [Session Management](#session-management)
  - [Email Operations](#email-operations)
  - [Health Check](#health-check)
- [Response Types](#response-types)
- [Examples](#examples)

## Authentication

All API endpoints require authentication via JWT Bearer token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Getting a Token

Tokens are obtained through the authentication flow (not covered in this API documentation). The token should include user information and appropriate scopes for the operations you want to perform.

## Rate Limiting

The API implements user-specific rate limiting to ensure fair usage:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/text-command` | 50 requests | 15 minutes |
| `/confirm-action` | 5 requests | 1 hour |
| `/session/:id` (GET) | 20 requests | 15 minutes |
| `/session/:id` (DELETE) | 10 requests | 15 minutes |
| General API | 100 requests | 15 minutes |

Rate limit headers are included in responses:
- `RateLimit-Limit`: Maximum requests in window
- `RateLimit-Remaining`: Requests remaining in current window
- `RateLimit-Reset`: Unix timestamp when window resets

## Error Handling

All API responses follow a consistent format:

```typescript
interface ApiResponse {
  success: boolean;
  type: 'response' | 'action_completed' | 'error' | 'confirmation_required' | 'auth_required';
  message: string;
  data?: unknown;
  error?: string;
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `SESSION_NOT_FOUND` | 404 | Session does not exist |
| `SESSION_EXPIRED` | 410 | Session has expired |
| `SESSION_ACCESS_DENIED` | 403 | User doesn't own session |
| `GOOGLE_AUTH_REQUIRED` | 401 | Google authentication needed |
| `INTERNAL_ERROR` | 500 | Server error |

## API Endpoints

### Text Command Processing

#### POST /assistant/text-command

Process natural language commands and execute appropriate tools.

**Request Body:**
```typescript
{
  command: string;           // The natural language command (required, max 5000 chars)
  sessionId?: string;        // Optional session ID for context
  context?: {
    conversationHistory?: Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp?: string;
    }>;
    pendingActions?: Array<{
      actionId: string;
      type: string;
      parameters: Record<string, unknown>;
      awaitingConfirmation?: boolean;
    }>;
    userPreferences?: {
      language?: string;
      timezone?: string;
      verbosity?: 'minimal' | 'normal' | 'detailed';
    };
  };
}
```

**Response Types:**

1. **Direct Response** (no tools needed):
```json
{
  "success": true,
  "type": "response",
  "message": "I can help you with that...",
  "data": {
    "response": "I can help you with that...",
    "sessionId": "session-123",
    "conversationContext": {...}
  }
}
```

2. **Action Completed**:
```json
{
  "success": true,
  "type": "action_completed",
  "message": "Email sent successfully",
  "data": {
    "sessionId": "session-123",
    "executionStats": {...},
    "toolResults": [...]
  }
}
```

3. **Confirmation Required**:
```json
{
  "success": true,
  "type": "confirmation_required",
  "message": "I'm about to send an email. Would you like me to proceed?",
  "data": {
    "pendingAction": {
      "actionId": "confirm-123",
      "type": "emailAgent",
      "parameters": {...}
    },
    "confirmationPrompt": "Reply with 'yes' to send or 'no' to cancel"
  }
}
```

**Example Request:**
```bash
curl -X POST http://localhost:3000/assistant/text-command \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "Send an email to john@example.com asking about the meeting tomorrow",
    "sessionId": "session-user123-1234567890",
    "context": {
      "userPreferences": {
        "verbosity": "normal"
      }
    }
  }'
```

### Action Confirmation

#### POST /assistant/confirm-action

Confirm or cancel a pending action.

**Request Body:**
```typescript
{
  actionId: string;           // ID of the action to confirm (required)
  confirmed: boolean;         // true to proceed, false to cancel (required)
  sessionId?: string;         // Optional session ID
  parameters?: Record<string, unknown>; // Optional additional parameters
}
```

**Response:**
```json
{
  "success": true,
  "type": "action_completed",
  "message": "Action completed successfully",
  "data": {
    "actionId": "confirm-123",
    "status": "completed",
    "result": {...}
  }
}
```

**Example Request:**
```bash
curl -X POST http://localhost:3000/assistant/confirm-action \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "actionId": "confirm-123",
    "confirmed": true,
    "sessionId": "session-user123-1234567890"
  }'
```

### Session Management

#### GET /assistant/session/:id

Retrieve session information, conversation history, and statistics.

**Parameters:**
- `id` (path): Session ID (required)

**Response:**
```json
{
  "success": true,
  "type": "session_data",
  "message": "Session retrieved successfully",
  "data": {
    "session": {
      "sessionId": "session-123",
      "userId": "user-456",
      "createdAt": "2024-01-01T12:00:00Z",
      "lastActivity": "2024-01-01T12:30:00Z",
      "expiresAt": "2024-01-01T13:00:00Z",
      "isActive": true
    },
    "conversationHistory": [
      {
        "timestamp": "2024-01-01T12:15:00Z",
        "userInput": "Send an email to John",
        "agentResponse": "I'll help you send that email",
        "toolsUsed": ["contactAgent", "emailAgent"],
        "success": true
      }
    ],
    "recentToolResults": [...],
    "statistics": {
      "conversationCount": 5,
      "toolExecutionCount": 12,
      "toolUsage": {
        "emailAgent": 4,
        "contactAgent": 3,
        "Think": 5
      },
      "minutesActive": 30
    }
  }
}
```

**Example Request:**
```bash
curl -X GET http://localhost:3000/assistant/session/session-user123-1234567890 \
  -H "Authorization: Bearer your-jwt-token"
```

#### DELETE /assistant/session/:id

Delete a session and clear its conversation history.

**Parameters:**
- `id` (path): Session ID (required)

**Response:**
```json
{
  "success": true,
  "type": "response",
  "message": "Session deleted successfully",
  "data": {
    "sessionId": "session-123",
    "deletedAt": "2024-01-01T12:45:00Z",
    "conversationCount": 5,
    "toolExecutionCount": 12
  }
}
```

**Example Request:**
```bash
curl -X DELETE http://localhost:3000/assistant/session/session-user123-1234567890 \
  -H "Authorization: Bearer your-jwt-token"
```

### Email Operations

#### POST /assistant/email/send

Send an email directly (bypasses natural language processing).

**Request Body:**
```typescript
{
  to: string | string[];      // Recipient email(s) (required)
  subject: string;            // Email subject (required)
  body: string;               // Email body (required)
  cc?: string | string[];     // CC recipients (optional)
  bcc?: string | string[];    // BCC recipients (optional)
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email sent successfully",
  "data": {
    "messageId": "msg-123",
    "threadId": "thread-456"
  },
  "executionTime": 1234
}
```

#### GET /assistant/email/search

Search emails in the user's mailbox.

**Query Parameters:**
- `q` (string): Search query (required)
- `maxResults` (number): Maximum results to return (optional, default: 20, max: 100)

**Response:**
```json
{
  "success": true,
  "message": "Search completed",
  "data": {
    "emails": [...],
    "resultCount": 5,
    "searchQuery": "from:john"
  },
  "executionTime": 567
}
```

**Example Request:**
```bash
curl -X GET "http://localhost:3000/assistant/email/search?q=from:john&maxResults=10" \
  -H "Authorization: Bearer your-jwt-token"
```

### Health Check

#### GET /health

Check the health status of the API and its dependencies.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "uptime": 3600,
  "environment": "development",
  "version": "1.0.0",
  "memory": {
    "used": 45.2,
    "total": 128.0,
    "rss": 67.8,
    "external": 12.1
  },
  "services": {
    "masterAgent": {
      "status": "healthy",
      "responseTime": 12,
      "lastCheck": "2024-01-01T12:00:00Z"
    },
    "toolExecutor": {
      "status": "healthy",
      "responseTime": 8,
      "lastCheck": "2024-01-01T12:00:00Z"
    },
    "emailAgent": {
      "status": "healthy",
      "responseTime": 15,
      "lastCheck": "2024-01-01T12:00:00Z"
    },
    "sessionService": {
      "status": "healthy",
      "responseTime": 3,
      "lastCheck": "2024-01-01T12:00:00Z"
    }
  },
  "rateLimiting": {
    "totalEntries": 42,
    "memoryUsage": 1234567
  },
  "nodeVersion": "v18.17.0",
  "pid": 12345
}
```

## Response Types

### Success Response Types

- `response`: Simple informational response
- `action_completed`: Action was successfully executed
- `partial_success`: Some actions succeeded, others failed
- `confirmation_required`: User confirmation needed before proceeding
- `session_data`: Session information response

### Error Response Types

- `error`: General error occurred
- `auth_required`: Authentication/authorization needed

## Examples

### Complete Workflow Example

1. **Send a text command:**
```bash
curl -X POST http://localhost:3000/assistant/text-command \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "Send an email to john@example.com with subject \"Meeting Tomorrow\" saying \"Hi John, can we reschedule our meeting for 3pm?\""
  }'
```

2. **If confirmation required, confirm the action:**
```bash
curl -X POST http://localhost:3000/assistant/confirm-action \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "actionId": "confirm-abc123",
    "confirmed": true
  }'
```

3. **Check session history:**
```bash
curl -X GET http://localhost:3000/assistant/session/session-user123-1234567890 \
  -H "Authorization: Bearer your-jwt-token"
```

### Error Handling Example

```bash
# Request with invalid data
curl -X POST http://localhost:3000/assistant/text-command \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"command": ""}'

# Response:
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "data": {
    "details": ["body.command: String must contain at least 1 character(s)"]
  }
}
```

### Rate Limiting Example

```bash
# When rate limit is exceeded:
{
  "success": false,
  "error": "RATE_LIMITED",
  "message": "Too many requests. Maximum 50 requests per 15 minutes per user.",
  "data": {
    "retryAfter": 300,
    "windowMs": 900000,
    "maxRequests": 50
  }
}
```

## Security Considerations

1. **Authentication**: All endpoints require valid JWT tokens
2. **Rate Limiting**: Prevents abuse with per-user limits
3. **Input Validation**: All inputs are validated and sanitized
4. **Session Isolation**: Users can only access their own sessions
5. **Logging**: Comprehensive logging with sensitive data redaction
6. **Error Handling**: No sensitive information leaked in error messages

## SDK Integration

The API is designed to work seamlessly with client SDKs. Response types are fully typed with TypeScript interfaces for better development experience.

For questions or support, please refer to the project documentation or contact the development team.