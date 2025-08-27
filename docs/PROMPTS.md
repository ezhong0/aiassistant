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