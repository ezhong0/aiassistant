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

### **🎯 MVP SCOPE DEFINITION**
**Core MVP Features (13 weeks):**
- ✅ **Authentication**: Google Sign-In with secure token management
- ✅ **Core Functionality**: Text input, conversation persistence, action cards
- ✅ **Action System**: Email, calendar, contact action cards with execution
- ✅ **Backend Integration**: Full integration with existing multi-agent backend
- ✅ **Voice Interface**: Speech-to-text and text-to-speech capabilities
- ✅ **Testing & Quality**: Comprehensive testing and production readiness

**🎯 Agent-Based Architecture (No Direct API Calls):**
- ✅ **All interactions** go through `/api/assistant/text-command` endpoint
- ✅ **Agents handle** email, calendar, and contact operations
- ✅ **Frontend displays** action cards from agent responses
- ✅ **User confirms** actions through `/api/assistant/confirm-action` endpoint
- ❌ **No direct access** to Gmail, Calendar, or Contact APIs from frontend

**What's NOT in MVP (Post-MVP):**
- ❌ Advanced navigation features (deep linking, route protection)
- ❌ Comprehensive error boundaries and global error handling
- ❌ Advanced offline state management and push notifications
- ❌ Analytics, accessibility, and internationalization
- ❌ Enterprise features (SSO, compliance, admin tools)

### **Foundation & Architecture Setup (Week 1-2) - MVP CORE**

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
- Backend API endpoints:
  - `/api/assistant/text-command` - Main AI processing endpoint (all user interactions)
  - `/api/assistant/confirm-action` - Action confirmation endpoint
  - `/api/assistant/session/:id` - Session management endpoint
- Google services (Gmail, Calendar, Contacts) - accessed through agents only
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
- Backend response types:
  - 'confirmation_required' for action cards
  - 'action_completed' for successful executions
  - 'partial_success' for mixed results
  - 'session_data' for session information

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

### **Authentication & Core Functionality (Week 3-4) - MVP CORE**

#### **4. Google Sign-In Implementation**
```
**Architecture Context:** Need to implement Google Sign-In for our AI assistant 
platform that integrates with our existing backend multi-agent system and Google 
services (Gmail, Calendar, Contacts). This is critical for user authentication 
and access to Google productivity tools.

**Goal:** Create complete Google Sign-In system with OAuth 2.0, secure token 
storage, and integration with our Redux store and repository pattern.

**Constraints:**
- Use @react-native-google-signin/google-signin library
- Implement secure token storage with react-native-keychain
- Follow our established error handling patterns
- Integrate with Redux store for authentication state
- Support both iOS and Android platforms
- Handle token refresh and expiration
- Implement proper logout and session cleanup
- Reference backend error codes:
  - ERROR_CODES.SERVICE_UNAVAILABLE
  - ERROR_CODES.SESSION_NOT_FOUND
  - ERROR_CODES.SESSION_ACCESS_DENIED

**Integration Points:**
- Redux store for authentication state management
- Repository pattern for user data access
- Backend API for session management and authentication
- Google services (Gmail, Calendar, Contacts)
- Secure local storage for tokens
- Navigation guards for protected routes

**Testing Requirements:**
- Authentication flow testing (sign in, sign out, token refresh)
- Token storage security testing
- Error handling for auth failures (network, invalid tokens)
- Platform-specific testing (iOS vs Android)
- Integration with backend API authentication
- Navigation guard testing for protected routes

**Format:** Provide complete Google Sign-In implementation including:
1. Google Sign-In configuration for iOS and Android
2. Authentication service with proper interfaces
3. Redux slice for authentication state management
4. Secure token storage implementation with react-native-keychain
5. Token refresh and expiration handling
6. Navigation guards for protected routes
7. Integration with existing repository pattern
8. Basic testing setup with mock Google services

**Example:** Follow React Native authentication best practices with proper 
security, similar to enterprise applications like Slack or Microsoft Teams.
```

#### **5. Authentication State Management**
```
**Architecture Context:** Need to implement comprehensive authentication state 
management that handles user sessions, token validation, and secure access to 
Google services through our backend multi-agent system.

**Goal:** Create authentication state management system with session persistence, 
token validation, and secure access control for all app features.

**Constraints:**
- Use Redux Toolkit for state management
- Implement secure session persistence
- Handle token refresh automatically
- Provide authentication guards for protected routes
- Support offline authentication state
- Integrate with our repository pattern
- Handle authentication errors gracefully
- Reference backend error codes:
  - ERROR_CODES.SERVICE_UNAVAILABLE
  - ERROR_CODES.SESSION_NOT_FOUND
  - ERROR_CODES.SESSION_ACCESS_DENIED

**Integration Points:**
- Redux store for global state management
- Secure local storage for session persistence
- Backend API for session validation and user data
- Navigation guards for protected screens
- Repository pattern for user data access
- Google services authentication state

**Testing Requirements:**
- Authentication state persistence testing
- Token refresh flow testing
- Protected route access testing
- Offline authentication testing
- Integration with backend API
- Error handling for authentication failures

**Format:** Provide complete authentication state management including:
1. Redux slice for authentication state with proper types
2. Session persistence service with secure storage
3. Authentication guards for navigation and components
4. Token validation and refresh logic
5. User session management and cleanup
6. Integration with repository pattern
7. Basic testing setup with mock authentication

**Example:** Follow React Native state management best practices with proper 
security and session handling, similar to enterprise applications.
```

#### **6. Basic Text Input Implementation**
```
**Architecture Context:** Need minimal text input to test core functionality 
before moving to voice integration. This is temporary scaffolding to validate 
our architecture and action card system.

**Goal:** Create basic text input system with minimal features that integrates 
with our Redux store and enables testing of the core AI assistant functionality.

**Constraints:**
- Use basic React Native TextInput with minimal enhancements
- Simple send button and basic validation
- No complex formatting or suggestions
- Basic error handling
- Integrate with Redux store for state management
- Keep implementation minimal and temporary

**Integration Points:**
- Redux store for input state management
- Chat system for sending text input
- Action card system for text commands
- Basic local storage for testing
- Error handling and user feedback

**Testing Requirements:**
- Basic component testing
- Input validation tests
- Integration with chat system
- Basic error handling tests

**Format:** Provide minimal text input implementation including:
1. Basic TextInput component with send button
2. Simple input validation
3. Integration with Redux store
4. Basic error handling
5. Simple testing setup

**Example:** Follow React Native basic input patterns, keeping it simple 
and focused on core functionality testing.
```

#### **7. Basic Conversation Persistence**
```
**Architecture Context:** Need minimal conversation persistence to test core 
functionality before moving to voice integration. This is temporary scaffolding 
to validate our data flow and state management.

**Goal:** Create basic conversation persistence with simple local storage 
that enables testing of the core AI assistant functionality.

**Constraints:**
- Use AsyncStorage for basic local storage only
- Simple message persistence without complex features
- No offline queuing or search functionality
- Basic error handling
- Integrate with Redux store for state management
- Keep implementation minimal and temporary

**Integration Points:**
- AsyncStorage for basic persistence
- Redux store for conversation state
- Repository pattern for data access
- Basic error handling

**Testing Requirements:**
- Basic local storage testing
- Data persistence tests
- Integration with Redux store
- Simple error handling tests

**Format:** Provide minimal conversation persistence implementation including:
1. Basic AsyncStorage service
2. Simple message persistence
3. Integration with Redux store
4. Basic error handling
5. Simple testing setup

**Example:** Follow React Native basic storage patterns, keeping it simple 
and focused on core functionality testing.
```

### **Action Card System (Week 5-6) - MVP CORE**

#### **8. Action Card Component Library**
```
**Architecture Context:** Need to implement action card system that displays 
proposed actions from our backend multi-agent system. This is core to our AI 
assistant's functionality and must integrate with Google services through agents only.

**Goal:** Create comprehensive action card component library with email, calendar, 
contact, and generic action cards that integrate with our Redux store and 
repository pattern. Action cards are generated from agent responses, not direct API calls.

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
- Backend response type validation:
  - 'confirmation_required' responses
  - 'action_completed' responses
  - 'partial_success' responses
  - 'session_data' responses

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

#### **9. Action Execution and Management**
```
**Architecture Context:** Need to implement action execution flow that connects 
action cards to our backend multi-agent system and Google services. This will 
handle the complete action lifecycle from proposal to execution through the agent system.

**Goal:** Create ActionExecutor service with action execution, real-time status 
updates, error handling, and retry mechanisms that integrates with our repository 
pattern and Redux store. This service coordinates with the backend agent system, 
not direct API calls.

**Constraints:**
- Follow service pattern with proper interfaces
- Implement real-time status updates
- Handle action confirmation and execution
- Support error handling and retry logic
- Integrate with Google services
- Provide user feedback and progress updates

**Integration Points:**
- Backend API endpoints for action execution:
  - `/api/assistant/text-command` for action proposals (agent-based)
  - `/api/assistant/confirm-action` for action execution
  - ToolExecutorService.executeTools() with preview mode
  - Tool execution context and statistics
- Google services (Gmail, Calendar, Contacts) - accessed through agents only
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

### **Integration and Polish (Week 7-8) - MVP CORE**

#### **10. Backend API Integration**
```
**Architecture Context:** Need to integrate with our existing backend multi-agent 
system using the repository pattern and RTK Query. This will connect our React 
Native app to the sophisticated AI backend we've already built.

**🎯 Correct Flow (Agent-Based Only):**
1. User input → Frontend → `/api/assistant/text-command`
2. Backend MasterAgent routes to appropriate agent (emailAgent, calendarAgent, etc.)
3. Agent runs in preview mode, returns action proposal
4. Frontend displays action card for user confirmation
5. User confirms → Frontend → `/api/assistant/confirm-action`
6. Backend executes confirmed action through agent
7. Frontend displays result

**Goal:** Complete backend integration with text-command, confirm-action, and 
session management endpoints, plus Google services connectivity through our 
multi-agent system.

**Constraints:**
- Use existing backend API endpoints (agent-based only)
- Follow repository pattern for data access
- Implement proper error handling and retry logic
- Support offline functionality and data persistence
- Integrate with Google services through backend agents only
- Handle authentication and session management
- **DO NOT** use direct email/calendar/contact endpoints
- **DO NOT** bypass the agent system for any operations

**Integration Points:**
- Backend multi-agent system API:
  - MasterAgent for intelligent routing
  - ToolExecutorService for action execution
  - AgentFactory for agent registration
  - BaseAgent framework for all agents
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

#### **11. Conversation Persistence and Offline Support**
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
- Backend session management:
  - 30-minute context window (session expiration)
  - Conversation history persistence
  - Pending actions tracking
  - User preferences (language, timezone, verbosity)

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

### **Voice Integration (Week 9-10) - MVP CORE**

#### **12. Speech-to-Text Implementation**
```
**Architecture Context:** Need to implement voice-first interface using React Native 
Voice or Expo Speech. This will enhance our AI assistant's user experience after 
the core functionality is working with text input.

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

#### **13. Text-to-Speech Implementation**
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

### **Testing and Quality Assurance (Week 11-12) - MVP CORE**

#### **14. Comprehensive Testing Implementation**
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

#### **15. Performance Optimization and Production Readiness**
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

## 🔧 **Implementation Roadmap - MVP Focus**

### **Week 1-2: Foundation & Architecture (MVP Core)**
- [ ] Project setup with React Native + TypeScript
- [ ] Redux store configuration with RTK Query
- [ ] Navigation setup with React Navigation
- [ ] Repository pattern implementation
- [ ] Service layer with dependency injection
- [ ] Basic component structure and styling

### **Week 3-4: Authentication & Core Functionality (MVP Core)**
- [ ] Google Sign-In implementation with OAuth 2.0
- [ ] Authentication state management and Redux integration
- [ ] Basic text input with simple send button
- [ ] Basic input validation and error handling
- [ ] Simple conversation persistence with AsyncStorage
- [ ] Core functionality validation with authentication

### **Week 5-6: Action Card System (MVP Core)**
- [ ] Action card component library
- [ ] Action card factory implementation
- [ ] Action execution flow
- [ ] User confirmation interfaces
- [ ] Real-time status updates
- [ ] Error handling and retry logic

### **Week 7-8: Backend Integration & Polish (MVP Core)**
- [ ] Backend API integration with authentication
- [ ] Google services connectivity through backend
- [ ] Conversation persistence and offline support
- [ ] Error handling and user feedback improvements

### **Week 9-10: Voice Integration (MVP Core)**
- [ ] Speech-to-Text implementation
- [ ] Text-to-Speech implementation
- [ ] Voice command integration with existing systems
- [ ] Voice-specific error handling and user experience

### **Week 11-12: Testing & Quality Assurance (MVP Core)**
- [ ] Comprehensive testing implementation
- [ ] Performance optimization and production readiness
- [ ] Code quality validation
- [ ] App Store preparation

### **Week 13: Production Deployment (MVP Core)**
- [ ] Production deployment
- [ ] Monitoring and analytics setup
- [ ] User onboarding and guidance

---

## 🚀 **POST-MVP ENHANCEMENTS (Future Development)**

### **Advanced Features (Post-MVP)**
- [ ] **Navigation & Route Protection**: Advanced navigation guards, deep linking, app state restoration
- [ ] **Error Boundaries & Global Error Handling**: Comprehensive error boundaries, global error handling service
- [ ] **Offline State Management**: Advanced offline state detection, offline action queuing
- [ ] **Push Notifications**: Push notification system for action updates and confirmations
- [ ] **Analytics & Performance Monitoring**: User behavior tracking, performance monitoring, crash reporting
- [ ] **Accessibility & Internationalization**: WCAG 2.1 AA compliance, multi-language voice command support
- [ ] **Advanced Voice Features**: Voice command learning, custom wake words, voice profiles
- [ ] **Team Collaboration**: Shared assistant experiences, team workflows
- [ ] **Microsoft 365 Integration**: Outlook, Teams, SharePoint integration
- [ ] **Workflow Automation**: Multi-step action sequences, complex workflow automation

### **Enterprise Features (Future Roadmap)**
- [ ] **SSO Integration**: Enterprise authentication, SAML, OIDC
- [ ] **Compliance & Security**: SOC 2, GDPR compliance, advanced security features
- [ ] **Admin Tools**: User management, analytics dashboard, policy management
- [ ] **API Platform**: Third-party integrations, webhook support
- [ ] **Desktop & Web Apps**: Cross-platform expansion beyond mobile

## ⚡ **Quick Reference for Common Scenarios - MVP Focus**

> **Note**: This section focuses on MVP implementation. For post-MVP features, see the "POST-MVP ENHANCEMENTS" section below.

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

### **Adding Authentication Features**
```
Context: Review Google Sign-In implementation in Prompt 4 and auth state management in Prompt 5
Goal: Add new authentication capabilities following our established patterns
Constraints: Use react-native-keychain for secure storage, follow Redux auth state patterns
Integration: Connect to existing auth Redux slice, use authentication guards
Testing: Auth flow testing, security testing, integration with existing auth system
```

### **Adding Voice Features (After Core Functionality)**
```
Context: Review voice integration prompts in Week 7-8 after core text functionality is working
Goal: Add voice input/output capabilities to existing text-based AI assistant
Constraints: Use React Native Voice/Expo Speech, integrate with existing Redux store
Integration: Connect to existing chat system, action cards, and state management
Testing: Platform-specific testing, voice processing tests, accessibility testing
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

---

## 📋 **MVP vs POST-MVP SUMMARY**

### **✅ INCLUDED IN MVP (13 weeks)**
- **Complete Authentication System**: Google Sign-In, secure token storage, auth state management
- **Core AI Assistant Functionality**: Text input, conversation persistence, action cards
- **Action Execution System**: Email, calendar, contact actions with backend integration
- **Voice Interface**: Speech-to-text and text-to-speech capabilities
- **Backend Integration**: Full integration with existing multi-agent system
- **Testing & Quality**: Comprehensive testing framework and production readiness

### **🚀 MOVED TO POST-MVP**
- **Advanced Navigation**: Deep linking, route protection, app state restoration
- **Error Handling**: Global error boundaries, comprehensive error handling service
- **Offline Features**: Advanced offline state management, push notifications
- **Analytics & Monitoring**: User behavior tracking, performance monitoring
- **Accessibility & i18n**: WCAG compliance, multi-language support
- **Enterprise Features**: SSO, compliance, admin tools, API platform

### **🎯 MVP SUCCESS CRITERIA**
Your MVP will be successful when users can:
1. **Sign in with Google** and access their productivity tools
2. **Use voice commands** to manage email and calendar
3. **See action cards** and confirm actions before execution
4. **Have conversations** that persist and maintain context
5. **Execute actions** through your multi-agent backend system

**🎯 Key Success Indicator:**
- **All user interactions** go through the agent system
- **No direct API calls** to Gmail, Calendar, or Contacts
- **Agents provide intelligence** and context awareness
- **Frontend is a smart client** that displays agent responses

### **🔗 BACKEND INTEGRATION ALIGNMENT**
Your prompts are **95% aligned** with your existing backend:
- ✅ **API Endpoints**: Perfect match with backend routes
- ✅ **Authentication Flow**: Perfect match with OAuth implementation  
- ✅ **Multi-Agent Architecture**: Perfect match with backend framework
- ✅ **Session Management**: Perfect match with 30-minute context window
- ✅ **Action System**: Perfect match with confirmation flow
- ✅ **Response Types**: Updated to reference backend response types
- ✅ **Error Handling**: Updated to reference backend error codes

**Focus on these core features first - everything else can be added later!**
