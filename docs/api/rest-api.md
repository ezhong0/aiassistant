# REST API

The AI Assistant Platform provides a comprehensive REST API for interacting with the AI-first multi-agent system. This document details all available endpoints, request/response formats, and authentication requirements.

## 🔐 **Authentication**

All API endpoints require authentication via JWT tokens.

### **Obtaining a JWT Token**

```bash
# Exchange OAuth code for JWT token
curl -X POST http://localhost:3000/auth/exchange \
  -H "Content-Type: application/json" \
  -d '{
    "code": "oauth-authorization-code",
    "state": "optional-state"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "jwt-token-here",
    "refreshToken": "refresh-token-here",
    "expiresIn": 86400,
    "user": {
      "userId": "user-123",
      "email": "user@example.com",
      "name": "John Doe"
    }
  }
}
```

### **Using JWT Tokens**

Include the JWT token in the Authorization header:

```bash
curl -X POST http://localhost:3000/assistant/text-command \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer jwt-token-here" \
  -d '{"command": "send email to john@example.com"}'
```

## 📧 **Assistant API**

### **Text Command Processing**

**Endpoint:** `POST /assistant/text-command`

Process natural language commands using the AI-first multi-agent system.

**Request:**
```json
{
  "command": "send email to john@example.com about project update",
  "sessionId": "session-123",
  "accessToken": "gmail-access-token",
  "context": {
    "pendingActions": [],
    "slack": {
      "channelId": "C1234567890",
      "teamId": "T1234567890",
      "userId": "U1234567890"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "type": "confirmation_required",
  "message": "I'll send an email to john@example.com about the project update. Please confirm to proceed.",
  "data": {
    "toolCalls": [
      {
        "name": "manage_emails",
        "parameters": {
          "operation": "send",
          "contactEmail": "john@example.com",
          "subject": "Project Update",
          "body": "Here's the latest project update..."
        }
      }
    ],
    "proposal": {
      "type": "email_send",
      "title": "Send Email Confirmation",
      "message": "Are you sure you want to send this email?",
      "details": {
        "to": "john@example.com",
        "subject": "Project Update",
        "body": "Here's the latest project update..."
      },
      "actions": [
        {
          "label": "Send Email",
          "action": "confirm",
          "style": "primary"
        },
        {
          "label": "Cancel",
          "action": "cancel",
          "style": "secondary"
        }
      ]
    }
  },
  "metadata": {
    "sessionId": "session-123",
    "userId": "user-123",
    "contextType": "none",
    "confidence": 0.95,
    "intent": "send_email",
    "entities": {
      "recipient": "john@example.com",
      "subject": "project update"
    }
  }
}
```

### **Tool Execution**

**Endpoint:** `POST /assistant/execute-tool`

Execute a specific tool with parameters.

**Request:**
```json
{
  "toolName": "manage_emails",
  "parameters": {
    "operation": "send",
    "contactEmail": "john@example.com",
    "subject": "Project Update",
    "body": "Here's the latest project update..."
  },
  "sessionId": "session-123",
  "accessToken": "gmail-access-token"
}
```

**Response:**
```json
{
  "success": true,
  "type": "action_completed",
  "message": "Email sent successfully to john@example.com",
  "data": {
    "toolName": "manage_emails",
    "result": {
      "id": "email-123",
      "threadId": "thread-123",
      "recipient": "john@example.com",
      "subject": "Project Update"
    },
    "executionTime": 1250
  },
  "metadata": {
    "sessionId": "session-123",
    "userId": "user-123",
    "operation": "send",
    "recipientCount": 1
  }
}
```

### **Confirmation Handling**

**Endpoint:** `POST /assistant/confirm-action`

Confirm or cancel a pending action.

**Request:**
```json
{
  "actionId": "action-123",
  "action": "confirm",
  "sessionId": "session-123"
}
```

**Response:**
```json
{
  "success": true,
  "type": "action_completed",
  "message": "Email sent successfully to john@example.com",
  "data": {
    "actionId": "action-123",
    "result": {
      "id": "email-123",
      "threadId": "thread-123"
    }
  }
}
```

## 🔐 **Authentication API**

### **OAuth URL Generation**

**Endpoint:** `GET /auth/google/url`

Generate Google OAuth authorization URL.

**Response:**
```json
{
  "success": true,
  "data": {
    "authUrl": "https://accounts.google.com/oauth/authorize?...",
    "state": "random-state-string"
  }
}
```

### **OAuth Token Exchange**

**Endpoint:** `POST /auth/google/exchange`

Exchange OAuth authorization code for tokens.

**Request:**
```json
{
  "code": "oauth-authorization-code",
  "state": "state-string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "jwt-token-here",
    "refreshToken": "refresh-token-here",
    "expiresIn": 86400,
    "user": {
      "userId": "user-123",
      "email": "user@example.com",
      "name": "John Doe",
      "picture": "https://..."
    }
  }
}
```

### **Token Refresh**

**Endpoint:** `POST /auth/refresh`

Refresh expired JWT token.

**Request:**
```json
{
  "refreshToken": "refresh-token-here"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "new-jwt-token-here",
    "expiresIn": 86400
  }
}
```

## 👤 **Protected Routes**

### **User Profile**

**Endpoint:** `GET /protected/profile`

Get current user profile information.

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user-123",
    "email": "user@example.com",
    "name": "John Doe",
    "picture": "https://...",
    "lastLogin": "2024-01-01T00:00:00.000Z",
    "permissions": ["read", "write"]
  }
}
```

### **Update Profile**

**Endpoint:** `PUT /protected/profile`

Update user profile information.

**Request:**
```json
{
  "name": "John Smith",
  "picture": "https://new-picture-url.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "userId": "user-123",
    "email": "user@example.com",
    "name": "John Smith",
    "picture": "https://new-picture-url.com"
  }
}
```

## 📊 **Health & Monitoring**

### **Overall Health**

**Endpoint:** `GET /health`

Get overall system health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "database": "healthy",
    "cache": "healthy",
    "openai": "configured",
    "gmail": "configured",
    "calendar": "configured",
    "slack": "configured"
  },
  "metrics": {
    "uptime": 86400,
    "memoryUsage": {
      "rss": 150,
      "heapTotal": 100,
      "heapUsed": 80,
      "external": 20
    },
    "cache": {
      "hitRate": 0.85,
      "totalHits": 1000,
      "totalMisses": 150
    }
  }
}
```

### **Service Health**

**Endpoint:** `GET /health/service/{serviceName}`

Get health status for a specific service.

**Response:**
```json
{
  "healthy": true,
  "details": {
    "state": "ready",
    "name": "emailService",
    "dependencies": ["databaseService", "cacheService"],
    "priority": 25,
    "autoStart": true,
    "uptime": 86400,
    "lastError": null
  }
}
```

### **Dependencies**

**Endpoint:** `GET /health/dependencies`

Get service dependency graph.

**Response:**
```json
{
  "services": {
    "configService": {
      "priority": 1,
      "autoStart": true,
      "state": "ready",
      "healthy": true
    },
    "emailService": {
      "priority": 25,
      "autoStart": true,
      "state": "ready",
      "healthy": true
    }
  },
  "dependencies": {
    "emailService": ["databaseService", "cacheService"],
    "calendarService": ["databaseService", "cacheService"]
  },
  "initializationOrder": [
    "configService",
    "databaseService",
    "cacheService",
    "emailService",
    "calendarService"
  ]
}
```

## 🔧 **Error Handling**

### **Error Response Format**

All errors follow a consistent format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "specific error details",
    "timestamp": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### **Common Error Codes**

- **`MISSING_TOKEN`**: JWT token not provided
- **`INVALID_TOKEN`**: JWT token is invalid or expired
- **`VALIDATION_ERROR`**: Request validation failed
- **`RATE_LIMIT_EXCEEDED`**: Rate limit exceeded
- **`SERVICE_UNAVAILABLE`**: Required service is not available
- **`AI_PLANNING_FAILED`**: AI planning failed
- **`EMAIL_SEND_FAILED`**: Email sending failed
- **`CALENDAR_CREATE_FAILED`**: Calendar event creation failed

### **HTTP Status Codes**

- **200**: Success
- **201**: Created
- **400**: Bad Request (validation error)
- **401**: Unauthorized (missing/invalid token)
- **403**: Forbidden (insufficient permissions)
- **404**: Not Found
- **429**: Too Many Requests (rate limit exceeded)
- **500**: Internal Server Error
- **503**: Service Unavailable

## 📝 **Request/Response Examples**

### **Email Operations**

**Send Email:**
```bash
curl -X POST http://localhost:3000/assistant/text-command \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer jwt-token" \
  -d '{
    "command": "send email to john@example.com about meeting tomorrow",
    "sessionId": "session-123",
    "accessToken": "gmail-access-token"
  }'
```

**Search Emails:**
```bash
curl -X POST http://localhost:3000/assistant/text-command \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer jwt-token" \
  -d '{
    "command": "find me emails from john@example.com",
    "sessionId": "session-123",
    "accessToken": "gmail-access-token"
  }'
```

### **Calendar Operations**

**Create Event:**
```bash
curl -X POST http://localhost:3000/assistant/text-command \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer jwt-token" \
  -d '{
    "command": "schedule a meeting tomorrow at 2pm with the team",
    "sessionId": "session-123",
    "accessToken": "calendar-access-token"
  }'
```

**Check Availability:**
```bash
curl -X POST http://localhost:3000/assistant/text-command \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer jwt-token" \
  -d '{
    "command": "am I free tomorrow afternoon?",
    "sessionId": "session-123",
    "accessToken": "calendar-access-token"
  }'
```

### **Contact Operations**

**Search Contacts:**
```bash
curl -X POST http://localhost:3000/assistant/text-command \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer jwt-token" \
  -d '{
    "command": "find contact information for Sarah",
    "sessionId": "session-123",
    "accessToken": "contacts-access-token"
  }'
```

### **Slack Integration**

**Read Slack Messages:**
```bash
curl -X POST http://localhost:3000/assistant/text-command \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer jwt-token" \
  -d '{
    "command": "what did we discuss in the last meeting?",
    "sessionId": "session-123",
    "context": {
      "slack": {
        "channelId": "C1234567890",
        "teamId": "T1234567890",
        "userId": "U1234567890"
      }
    }
  }'
```

## 🔒 **Rate Limiting**

The API implements rate limiting to prevent abuse:

- **General API**: 100 requests per minute per user
- **Assistant Commands**: 50 requests per minute per user
- **Heavy Operations**: 10 requests per minute per user

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## 📊 **API Versioning**

The API uses URL versioning:

- **Current Version**: `/v1/` (default)
- **Future Versions**: `/v2/`, `/v3/`, etc.

Version headers are also supported:

```
Accept: application/vnd.ai-assistant.v1+json
```

---

**Next**: [Slack API](./api/slack-api.md) - Slack integration endpoints
