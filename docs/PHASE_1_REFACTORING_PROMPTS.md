# 🔧 Phase 1 Core Refactoring Prompts

## 🎯 **Vision-Aligned Refactoring Strategy**

This document provides comprehensive prompts for **eliminating string matching** and implementing **core architectural improvements** to achieve a pure LLM-driven Slack assistant that aligns with your vision of zero string matching.

## 📚 **Essential Pre-Prompt Reading**

Before using any prompt, review:
- `backend/src/config/agent-config.ts` - Current string matching patterns to eliminate
- `backend/src/agents/master.agent.ts` - Current dual routing architecture
- `backend/src/framework/ai-agent.ts` - Current AIAgent base class (1,636 lines)
- `backend/src/services/slack-interface.service.ts` - Current confirmation parsing
- `backend/src/services/service-manager.ts` - Current service priorities and dependencies

---

## 🚨 **Critical Flow Issues - Immediate Priority**

### **CF1: Invert Control Flow - Make OpenAI Primary**

```
**Architecture Context:** Currently in backend/src/agents/master.agent.ts, the system treats 
OpenAI as optional with string matching fallback. This violates the "zero string matching" 
vision and makes AI secondary rather than primary.

**Goal:** Invert the control flow to make OpenAI the required primary service, with graceful 
degradation only for non-critical errors, never falling back to string matching.

**Current Problem Code:**
- Lines 300-320 in master.agent.ts: Falls back to determineToolCalls() string matching
- Line 44: useOpenAI boolean makes AI optional
- ServiceManager priority 70 for OpenAI makes it low priority

**Constraints:** 
- OpenAI service must become required, not optional
- Remove all string matching fallback logic
- Implement circuit breaker pattern for AI failures
- Maintain user experience with proper error messages
- Follow existing ServiceManager and AIAgent patterns

**Integration Points:**
- ServiceManager service priority system (increase OpenAI to priority 15)
- AIAgent error handling patterns
- MasterAgent initialization and routing logic
- Circuit breaker implementation for external services

**Testing Requirements:**
- Test OpenAI service unavailable scenarios with proper error messages
- Test circuit breaker open/close/half-open states
- Test graceful degradation without string matching fallback
- Integration tests for AI-first routing

**Format:** Provide:
1. Updated ServiceManager configuration with OpenAI as high priority
2. Refactored MasterAgent with AI-first routing (remove useOpenAI boolean)
3. AIServiceCircuitBreaker implementation with proper state management
4. Error handling that never falls back to string matching
5. Updated service initialization order and dependencies
6. Comprehensive tests for AI-first architecture

**Example:** Like a modern SaaS app that requires internet connectivity - it doesn't fall 
back to offline mode with reduced functionality, it shows clear error messages and retry options.
```

### **CF2: Eliminate Dual Routing Architecture**

```
**Architecture Context:** The MasterAgent currently maintains both AI routing (processUserInput) 
and rule-based routing (determineToolCalls) in backend/src/agents/master.agent.ts. This 
dual approach contradicts the vision of pure LLM-driven classification.

**Goal:** Remove all rule-based routing logic and implement single AI-powered routing 
with proper entity extraction and intent classification using only OpenAI services.

**Current Problem Code:**
- determineToolCalls() method (lines 450-500): String pattern matching
- needsContactLookup() method (lines 520-540): String includes() checks
- Rule-based tool matching in AgentFactory.findMatchingTools()

**Constraints:** 
- Remove all methods that use string matching for routing
- Replace with LLM-based intent classification and entity extraction
- Maintain existing agent capabilities (email, calendar, contacts)
- Preserve context gathering functionality from SlackMessageReaderService
- Follow OpenAI service patterns established in the codebase

**Integration Points:**
- OpenAI service for intent classification and entity extraction
- AgentFactory tool registration (keep, but remove string matching)
- SlackMessageReaderService context gathering (keep as-is)
- Individual agent parameter validation (keep existing patterns)

**Testing Requirements:**
- Intent classification accuracy tests with various message phrasings
- Entity extraction tests for contacts, dates, subjects
- Agent routing tests ensuring correct agent selection
- Context integration tests with SlackMessageReaderService

**Format:** Provide:
1. Refactored MasterAgent with single AI routing path
2. LLM-based intent classification using OpenAI function calling
3. Entity extraction for contacts, dates, and other parameters
4. Removal of all determineToolCalls, needsContactLookup string matching
5. Enhanced processUserInput method with pure AI classification
6. Test suite covering various message types and routing scenarios

**Example:** Like modern voice assistants (Alexa, Google) that use only AI for intent 
classification, never falling back to keyword matching.
```

### **CF3: Fix Service Dependency Hierarchy**

```
**Architecture Context:** In backend/src/services/service-manager.ts, OpenAI service has 
priority 70 (low priority), making it optional and initializing after other services. 
For an AI-first architecture, OpenAI should be a critical, high-priority service.

**Goal:** Restructure service dependencies to make OpenAI a critical service with high 
priority, proper health checks, and circuit breaker patterns for reliability.

**Current Problem Code:**
- ServiceManager: OpenAI service priority 70 (should be ~15)
- OpenAI service can fail to initialize without breaking system startup
- No circuit breaker or health monitoring for critical AI dependency

**Constraints:** 
- Maintain existing IService interface and ServiceManager patterns
- Preserve service dependency resolution and initialization order
- Add circuit breaker pattern for OpenAI service reliability
- Implement proper health checks and monitoring
- Ensure graceful startup failure if OpenAI unavailable

**Integration Points:**
- ServiceManager dependency resolution and priority system
- Service health monitoring and lifecycle management
- Error handling patterns for critical service failures
- Application startup and initialization flow

**Testing Requirements:**
- Service initialization order tests with OpenAI as high priority
- Circuit breaker functionality tests (open/close/half-open states)
- Health check tests for OpenAI service monitoring
- Service dependency resolution tests

**Format:** Provide:
1. Updated service priority configuration (OpenAI priority 15)
2. Enhanced OpenAI service with health checks and monitoring
3. Circuit breaker implementation for OpenAI service calls
4. Service dependency updates to reflect OpenAI as critical
5. Error handling for OpenAI service initialization failures
6. Monitoring and metrics for service health tracking

**Example:** Like a database service in a web application - if it's not available, 
the application should fail fast rather than continue with degraded functionality.
```

---

## 🏗️ **Core Architectural Refactorings**

### **AR1: Consolidate Agent Configuration Logic**

```
**Architecture Context:** Agent configuration and operation detection logic is currently 
scattered across backend/src/config/agent-config.ts (string matching patterns) and 
individual agents. This creates inconsistency and violates the zero string matching vision.

**Goal:** Create a centralized AgentCapabilitiesService that uses pure LLM classification 
for all agent routing and operation detection, eliminating AGENT_HELPERS string patterns.

**Current Problem Code:**
- AGENT_HELPERS.detectOperation() in agent-config.ts (lines 221-266): String pattern matching
- operationPatterns object (lines 246-264): Hard-coded string arrays
- Individual agents duplicating operation detection logic

**Constraints:** 
- Replace all string pattern matching with LLM classification
- Maintain existing agent capabilities and operation types
- Use OpenAI function calling for structured operation classification
- Follow existing service patterns (IService interface, service registry)
- Preserve agent-specific behavior and parameter validation

**Integration Points:**
- OpenAI service for operation classification and capability matching
- Individual agents for capability definitions and schema
- ServiceManager for AgentCapabilitiesService registration
- Agent factory for capability registration and discovery

**Testing Requirements:**
- Operation classification accuracy tests across all agent types
- Agent capability matching tests with various input phrasings
- Performance tests for LLM-based classification vs string matching
- Integration tests with existing agent execution flow

**Format:** Provide:
1. AgentCapabilitiesService implementing IService interface
2. LLM-based operation classification using OpenAI function calling
3. Agent capability schema definitions (replace string patterns)
4. Integration with existing agent factory and service registry
5. Migration path from AGENT_HELPERS to AgentCapabilitiesService
6. Comprehensive test suite for operation classification accuracy

**Example:** Like a modern recommendation system that uses ML models for classification 
rather than rule-based keyword matching - more accurate and handles edge cases better.
```

### **AR2: Refactor Confirmation Flow**

```
**Architecture Context:** Confirmation logic is currently mixed across 
backend/src/services/slack-interface.service.ts (string matching for responses), 
backend/src/framework/ai-agent.ts (preview generation), and agent configuration. 
This creates scattered responsibilities and uses string matching.

**Goal:** Extract confirmation logic into a dedicated ConfirmationOrchestrator service 
that uses LLM classification for response parsing and centralizes all confirmation workflows.

**Current Problem Code:**
- isConfirmationResponse() in slack-interface.service.ts: String array matching
- CONFIRMATION_WORDS in agent-config.ts: Hard-coded response words
- Confirmation logic scattered across multiple classes

**Constraints:** 
- Use LLM classification for confirmation response parsing (no string matching)
- Centralize all confirmation workflow logic in single service
- Support interactive Slack confirmation buttons (preserve existing UI)
- Maintain existing preview generation and risk assessment capabilities
- Follow service patterns and integrate with ServiceManager

**Integration Points:**
- OpenAI service for response classification and intent detection
- SlackInterface service for interactive button handling
- AIAgent preview generation (extract and centralize)
- Individual agents for confirmation requirements

**Testing Requirements:**
- Confirmation response classification tests (various ways of confirming/rejecting)
- Interactive button flow tests with Slack interface
- Preview generation tests for different operation types
- Integration tests for end-to-end confirmation workflows

**Format:** Provide:
1. ConfirmationOrchestrator service with centralized confirmation logic
2. LLM-based response classification (replace string matching)
3. Enhanced preview generation with risk assessment
4. Integration with existing Slack interactive button system
5. Clean separation from agent execution logic
6. Test suite covering all confirmation scenarios and edge cases

**Example:** Like a checkout flow in e-commerce - centralized logic that handles 
user intent classification, generates clear previews, and manages the confirmation process.
```

### **AR3: Simplify AIAgent Base Class**

```
**Architecture Context:** The AIAgent base class in backend/src/framework/ai-agent.ts 
is 1,636 lines and handles AI planning, caching, tool execution, preview generation, 
and lifecycle management all in one class, violating Single Responsibility Principle.

**Goal:** Refactor AIAgent into focused components by extracting services for AI planning, 
caching, and preview generation, reducing the base class to <300 lines focused on 
core orchestration and lifecycle management.

**Current Problem Code:**
- AIAgent class: 1,636 lines handling multiple responsibilities
- AI planning logic (lines 400-600): Should be separate service
- Caching logic (lines 1400-1500): Should be separate service
- Preview generation (lines 1520-1600): Should be separate service

**Constraints:** 
- Maintain existing AIAgent interface and agent implementation patterns
- Preserve all current functionality (planning, caching, preview generation)
- Follow service registry patterns for extracted components
- Keep backward compatibility with existing agents (CalendarAgent, EmailAgent, etc.)
- Maintain error handling and logging patterns

**Integration Points:**
- ServiceManager for registering extracted services
- Individual agents that extend AIAgent (must remain compatible)
- OpenAI service integration (preserve existing patterns)
- Service lifecycle management and dependency injection

**Testing Requirements:**
- Backward compatibility tests with existing agents
- Service extraction tests (planning, caching, preview generation)
- Performance tests ensuring no regression from refactoring
- Integration tests for complete agent execution flows

**Format:** Provide:
1. Refactored AIAgent base class (<300 lines, focused on orchestration)
2. AIPlanningService extracted from AIAgent planning logic
3. AgentCacheService extracted from AIAgent caching logic  
4. PreviewGeneratorService extracted from AIAgent preview logic
5. Service registration and dependency injection setup
6. Migration guide for existing agents and backward compatibility tests

**Example:** Like refactoring a monolithic service into microservices - each component 
has a single responsibility but they work together seamlessly through well-defined interfaces.
```

---

## 🔄 **Critical Flow Improvements**

### **FI1: Implement Proper Error Boundaries**

```
**Architecture Context:** Error handling is currently inconsistent across the system, 
with different components handling AI service failures differently. Some fall back to 
string matching (violating the vision), others throw generic errors without user context.

**Goal:** Implement standardized error boundary service with user-friendly messages, 
proper error classification, and consistent handling that never falls back to string matching.

**Current Problem Areas:**
- Inconsistent error handling across agents and services
- Generic error messages not helpful to users
- Some components fall back to string matching on AI failures
- No centralized error classification or user message generation

**Constraints:** 
- Never fall back to string matching under any error condition
- Generate user-friendly error messages appropriate for Slack context
- Implement proper error classification (temporary vs permanent failures)
- Maintain existing logging and monitoring patterns
- Follow service registry patterns for error boundary service

**Integration Points:**
- All agents and services for consistent error handling
- OpenAI service for error classification and user message generation
- Slack interface for user-friendly error message delivery
- Logging and monitoring systems for error tracking

**Testing Requirements:**
- Error boundary tests for various failure scenarios
- User message generation tests for different error types
- Integration tests ensuring no fallback to string matching
- Error recovery and retry mechanism tests

**Format:** Provide:
1. ErrorBoundaryService with centralized error handling
2. User-friendly error message generation using LLM
3. Error classification system (temporary/permanent/user-actionable)
4. Integration with existing logging and monitoring
5. Consistent error handling patterns for all components
6. Test suite covering all error scenarios and user experience

**Example:** Like modern web applications that show contextual error messages 
("Something went wrong, please try again") rather than technical error codes.
```

### **FI2: Fix Message Processing Pipeline**

```
**Architecture Context:** Message processing logic is currently scattered across 
MasterAgent.processUserInput(), SlackInterface event handling, and various service methods, 
creating unclear flow and making it hard to follow the conversation processing pipeline.

**Goal:** Create a clean MessageProcessor pipeline with clear stages: context gathering, 
intent classification, action planning, and execution, with proper separation of concerns.

**Current Problem Areas:**
- Message processing logic scattered across multiple classes
- Unclear pipeline flow makes debugging difficult
- Context gathering mixed with routing logic
- No clear separation between classification and execution phases

**Constraints:** 
- Create clear pipeline stages with defined interfaces
- Maintain existing functionality (context, routing, execution)
- Use dependency injection for pipeline stage services
- Preserve Slack-specific message handling and formatting
- Follow existing service and error handling patterns

**Integration Points:**
- SlackMessageReaderService for context gathering (existing)
- AgentCapabilitiesService for intent classification (new)
- ConfirmationOrchestrator for confirmation flows (new)
- Individual agents for action execution (existing)

**Testing Requirements:**
- Pipeline stage tests for each processing step
- End-to-end message processing tests
- Error handling tests at each pipeline stage
- Performance tests for complete pipeline execution

**Format:** Provide:
1. MessageProcessor service with clear pipeline stages
2. Defined interfaces for each pipeline stage
3. Integration with existing context gathering and agent services
4. Clear error handling and logging at each stage
5. Pipeline configuration and stage ordering management
6. Comprehensive test suite for pipeline functionality

**Example:** Like a modern CI/CD pipeline - clear stages (build, test, deploy) with 
defined inputs/outputs and proper error handling at each stage.
```

### **FI3: Implement Circuit Breaker for OpenAI**

```
**Architecture Context:** The system currently has no circuit breaker pattern for OpenAI 
service failures, leading to cascading failures and poor user experience when AI services 
are temporarily unavailable. Need proper failure detection and recovery.

**Goal:** Implement circuit breaker pattern for OpenAI service with proper state management, 
failure detection, recovery mechanisms, and user-friendly error messages during outages.

**Current Problem Areas:**
- No circuit breaker for OpenAI service reliability
- Cascading failures when OpenAI is temporarily unavailable  
- No automatic recovery detection when service comes back online
- Poor user experience during AI service outages

**Constraints:** 
- Implement standard circuit breaker pattern (CLOSED/OPEN/HALF_OPEN states)
- Configure appropriate failure thresholds and recovery timeouts
- Provide meaningful user messages during service outages
- Integrate with existing OpenAI service and service registry
- Add metrics and monitoring for circuit breaker state changes

**Integration Points:**
- OpenAI service wrapper for circuit breaker functionality
- ServiceManager for circuit breaker service registration
- Monitoring and metrics systems for failure tracking
- Error boundary service for user-friendly outage messages

**Testing Requirements:**
- Circuit breaker state transition tests (failure detection, recovery)
- Service outage simulation and recovery tests
- User experience tests during AI service unavailability
- Metrics and monitoring integration tests

**Format:** Provide:
1. AIServiceCircuitBreaker with proper state management
2. Integration with existing OpenAI service (wrapper pattern)
3. Configurable failure thresholds and recovery timeouts
4. User-friendly error messages during service outages
5. Metrics and monitoring for circuit breaker events
6. Test suite covering failure scenarios and recovery patterns

**Example:** Like Netflix's Hystrix circuit breaker - protects against cascading failures 
and provides graceful degradation with clear user communication during outages.
```

---

## 📋 **String Matching Elimination Prompts**

### **SM1: Replace Agent Config String Patterns**

```
**Architecture Context:** The AGENT_HELPERS.detectOperation() function in 
backend/src/config/agent-config.ts (lines 221-290) uses extensive string pattern matching 
with hard-coded arrays like ['what do i have', 'show me', 'today'] which directly 
violates the zero string matching vision.

**Goal:** Replace all string pattern matching in agent configuration with pure LLM-based 
operation classification that understands intent rather than matching keywords.

**Current Problem Code:**
- operationPatterns object (lines 246-264): Hard-coded string arrays for each operation
- String includes() checks (lines 257-262): lowerQuery.includes(pattern) matching
- CONFIRMATION_WORDS arrays: Hard-coded confirmation/rejection words

**Constraints:** 
- Use OpenAI function calling for structured operation classification
- Maintain existing operation types (read, write, search, create, etc.)
- Preserve agent-specific operation mappings and capabilities
- Ensure classification accuracy equal to or better than string matching
- Follow existing service patterns and error handling

**Integration Points:**
- OpenAI service for LLM-based classification
- Individual agents for operation capability definitions
- AgentFactory for operation schema registration
- ServiceManager for service lifecycle management

**Testing Requirements:**
- Operation classification accuracy tests with varied phrasings
- Performance comparison tests (LLM vs string matching)
- Edge case handling tests (ambiguous messages, typos)
- Integration tests with existing agent routing flow

**Format:** Provide:
1. LLM-based operation classification using OpenAI function calling
2. Operation schema definitions for each agent type
3. Replacement for AGENT_HELPERS.detectOperation() without string matching
4. Migration strategy from string patterns to LLM classification
5. Performance optimizations for LLM-based classification
6. Comprehensive test suite with accuracy benchmarks

**Example:** Replace keyword matching like email spam filters evolved from rule-based 
to ML-based classification - more accurate and handles variations naturally.
```

### **SM2: Replace Contact Lookup Detection**

```
**Architecture Context:** The needsContactLookup() method in backend/src/agents/master.agent.ts 
uses string matching like input.includes('email') || input.includes('send') to detect 
when contact resolution is needed, violating the zero string matching requirement.

**Goal:** Replace string-based contact detection with LLM entity extraction that can 
identify person names, contact references, and relationship context from natural language.

**Current Problem Code:**
- needsContactLookup() method: String includes() checks for keywords
- extractContactName() method: Regex patterns for name extraction
- Hard-coded keyword lists for email and meeting detection

**Constraints:** 
- Use OpenAI for entity extraction and relationship detection
- Identify person names, email addresses, and contact references
- Understand context (meeting with John vs emailing about John)
- Maintain existing contact resolution workflow with ContactAgent
- Handle ambiguous cases and multiple contact references

**Integration Points:**
- OpenAI service for entity extraction and context analysis
- ContactAgent for contact resolution and lookup
- MasterAgent routing logic for contact resolution workflow
- Parameter passing to downstream agents (email, calendar)

**Testing Requirements:**
- Entity extraction accuracy tests for person names and contacts
- Context understanding tests (meeting with vs emailing about)
- Multiple contact reference handling tests
- Integration tests with ContactAgent resolution workflow

**Format:** Provide:
1. LLM-based entity extraction for contact identification
2. Context analysis for understanding contact relationships
3. Replacement for needsContactLookup() and extractContactName() methods
4. Enhanced parameter passing to ContactAgent with extracted entities
5. Ambiguity handling for unclear contact references
6. Test suite covering various contact reference patterns

**Example:** Like modern email clients that suggest contacts as you type - understands 
context and relationships, not just keyword matching.
```

### **SM3: Replace Confirmation Response Parsing**

```
**Architecture Context:** The isConfirmationResponse() method in 
backend/src/services/slack-interface.service.ts uses hard-coded arrays of confirmation 
words (['yes', 'y', 'confirm', 'ok']) which is exactly the kind of string matching 
that violates the zero string matching vision.

**Goal:** Replace string array matching with LLM-based response classification that 
understands user intent for confirmation, rejection, or modification requests regardless 
of specific wording used.

**Current Problem Code:**
- isConfirmationResponse() method: Hard-coded word arrays for yes/no detection
- CONFIRMATION_WORDS in agent-config.ts: Static confirmation/rejection word lists
- Simple string matching that misses variations and context

**Constraints:** 
- Use OpenAI for response intent classification
- Handle variations like "go for it", "not right now", "change the time to..."
- Understand context of what's being confirmed
- Support modification requests ("yes but make it 3pm instead")
- Maintain existing interactive button confirmation flow

**Integration Points:**
- OpenAI service for response intent classification
- ConfirmationOrchestrator for confirmation workflow management
- Slack interface for interactive button and text response handling
- Context from previous confirmation proposals

**Testing Requirements:**
- Response classification accuracy tests with various confirmation styles
- Modification request detection and parsing tests
- Context-aware confirmation tests (what's being confirmed)
- Integration tests with interactive Slack confirmation flows

**Format:** Provide:
1. LLM-based response classification for confirmation intent
2. Support for modification requests and conditional confirmations
3. Context-aware confirmation understanding
4. Replacement for isConfirmationResponse() without string matching
5. Integration with existing interactive Slack confirmation buttons
6. Test suite covering diverse confirmation response patterns

**Example:** Like modern voice assistants that understand "sure thing" or "not today" 
as confirmation/rejection regardless of specific wording - context and intent matter.
```

---

## 📊 **Implementation Schedule**

### **Week 1: Critical Flow Issues**
- **Day 1-2**: CF1 - Invert Control Flow (Make OpenAI Primary)
- **Day 3-4**: CF2 - Eliminate Dual Routing Architecture  
- **Day 5**: CF3 - Fix Service Dependency Hierarchy

### **Week 2: String Matching Elimination** 
- **Day 1-2**: SM1 - Replace Agent Config String Patterns
- **Day 3-4**: SM2 - Replace Contact Lookup Detection
- **Day 5**: SM3 - Replace Confirmation Response Parsing

### **Week 3: Architectural Refactorings**
- **Day 1-2**: AR1 - Consolidate Agent Configuration Logic
- **Day 3-4**: AR2 - Refactor Confirmation Flow
- **Day 5**: AR3 - Simplify AIAgent Base Class

### **Week 4: Flow Improvements**
- **Day 1-2**: FI1 - Implement Proper Error Boundaries
- **Day 3-4**: FI2 - Fix Message Processing Pipeline
- **Day 5**: FI3 - Implement Circuit Breaker for OpenAI

---

## 🎯 **Success Criteria**

### **Zero String Matching Achievement**
- [ ] No string.includes(), string matching, or regex patterns for intent detection
- [ ] All operation classification uses LLM classification
- [ ] All confirmation parsing uses LLM intent detection
- [ ] All entity extraction uses LLM entity recognition

### **AI-First Architecture**
- [ ] OpenAI service is required, not optional
- [ ] No fallback to string matching under any condition
- [ ] Circuit breaker provides graceful degradation without string matching
- [ ] Error messages are user-friendly and contextually generated

### **Clean Architecture**
- [ ] Single responsibility classes (<300 lines for core components)
- [ ] Clear separation of concerns in message processing pipeline
- [ ] Centralized confirmation and error handling workflows
- [ ] Comprehensive test coverage for all refactored components

This refactoring will transform your already sophisticated system into a **pure LLM-driven assistant** that truly embodies your vision of zero string matching while maintaining all existing advanced capabilities.