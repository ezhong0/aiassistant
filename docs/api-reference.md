# API Reference

Complete reference for the Assistant App Backend API endpoints.

## Base URL

- **Development:** `http://localhost:3000`
- **Production:** `https://your-domain.com`

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```http
Authorization: Bearer <jwt_token>
```

Get JWT tokens through the OAuth flow or token exchange endpoints.

## Response Format

All API responses follow this standard format:

```typescript
interface APIResponse<T> {
  success: boolean;
  type: 'response' | 'action_completed' | 'confirmation_required' | 'error';
  message: string;
  data?: T;
  error?: string;
  timestamp?: string;
}
```

## Authentication Endpoints

### `GET /auth/google`

Initiates Google OAuth flow.

**Rate Limit:** 10 requests per 15 minutes per IP

**Response:** Redirects to Google OAuth consent screen

**Example:**
```bash
curl -X GET http://localhost:3000/auth/google
# Redirects to Google OAuth
```

### `GET /auth/callback`

Handles OAuth callback from Google.

**Rate Limit:** 10 requests per 15 minutes per IP

**Query Parameters:**
- `code` (string) - Authorization code from Google
- `state` (string) - CSRF protection state
- `error` (string, optional) - Error code if OAuth failed

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "userId": "google_123456789",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "expiresAt": "2024-01-02T12:00:00.000Z"
}
```

### `POST /auth/refresh`

Refreshes expired access tokens.

**Rate Limit:** 10 requests per 15 minutes per IP

**Request Body:**
```json
{
  "refresh_token": "1//04-refresh-token"
}
```

**Response:**
```json
{
  "success": true,
  "token": "new-jwt-token",
  "expiresAt": "2024-01-02T12:00:00.000Z"
}
```

### `POST /auth/exchange-mobile-tokens`

Exchanges mobile OAuth tokens for JWT.

**Request Body:**
```json
{
  "access_token": "ya29.access-token",
  "platform": "web" | "slack"
}
```

### `POST /auth/logout`

Logs out user and revokes tokens.

**Request Body:**
```json
{
  "access_token": "access-token",
  "everywhere": false
}
```

### `GET /auth/validate`

Validates JWT tokens.

**Headers:** `Authorization: Bearer <jwt_token>`

**Response:**
```json
{
  "valid": true,
  "payload": {
    "sub": "user-id",
    "email": "user@example.com"
  }
}
```

## Assistant Endpoints

### `POST /api/assistant/text-command`

Main assistant endpoint for processing natural language commands.

**Authentication:** Required

**Rate Limit:** 30 requests per 15 minutes per user

**Request Body:**
```json
{
  "command": "Send email to john@example.com about meeting",
  "sessionId": "optional-session-id",
  "accessToken": "google-access-token",
  "context": {
    "conversationHistory": [
      {
        "role": "user",
        "content": "Previous message",
        "timestamp": "2024-01-01T12:00:00.000Z"
      }
    ],
    "pendingActions": [],
    "userPreferences": {
      "timezone": "America/New_York",
      "verbosity": "normal"
    }
  }
}
```

**Response Types:**

#### Confirmation Required
```json
{
  "success": true,
  "type": "confirmation_required",
  "message": "I'm about to send an email to john@example.com. Should I proceed?",
  "data": {
    "sessionId": "session-123",
    "pendingActions": [
      {
        "actionId": "action-456",
        "type": "email",
        "parameters": {
          "to": "john@example.com",
          "subject": "Meeting"
        },
        "awaitingConfirmation": true
      }
    ],
    "confirmationPrompt": "Reply with 'yes' to send or 'no' to cancel"
  }
}
```

#### Action Completed
```json
{
  "success": true,
  "type": "action_completed",
  "message": "Email sent successfully to john@example.com",
  "data": {
    "sessionId": "session-123",
    "toolResults": [
      {
        "toolName": "emailAgent",
        "success": true,
        "result": {
          "messageId": "msg-123",
          "status": "sent"
        },
        "executionTime": 1500
      }
    ]
  }
}
```

#### Simple Response
```json
{
  "success": true,
  "type": "response",
  "message": "I can help you with email, calendar, and contact management. What would you like to do?",
  "data": {
    "sessionId": "session-123"
  }
}
```

### `POST /api/assistant/confirm-action`

Confirm or cancel pending actions.

**Authentication:** Required

**Request Body:**
```json
{
  "actionId": "action-456",
  "confirmed": true,
  "sessionId": "session-123",
  "parameters": {
    "additional": "parameters"
  }
}
```

**Response:**
```json
{
  "success": true,
  "type": "action_completed",
  "message": "Email sent successfully",
  "data": {
    "actionId": "action-456",
    "status": "completed",
    "result": {
      "messageId": "msg-789"
    }
  }
}
```

### `GET /api/assistant/session/:id`

Retrieve session information and conversation history.

**Authentication:** Required

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
      "createdAt": "2024-01-01T10:00:00.000Z",
      "lastActivity": "2024-01-01T12:00:00.000Z",
      "isActive": true
    },
    "conversationHistory": [
      {
        "timestamp": "2024-01-01T12:00:00.000Z",
        "userInput": "Send email to john@example.com",
        "agentResponse": "Email sent successfully",
        "toolsUsed": ["emailAgent"],
        "success": true
      }
    ],
    "statistics": {
      "totalSessions": 5,
      "activeSessions": 2
    }
  }
}
```

### `DELETE /api/assistant/session/:id`

Delete a session and clear conversation history.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "type": "response",
  "message": "Session deleted successfully",
  "data": {
    "sessionId": "session-123",
    "deletedAt": "2024-01-01T12:00:00.000Z"
  }
}
```

### `POST /api/assistant/email/send`

Direct email sending endpoint.

**Authentication:** Required

**Request Body:**
```json
{
  "to": ["john@example.com"],
  "subject": "Meeting Request",
  "body": "Let's schedule a meeting for next week.",
  "cc": ["manager@example.com"],
  "bcc": []
}
```

### `GET /api/assistant/email/search`

Search emails.

**Authentication:** Required

**Query Parameters:**
- `q` (string) - Search query
- `maxResults` (number) - Maximum results (default: 10, max: 50)

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
     "http://localhost:3000/api/assistant/email/search?q=from:john@example.com&maxResults=20"
```

### `GET /api/assistant/status`

Get assistant service status.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "status": "operational",
  "services": {
    "masterAgent": "ready",
    "toolExecutor": "ready",
    "emailAgent": "ready"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Protected Endpoints

### `GET /protected/profile`

Get user profile information.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "user": {
    "userId": "user-123",
    "email": "user@example.com",
    "name": "John Doe",
    "picture": "https://lh3.googleusercontent.com/..."
  }
}
```

### `PUT /protected/profile`

Update user profile.

**Authentication:** Required

**Request Body:**
```json
{
  "name": "John Smith",
  "preferences": {
    "timezone": "America/New_York",
    "language": "en"
  }
}
```

## System Endpoints

### `GET /health`

System health check.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600.5,
  "environment": "production",
  "memory": {
    "used": 128.5,
    "total": 512.0
  },
  "services": {
    "database": "healthy",
    "openai": "healthy"
  }
}
```

### `GET /`

API information.

**Response:**
```json
{
  "message": "Assistant App API",
  "version": "1.0.0",
  "environment": "production",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Error Responses

### Standard Error Format

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human readable error message",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Common Error Codes

- `AUTHENTICATION_REQUIRED` (401) - Missing or invalid token
- `ACCESS_DENIED` (403) - Insufficient permissions
- `RATE_LIMIT_EXCEEDED` (429) - Too many requests
- `VALIDATION_ERROR` (400) - Invalid request data
- `SESSION_NOT_FOUND` (404) - Session does not exist
- `SERVICE_UNAVAILABLE` (503) - Service temporarily unavailable

## Rate Limits

- **Authentication endpoints:** 10 requests per 15 minutes per IP
- **Assistant text-command:** 30 requests per 15 minutes per user
- **Session operations:** 20 requests per 15 minutes per user
- **Email operations:** 10 requests per 15 minutes per user
- **General API:** 100 requests per 15 minutes per user

Rate limit headers are included in responses:
- `RateLimit-Limit` - Request limit
- `RateLimit-Remaining` - Remaining requests
- `RateLimit-Reset` - Reset time (Unix timestamp)

## SDKs and Examples

### JavaScript/TypeScript

```typescript
class AssistantAPI {
  constructor(private baseURL: string, private token: string) {}

  async sendCommand(command: string, sessionId?: string) {
    const response = await fetch(`${this.baseURL}/api/assistant/text-command`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ command, sessionId })
    });
    return response.json();
  }
}

// Usage
const api = new AssistantAPI('http://localhost:3000', 'your-jwt-token');
const result = await api.sendCommand('Send email to john@example.com');
```

### cURL Examples

```bash
# Get health status
curl http://localhost:3000/health

# Authenticate and send command
TOKEN="your-jwt-token"
curl -X POST http://localhost:3000/api/assistant/text-command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "Send email to john@example.com about meeting"}'

# Get session information
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/api/assistant/session/session-123
```