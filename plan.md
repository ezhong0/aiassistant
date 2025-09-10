# 🎯 AI Assistant Platform: DM-Only Bot Transition Plan

## 📋 **Strategic Overview**

This plan implements a **DM-only Slack bot** with **draft-based confirmations** and a dedicated **Slack Agent** for message reading and context management. The design prioritizes privacy, user experience, and architectural consistency.

---

## 🚀 **Phase 1: DM-Only Transition**

### **Prompt 1.1: Slack Scope Migration**

**Architecture Context:** Based on our existing Slack integration in `backend/src/interfaces/slack.interface.ts` and `backend/src/services/slack-interface.service.ts`, we need to transition from channel-based to DM-only permissions while maintaining all existing functionality.

**Goal:** Update Slack app configuration and OAuth flow to support DM-only access while preserving current bot capabilities.

**Constraints:**
- Maintain existing SlackInterface and SlackInterfaceService patterns
- Preserve all current event handling logic
- Update OAuth scopes to DM-only permissions
- Ensure backward compatibility during transition
- Follow our established error handling patterns

**Integration Points:**
- Slack app configuration in Slack Developer Console
- OAuth flow in `backend/src/routes/slack.routes.ts`
- Event handling in `backend/src/interfaces/slack.interface.ts`
- Service initialization in `backend/src/services/service-initialization.ts`

**Testing Requirements:**
- OAuth flow tests for DM-only permissions
- Event handling tests for DM vs channel events
- Integration tests for DM functionality
- Error handling tests for permission failures

**Format:** Provide:
1. Updated Slack app configuration with DM-only scopes
2. Modified OAuth flow for DM permissions
3. Updated event handling logic for DM-only mode
4. Migration strategy for existing channel-based users
5. Comprehensive test updates

**Example:** Follow the existing OAuth pattern in `backend/src/routes/slack.routes.ts` but restrict scopes to `['im:history', 'im:write', 'users:read']` and update event filtering logic.

---

## 🤖 **Phase 2: Slack Agent Implementation**

### **Prompt 1.2: Slack Agent Creation**

**Architecture Context:** Following our multi-agent architecture in `docs/AGENTS.md`, we need to create a specialized SlackAgent that handles Slack-specific operations including message reading, draft management, and confirmation handling. This agent should integrate with our existing AgentFactory pattern.

**Goal:** Implement SlackAgent extending AIAgent that can read Slack message history, manage drafts, and handle confirmations through natural language processing.

**Constraints:**
- Extend AIAgent<SlackAgentParams, SlackAgentResult> following our established pattern
- Implement proper error handling using our BaseAgent error patterns
- Use structured logging format (logger.error with context)
- Follow our service registry dependency injection patterns
- Integrate with existing SlackInterface service

**Integration Points:**
- AgentFactory registration in `backend/src/config/agent-factory-init.ts`
- MasterAgent routing logic for Slack-specific queries
- SlackInterface service for API calls
- Tool metadata registration for OpenAI function calling

**Testing Requirements:**
- Unit tests following `docs/TESTING.md` patterns
- Agent behavior tests for message reading
- Error handling tests for Slack API failures
- Performance tests within 2-second requirement
- Mock Slack API responses for testing

**Format:** Provide:
1. Complete SlackAgent class extending AIAgent
2. TypeScript interfaces for SlackAgentParams and SlackAgentResult
3. Message reading and parsing methods
4. Draft detection and confirmation handling logic
5. Registration code for AgentFactory
6. Comprehensive unit tests

**Example:** Follow the ContactAgent pattern in `backend/src/agents/contact.agent.ts` but adapt for Slack message operations instead of Google Contacts API calls.

### **Prompt 1.3: Slack Message Reading Service**

**Architecture Context:** Building on our service layer architecture in `docs/SERVICES.md`, create a dedicated service for reading Slack message history that follows our BaseService pattern and integrates with the Slack Web API.

**Goal:** Implement SlackMessageReaderService that can safely read recent Slack messages with proper error handling, rate limiting, and privacy controls.

**Constraints:**
- Extend BaseService following our IService interface
- Implement proper error handling with Slack-specific error types
- Use our established logging patterns
- Follow dependency injection through ServiceManager
- Include rate limiting and API quota management
- Implement message filtering for sensitive content

**Integration Points:**
- Service registration in `backend/src/services/service-initialization.ts`
- SlackInterface service for WebClient access
- CacheService for message caching (optional)
- DatabaseService for audit logging (optional)

**Testing Requirements:**
- Service lifecycle tests following our patterns
- Slack API integration tests with mocks
- Rate limiting and error handling tests
- Privacy and security validation tests
- Performance tests for message reading operations

**Format:** Provide:
1. Complete SlackMessageReaderService class
2. Message filtering and privacy controls
3. Rate limiting and quota management
4. Error handling with proper Slack error types
5. Service registration and dependency setup
6. Comprehensive test suite

**Example:** Follow the GmailService pattern in `backend/src/services/gmail.service.ts` but adapt for Slack API calls instead of Gmail API operations.

---

## 📝 **Phase 3: Draft-Based Confirmation System**

### **Prompt 1.4: Draft Generation Framework**

**Architecture Context:** Based on our existing confirmation system in `backend/src/services/confirmation.service.ts`, implement a new draft-based approach that generates previews in chat and handles confirmations through message reading rather than persistent storage.

**Goal:** Create a DraftService that generates email, calendar, and contact drafts, sends them to users in Slack, and handles confirmations by reading the user's response messages.

**Constraints:**
- Replace current confirmation table approach with message-based confirmations
- Maintain compatibility with existing EmailAgent, CalendarAgent, and ContactAgent
- Follow our established error handling patterns
- Use our structured logging format
- Implement proper draft formatting for Slack messages
- Include modification support for draft changes

**Integration Points:**
- Integration with existing agents for draft generation
- SlackInterface service for sending draft messages
- SlackMessageReaderService for reading confirmations
- ToolExecutorService for executing confirmed actions
- OpenAI service for draft modification processing

**Testing Requirements:**
- Draft generation tests for all agent types
- Confirmation parsing tests with various user inputs
- Modification handling tests
- Integration tests with existing agents
- Error handling tests for failed confirmations

**Format:** Provide:
1. Complete DraftService class with draft generation methods
2. Draft formatting utilities for Slack messages
3. Confirmation parsing and handling logic
4. Modification support for user changes
5. Integration with existing agents
6. Comprehensive test suite

**Example:** Follow the ConfirmationService pattern in `backend/src/services/confirmation.service.ts` but replace database storage with message-based confirmations and add draft generation capabilities.

### **Prompt 1.5: Natural Language Confirmation Processing**

**Architecture Context:** Building on our OpenAI integration in `backend/src/services/openai.service.ts`, implement natural language processing for confirmation responses that can handle various user inputs like "send it", "make it friendlier", "change the time to 3pm", etc.

**Goal:** Create ConfirmationProcessor that uses AI to understand user confirmation intent and extract modification requests from natural language responses.

**Constraints:**
- Use our existing OpenAI service patterns
- Implement proper error handling for AI processing failures
- Follow our structured logging format
- Include fallback handling for unclear responses
- Support multiple confirmation types (send, cancel, modify)
- Maintain conversation context for modifications

**Integration Points:**
- OpenAI service for natural language processing
- DraftService for draft modifications
- SlackMessageReaderService for context reading
- Existing agents for executing modified actions
- Error handling integration with our patterns

**Testing Requirements:**
- Natural language processing tests with various inputs
- Confirmation intent recognition tests
- Modification extraction tests
- Error handling tests for AI failures
- Integration tests with draft system

**Format:** Provide:
1. Complete ConfirmationProcessor class
2. Natural language processing methods
3. Intent recognition and extraction logic
4. Modification handling and context management
5. Error handling and fallback mechanisms
6. Comprehensive test suite with various user inputs

**Example:** Follow the OpenAI service patterns in `backend/src/services/openai.service.ts` but focus on confirmation processing and modification extraction rather than general text generation.

---

## 🔄 **Phase 4: Integration and Testing**

### **Prompt 1.6: Master Agent Integration**

**Architecture Context:** Based on our MasterAgent implementation in `backend/src/agents/master.agent.ts`, integrate the new SlackAgent and draft-based confirmation system into the existing routing and orchestration logic.

**Goal:** Update MasterAgent to route Slack-specific queries to SlackAgent and integrate draft-based confirmations into the tool execution workflow.

**Constraints:**
- Maintain existing MasterAgent routing patterns
- Integrate SlackAgent into existing agent discovery
- Preserve existing tool execution workflows
- Follow our established error handling patterns
- Maintain backward compatibility with existing agents
- Update OpenAI function calling schemas

**Integration Points:**
- AgentFactory for SlackAgent registration
- ToolExecutorService for draft-based confirmations
- Existing agent routing logic
- OpenAI function calling integration
- Error handling and logging patterns

**Testing Requirements:**
- MasterAgent routing tests for Slack queries
- Integration tests with draft confirmation flow
- Tool execution tests with new confirmation system
- Error handling tests for integration failures
- Performance tests for complete workflow

**Format:** Provide:
1. Updated MasterAgent routing logic
2. SlackAgent integration code
3. Draft confirmation workflow integration
4. Updated OpenAI function schemas
5. Comprehensive integration tests
6. Migration strategy from old confirmation system

**Example:** Follow the existing MasterAgent patterns in `backend/src/agents/master.agent.ts` but add Slack-specific routing and integrate the new draft-based confirmation system.

### **Prompt 1.7: End-to-End Testing Framework**

**Architecture Context:** Building on our testing infrastructure in `backend/tests/`, create comprehensive end-to-end tests for the complete DM-only bot workflow including draft generation, confirmation handling, and action execution.

**Goal:** Implement comprehensive test suite that validates the complete user journey from initial request through draft generation, confirmation, and execution.

**Constraints:**
- Follow our established testing patterns in `docs/TESTING.md`
- Use our existing test utilities and mocking strategies
- Include performance tests within 2-second requirement
- Test error handling and edge cases
- Validate privacy and security controls
- Include load testing for concurrent users

**Integration Points:**
- Existing test infrastructure and utilities
- Mock Slack API responses
- Mock OpenAI API responses
- Database testing with test fixtures
- Service integration testing

**Testing Requirements:**
- Complete user journey tests
- Draft generation and formatting tests
- Confirmation processing tests
- Error handling and edge case tests
- Performance and load tests
- Privacy and security validation tests

**Format:** Provide:
1. Complete end-to-end test suite
2. Mock implementations for external APIs
3. Test fixtures and data setup
4. Performance and load testing
5. Error scenario testing
6. Privacy and security validation tests

**Example:** Follow the integration test patterns in `backend/tests/integration/` but create comprehensive tests for the complete DM-only bot workflow.

---

## 📊 **Phase 5: Performance and Optimization**

### **Prompt 1.8: Performance Optimization**

**Architecture Context:** Based on our performance requirements and existing optimization patterns, optimize the DM-only bot for response time, memory usage, and API efficiency.

**Goal:** Implement performance optimizations including message caching, intelligent context selection, and efficient API usage while maintaining the 2-second response requirement.

**Constraints:**
- Maintain 2-second response time requirement
- Follow our established caching patterns in CacheService
- Implement proper memory management
- Use our structured logging for performance monitoring
- Include performance metrics and monitoring
- Optimize OpenAI token usage

**Integration Points:**
- CacheService for message caching
- Existing performance monitoring
- Database optimization patterns
- Service performance patterns
- Error handling for performance issues

**Testing Requirements:**
- Performance benchmark tests
- Memory usage tests
- API efficiency tests
- Load testing with concurrent users
- Performance regression tests
- Monitoring and alerting tests

**Format:** Provide:
1. Performance optimization implementations
2. Caching strategies for message history
3. Memory management improvements
4. API efficiency optimizations
5. Performance monitoring and metrics
6. Comprehensive performance test suite

**Example:** Follow the performance patterns in existing services but optimize specifically for the DM-only bot workflow and message processing requirements.

---

## 🎯 **Success Criteria**

### **Functional Requirements**
- [ ] DM-only Slack bot with proper OAuth scopes
- [ ] SlackAgent integrated with AgentFactory
- [ ] Message reading capability with privacy controls
- [ ] Draft generation for email, calendar, and contacts
- [ ] Natural language confirmation processing
- [ ] Modification support for draft changes
- [ ] Complete integration with existing agents

### **Non-Functional Requirements**
- [ ] 2-second response time maintained
- [ ] Memory usage optimized for message processing
- [ ] Privacy controls implemented and tested
- [ ] Error handling follows established patterns
- [ ] Comprehensive test coverage (>80%)
- [ ] Performance monitoring implemented
- [ ] Documentation updated

### **Architectural Compliance**
- [ ] Follows BaseAgent and AIAgent patterns
- [ ] Integrates with ServiceManager dependency injection
- [ ] Uses established error handling and logging
- [ ] Maintains separation of concerns
- [ ] Follows testing patterns and requirements
- [ ] Preserves existing agent functionality

---

## 🚀 **Implementation Timeline**

**Week 1:** DM-Only Transition (Prompts 1.1)
**Week 2:** Slack Agent Implementation (Prompts 1.2, 1.3)
**Week 3:** Draft-Based Confirmations (Prompts 1.4, 1.5)
**Week 4:** Integration and Testing (Prompts 1.6, 1.7)
**Week 5:** Performance Optimization (Prompt 1.8)

This plan ensures a systematic, architecture-compliant transition to a DM-only bot with enhanced user experience through draft-based confirmations and intelligent message processing.
