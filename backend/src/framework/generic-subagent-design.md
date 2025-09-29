# Generic SubAgent Design - Simplified Architecture

## Overview

The Generic SubAgent is a simplified version of the MasterAgent that follows the same 3-phase architecture but executes domain-specific tools directly. It mirrors the MasterAgent's design patterns while being much simpler and focused on direct tool execution.

## Core Architecture

### 1. Base Generic SubAgent Class

```typescript
abstract class BaseSubAgent {
  // Main entry point (mirrors MasterAgent.processUserInput)
  async processNaturalLanguageRequest(request: string, context: AgentExecutionContext): Promise<SubAgentResponse>
  
  // 3-phase workflow (simplified from MasterAgent's 10 iterations)
  protected abstract assessIntent(request: string): Promise<string>
  protected abstract executeTools(context: string): Promise<string>
  protected abstract formatResponse(context: string): Promise<SubAgentResponse>
  
  // Domain-specific implementations
  protected abstract getSystemPrompt(): string
  protected abstract executeToolCall(toolName: string, params: any): Promise<any>
}
```

### 2. Response Format (Simplified)

```typescript
interface SubAgentResponse {
  success: boolean;
  message: string;        // Human-readable summary
  metadata: any;          // Tool execution results (not "data")
}
```

### 3. Context Management (Single Textbox)

**SimpleContext Format (like MasterAgent):**
```
REQUEST: [What master agent asked for]
TOOLS: [Tools needed to fulfill request]  
PARAMS: [Parameters for tool calls]
STATUS: [Planning/Executing/Complete/Failed]
RESULT: [Data collected from tool calls]
NOTES: [Brief execution context]
```

## 3-Phase Workflow

### Phase 1: Intent Assessment & Planning
- Parse natural language request
- Map to domain-specific tools
- Create execution plan
- Initialize context

### Phase 2: Direct Tool Execution (Max 3 iterations)
- Execute tools directly (no delegation)
- Handle errors gracefully
- Update context with results
- Review and revise plan if needed

### Phase 3: Response Formatting
- Structure collected metadata
- Create natural language summary
- Format final response

## Key Design Principles

### 1. Mirror MasterAgent Patterns
- **Single textbox context** (like MasterAgent's context box)
- **3-phase execution** (simplified from MasterAgent's 10 iterations)
- **Natural language interface**
- **Structured response format**

### 2. Simplifications
- **No complex domain modeling**
- **Direct tool calls** (no sub-agent delegation)
- **Max 3 iterations** (vs MasterAgent's 10)
- **Single message interface** (no back-and-forth)

### 3. Domain-Specific Implementation
Each SubAgent only needs to specify:
- **System prompt** (domain-specific instructions)
- **Tool execution function** (maps tool names to existing domain service methods)
- **Domain service reference** (links to existing EmailDomainService, CalendarDomainService, etc.)

## Implementation Strategy

### 1. Base Infrastructure

**BaseSubAgent Abstract Class:**
```typescript
abstract class BaseSubAgent {
  protected aiService: GenericAIService;
  protected domain: string;
  
  // Main entry point
  async processNaturalLanguageRequest(request: string, context: AgentExecutionContext): Promise<SubAgentResponse> {
    // Phase 1: Intent Assessment
    let workflowContext = await this.assessIntent(request);
    
    // Phase 2: Tool Execution (max 3 iterations)
    workflowContext = await this.executeTools(workflowContext);
    
    // Phase 3: Response Formatting
    return await this.formatResponse(workflowContext);
  }
  
  // Abstract methods for domain-specific implementation
  protected abstract getSystemPrompt(): string;
  protected abstract executeToolCall(toolName: string, params: any): Promise<any>;
}
```

### 2. Domain-Specific Implementations

**ContactSubAgent Example:**
```typescript
class ContactSubAgent extends BaseSubAgent {
  private contactsService: IContactsDomainService;
  
  constructor() {
    super();
    // Get existing domain service from container
    this.contactsService = DomainServiceResolver.getContactsService();
  }
  
  protected getSystemPrompt(): string {
    return `
      You are a contact management sub-agent.
      Available tools: contacts_search, contacts_get_by_id, contacts_validate_email, contacts_create
      Your job is to help users find and manage contact information.
    `;
  }
  
  protected async executeToolCall(toolName: string, params: any): Promise<any> {
    const userId = params.userId; // Extract userId from context
    
    switch (toolName) {
      case 'contacts_search':
        return await this.contactsService.searchContacts(userId, params);
      case 'contacts_get_by_id':
        return await this.contactsService.getContact(userId, params.contactId);
      case 'contacts_validate_email':
        return await this.contactsService.validateEmail(userId, params.email);
      case 'contacts_create':
        return await this.contactsService.createContact(userId, params);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
```

### 3. Integration with AgentFactory

**Required Methods:**
```typescript
// Required by AgentFactory
isEnabled(): boolean
processNaturalLanguageRequest(request: string, context: AgentExecutionContext): Promise<SubAgentResponse>
getCapabilityDescription(): AgentCapabilities
getConfig(): AgentConfig
```

### 4. Service Integration Benefits

**Reduced Redundancy:**
- **No duplicate service logic** - SubAgents use existing domain services
- **Leverages existing OAuth** - Domain services handle authentication
- **Reuses API clients** - No need to recreate API connections
- **Consistent error handling** - Uses existing service error patterns

**Service Container Integration:**
```typescript
// Each SubAgent gets services from the existing container
class EmailSubAgent extends BaseSubAgent {
  private emailService: IEmailDomainService;
  
  constructor() {
    super();
    this.emailService = DomainServiceResolver.getEmailService();
  }
  
  protected async executeToolCall(toolName: string, params: any): Promise<any> {
    const userId = params.userId;
    
    switch (toolName) {
      case 'send_email':
        return await this.emailService.sendEmail(userId, params);
      case 'search_emails':
        return await this.emailService.searchEmails(userId, params);
      case 'get_email':
        return await this.emailService.getEmail(params.messageId);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
```

## Key Benefits

### 1. Simplified Architecture
- **Minimal context** (single textbox)
- **Direct tool execution** (no delegation)
- **Clear domain boundaries**
- **Easy to implement**

### 2. MasterAgent Compatibility
- **Same response format** (success, message, metadata)
- **Natural language interface**
- **Consistent error handling**
- **AgentFactory integration**

### 3. Service Integration
- **No redundant code** - Uses existing domain services
- **Leverages existing OAuth** - Domain services handle authentication
- **Reuses API clients** - No duplicate API connections
- **Consistent error handling** - Uses existing service patterns

### 4. Domain Focus
- **Each agent owns specific tools**
- **Domain-specific system prompts**
- **Clear tool-to-service mapping**
- **Focused responsibility**

## Implementation Phases

### Phase 1: Base Infrastructure
1. Create `BaseSubAgent` abstract class
2. Implement 3-phase workflow
3. Add error handling and logging
4. Create response formatting

### Phase 2: Domain Agents
1. Implement `ContactSubAgent` first (simplest)
2. Add tool execution logic
3. Test with AgentFactory integration
4. Implement other domain agents

### Phase 3: Integration & Testing
1. Update AgentFactory to use new SubAgents
2. Test natural language processing
3. Validate response formats
4. Performance optimization

## Critical Design Decisions

### 1. Context Management
- **Single textbox** (like MasterAgent)
- **Simple 6-field structure**
- **No complex domain modeling**

### 2. Tool Execution
- **Direct service calls** (no delegation)
- **Domain-specific tool sets**
- **Clear error handling**

### 3. Response Format
- **Use "metadata" instead of "data"**
- **Simple success/message/metadata structure**
- **Natural language summaries**

### 4. Integration
- **Compatible with existing AgentFactory**
- **Natural language interface**
- **Single message communication**

## Long-Term Architecture Design Choices

### **Recommended Approach: Interface-Driven + Tool Mapping**

**Why this is best for long-term maintenance:**

**1. ✅ Type Safety** - TypeScript interfaces provide compile-time safety
**2. ✅ Zero Runtime Overhead** - No reflection or complex runtime parsing
**3. ✅ Self-Documenting** - Clear mapping between tools and services
**4. ✅ Extensible** - Easy to add new domains/tools
**5. ✅ Maintainable** - Changes to service interfaces automatically propagate

### **Core Architecture Pattern:**

```typescript
abstract class BaseSubAgent {
  // Each SubAgent defines its tool-to-service mapping
  protected abstract readonly toolToServiceMap: Record<string, string>;
  
  protected abstract getService(): IDomainService;
  
  protected async executeToolCall(toolName: string, params: any): Promise<any> {
    const serviceMethod = this.toolToServiceMap[toolName];
    if (!serviceMethod) {
      throw new Error(`Unknown tool: ${toolName}`);
    }
    
    const { userId, ...serviceParams } = params;
    const service = this.getService();
    
    // TypeScript will enforce that service[serviceMethod] exists
    return await (service as any)[serviceMethod](userId, serviceParams);
  }
}
```

### **Implementation Example:**

```typescript
class EmailSubAgent extends BaseSubAgent {
  private emailService: IEmailDomainService;
  
  constructor() {
    super();
    this.emailService = DomainServiceResolver.getEmailService();
    this.domain = 'email';
  }
  
  // Simple tool-to-service mapping
  protected readonly toolToServiceMap = {
    'send_email': 'sendEmail',
    'search_emails': 'searchEmails', 
    'get_email': 'getEmail',
    'reply_to_email': 'replyToEmail',
    'get_email_thread': 'getEmailThread'
  };
  
  protected getService() { 
    return this.emailService; 
  }
  
  protected getSystemPrompt(): string {
    return `
      You are an email management sub-agent.
      
      Available tools:
      - send_email: Send emails with rich formatting and attachments
      - search_emails: Search emails with advanced query capabilities
      - get_email: Retrieve email details and threads
      - reply_to_email: Reply to specific emails
      - get_email_thread: Get entire conversation thread
      
      Your job is to help users manage their email communications effectively.
    `;
  }
}
```

### **Alternative Approaches Considered:**

#### **1. TypeScript Reflection (❌ Not Recommended)**
```typescript
// Complex runtime reflection
const methodInfo = getMetadata(this.service.methodName);
const paramTypes = methodInfo.parameters;
```
**Problems:**
- Runtime complexity
- Performance overhead
- Type information lost at runtime
- Hard to debug

#### **2. Decorator Schema (⚠️ Over-Engineering)**
```typescript
@ToolMetadata({
  name: 'contacts_search',
  parameters: { query: { required: true } }
})
async searchContacts(userId: string, params: any) { ... }
```
**Problems:**
- Requires decorator setup
- Additional metadata maintenance
- No significant benefit over interface-driven approach

#### **3. Static Parameter Registry (⚠️ Duplication)**
```typescript
const DOMAIN_SCHEMAS = {
  'contacts.searchContacts': {
    parameters: { query: { type: 'string', required: true } }
  }
};
```
**Problems:**
- Parameter duplication
- Manual schema maintenance
- Out of sync with actual service interfaces

### **Long-Term Benefits of Recommended Approach:**

#### **🔧 Maintainability:**
- **Single source of truth**: Service interfaces define parameter contracts
- **No duplication**: No need to redefine parameters in SubAgents
- **Automatic updates**: Interface changes propagate automatically
- **Clear separation**: Tool names vs service methods are explicitly mapped

#### **📈 Scalability:**
- **Domain isolation**: Each SubAgent only knows its domain's tools
- **Easy extension**: Add new tools by updating the mapping object
- **Service agnostic**: SubAgents don't care about service implementation details

#### **🛡️ Robustness:**
- **Compile-time safety**: TypeScript catches method name errors
- **Runtime simplicity**: No complex reflection or schema parsing
- **Error clarity**: Clear error messages for unknown tools

#### **🔀 Flexibility:**
- **Tool naming freedom**: Use natural language tool names (`contacts_search`) vs service method names (`searchContacts`)
- **Parameter abstraction**: SubAgents can transform/validate parameters before calling services
- **Domain customization**: Each SubAgent can have different tool->service mappings

### **Implementation Guidelines:**

#### **1. Tool Naming Convention:**
- Use descriptive, natural language names: `send_email`, `search_contacts`, `create_calendar_event`
- Use snake_case for consistency
- Avoid abbreviations unless clear context

#### **2. Parameter Handling:**
- Always extract `userId` from params
- Pass remaining parameters directly to service method
- Let TypeScript handle parameter validation

#### **3. Error Handling:**
- Use descriptive error messages for unknown tools
- Preserve service-layer errors (don't wrap unnecessarily)
- Log tool calls for debugging

#### **4. System Prompt Guidelines:**
- List all available tools with descriptions
- Include parameter examples where helpful
- Keep prompts concise but informative
- Update prompts when tools change

### **Future-Proofing Considerations:**

#### **🔄 Service Evolution:**
- **Interface changes**: Automatically propagate through tool mappings
- **Method renames**: Update tool mappings accordingly
- **New methods**: Add to mapping when needed

#### **🔧 Domain Expansion:**
- **New domains**: Create new SubAgent with domain-specific mapping
- **Cross-domain tools**: Can implement hybrid agents that use multiple services
- **Tool combinations**: Easy to create composite tools that call multiple service methods

#### **🏗️ Architecture Scaling:**
- **Microservices**: Each domain can become a separate service
- **API changes**: Service interface changes are isolated
- **Authentication**: Each service handles its own auth via existing OAuth managers

This design balances **simplicity** with **flexibility** while maintaining **type safety** and **long-term maintainability**. It's the sweet spot between "too much magic" and "too much boilerplate".

This design provides a clean, simplified architecture that mirrors the MasterAgent while being much easier to implement and maintain.
