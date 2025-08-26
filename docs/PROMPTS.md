# 🎯 AI Prompting Guide - Strategic Development

## 🎯 **Prompting Vision**

This document establishes **effective AI prompting strategies** for the AI assistant platform. The approach ensures AI development respects architectural boundaries while maximizing productivity through clear, context-rich communication.

## 📚 **Pre-Prompt Preparation: Know Your Architecture**

### **Essential Reading Before Prompting**
Before writing any AI prompt, **always review the relevant documentation**:

1. **`docs/ARCHITECTURE.md`** - Understand system boundaries and component relationships
2. **`docs/AGENTS.md`** - Learn agent patterns and established implementations  
3. **`docs/SERVICES.md`** - Review service layer patterns and interfaces
4. **`docs/DEVELOPMENT.md`** - Follow established development workflows
5. **`docs/TESTING.md`** - Understand testing requirements and patterns

### **Architecture-First Prompting Checklist**
- [ ] Read relevant architecture documentation
- [ ] Identify which components will be affected
- [ ] Understand existing patterns to follow
- [ ] Know the testing requirements
- [ ] Review error handling patterns

## 🧠 **The 80/20 Rule of AI Prompting**

### **The Critical 20% That Delivers 80% of Value**

#### **1. Context is King**
Provide architectural context from our documentation:

```
❌ Bad: "Add calendar functionality"

✅ Good: "Given our existing BaseAgent framework in backend/src/framework/base-agent.ts 
and the service registry pattern in docs/SERVICES.md, implement a CalendarAgent that 
follows our established error handling patterns and integrates with Google Calendar API."
```

#### **2. Be Specific About Output**
Reference our established patterns:

```
❌ Bad: "Help with error handling"

✅ Good: "Refactor this function to use our BaseAgent error handling pattern from 
docs/ARCHITECTURE.md, throw proper CalendarServiceError types, and include structured 
logging following our logger.error format in existing agents."
```

#### **3. Break Down Complex Requests**
Follow our component boundaries:

```
❌ Bad: "Build a complete email management system"

✅ Good: 
"Step 1: Implement EmailService following IService interface from docs/SERVICES.md
Step 2: Create EmailAgent extending BaseAgent from docs/AGENTS.md  
Step 3: Register with AgentFactory following our initialization patterns
Step 4: Add comprehensive tests following docs/TESTING.md patterns"
```

#### **4. Use Architecture Examples**
Reference existing implementations:

```
✅ "Follow the same pattern as ContactAgent in backend/src/agents/contact.agent.ts 
but adapt it for calendar operations. Use the same error handling, logging, and 
parameter validation approaches."
```

#### **5. Specify Constraints from Our Stack**
Be explicit about our architectural requirements:

```
✅ "As a senior developer building this production AI assistant platform, I need code that:
- Follows our BaseAgent pattern from docs/AGENTS.md
- Implements IService interface from docs/SERVICES.md  
- Uses our established error types and logging patterns
- Includes tests following docs/TESTING.md structure
- Respects the service registry dependency injection"
```

## 📋 **Architecture-Aware Prompt Template**

### **Template for 80% of Development Prompts**

```
**Architecture Context:** [Reference specific docs and existing patterns]
**Goal:** [Specific outcome that respects architectural boundaries]  
**Constraints:** [Our established patterns, interfaces, and conventions]
**Integration Points:** [Which existing components this affects]
**Testing Requirements:** [Following our testing patterns]
**Format:** [How to structure the response]

**Example:** [Reference existing similar implementation]
```

### **Real Example**

```
**Architecture Context:** Based on our multi-agent architecture in docs/AGENTS.md, 
I need to add weather functionality. We have a MasterAgent that routes to specialized 
agents using AgentFactory registration, and all agents extend BaseAgent.

**Goal:** Create a WeatherAgent that integrates with a weather API and follows our 
established agent patterns for tool execution and error handling.

**Constraints:** 
- Extend BaseAgent<WeatherAgentRequest, WeatherResult> 
- Follow error handling patterns from existing agents
- Use our structured logging format (logger.error with context)
- Implement proper parameter validation like ContactAgent
- Register with AgentFactory following initialization patterns

**Integration Points:**
- AgentFactory registration in backend/src/config/agent-factory-init.ts
- MasterAgent routing logic for weather-related queries
- Tool metadata registration for OpenAI function calling

**Testing Requirements:**
- Unit tests following docs/TESTING.md patterns
- Agent behavior tests for routing validation  
- Error handling tests for API failures
- Performance tests within 2-second requirement

**Format:** Provide the complete WeatherAgent implementation with:
1. TypeScript class extending BaseAgent
2. Proper interfaces for request/response types
3. Error handling following our patterns
4. Registration code for AgentFactory
5. Basic unit tests structure

**Example:** Follow the ContactAgent pattern in backend/src/agents/contact.agent.ts 
but adapt for weather API calls instead of Google Contacts.
```

## 🚀 **Advanced Prompting Techniques (The Remaining 80%)**

### **When Basic Template Isn't Enough**

#### **1. Chain-of-Thought for Complex Architecture Decisions**
```
"Think step by step about how this new component fits into our architecture:
1. Which layer does this belong in (Agent, Service, or Utility)?
2. What existing interfaces should it implement?
3. How does it integrate with our dependency injection?
4. What are the error propagation patterns?
5. How should it be tested according to our strategy?"
```

#### **2. Role-Based Prompting for Code Reviews**
```
"Act as a senior architect reviewing this code against our established patterns 
in docs/ARCHITECTURE.md. Check for:
- Proper BaseAgent implementation
- Correct error handling patterns
- Service interface compliance
- Dependency injection usage
- Testing completeness"
```

#### **3. Negative Examples for Anti-Patterns**
```
"Implement this feature but avoid these anti-patterns:
- Don't access services directly; use getService() from ServiceManager
- Don't bypass BaseAgent error handling with try/catch
- Don't create new error types; use our established hierarchy
- Don't skip parameter validation in agent execute methods"
```

#### **4. Iterative Refinement with Architecture Validation**
```
"Review this implementation against our architecture documentation:
1. Does it follow BaseAgent template method pattern?
2. Is error handling consistent with other agents?
3. Does service registration follow our lifecycle management?
4. Are tests comprehensive per our testing strategy?

If any issues, refactor to align with our patterns."
```

## 📱 **React Native Development Prompts**

### **Foundation & Architecture Setup (Week 1-2)**

#### **1. Project Structure and Dependencies**
```
**Architecture Context:** Starting fresh React Native app following our strategic framework 
approach from plan.md. Need clean architecture with clear separation of concerns.

**Goal:** Set up React Native project with TypeScript, Redux Toolkit, React Navigation, 
and proper project structure following clean architecture principles.

**Constraints:**
- Use React Native 0.72+ with TypeScript
- Follow the project structure defined in plan.md
- Implement Redux Toolkit with RTK Query for state management
- Use React Navigation 6 for navigation
- Set up ESLint, Prettier, and TypeScript configuration

**Integration Points:**
- Backend API integration (existing multi-agent system)
- Google services integration (Gmail, Calendar, Contacts)
- Voice processing capabilities
- Action card system

**Testing Requirements:**
- Jest + React Native Testing Library setup
- Component testing framework
- Mock service implementations
- E2E testing preparation with Detox

**Format:** Provide complete project setup including:
1. package.json with all dependencies
2. Project structure and file organization
3. Redux store configuration with RTK Query
4. Navigation setup with React Navigation
5. TypeScript configuration and ESLint rules
6. Basic component structure and styling setup

**Example:** Follow modern React Native best practices with clean architecture, 
similar to established enterprise React Native applications.
```

#### **2. Repository Pattern Implementation**
```
**Architecture Context:** Need to implement repository pattern for data access layer 
following clean architecture principles. This will abstract API calls and enable 
easy testing with mock implementations.

**Goal:** Create repository interfaces and implementations for chat, actions, and user data 
that integrate with our existing backend multi-agent system.

**Constraints:**
- Follow repository pattern with clear interfaces
- Use dependency injection for service management
- Implement proper error handling and retry logic
- Support offline functionality and caching
- Integrate with existing backend API endpoints

**Integration Points:**
- Backend API endpoints (text-command, confirm-action, session management)
- Google services (Gmail, Calendar, Contacts)
- Local storage (AsyncStorage, SQLite)
- Redux store for state management

**Testing Requirements:**
- Mock repository implementations for testing
- Unit tests for repository methods
- Integration tests with mock API responses
- Error handling and retry logic tests

**Format:** Provide complete repository implementation including:
1. Repository interfaces (IChatRepository, IActionRepository, IUserRepository)
2. Concrete implementations using Axios for API calls
3. Mock implementations for testing
4. Error handling and retry mechanisms
5. Integration with Redux store and RTK Query

**Example:** Follow repository pattern best practices with proper error handling, 
similar to enterprise React applications but adapted for React Native.
```

#### **3. Redux Store and State Management**
```
**Architecture Context:** Need to implement Redux Toolkit with RTK Query for state 
management following our clean architecture approach. This will handle app state, 
API calls, and data persistence.

**Goal:** Set up Redux store with slices for chat, actions, user, and voice state, 
plus RTK Query for API integration with our backend multi-agent system.

**Constraints:**
- Use Redux Toolkit with RTK Query
- Implement proper state normalization
- Handle loading, error, and success states
- Support offline functionality and data persistence
- Integrate with repository pattern

**Integration Points:**
- Repository layer for data access
- React Navigation for navigation state
- Voice processing components
- Action card system
- Local storage for persistence

**Testing Requirements:**
- Redux store testing with mock actions
- RTK Query testing with mock responses
- State persistence testing
- Integration tests with mock repositories

**Format:** Provide complete Redux implementation including:
1. Store configuration with middleware
2. RTK Query API definitions for backend endpoints
3. Redux slices for chat, actions, user, and voice state
4. Selectors and actions for state management
5. Integration with repository pattern
6. Basic testing setup

**Example:** Follow Redux Toolkit best practices with proper state management, 
similar to enterprise React applications but adapted for React Native.
```

### **Voice Integration (Week 3-4)**

#### **4. Speech-to-Text Implementation**
```
**Architecture Context:** Need to implement voice-first interface using React Native 
Voice or Expo Speech. This is core to our AI assistant's user experience and must 
integrate seamlessly with our existing architecture.

**Goal:** Create VoiceInput component with speech recognition, voice activation, 
visual feedback, and proper error handling that integrates with our Redux store 
and chat system.

**Constraints:**
- Use React Native Voice or Expo Speech for speech recognition
- Implement continuous listening with voice activation
- Handle background processing and interruptions
- Provide visual feedback (waveforms, listening states)
- Integrate with Redux store for state management
- Support both iOS and Android platforms

**Integration Points:**
- Redux store for voice state management
- Chat system for sending voice input
- Action card system for voice commands
- Error handling and user feedback
- Background audio management

**Testing Requirements:**
- Component testing with mock voice services
- Platform-specific testing (iOS vs Android)
- Error handling and retry logic tests
- Performance testing for voice processing
- Accessibility testing for voice navigation

**Format:** Provide complete voice input implementation including:
1. VoiceInput component with speech recognition
2. Voice state management in Redux
3. Visual feedback components (waveforms, listening states)
4. Error handling and retry mechanisms
5. Platform-specific adaptations
6. Integration with chat system
7. Basic testing setup

**Example:** Follow React Native voice integration best practices with proper 
error handling and user experience, similar to established voice-first applications.
```

#### **5. Text-to-Speech Implementation**
```
**Architecture Context:** Need to implement text-to-speech for AI responses using 
AVSpeechSynthesizer (iOS) and TextToSpeech (Android). This will complete the 
voice-first experience and integrate with our action card system.

**Goal:** Create VoiceOutput component with TTS capabilities, queue management, 
voice settings, and background audio handling that integrates with our Redux store.

**Constraints:**
- Use platform-specific TTS implementations
- Implement queue management for multiple responses
- Support voice settings and preferences
- Handle background audio and interruptions
- Integrate with action card system
- Support both iOS and Android platforms

**Integration Points:**
- Redux store for voice output state
- Action card system for response reading
- Chat system for AI responses
- Voice settings and preferences
- Background audio management

**Testing Requirements:**
- Component testing with mock TTS services
- Platform-specific testing
- Queue management testing
- Background audio handling tests
- Voice settings and preferences tests

**Format:** Provide complete voice output implementation including:
1. VoiceOutput component with TTS capabilities
2. Voice output state management in Redux
3. Queue management for multiple responses
4. Voice settings and preferences
5. Platform-specific adaptations
6. Integration with action card system
7. Basic testing setup

**Example:** Follow React Native TTS best practices with proper queue management 
and platform support, similar to established voice applications.
```

### **Action Card System (Week 5-6)**

#### **6. Action Card Component Library**
```
**Architecture Context:** Need to implement action card system that displays 
proposed actions from our backend multi-agent system. This is core to our AI 
assistant's functionality and must integrate with Google services.

**Goal:** Create comprehensive action card component library with email, calendar, 
contact, and generic action cards that integrate with our Redux store and 
repository pattern.

**Constraints:**
- Follow component library best practices
- Implement proper TypeScript interfaces
- Support all action types (email, calendar, contact, generic)
- Integrate with Redux store for state management
- Support action confirmation and execution
- Handle loading, error, and success states

**Integration Points:**
- Redux store for action state management
- Repository pattern for action execution
- Google services integration
- Voice system for voice commands
- Chat system for action proposals

**Testing Requirements:**
- Component testing with mock data
- Action execution flow testing
- Error handling and retry logic tests
- User interaction testing
- Accessibility testing

**Format:** Provide complete action card implementation including:
1. Action card interfaces and types
2. EmailActionCard, CalendarActionCard, ContactActionCard components
3. GenericActionCard for flexible actions
4. Action confirmation and execution flow
5. Integration with Redux store
6. Basic testing setup

**Example:** Follow React Native component library best practices with proper 
TypeScript support and accessibility, similar to established design systems.
```

#### **7. Action Execution and Management**
```
**Architecture Context:** Need to implement action execution flow that connects 
action cards to our backend multi-agent system and Google services. This will 
handle the complete action lifecycle from proposal to execution.

**Goal:** Create ActionExecutor service with action execution, real-time status 
updates, error handling, and retry mechanisms that integrates with our repository 
pattern and Redux store.

**Constraints:**
- Follow service pattern with proper interfaces
- Implement real-time status updates
- Handle action confirmation and execution
- Support error handling and retry logic
- Integrate with Google services
- Provide user feedback and progress updates

**Integration Points:**
- Backend API endpoints for action execution
- Google services (Gmail, Calendar, Contacts)
- Redux store for action state management
- Action card components for user interaction
- Error handling and user feedback

**Testing Requirements:**
- Service testing with mock implementations
- Action execution flow testing
- Error handling and retry logic tests
- Integration tests with mock API responses
- Performance testing for action execution

**Format:** Provide complete action execution implementation including:
1. ActionExecutor service with interfaces
2. Action execution flow and state management
3. Real-time status updates and progress tracking
4. Error handling and retry mechanisms
5. Integration with repository pattern
6. Basic testing setup

**Example:** Follow React Native service pattern best practices with proper 
error handling and state management, similar to enterprise applications.
```

### **Integration and Polish (Week 7-8)**

#### **8. Backend API Integration**
```
**Architecture Context:** Need to integrate with our existing backend multi-agent 
system using the repository pattern and RTK Query. This will connect our React 
Native app to the sophisticated AI backend we've already built.

**Goal:** Complete backend integration with text-command, confirm-action, and 
session management endpoints, plus Google services connectivity through our 
multi-agent system.

**Constraints:**
- Use existing backend API endpoints
- Follow repository pattern for data access
- Implement proper error handling and retry logic
- Support offline functionality and data persistence
- Integrate with Google services through backend
- Handle authentication and session management

**Integration Points:**
- Backend multi-agent system API
- Google services (Gmail, Calendar, Contacts)
- Authentication and session management
- Offline functionality and data persistence
- Error handling and user feedback

**Testing Requirements:**
- API integration testing with mock responses
- Error handling and retry logic tests
- Offline functionality testing
- Authentication and session management tests
- Performance testing for API calls

**Format:** Provide complete backend integration including:
1. API service implementations using RTK Query
2. Authentication and session management
3. Offline functionality and data persistence
4. Error handling and retry mechanisms
5. Integration with repository pattern
6. Basic testing setup

**Example:** Follow React Native API integration best practices with proper 
error handling and offline support, similar to enterprise applications.
```

#### **9. Conversation Persistence and Offline Support**
```
**Architecture Context:** Need to implement conversation persistence using local 
storage and offline message queuing. This will provide a seamless user experience 
even when offline and support conversation history management.

**Goal:** Create conversation persistence system with local storage, offline 
queuing, search and filtering, and export capabilities that integrates with 
our Redux store and repository pattern.

**Constraints:**
- Use AsyncStorage and SQLite for local storage
- Implement offline message queuing
- Support conversation search and filtering
- Handle large conversation histories efficiently
- Integrate with Redux store for state management
- Support conversation export and sharing

**Integration Points:**
- Local storage (AsyncStorage, SQLite)
- Redux store for conversation state
- Repository pattern for data access
- Offline functionality and data persistence
- Search and filtering capabilities

**Testing Requirements:**
- Local storage testing with mock data
- Offline functionality testing
- Search and filtering tests
- Performance testing for large datasets
- Data persistence and recovery tests

**Format:** Provide complete conversation persistence implementation including:
1. Local storage service with AsyncStorage and SQLite
2. Offline message queuing and synchronization
3. Conversation search and filtering
4. Export and sharing capabilities
5. Integration with Redux store
6. Basic testing setup

**Example:** Follow React Native local storage best practices with proper 
offline support and data management, similar to enterprise applications.
```

### **Testing and Quality Assurance (Week 9-10)**

#### **10. Comprehensive Testing Implementation**
```
**Architecture Context:** Need to implement comprehensive testing strategy using 
Jest, React Native Testing Library, and Detox. This will ensure code quality, 
reliability, and maintainability following our strategic framework approach.

**Goal:** Create complete testing framework with unit tests, integration tests, 
E2E tests, and performance testing that covers all components and user flows.

**Constraints:**
- Use Jest + React Native Testing Library for unit/integration tests
- Use Detox for E2E testing
- Implement proper mocking and test utilities
- Cover all critical user flows and edge cases
- Maintain high test coverage (80%+)
- Follow testing best practices and patterns

**Integration Points:**
- All React Native components and screens
- Redux store and state management
- Repository pattern and API integration
- Voice processing and action execution
- Navigation and user flows

**Testing Requirements:**
- Unit tests for all components and services
- Integration tests for component interactions
- E2E tests for critical user flows
- Performance testing for voice and action processing
- Accessibility testing for voice navigation

**Format:** Provide complete testing implementation including:
1. Jest configuration and test utilities
2. Component testing with React Native Testing Library
3. Redux store testing with mock actions
4. E2E testing setup with Detox
5. Performance testing framework
6. Test coverage reporting and CI integration

**Example:** Follow React Native testing best practices with comprehensive 
coverage and proper mocking, similar to enterprise applications.
```

#### **11. Performance Optimization and Production Readiness**
```
**Architecture Context:** Need to optimize performance for production use and 
prepare for App Store submission. This includes performance profiling, memory 
optimization, and production deployment preparation.

**Goal:** Optimize app performance, implement production monitoring, and prepare 
for App Store submission with proper error handling, accessibility, and user guidance.

**Constraints:**
- Optimize memory usage and rendering performance
- Implement performance monitoring and analytics
- Ensure accessibility compliance (WCAG 2.1 AA)
- Prepare App Store metadata and screenshots
- Implement proper error handling and user guidance
- Support production deployment and monitoring

**Integration Points:**
- Performance monitoring and analytics
- App Store submission and deployment
- Error handling and user feedback
- Accessibility and user guidance
- Production monitoring and logging

**Testing Requirements:**
- Performance profiling and optimization
- Memory usage and rendering tests
- Accessibility compliance testing
- App Store submission validation
- Production deployment testing

**Format:** Provide complete production readiness implementation including:
1. Performance optimization strategies and tools
2. Memory usage and rendering optimization
3. Accessibility compliance and testing
4. App Store submission preparation
5. Production monitoring and analytics
6. Error handling and user guidance improvements

**Example:** Follow React Native production optimization best practices with 
proper monitoring and deployment preparation, similar to enterprise applications.
```

## ⚡ **Quick Reference for Common Scenarios**

### **Adding a New Agent**
```
Context: Review docs/AGENTS.md BaseAgent pattern and existing agent implementations
Goal: Create [AgentName] extending BaseAgent with proper configuration
Constraints: Follow error handling, logging, and validation patterns from existing agents
Integration: Register with AgentFactory, add to MasterAgent routing
Testing: Unit tests, integration tests, AI behavior tests per docs/TESTING.md
```

### **Adding a New Service**
```
Context: Review docs/SERVICES.md IService interface and service lifecycle patterns
Goal: Implement [ServiceName] with proper dependency injection and health monitoring
Constraints: Follow ServiceManager registration, initialization order, error isolation
Integration: Register with ServiceManager, handle dependencies properly
Testing: Service lifecycle tests, integration tests, health check validation
```

### **Adding a New React Native Component**
```
Context: Review plan.md for React Native architecture and component patterns
Goal: Create [ComponentName] following our clean architecture approach
Constraints: Use TypeScript, follow component library patterns, integrate with Redux
Integration: Connect to Redux store, use repository pattern, follow navigation patterns
Testing: Component tests, integration tests, accessibility tests per testing strategy
```

### **Fixing a Bug**
```
Context: [Describe current behavior and system component affected]
Goal: Fix the issue while maintaining architectural patterns
Constraints: Don't bypass established error handling or logging patterns
Investigation: Check service health, agent execution logs, test coverage
Resolution: Implement fix with proper error handling and add regression tests
```

### **Refactoring Existing Code**
```
Context: Review current implementation against docs/ARCHITECTURE.md patterns
Goal: Refactor to better align with our established architectural boundaries
Constraints: Maintain backward compatibility, follow migration patterns
Testing: Ensure all existing tests pass, add tests for new patterns
Validation: Verify performance benchmarks and error handling still work
```

## 🎯 **Key Success Patterns**

### **Always Start With Architecture**
1. **Read the docs first** - Understand existing patterns
2. **Identify integration points** - Know what you're connecting to
3. **Follow established interfaces** - Don't reinvent patterns
4. **Test comprehensively** - Follow our testing strategy

### **Prompt for Consistency**
```
"Following the exact same pattern as [ExistingComponent], implement [NewComponent] 
with the same error handling, logging, and validation approaches but adapted for 
[NewUseCase]."
```

### **Validate Against Architecture**
```
"Review this implementation against our architecture documentation and refactor 
any parts that don't follow our established patterns for error handling, service 
registration, or agent lifecycle management."
```

## 📚 **Documentation-Driven Development**

### **The Golden Rule**
> **Before writing any prompt, read the relevant architecture documentation and reference specific patterns, interfaces, and examples in your prompt.**

### **Documentation Reading Order**
1. **`docs/ARCHITECTURE.md`** - System overview and boundaries
2. **Component-specific docs** - Agents, Services, etc.
3. **`docs/TESTING.md`** - Quality requirements
4. **`docs/DEVELOPMENT.md`** - Implementation workflow

### **Prompt Validation Checklist**
- [ ] Referenced specific architecture documentation
- [ ] Cited existing patterns to follow
- [ ] Specified integration points
- [ ] Included testing requirements
- [ ] Mentioned error handling patterns
- [ ] Provided architectural context

## 🎯 **Remember: Architecture First, Prompts Second**

The most effective AI development happens when you:

1. **Understand the architecture** by reading the documentation
2. **Identify the patterns** you need to follow
3. **Write prompts** that reference these specific patterns
4. **Validate results** against architectural requirements

This approach ensures AI assistance respects your system's boundaries while maximizing development velocity and code quality.
