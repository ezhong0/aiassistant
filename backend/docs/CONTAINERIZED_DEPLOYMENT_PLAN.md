# Containerized Deployment Plan: iOS Native + Always-On Backend

## Executive Summary

This document outlines the **containerized deployment strategy** for migrating from Slack to iOS native chatbot with an always-on backend. This approach is **fully compatible with the 4-Prompt Architecture** and solves critical state management issues that make FaaS unsuitable.

**Architecture**: React Native iOS App + Containerized Backend (Cloud Run / ECS Fargate)
**State Management**: In-memory with Redis fallback
**Cost**: $25-50/month (50-70% cheaper than FaaS)
**Latency**: <500ms (no cold starts)
**Timeline**: 4-5 weeks for MVP

---

## Table of Contents

1. [Why Containerized vs. FaaS](#why-containerized-vs-faas)
2. [Architecture Overview](#architecture-overview)
3. [State Management Strategy](#state-management-strategy)
4. [API Design](#api-design)
5. [Infrastructure Setup](#infrastructure-setup)
6. [Docker Configuration](#docker-configuration)
7. [Deployment Options](#deployment-options)
8. [Migration Steps](#migration-steps)
9. [Monitoring & Scaling](#monitoring--scaling)
10. [Cost Analysis](#cost-analysis)

---

## Why Containerized vs. FaaS

### Critical FaaS Problems with 4-Prompt Architecture

| Issue | FaaS Impact | Container Solution |
|-------|-------------|-------------------|
| **Stateful Confirmation Flows** | ❌ `working_data` lost between turns | ✅ In-memory persistence |
| **Undo Mechanism** | ❌ `last_action` requires Redis | ✅ In-memory + Redis backup |
| **Cold Start Latency** | ❌ 1-3 second delays | ✅ Always-on, <200ms |
| **Multi-turn Operations** | ❌ State persistence complex | ✅ Native support |
| **WebSocket Support** | ❌ Limited/expensive | ✅ Full support |
| **Cost** | ❌ $100-175/month | ✅ $25-50/month |

### Architecture Compatibility

**4-Prompt Architecture Requirements:**
```
✅ working_data persistence (SubAgent state)
✅ last_action storage (5-minute undo window)
✅ accumulated_knowledge (Master Agent state)
✅ Multi-turn confirmation flows
✅ Tool execution loops (1-10 iterations)
✅ Natural language boundaries maintained
```

**Containerized Backend Provides:**
- ✅ In-memory state with session management
- ✅ WebSocket for real-time updates
- ✅ Consistent <500ms latency
- ✅ Auto-scaling with zero cold starts
- ✅ Standard Express.js patterns (familiar DI)

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         iOS APP (React Native)                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  • Chat Interface                                         │   │
│  │  • Google OAuth                                           │   │
│  │  • Local conversation history                             │   │
│  │  • WebSocket for real-time updates                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                 ↓ HTTPS/WSS
┌─────────────────────────────────────────────────────────────────┐
│                    API GATEWAY / LOAD BALANCER                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  • SSL Termination                                        │   │
│  │  • Rate Limiting                                          │   │
│  │  • Request Routing                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────┐
│               CONTAINERIZED BACKEND (Auto-Scaling)               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Express.js Server                      │   │
│  │  ┌────────────┐  ┌──────────────┐  ┌─────────────────┐   │   │
│  │  │ Auth Layer │  │ Session Mgr  │  │ WebSocket Server│   │   │
│  │  │ • JWT      │  │ • In-memory  │  │ • Real-time     │   │   │
│  │  │ • OAuth    │  │ • Redis sync │  │ • Progress      │   │   │
│  │  └────────────┘  └──────────────┘  └─────────────────┘   │   │
│  │                                                           │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │           Master Agent (4-Prompt Flow)           │    │   │
│  │  │  • command_list (in-memory)                      │    │   │
│  │  │  • accumulated_knowledge (in-memory)             │    │   │
│  │  │  • Prompt 1: Intent Understanding                │    │   │
│  │  │  • Prompt 2: Context Update                      │    │   │
│  │  └──────────────────────────────────────────────────┘    │   │
│  │           ↓                                               │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │        SubAgents (Email, Calendar)               │    │   │
│  │  │  • working_data (in-memory per session)          │    │   │
│  │  │  • last_action (in-memory + Redis backup)        │    │   │
│  │  │  • tool_call_list (in-memory)                    │    │   │
│  │  │  • Prompt 1: Command Interpretation              │    │   │
│  │  │  • Prompt 2: Tool Reassessment                   │    │   │
│  │  └──────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────┐
│                        PERSISTENCE LAYER                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │    Redis     │  │  PostgreSQL  │  │   External APIs      │   │
│  │  • Sessions  │  │  • Users     │  │  • Gmail API         │   │
│  │  • State     │  │  • Tokens    │  │  • Calendar API      │   │
│  │  • Cache     │  │  • Prefs     │  │  • Contacts API      │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **In-Memory First**: State lives in container memory during active sessions
2. **Redis Backup**: Persist critical state to Redis for failover
3. **Session-Based**: Each conversation has a session with TTL
4. **WebSocket Support**: Real-time progress updates for long operations
5. **Auto-Scaling**: Horizontal scaling with session affinity
6. **Zero Downtime**: Rolling deployments with health checks

---

## State Management Strategy

### Session Architecture

**Session Lifecycle:**
```typescript
// Session creation
POST /api/chat/process (first message)
→ Creates session in-memory
→ Returns session_id to client
→ Client includes session_id in subsequent requests

// Session storage
In-Memory Map: sessionId → SessionState
Redis Backup: session:{sessionId} → SessionState (5-min TTL)

// Session expiry
- Idle timeout: 5 minutes
- Cleanup: Every 1 minute
- Redis TTL: Auto-cleanup
```

### SessionState Structure

```typescript
interface SessionState {
  // Session metadata
  sessionId: string;
  userId: string;
  createdAt: Date;
  lastAccessedAt: Date;

  // Master Agent state
  masterState: {
    command_list: CommandWithStatus[];
    accumulated_knowledge: Record<string, unknown>;
  };

  // SubAgent state (per domain)
  subAgentStates: {
    email?: {
      working_data: Record<string, unknown>;
      tool_call_list: ToolCall[];
      last_action?: LastAction;
      pending_action?: PendingAction;
    };
    calendar?: {
      working_data: Record<string, unknown>;
      tool_call_list: ToolCall[];
      last_action?: LastAction;
      pending_action?: PendingAction;
    };
  };

  // Conversation history (last 10 turns)
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
}
```

### In-Memory Session Manager

```typescript
// src/services/session-manager.service.ts
import { Redis } from 'ioredis';

export class SessionManager {
  private sessions: Map<string, SessionState> = new Map();
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
    this.startCleanupTimer();
  }

  /**
   * Create or retrieve session
   */
  async getOrCreateSession(userId: string, sessionId?: string): Promise<SessionState> {
    if (sessionId && this.sessions.has(sessionId)) {
      // Update last accessed
      const session = this.sessions.get(sessionId)!;
      session.lastAccessedAt = new Date();
      return session;
    }

    if (sessionId) {
      // Try to restore from Redis
      const restored = await this.restoreFromRedis(sessionId);
      if (restored) {
        this.sessions.set(sessionId, restored);
        return restored;
      }
    }

    // Create new session
    const newSession: SessionState = {
      sessionId: sessionId || this.generateSessionId(),
      userId,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      masterState: {
        command_list: [],
        accumulated_knowledge: {}
      },
      subAgentStates: {},
      conversationHistory: []
    };

    this.sessions.set(newSession.sessionId, newSession);
    await this.backupToRedis(newSession);

    return newSession;
  }

  /**
   * Update session state
   */
  async updateSession(sessionId: string, updates: Partial<SessionState>): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    Object.assign(session, updates);
    session.lastAccessedAt = new Date();

    // Backup to Redis (async, non-blocking)
    this.backupToRedis(session).catch(err =>
      console.error('Failed to backup session to Redis:', err)
    );
  }

  /**
   * Get SubAgent state
   */
  getSubAgentState(sessionId: string, domain: 'email' | 'calendar'): any {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (!session.subAgentStates[domain]) {
      session.subAgentStates[domain] = {
        working_data: {},
        tool_call_list: [],
      };
    }

    return session.subAgentStates[domain];
  }

  /**
   * Update SubAgent state
   */
  async updateSubAgentState(
    sessionId: string,
    domain: 'email' | 'calendar',
    updates: any
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (!session.subAgentStates[domain]) {
      session.subAgentStates[domain] = { working_data: {}, tool_call_list: [] };
    }

    Object.assign(session.subAgentStates[domain], updates);
    session.lastAccessedAt = new Date();

    await this.backupToRedis(session);
  }

  /**
   * Backup to Redis (async)
   */
  private async backupToRedis(session: SessionState): Promise<void> {
    const key = `session:${session.sessionId}`;
    await this.redis.setex(key, 300, JSON.stringify(session)); // 5-min TTL
  }

  /**
   * Restore from Redis
   */
  private async restoreFromRedis(sessionId: string): Promise<SessionState | null> {
    const key = `session:${sessionId}`;
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    const session = JSON.parse(data) as SessionState;
    // Convert date strings back to Date objects
    session.createdAt = new Date(session.createdAt);
    session.lastAccessedAt = new Date(session.lastAccessedAt);

    return session;
  }

  /**
   * Cleanup expired sessions
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      const now = Date.now();
      const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

      for (const [sessionId, session] of this.sessions.entries()) {
        const idleTime = now - session.lastAccessedAt.getTime();

        if (idleTime > IDLE_TIMEOUT) {
          this.sessions.delete(sessionId);
          console.log(`Cleaned up expired session: ${sessionId}`);
        }
      }
    }, 60 * 1000); // Run every minute
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### Integration with Agents

**BaseSubAgent Integration:**

```typescript
// src/framework/base-subagent.ts
export abstract class BaseSubAgent {
  constructor(
    private sessionManager: SessionManager,
    // ... other dependencies
  ) {}

  async processNaturalLanguageRequest(
    request: string,
    userId: string,
    sessionId: string
  ): Promise<SubAgentResponse> {
    // Load state from session
    const state = this.sessionManager.getSubAgentState(sessionId, this.domain);
    this.working_data = state.working_data || {};
    this.tool_call_list = state.tool_call_list || [];

    // Execute 2-prompt flow
    const result = await this.execute2PromptFlow(request, userId);

    // Save state back to session
    await this.sessionManager.updateSubAgentState(sessionId, this.domain, {
      working_data: this.working_data,
      tool_call_list: this.tool_call_list,
      last_action: this.last_action,
      pending_action: this.pending_action
    });

    return result;
  }
}
```

**MasterAgent Integration:**

```typescript
// src/agents/master.agent.ts
export class MasterAgent {
  constructor(
    private sessionManager: SessionManager,
    // ... other dependencies
  ) {}

  async processUserInput(
    userInput: string,
    sessionId: string,
    userId: string
  ): Promise<ProcessingResult> {
    // Get or create session
    const session = await this.sessionManager.getOrCreateSession(userId, sessionId);

    // Load state
    this.accumulated_knowledge = session.masterState.accumulated_knowledge;
    this.command_list = session.masterState.command_list;

    // Execute 2-prompt flow with SubAgents
    const result = await this.execute2PromptFlow(userInput, session, userId);

    // Update session
    await this.sessionManager.updateSession(sessionId, {
      masterState: {
        command_list: this.command_list,
        accumulated_knowledge: this.accumulated_knowledge
      },
      conversationHistory: [
        ...session.conversationHistory.slice(-9), // Keep last 9
        { role: 'user', content: userInput, timestamp: new Date() },
        { role: 'assistant', content: result.message, timestamp: new Date() }
      ]
    });

    return {
      ...result,
      session_id: session.sessionId // Return to client
    };
  }
}
```

---

## API Design

### REST Endpoints

```typescript
// Primary chat endpoint
POST /api/chat/process
Request:
{
  "message": "Archive all newsletters from today",
  "user_id": "user_123",
  "session_id": "sess_abc123",  // Optional for first message
  "user_preferences": {
    "timezone": "America/New_York"
  }
}

Response:
{
  "success": true,
  "message": "Found 23 newsletters from today:\n\n• Morning Brew (8am)\n• TechCrunch (9am)\n...\n\nArchive all 23? Reply 'yes' to confirm.",
  "session_id": "sess_abc123",
  "requires_confirmation": true,
  "confirmation_context": {
    "action": "bulk_archive",
    "count": 23,
    "risk_level": "medium"
  },
  "metadata": {
    "processing_time": 1.2,
    "tools_used": ["search_emails"]
  }
}
```

```typescript
// Authentication endpoint
POST /api/auth/google
Request:
{
  "google_token": "ya29.xxx",
  "user_email": "user@gmail.com"
}

Response:
{
  "jwt_token": "eyJhbGc...",
  "user_id": "user_123",
  "expires_in": 3600
}
```

```typescript
// Session management
GET /api/session/{session_id}
Response:
{
  "session_id": "sess_abc123",
  "created_at": "2024-01-15T10:00:00Z",
  "expires_at": "2024-01-15T10:05:00Z",
  "message_count": 5
}

DELETE /api/session/{session_id}
Response:
{
  "success": true,
  "message": "Session cleared"
}
```

### WebSocket Protocol (Optional Enhancement)

```typescript
// WebSocket connection for real-time updates
ws://api.example.com/ws?session_id=sess_abc123&token=jwt_token

// Client → Server
{
  "type": "message",
  "data": {
    "message": "Find emails from Sarah this week"
  }
}

// Server → Client (progress updates)
{
  "type": "progress",
  "data": {
    "stage": "executing_subagent",
    "agent": "email",
    "status": "Searching emails..."
  }
}

// Server → Client (final response)
{
  "type": "response",
  "data": {
    "message": "Found 3 emails from Sarah...",
    "requires_confirmation": false
  }
}
```

---

## Infrastructure Setup

### Deployment Options Comparison

| Platform | Pros | Cons | Cost (est.) |
|----------|------|------|-------------|
| **AWS ECS Fargate** | Auto-scaling, AWS ecosystem, mature | Complex setup, vendor lock-in | $30-50/mo |
| **Google Cloud Run** | ✅ Simplest, auto-scale, fast deploy | Less control over infra | $25-40/mo |
| **Azure Container Instances** | Good Windows integration | Limited features | $30-45/mo |
| **Railway/Render** | Easy setup, dev-friendly | Less enterprise features | $20-35/mo |
| **DigitalOcean App Platform** | Simple, affordable | Limited scaling options | $15-30/mo |

**Recommendation: Google Cloud Run** ✅
- Easiest setup (single `gcloud run deploy`)
- Auto-scales to zero (cost-effective)
- Built-in HTTPS + load balancing
- Perfect for containerized Express apps
- 2M free requests/month

---

## Docker Configuration

### Dockerfile (Production-Optimized)

```dockerfile
# ============================================
# Stage 1: Build
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# ============================================
# Stage 2: Production
# ============================================
FROM node:20-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy built app from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start app
CMD ["node", "dist/index.js"]
```

### docker-compose.yml (Local Development)

```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=development
      - PORT=8080
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/chatbot
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
    depends_on:
      - redis
      - postgres
    volumes:
      - ./src:/app/src
      - ./dist:/app/dist
    command: npm run dev

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=chatbot
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  redis_data:
  postgres_data:
```

### .dockerignore

```
node_modules
npm-debug.log
dist
.env
.env.local
.git
.gitignore
README.md
docs/
tests/
*.test.ts
*.spec.ts
.DS_Store
coverage/
.nyc_output/
```

---

## Deployment Options

### Option 1: Google Cloud Run (Recommended)

**Setup Steps:**

```bash
# 1. Build and push Docker image
gcloud builds submit --tag gcr.io/PROJECT_ID/chatbot-backend

# 2. Deploy to Cloud Run
gcloud run deploy chatbot-backend \
  --image gcr.io/PROJECT_ID/chatbot-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --port 8080 \
  --set-env-vars OPENAI_API_KEY=${OPENAI_API_KEY} \
  --set-env-vars REDIS_URL=${REDIS_URL}

# 3. Get service URL
gcloud run services describe chatbot-backend --region us-central1 --format 'value(status.url)'
```

**cloudbuild.yaml (CI/CD):**

```yaml
steps:
  # Build Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/chatbot-backend', '.']

  # Push to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/chatbot-backend']

  # Deploy to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'chatbot-backend'
      - '--image'
      - 'gcr.io/$PROJECT_ID/chatbot-backend'
      - '--region'
      - 'us-central1'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'

images:
  - 'gcr.io/$PROJECT_ID/chatbot-backend'
```

**Benefits:**
- ✅ Auto-scaling (0 to 10+ instances)
- ✅ Pay only for requests (scales to zero)
- ✅ Built-in HTTPS + CDN
- ✅ Simple deployment (`gcloud run deploy`)
- ✅ 2M free requests/month

---

### Option 2: AWS ECS Fargate

**Task Definition (JSON):**

```json
{
  "family": "chatbot-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "chatbot-backend",
      "image": "YOUR_ECR_REPO/chatbot-backend:latest",
      "portMappings": [
        {
          "containerPort": 8080,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "8080"
        }
      ],
      "secrets": [
        {
          "name": "OPENAI_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:openai-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/chatbot-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3
      }
    }
  ]
}
```

**Service Definition:**

```json
{
  "serviceName": "chatbot-backend",
  "taskDefinition": "chatbot-backend:1",
  "desiredCount": 2,
  "launchType": "FARGATE",
  "networkConfiguration": {
    "awsvpcConfiguration": {
      "subnets": ["subnet-xxx", "subnet-yyy"],
      "securityGroups": ["sg-xxx"],
      "assignPublicIp": "ENABLED"
    }
  },
  "loadBalancers": [
    {
      "targetGroupArn": "arn:aws:elasticloadbalancing:xxx",
      "containerName": "chatbot-backend",
      "containerPort": 8080
    }
  ]
}
```

---

### Option 3: Railway (Simplest)

**railway.json:**

```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "node dist/index.js",
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

**Deployment:**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Link to project
railway link

# Deploy
railway up
```

**Benefits:**
- ✅ Simplest setup (no config needed)
- ✅ Auto-HTTPS
- ✅ Built-in Redis/PostgreSQL
- ✅ GitHub auto-deploy
- ✅ $5/month starter plan

---

## Migration Steps

### Phase 1: Backend Preparation (Week 1)

**Step 1.1: Remove Slack Dependencies**

```bash
# Delete Slack-related files
rm -rf src/agents/slack.agent.ts
rm -rf src/services/domain/slack-domain.service.ts
rm -rf src/services/oauth/slack-oauth-manager.ts
rm -rf src/routes/slack.routes.ts
rm -rf src/types/slack/

# Update package.json (remove)
npm uninstall @slack/web-api @slack/bolt @slack/types

# Remove from .env
# SLACK_BOT_TOKEN
# SLACK_CLIENT_ID
# SLACK_CLIENT_SECRET
```

**Step 1.2: Implement Session Manager**

```bash
# Create session manager service
touch src/services/session-manager.service.ts

# Implement SessionManager class (see code above)

# Register in DI container
# src/di/registrations/core-services.ts
```

**Step 1.3: Update Agents for Session Support**

```typescript
// Update BaseSubAgent constructor
export abstract class BaseSubAgent {
  constructor(
    private sessionManager: SessionManager,
    domain: string,
    aiService: GenericAIService,
    config: Partial<AgentConfig> = {}
  ) {
    // ... existing code
  }
}

// Update MasterAgent constructor
export class MasterAgent {
  constructor(
    private sessionManager: SessionManager,
    aiService: GenericAIService,
    contextManager: ContextManager,
    tokenManager: TokenManager
  ) {
    // ... existing code
  }
}
```

**Step 1.4: Create Chat API Endpoint**

```typescript
// src/routes/chat.routes.ts
import express from 'express';
import { authenticateJWT } from '../middleware/auth';
import type { AppContainer } from '../di';

export function createChatRoutes(container: AppContainer) {
  const router = express.Router();
  const masterAgent = container.resolve<MasterAgent>('masterAgent');
  const sessionManager = container.resolve<SessionManager>('sessionManager');

  router.post('/process', authenticateJWT, async (req, res) => {
    try {
      const { message, session_id, user_preferences } = req.body;
      const userId = req.user.id; // From JWT

      // Process through Master Agent
      const result = await masterAgent.processUserInput(
        message,
        session_id,
        userId,
        user_preferences
      );

      res.json(result);
    } catch (error) {
      console.error('Chat processing error:', error);
      res.status(500).json({
        success: false,
        error: 'Processing failed',
        message: 'Unable to process your request'
      });
    }
  });

  // Get session info
  router.get('/session/:sessionId', authenticateJWT, async (req, res) => {
    try {
      const session = await sessionManager.getSession(req.params.sessionId);
      res.json(session);
    } catch (error) {
      res.status(404).json({ error: 'Session not found' });
    }
  });

  // Clear session
  router.delete('/session/:sessionId', authenticateJWT, async (req, res) => {
    await sessionManager.deleteSession(req.params.sessionId);
    res.json({ success: true });
  });

  return router;
}
```

---

### Phase 2: Containerization (Week 2)

**Step 2.1: Create Dockerfile**

```bash
# Copy Dockerfile from above section
touch Dockerfile
touch .dockerignore

# Test local build
docker build -t chatbot-backend .
docker run -p 8080:8080 --env-file .env chatbot-backend
```

**Step 2.2: Setup Docker Compose for Development**

```bash
# Copy docker-compose.yml from above
touch docker-compose.yml

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Test endpoint
curl -X POST http://localhost:8080/api/chat/process \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{"message": "Hello", "user_id": "test"}'
```

**Step 2.3: Update Application Entry Point**

```typescript
// src/index.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createContainer } from './di/container';
import { createChatRoutes } from './routes/chat.routes';
import { createAuthRoutes } from './routes/auth.routes';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Initialize DI container
const container = createContainer();

// Routes
app.use('/api/auth', createAuthRoutes(container));
app.use('/api/chat', createChatRoutes(container));

// Error handling
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Chatbot backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
```

---

### Phase 3: Cloud Deployment (Week 3)

**Step 3.1: Setup Cloud Infrastructure**

**For Google Cloud Run:**

```bash
# Create Google Cloud project
gcloud projects create chatbot-backend --name="Chatbot Backend"
gcloud config set project chatbot-backend

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable redis.googleapis.com
gcloud services enable sql.googleapis.com

# Create Redis instance (Memorystore)
gcloud redis instances create chatbot-redis \
  --size=1 \
  --region=us-central1 \
  --redis-version=redis_7_0

# Create PostgreSQL instance (Cloud SQL)
gcloud sql instances create chatbot-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1

# Create database
gcloud sql databases create chatbot --instance=chatbot-db
```

**Step 3.2: Configure Secrets**

```bash
# Store secrets in Secret Manager
echo -n "$OPENAI_API_KEY" | gcloud secrets create openai-api-key --data-file=-
echo -n "$GOOGLE_CLIENT_SECRET" | gcloud secrets create google-client-secret --data-file=-
echo -n "$JWT_SECRET" | gcloud secrets create jwt-secret --data-file=-

# Grant access to Cloud Run
gcloud secrets add-iam-policy-binding openai-api-key \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

**Step 3.3: Deploy to Cloud Run**

```bash
# Build and deploy
gcloud builds submit --tag gcr.io/chatbot-backend/backend

gcloud run deploy chatbot-backend \
  --image gcr.io/chatbot-backend/backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10 \
  --port 8080 \
  --set-env-vars NODE_ENV=production \
  --set-env-vars PORT=8080 \
  --set-secrets OPENAI_API_KEY=openai-api-key:latest \
  --set-secrets JWT_SECRET=jwt-secret:latest \
  --add-cloudsql-instances chatbot-backend:us-central1:chatbot-db \
  --vpc-connector chatbot-vpc-connector

# Get service URL
SERVICE_URL=$(gcloud run services describe chatbot-backend \
  --region us-central1 \
  --format 'value(status.url)')

echo "Backend deployed at: $SERVICE_URL"
```

---

### Phase 4: iOS App Integration (Week 4)

**Step 4.1: Update iOS API Client**

```typescript
// src/services/api.ts
import axios from 'axios';
import { getSecureToken } from './secureStorage';

const API_BASE = process.env.REACT_APP_API_URL; // Cloud Run URL

export const chatAPI = {
  async sendMessage(data: {
    message: string;
    session_id?: string;
    user_preferences?: any;
  }) {
    const token = await getSecureToken();

    const response = await axios.post(
      `${API_BASE}/api/chat/process`,
      data,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      }
    );

    return response.data;
  },

  async getSession(sessionId: string) {
    const token = await getSecureToken();

    const response = await axios.get(
      `${API_BASE}/api/chat/session/${sessionId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    return response.data;
  },

  async clearSession(sessionId: string) {
    const token = await getSecureToken();

    await axios.delete(
      `${API_BASE}/api/chat/session/${sessionId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
  }
};
```

**Step 4.2: Implement Session Persistence in App**

```typescript
// src/hooks/useConversation.ts
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { chatAPI } from '../services/api';

export const useConversation = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load session from storage on mount
  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      const storedSessionId = await AsyncStorage.getItem('current_session_id');
      if (storedSessionId) {
        setSessionId(storedSessionId);

        // Try to restore session from backend
        const session = await chatAPI.getSession(storedSessionId);
        if (session.conversationHistory) {
          setMessages(session.conversationHistory);
        }
      }
    } catch (error) {
      console.log('No previous session found');
    }
  };

  const sendMessage = async (text: string) => {
    setIsLoading(true);

    // Add user message
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await chatAPI.sendMessage({
        message: text,
        session_id: sessionId || undefined
      });

      // Store session ID
      if (response.session_id && response.session_id !== sessionId) {
        setSessionId(response.session_id);
        await AsyncStorage.setItem('current_session_id', response.session_id);
      }

      // Add assistant response
      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Failed to send message:', error);
      // Add error message
      const errorMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearConversation = async () => {
    if (sessionId) {
      await chatAPI.clearSession(sessionId);
      await AsyncStorage.removeItem('current_session_id');
    }
    setMessages([]);
    setSessionId(null);
  };

  return {
    messages,
    sessionId,
    isLoading,
    sendMessage,
    clearConversation
  };
};
```

---

## Monitoring & Scaling

### Health Monitoring

```typescript
// src/routes/health.routes.ts
import express from 'express';
import { Redis } from 'ioredis';

export function createHealthRoutes(redis: Redis, postgres: any) {
  const router = express.Router();

  router.get('/health', async (req, res) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: {
        redis: 'unknown',
        postgres: 'unknown',
        openai: 'unknown'
      }
    };

    // Check Redis
    try {
      await redis.ping();
      health.services.redis = 'healthy';
    } catch (error) {
      health.services.redis = 'unhealthy';
      health.status = 'degraded';
    }

    // Check PostgreSQL
    try {
      await postgres.raw('SELECT 1');
      health.services.postgres = 'healthy';
    } catch (error) {
      health.services.postgres = 'unhealthy';
      health.status = 'degraded';
    }

    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  });

  router.get('/metrics', (req, res) => {
    res.json({
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      uptime: process.uptime(),
      activeSessions: sessionManager.getActiveSessionCount()
    });
  });

  return router;
}
```

### Auto-Scaling Configuration

**Cloud Run Auto-Scaling:**

```bash
# Configure auto-scaling
gcloud run services update chatbot-backend \
  --region us-central1 \
  --min-instances 1 \
  --max-instances 20 \
  --cpu 1 \
  --memory 1Gi \
  --concurrency 80 \
  --cpu-throttling \
  --max-instances-per-revision 10
```

**Scaling Triggers:**
- CPU > 60% → Scale up
- Request latency > 2s → Scale up
- Active connections > 1000 → Scale up
- Idle for 5 min → Scale down

---

## Cost Analysis

### Monthly Cost Breakdown (Google Cloud Run)

**Base Infrastructure:**
```
Cloud Run (always-on):
- 1 instance @ 1GB RAM: $15/month
- Additional instances: $10/instance (auto-scale)
- Total compute: $15-35/month

Redis (Memorystore):
- Basic tier 1GB: $40/month

PostgreSQL (Cloud SQL):
- db-f1-micro: $7/month

Total: $62-82/month
```

**With 10,000 requests/day:**
```
Cloud Run requests: $0 (within free tier)
Outbound bandwidth: ~$2/month
Secrets Manager: $0.06/month

Total: $64-84/month
```

**Comparison:**
- FaaS (Lambda): $100-175/month
- Container (Cloud Run): $64-84/month
- **Savings: 35-65% cheaper** ✅

---

## Migration Checklist

### Pre-Migration
- [x] Review 4-Prompt Architecture compatibility
- [x] Identify state management requirements
- [x] Choose deployment platform (Cloud Run)
- [ ] Create feature branch: `feature/containerized-deployment`

### Backend Migration
- [ ] Remove Slack dependencies (files, packages, env vars)
- [ ] Implement SessionManager service
- [ ] Update BaseSubAgent for session support
- [ ] Update MasterAgent for session support
- [ ] Create `/api/chat/process` endpoint
- [ ] Create authentication endpoints
- [ ] Add health check endpoints

### Containerization
- [ ] Create optimized Dockerfile
- [ ] Setup docker-compose for local dev
- [ ] Test local Docker build
- [ ] Create .dockerignore
- [ ] Configure environment variables

### Cloud Deployment
- [ ] Setup Google Cloud project
- [ ] Configure Redis (Memorystore)
- [ ] Configure PostgreSQL (Cloud SQL)
- [ ] Store secrets (Secret Manager)
- [ ] Deploy to Cloud Run
- [ ] Configure auto-scaling
- [ ] Setup monitoring/alerts

### iOS Integration
- [ ] Update API client with Cloud Run URL
- [ ] Implement session persistence
- [ ] Add error handling
- [ ] Test end-to-end flow
- [ ] Performance testing

### Testing & Go-Live
- [ ] Load testing (1000+ concurrent)
- [ ] Security audit
- [ ] Cost monitoring setup
- [ ] Rollback plan documented
- [ ] Production deployment

---

## Success Metrics

### Performance
- ✅ Response time: <500ms (p50)
- ✅ Response time: <2s (p99)
- ✅ Uptime: >99.9%
- ✅ Zero cold starts

### Functionality
- ✅ Multi-turn confirmation flows work
- ✅ Undo mechanism (5-min window) works
- ✅ Session persistence across requests
- ✅ Conversation history maintained

### Cost
- ✅ Total cost: <$100/month
- ✅ Cost per 1000 requests: <$0.10
- ✅ No unexpected scaling costs

---

## Conclusion

This containerized deployment strategy provides the **best of both worlds**:

✅ **Architecture Compatible**: Full support for stateful 4-Prompt Architecture
✅ **Performance**: No cold starts, consistent <500ms latency
✅ **Cost Effective**: 35-65% cheaper than FaaS
✅ **Scalable**: Auto-scales from 1 to 20+ instances
✅ **Simple**: Standard Express.js patterns, familiar tooling
✅ **Production Ready**: Built-in monitoring, health checks, graceful shutdown

**Deployment Timeline**: 4-5 weeks to production

**Next Steps:**
1. Create feature branch
2. Implement SessionManager
3. Build and test Docker image locally
4. Deploy to Cloud Run staging
5. iOS app integration
6. Production rollout

---

*Document Version: 1.0*
*Created: January 2025*
*Architecture: Containerized Backend + iOS Native App*
