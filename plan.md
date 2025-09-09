# Multi-Agent AI Architecture Plan

## Overview
Transform your existing multi-agent system into intelligent AI-driven assistants that use AI planning for complex operations while maintaining agent specialization. Each agent (EmailAgent, ContactAgent, CalendarAgent) becomes an AI-powered specialist that can orchestrate multi-step workflows within their domain.

## Strategic Principles
- **Multi-Agent Specialization**: Each agent handles its domain (email, contacts, calendar) with specialized AI planning
- **Agent-Centric Architecture**: Agents are the primary tools, not separate tool systems
- **AI Planning Integration**: Add AI planning to existing agents while keeping their specialized logic
- **Service Reuse**: Leverage existing BaseAgent framework, AgentFactory, and service registry
- **Clean Enhancement**: Enhance existing agents rather than replacing them

---

## Phase 1: AI Foundation ✅ COMPLETED

### Prompt 1.1: Create AIAgent Base Class ✅ COMPLETED

**Status**: Successfully implemented `AIAgent` and `AIAgentWithPreview` classes that extend `BaseAgent` with AI planning capabilities.

**What Was Built**:
- `AIAgent<TParams, TResult>` abstract class extending BaseAgent patterns
- AI planning framework with step-by-step execution
- `AIAgentWithPreview` for agents requiring confirmation flows
- Integration with existing OpenAI service and AgentFactory
- Example transformation: `AIEmailAgent` demonstrating AI planning

---

### Prompt 1.1.5: Replace BaseAgent with AIAgent (Architectural Foundation)

**Architecture Context:** Currently you have both `BaseAgent` and `AIAgent` classes, where `AIAgent` extends `BaseAgent`. Since nothing is shipped yet and you're building an AI-first architecture, replace `BaseAgent` with `AIAgent` as the single base class for all agents to create a cleaner, more maintainable architecture.

**Goal:** Replace `BaseAgent` with `AIAgent` as the single base class for all agents, making AI planning the default behavior while maintaining manual fallbacks for simple cases.

**Constraints:**
- Replace `BaseAgent` with `AIAgent` as the single base class
- Merge all `BaseAgent` functionality into `AIAgent`
- Make AI planning optional but default (can be disabled for simple agents)
- Maintain all existing patterns: error handling, logging, validation, preview generation
- Preserve all existing agent functionality during migration
- Update all existing agents to extend `AIAgent` instead of `BaseAgent`
- Update `AgentFactory` and related systems to use `AIAgent`

**Integration Points:**
- `BaseAgent` in `backend/src/framework/base-agent.ts` (to be replaced)
- `AIAgent` in `backend/src/framework/ai-agent.ts` (to be enhanced)
- All existing agents: `EmailAgent`, `ContactAgent`, `CalendarAgent`, `MasterAgent`
- `AgentFactory` in `backend/src/framework/agent-factory.ts`
- Agent initialization in `backend/src/config/agent-factory-init.ts`

**Testing Requirements:**
- Migration tests ensuring all existing functionality works
- AI planning default behavior tests
- Manual fallback tests for simple agents
- Agent factory and registration tests
- Performance tests maintaining 2-second requirement
- Regression tests for all existing agent capabilities

**Format:** Provide:
1. Enhanced `AIAgent` class merging all `BaseAgent` functionality
2. Migration strategy for existing agents
3. Updated `AgentFactory` and initialization code
4. Agent configuration for AI planning enable/disable
5. Cleanup of deprecated `BaseAgent` references

**Example:** 
- Before: `class EmailAgent extends BaseAgent` → Manual execution only
- After: `class EmailAgent extends AIAgent` → AI planning by default, manual fallback available
- Configuration: `new EmailAgent({ aiPlanning: { enableAIPlanning: false } })` for simple cases

---

## Phase 2: Agent Enhancement (Week 2)

### Prompt 1.2: Enhance Agents with OpenAI Function Calling

**Architecture Context:** Your existing agents (EmailAgent, ContactAgent, CalendarAgent) already call services directly and have specialized logic. Enhance them with OpenAI function calling metadata so they can be discovered and orchestrated by AI systems while maintaining their domain expertise.

**Goal:** Add OpenAI function calling schemas to existing agents and enhance the MasterAgent to intelligently orchestrate multiple specialized agents using AI planning.

**Constraints:**
- Keep existing multi-agent architecture intact
- Add OpenAI metadata to existing agents without changing their core logic
- Enhance MasterAgent with AI planning for multi-agent orchestration
- Maintain agent-specific confirmation flows and error handling
- Use existing AgentFactory and service registry patterns

**Integration Points:**
- Existing agents in `backend/src/agents/` (EmailAgent, ContactAgent, CalendarAgent)
- MasterAgent in `backend/src/agents/master.agent.ts`
- AgentFactory in `backend/src/framework/agent-factory.ts`
- OpenAI service in `backend/src/services/openai.service.ts`
- ToolExecutorService in `backend/src/services/tool-executor.service.ts`

**Testing Requirements:**
- Agent OpenAI schema generation tests
- Multi-agent orchestration tests
- MasterAgent AI planning validation
- Agent discovery and routing tests
- Performance tests maintaining 2-second requirement

**Format:** Provide enhancements to:
1. Add OpenAI function schemas to existing agents
2. Enhance MasterAgent with AI planning for multi-agent orchestration
3. Agent discovery and metadata generation
4. Multi-agent workflow execution
5. Agent-specific tool metadata

**Example:** 
- EmailAgent gets OpenAI schema: `{"name": "send_email", "description": "Send email via Gmail", "parameters": {...}}`
- ContactAgent gets schema: `{"name": "search_contacts", "description": "Search Google Contacts", "parameters": {...}}`
- MasterAgent uses AI to decide: "Send email to john@example.com" → calls EmailAgent with proper parameters

---

### Prompt 1.3: Enhance OpenAI Service for Multi-Agent Planning

**Architecture Context:** Your existing OpenAI service handles function calling for MasterAgent. Enhance it with multi-agent orchestration capabilities to support intelligent agent selection, parameter extraction, and result synthesis across multiple specialized agents.

**Goal:** Add multi-agent orchestration methods to OpenAI service to support intelligent agent routing, parameter extraction, and result synthesis for complex multi-step operations.

**Constraints:**
- Extend existing OpenAI service without breaking current functionality
- Support multi-agent orchestration and parameter extraction
- Maintain existing function calling capabilities
- Use existing agent metadata and discovery patterns
- Follow service registry patterns for dependency injection

**Integration Points:**
- OpenAI service in `backend/src/services/openai.service.ts`
- AgentFactory for agent discovery and metadata
- MasterAgent for orchestration coordination
- Existing agent schemas and parameter validation

**Testing Requirements:**
- Multi-agent orchestration tests
- Parameter extraction and validation tests
- Agent selection and routing tests
- Result synthesis and formatting tests
- Performance tests for complex workflows

**Format:** Provide enhancements to:
1. Multi-agent orchestration methods
2. Intelligent agent selection and routing
3. Parameter extraction and validation
4. Result synthesis across multiple agents
5. Workflow planning and execution

**Example:** 
- User: "Send email to john@example.com about the meeting and add him to my contacts"
- AI Planning: 1) ContactAgent.searchContacts("john@example.com") 2) ContactAgent.createContact() 3) EmailAgent.sendEmail()
- Orchestration: Execute steps in parallel where possible, synthesize results

---


## Phase 3: Advanced Multi-Agent Features (Week 3)

### Prompt 1.4: Agent Communication and Context Sharing

**Architecture Context:** Enhance agents to share context and results with each other during multi-agent workflows. For example, ContactAgent finding a contact should pass that information to EmailAgent for sending emails.

**Goal:** Add agent-to-agent communication and context sharing capabilities while maintaining agent independence and specialized logic.

**Constraints:**
- Maintain agent independence and specialized logic
- Add context sharing without tight coupling
- Use existing ToolExecutionContext for context passing
- Support both synchronous and asynchronous agent communication
- Maintain existing error handling and logging patterns

**Integration Points:**
- ToolExecutionContext for context sharing
- AgentFactory for agent discovery and communication
- Existing agent result interfaces
- MasterAgent for coordination

**Testing Requirements:**
- Agent communication tests
- Context sharing validation
- Multi-agent workflow tests
- Error propagation tests
- Performance tests for agent coordination

**Format:** Provide:
1. Agent communication framework
2. Context sharing mechanisms
3. Result passing between agents
4. Coordination patterns
5. Example multi-agent workflows

---

### Prompt 1.5: Advanced Agent Capabilities

**Architecture Context:** Enhance agents with advanced capabilities like learning from user feedback, adaptive behavior, and intelligent error recovery while maintaining their specialized domain expertise.

**Goal:** Add learning, adaptation, and intelligent error recovery to agents while keeping them focused on their specialized domains.

**Constraints:**
- Maintain agent specialization and domain expertise
- Add learning without changing core agent logic
- Use existing service patterns for data persistence
- Support both online and offline learning
- Maintain existing error handling patterns

**Integration Points:**
- Existing agent base classes and patterns
- Service registry for data persistence
- User feedback mechanisms
- Error handling and logging systems

**Testing Requirements:**
- Learning and adaptation tests
- Error recovery validation
- User feedback integration tests
- Performance impact tests
- Regression tests for existing functionality

**Format:** Provide:
1. Agent learning framework
2. Adaptive behavior mechanisms
3. Intelligent error recovery
4. User feedback integration
5. Performance monitoring

---

## Implementation Strategy

### Week 1: Foundation ✅ COMPLETED
- [x] AIAgent base class with AI planning
- [x] AIAgentWithPreview for confirmation flows
- [x] Example AIEmailAgent implementation

### Week 2: Agent Enhancement
- [ ] Add OpenAI schemas to existing agents
- [ ] Enhance MasterAgent with multi-agent orchestration
- [ ] Multi-agent workflow execution
- [ ] Agent discovery and routing

### Week 3: Advanced Features
- [ ] Agent communication and context sharing
- [ ] Advanced agent capabilities
- [ ] Learning and adaptation
- [ ] Performance optimization

## Key Architectural Principles

1. **Agent Specialization**: Each agent remains focused on its domain (email, contacts, calendar)
2. **AI Enhancement**: Add AI planning to existing agents without replacing their specialized logic
3. **Multi-Agent Orchestration**: MasterAgent coordinates multiple specialized agents
4. **Service Integration**: Agents continue to call services directly through service registry
5. **Clean Enhancement**: Build on existing architecture rather than replacing it

## Success Metrics

- **Functionality**: All existing agent capabilities preserved and enhanced
- **Performance**: Multi-agent workflows complete within 2-second requirement
- **Intelligence**: AI planning improves user experience for complex operations
- **Maintainability**: Clean separation of concerns between agents and services
- **Scalability**: Easy to add new specialized agents following established patterns

This plan aligns with your multi-agent vision where each agent is a specialized tool with its own domain expertise, enhanced with AI planning capabilities for intelligent orchestration.