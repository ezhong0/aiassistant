# System Architecture

The AI Assistant Platform implements a sophisticated **service-oriented architecture** with **AI-first design principles**, built for production scalability and maintainability.

## 🏗️ **High-Level Architecture**

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Interface]
        SLACK[Slack Bot]
        API[REST API Clients]
    end

    subgraph "API Gateway Layer"
        ROUTES[Express Routes]
        MIDDLEWARE[Middleware Stack]
        VALIDATION[Zod Validation]
        AUTH[Authentication]
    end

    subgraph "Service Orchestration Layer"
        SM[Service Manager<br/>Dependency Injection]
        AF[Agent Factory<br/>AI Orchestration]
        TE[Tool Executor<br/>Service]
    end

    subgraph "AI Agent Layer"
        MA[Master Agent<br/>Central Orchestrator]
        EA[Email Agent]
        CA[Calendar Agent]
        COA[Contact Agent]
        SA[Slack Agent]
        TA[Think Agent]
    end

    subgraph "Service Layer"
        subgraph "Core Services"
            CONFIG[Config Service]
            AUTH_SVC[Auth Service]
            DB[Database Service]
            CACHE[Cache Service]
        end

        subgraph "AI Services"
            OPENAI[OpenAI Service]
            AI_CB[AI Circuit Breaker]
            AI_CLASS[AI Classification]
            TOOL_ROUTE[Tool Routing]
        end

        subgraph "Domain Services"
            GMAIL[Gmail Service]
            CONTACT[Contact Service]
            CALENDAR[Calendar Service]
            SLACK_SVC[Slack Services]
        end

        subgraph "Cache Services"
            GMAIL_CACHE[Gmail Cache]
            CONTACT_CACHE[Contact Cache]
            SLACK_CACHE[Slack Cache]
            CACHE_MONITOR[Cache Monitor]
        end
    end

    subgraph "External Services"
        GOOGLE[Google APIs<br/>Gmail, Calendar, Contacts]
        OPENAI_API[OpenAI API]
        SLACK_API[Slack API]
        POSTGRES[PostgreSQL]
        REDIS[Redis Cache]
    end

    WEB --> ROUTES
    SLACK --> ROUTES
    API --> ROUTES

    ROUTES --> MIDDLEWARE
    MIDDLEWARE --> VALIDATION
    VALIDATION --> AUTH
    AUTH --> SM

    SM --> MA
    AF --> EA
    TE --> CA

    MA --> AI_CLASS
    EA --> GMAIL_CACHE
    CA --> CALENDAR
    COA --> CONTACT_CACHE
    SA --> SLACK_CACHE

    CONFIG --> DB
    AUTH_SVC --> POSTGRES
    CACHE --> REDIS
    OPENAI --> OPENAI_API
    GMAIL --> GOOGLE
    CONTACT --> GOOGLE
    CALENDAR --> GOOGLE
    SLACK_SVC --> SLACK_API
```

## 🎯 **Core Architectural Principles**

### **1. Service-Oriented Architecture (SOA)**

The platform implements a sophisticated SOA pattern with:

- **Service Manager**: Central dependency injection container managing 26+ services
- **Dependency Resolution**: Automatic topological sorting for initialization order
- **Lifecycle Management**: Complete service lifecycle with health monitoring
- **Graceful Shutdown**: Reverse-order shutdown with proper cleanup

**Service Hierarchy:**
```
Priority 1-10:   Infrastructure Services (Config, Database, Cache)
Priority 10-25:  Authentication & Session Services
Priority 20-35:  Domain Services (Gmail, Calendar, Contacts)
Priority 15-18:  AI Services (OpenAI, Classification, Routing)
Priority 70-97:  Slack Services (Event Handling, OAuth, Confirmation)
Priority 85-88:  Email Services (Operations, Validation, Formatting)
Priority 90-93:  Calendar Services (Event Management, Availability)
Priority 98-101: Cache Services (Gmail, Contact, Slack, Monitoring)
```

### **2. AI-First Multi-Agent System**

The platform implements intelligent AI orchestration:

```mermaid
graph LR
    USER[User Request] --> MASTER[Master Agent]
    MASTER --> AI_CLASS[AI Classification]
    AI_CLASS --> CONTEXT[Context Detection]
    CONTEXT --> SLACK[Slack Agent]
    MASTER --> EMAIL[Email Agent]
    MASTER --> CALENDAR[Calendar Agent]
    MASTER --> CONTACT[Contact Agent]
    MASTER --> THINK[Think Agent]

    EMAIL --> EMAIL_OPS[Email Operations]
    EMAIL --> EMAIL_VAL[Email Validator]
    EMAIL --> EMAIL_FMT[Email Formatter]
    EMAIL --> CONTACT_RES[Contact Resolver]

    CALENDAR --> CAL_MGR[Calendar Event Manager]
    CALENDAR --> CAL_AVAIL[Calendar Availability Checker]
    CALENDAR --> CAL_FMT[Calendar Formatter]
    CALENDAR --> CAL_VAL[Calendar Validator]

    SLACK --> SLACK_EVT[Slack Event Handler]
    SLACK --> SLACK_OAUTH[Slack OAuth Manager]
    SLACK --> SLACK_CONF[Slack Confirmation Handler]
    SLACK --> SLACK_MSG[Slack Message Analyzer]
```

**AI Planning Flow:**
1. **Intent Classification**: AI determines user intent from natural language
2. **Context Detection**: Determines if Slack context is needed
3. **Plan Generation**: Creates step-by-step execution plan
4. **Tool Selection**: Selects appropriate agents and tools
5. **Parallel Execution**: Executes independent steps concurrently
6. **Result Synthesis**: Combines results into user-friendly response

### **3. Intelligent Caching System**

The platform implements sophisticated caching strategies:

```mermaid
graph TB
    REQUEST[API Request] --> CACHE_CHECK{Cache Hit?}
    CACHE_CHECK -->|Yes| CACHE_HIT[Return Cached Data<br/>~10ms response]
    CACHE_CHECK -->|No| API_CALL[External API Call<br/>~500ms response]
    API_CALL --> CACHE_STORE[Store in Cache]
    CACHE_STORE --> RETURN[Return Data]

    subgraph "Cache Services"
        GMAIL_CACHE[Gmail Cache<br/>1 hour TTL<br/>70-90% hit rate]
        CONTACT_CACHE[Contact Cache<br/>2 hours TTL<br/>80-95% hit rate]
        SLACK_CACHE[Slack Cache<br/>30 min TTL<br/>60-80% hit rate]
        CACHE_MONITOR[Cache Monitor<br/>Performance Tracking]
    end
```

**Cache Performance:**
- **Gmail API**: 70-90% hit rate, 1 hour TTL
- **Contact Resolution**: 80-95% hit rate, 2 hours TTL
- **Slack Messages**: 60-80% hit rate, 30 minutes TTL
- **Performance Impact**: 95% faster response times for cached operations

### **4. Request Processing Pipeline**

```mermaid
graph TB
    REQ[HTTP Request] --> TIMEOUT[Request Timeout<br/>30s limit]
    TIMEOUT --> CORS[CORS Handling]
    CORS --> SEC_HEADERS[Security Headers]
    SEC_HEADERS --> COMPRESS[Response Compression]
    COMPRESS --> API_SEC[API Security Headers]
    API_SEC --> SIZE_LIMIT[Request Size Limit]
    SIZE_LIMIT --> SANITIZE[Input Sanitization<br/>XSS Protection]
    SANITIZE --> REQ_LOG[Request Logging]
    REQ_LOG --> ZOD_VALID[Zod Schema Validation<br/>100% Route Coverage]
    ZOD_VALID --> RATE_LIMIT[Rate Limiting]
    RATE_LIMIT --> ROUTE[Route Handler]
    ROUTE --> AUTH[Authentication]
    AUTH --> AGENT[Agent Execution]
    AGENT --> RESPONSE[Formatted Response]
```

## 🔧 **Key Architectural Patterns**

### **Dependency Injection**
- **Service Manager**: Central container managing all services
- **Automatic Resolution**: Services initialized in dependency order
- **Lifecycle Management**: Proper initialization and cleanup
- **Health Monitoring**: Service health status tracking

### **AI Planning & Orchestration**
- **Intent Classification**: AI-powered request understanding
- **Context Detection**: Smart context gathering from Slack
- **Tool Generation**: AI-driven tool call creation
- **Result Synthesis**: Natural language response generation

### **Caching Strategy**
- **Cache-First**: Check cache before external API calls
- **Intelligent TTL**: Domain-specific cache expiration
- **Performance Monitoring**: Real-time cache metrics
- **Graceful Degradation**: Fallback to direct API calls

### **Error Handling**
- **Circuit Breaker**: AI service failure protection
- **Graceful Degradation**: Fallback mechanisms
- **Comprehensive Logging**: Structured error tracking
- **User-Friendly Messages**: Clear error communication

## 📊 **System Characteristics**

### **Scalability**
- **Stateless Services**: Horizontal scaling capability
- **Connection Pooling**: Efficient database connections
- **Caching**: Reduced external API load
- **Async Processing**: Non-blocking operations

### **Reliability**
- **Health Monitoring**: Service health tracking
- **Graceful Shutdown**: Proper cleanup on termination
- **Error Recovery**: Automatic retry mechanisms
- **Circuit Breakers**: Failure isolation

### **Security**
- **OAuth 2.0**: Secure authentication
- **JWT Tokens**: Stateless session management
- **Input Validation**: Zod schema validation
- **Rate Limiting**: API abuse prevention
- **XSS Protection**: Input sanitization

### **Performance**
- **Intelligent Caching**: 70-90% hit rates
- **Connection Pooling**: Efficient resource usage
- **Async Operations**: Non-blocking processing
- **Memory Optimization**: Service lifecycle management

## 🚀 **Deployment Architecture**

The platform is designed for **Railway deployment** with:

- **Containerized Services**: Docker-based deployment
- **Environment Configuration**: Secure secret management
- **Health Monitoring**: Production health checks
- **Log Aggregation**: Centralized logging
- **Auto-scaling**: Railway's automatic scaling

---

**Next**: [Service Architecture](./service-architecture.md) - Detailed service design and dependencies
