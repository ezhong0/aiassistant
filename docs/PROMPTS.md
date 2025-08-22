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
