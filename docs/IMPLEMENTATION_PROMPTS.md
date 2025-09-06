# 🎯 Implementation Prompts - Slack Assistant Enhancement

## 📚 **Pre-Development Checklist**

Before using any prompt below, **always review**:
1. **`docs/ARCHITECTURE.md`** - System boundaries and patterns
2. **`docs/AGENTS.md`** - Agent implementation guidelines  
3. **`docs/SERVICES.md`** - Service layer interfaces
4. **`backend/src/interfaces/slack.interface.ts`** - Current Slack integration

---

## 🚀 **Phase 1: Foundation for User Delight**

### **1. Enhanced Slack Response Formatting**

```
**Architecture Context:** Based on our existing SlackInterface in backend/src/interfaces/slack.interface.ts 
I need to enhance message 
formatting to use rich Slack Block Kit elements for better user experience.

**Goal:** Transform basic text responses into rich, interactive Slack messages with buttons, 
blocks, and visual elements that make the assistant feel modern and polished.

**Constraints:** 
- Use simple fallback formatting for Slack messages
- Follow our BaseService pattern from docs/SERVICES.md
- Use Slack Block Kit API specification
- Maintain backward compatibility with existing message formats
- Follow our error handling patterns with structured logging

**Integration Points:**
- SlackInterface.sendResponse() method for message delivery
- Built-in fallback formatting for messages
- Agent responses that need rich formatting (email previews, confirmations)
- Error message formatting for better user experience

**Testing Requirements:**
- Unit tests for new formatting methods following docs/TESTING.md
- Integration tests for Slack Block Kit compliance
- Visual regression tests for message appearance
- Error handling tests for malformed blocks

**Format:** Use simple text formatting with:
1. Methods for creating email preview blocks
2. Interactive button components (Send/Edit/Cancel)
3. Rich formatting for calendar events
4. Error message blocks with helpful actions
5. Loading/typing indicators
6. Success confirmation blocks with emoji reactions

**Example:** Use simple text-based responses with basic formatting.

**Specific Requirements:**
- Email drafts should display as rich cards with sender, recipient, subject, body preview
- Action buttons should be properly styled and include confirmation flows
- Error messages should be friendly and include suggested next steps
- Success messages should use appropriate emojis and clear language
```

### **2. Email Draft & Preview System**

```
**Architecture Context:** Based on our EmailAgent in backend/src/agents/email.agent.ts 
and GmailService in backend/src/services/gmail.service.ts, I need to add a preview-before-send 
workflow that shows email drafts in Slack before execution.

**Goal:** Implement a complete email drafting workflow: Draft → Preview → Confirm → Send, 
with inline editing capabilities and rich Slack formatting.

**Constraints:** 
- Extend existing EmailAgent without breaking current send functionality
- Follow BaseAgent pattern from docs/AGENTS.md
- Use our established GmailService for actual email operations
- Implement proper state management for draft sessions
- Follow our error handling and logging patterns

**Integration Points:**
- EmailAgent.execute() method for draft creation
- SlackInterface for displaying previews and handling confirmations
- Simple text formatting for email previews
- TokenManager for Gmail API authentication
- Database for storing draft state temporarily

**Testing Requirements:**
- Unit tests for draft creation and editing logic
- Integration tests for Gmail API draft operations
- User flow tests for complete preview → send workflow
- Error handling tests for failed sends and authentication issues

**Format:** Provide enhanced EmailAgent with:
1. createDraft() method that doesn't immediately send
2. previewDraft() method that formats for Slack display
3. editDraft() method for inline modifications
4. confirmSend() method for final execution
5. State management for tracking draft sessions
6. Simple text-based preview display

**Example:** Follow the BaseAgent pattern from ContactAgent but add draft state management 
and multi-step execution workflow instead of immediate action.

**Specific Requirements:**
- Draft previews should show: To, Subject, Body preview, attachments if any
- Users should be able to edit drafts with natural language ("change subject to...")
- Confirmation should require explicit user action (button click or emoji reaction)
- Failed sends should offer retry options and clear error messages
- Draft state should expire after reasonable time to prevent memory leaks
```

### **3. Slack Threading Support**

```
**Architecture Context:** Based on our current SlackInterface in backend/src/interfaces/slack.interface.ts 
and the event handling patterns, I need to add proper threading support to maintain conversation 
context and enable natural back-and-forth interactions.

**Goal:** Implement conversation threading that tracks context across multiple messages, 
enables follow-up questions, and maintains separate conversation states per thread.

**Constraints:** 
- Extend existing SlackInterface without breaking current functionality
- Follow our service patterns and dependency injection from docs/SERVICES.md
- Use Slack threading API properly
- Implement conversation state management
- Follow our error handling and logging patterns

**Integration Points:**
- SlackInterface event handling for threaded messages
- MasterAgent routing with thread context
- Database for storing conversation state
- TokenManager for maintaining user context across thread messages
- All agents that need conversation continuity

**Testing Requirements:**
- Unit tests for thread context tracking
- Integration tests for multi-message conversations
- User flow tests for complex email/calendar conversations
- Memory management tests for conversation cleanup

**Format:** Provide enhanced SlackInterface with:
1. Thread context tracking and management
2. Conversation state persistence
3. Follow-up message handling
4. Context-aware agent routing
5. Thread cleanup and memory management
6. Rich threading support for all message types

**Example:** Follow the existing event handling pattern in SlackInterface.handleEvent() 
but add thread_ts tracking and conversation state management.

**Specific Requirements:**
- Each thread should maintain independent conversation context
- Follow-up messages should reference previous context intelligently
- Thread state should include user preferences and current workflow stage
- Conversations should gracefully handle interruptions and context switches
- Thread cleanup should prevent memory leaks in long-running conversations
```

---

## 🧠 **Phase 2: Intelligent Workflows**

### **4. Natural Language Clarifications**

```
**Architecture Context:** Based on our MasterAgent in backend/src/agents/master.agent.ts 
and OpenAI integration, I need to add intelligent clarification handling that gracefully 
manages ambiguous user requests and guides users to successful task completion.

**Goal:** Implement smart clarification flows that detect ambiguities, ask targeted questions, 
remember context, and guide users naturally through complex workflows.

**Constraints:** 
- Extend MasterAgent routing logic following BaseAgent patterns
- Use OpenAI service for intent analysis and clarification generation
- Integrate with thread context from Phase 1
- Follow our error handling patterns
- Maintain conversation state across clarification exchanges

**Integration Points:**
- MasterAgent.processUserInput() for ambiguity detection
- OpenAI service for intelligent clarification generation
- SlackInterface threading for clarification conversations
- All agents that might need clarification (Email, Calendar, Contact)
- Database for storing clarification context

**Testing Requirements:**
- Unit tests for ambiguity detection algorithms
- Integration tests for clarification conversation flows
- User experience tests for common ambiguous scenarios
- Performance tests for clarification response times

**Format:** Provide enhanced MasterAgent with:
1. Ambiguity detection in user input analysis
2. Intelligent clarification question generation
3. Context-aware clarification tracking
4. Smart suggestion system for common scenarios
5. Graceful fallback for unresolvable ambiguities
6. Integration with existing agent routing

**Example:** Follow the existing MasterAgent pattern but add pre-routing analysis 
for ambiguity detection and clarification generation before tool execution.

**Specific Requirements:**
- Detect ambiguities like time (8am vs 8pm), people (multiple Johns), dates (next Monday?)
- Generate contextual clarifying questions based on available information
- Remember clarification answers throughout the conversation
- Provide smart suggestions when possible ("John Smith from Marketing?")
- Handle multiple ambiguities gracefully without overwhelming users
```

### **5. Calendar Intelligence**

```
**Architecture Context:** Based on our CalendarAgent in backend/src/agents/calendar.agent.ts 
and CalendarService in backend/src/services/calendar.service.ts, I need to add intelligent 
scheduling features including conflict detection, availability checking, and natural rescheduling.

**Goal:** Transform basic calendar operations into intelligent scheduling workflows that 
understand context, detect conflicts, suggest optimal times, and handle complex scheduling scenarios.

**Constraints:** 
- Extend existing CalendarAgent and CalendarService following established patterns
- Follow BaseAgent and BaseService patterns from our architecture
- Use Google Calendar API through our existing service layer
- Integrate with contact lookup for attendee management
- Follow our error handling and logging patterns

**Integration Points:**
- CalendarAgent for intelligent scheduling logic
- CalendarService for Google Calendar API operations
- ContactAgent for attendee lookup and management
- Email integration for meeting invitations
- Conflict detection with existing calendar events

**Testing Requirements:**
- Unit tests for conflict detection algorithms
- Integration tests for Google Calendar API operations
- User flow tests for complex scheduling scenarios
- Performance tests for availability checking

**Format:** Provide enhanced CalendarAgent and CalendarService with:
1. Intelligent availability checking across multiple calendars
2. Conflict detection and resolution suggestions
3. Natural language scheduling ("tomorrow afternoon", "next available slot")
4. Smart rescheduling with minimal disruption
5. Meeting context awareness and preparation suggestions
6. Integration with email workflows for invitations

**Example:** Follow the existing CalendarAgent pattern but add intelligent scheduling 
logic similar to how ContactAgent handles fuzzy matching and context awareness.

**Specific Requirements:**
- Parse natural language time expressions ("tomorrow at 3", "next Monday morning")
- Check availability for all attendees when possible
- Detect and warn about scheduling conflicts
- Suggest alternative times when conflicts exist
- Handle recurring meeting patterns intelligently
- Integrate with email for automatic invitation sending
```

### **6. Security Confirmations**

```
**Architecture Context:** Based on our existing authentication patterns in backend/src/services/auth.service.ts 
and error handling throughout the system, I need to implement comprehensive security confirmations 
for sensitive actions while maintaining user experience.

**Goal:** Implement robust security confirmation system that previews all sensitive actions, 
requires explicit user confirmation, maintains audit trails, and prevents accidental operations.

**Constraints:** 
- Follow our existing security patterns and JWT authentication
- Integrate with TokenManager for permission checking
- Use our established error handling and logging patterns
- Maintain user experience while ensuring security
- Follow our service architecture and dependency injection

**Integration Points:**
- All agents that perform sensitive actions (Email, Calendar)
- TokenManager for permission verification
- Database for audit trail storage
- SlackInterface for confirmation UI
- Error handling middleware for security violations

**Testing Requirements:**
- Security tests for permission enforcement
- User flow tests for confirmation workflows
- Audit trail tests for action logging
- Error handling tests for security violations

**Format:** Provide new SecurityService and confirmation integration with:
1. Action preview system for sensitive operations
2. Explicit confirmation requirements with clear previews
3. Comprehensive audit trail for all actions
4. Permission checking and enforcement
5. Graceful error handling for security violations
6. Integration with existing agent workflows

**Example:** Create new SecurityService following BaseService pattern, similar to 
how TokenManager handles authentication but focused on action authorization.

**Specific Requirements:**
- Preview all email sends with recipient, subject, and content overview
- Require explicit confirmation for calendar modifications
- Log all sensitive actions with user context and timestamps
- Prevent accidental bulk operations or dangerous actions
- Provide clear security error messages with guidance
- Support different confirmation levels based on action sensitivity
```

---

## 🤖 **Phase 3: Advanced Intelligence**

### **7. Slash Commands & Settings**

```
**Architecture Context:** Based on our existing Slack routing in backend/src/routes/slack.routes.ts 
and service architecture, I need to implement comprehensive slash command handling and user 
preference management for the assistant.

**Goal:** Create intuitive slash command interface for assistant control, user settings management, 
help system, and feature discovery that integrates seamlessly with existing architecture.

**Constraints:** 
- Follow our existing routing patterns and middleware
- Integrate with current SlackInterface and service architecture
- Use database for persistent user preferences
- Follow our authentication and authorization patterns
- Maintain consistency with our error handling and logging

**Integration Points:**
- Slack routes for slash command handling
- SlackInterface for command processing
- Database for user preferences storage
- All services for settings that affect their behavior
- Help system integration with existing documentation

**Testing Requirements:**
- Unit tests for command parsing and routing
- Integration tests for settings persistence
- User experience tests for help and onboarding flows
- Permission tests for settings access control

**Format:** Provide slash command system with:
1. Complete /assistant command handling with subcommands
2. User preferences management and persistence
3. Interactive help system with command discovery
4. Onboarding flow for new users
5. Settings UI using Slack's interactive components
6. Integration with existing service configurations

**Example:** Follow the existing routing pattern in slack.routes.ts but add 
comprehensive command parsing similar to how we handle OAuth callbacks.

**Specific Requirements:**
- /assistant help - Interactive help with examples and tips
- /assistant settings - Preference management interface
- /assistant status - Show connection status and permissions
- /assistant onboard - Guided setup flow for new users
- Persistent user preferences affecting notification timing, response style
- Rich interactive settings interface using Slack blocks
```

### **8. Smart Email Features**

```
**Architecture Context:** Based on our EmailAgent and GmailService, I need to add intelligent 
email management features including categorization, priority detection, reply context analysis, 
and smart search capabilities.

**Goal:** Transform basic email operations into intelligent email management that understands 
context, prioritizes important messages, suggests responses, and learns user patterns.

**Constraints:** 
- Extend existing EmailAgent and GmailService following established patterns
- Use OpenAI service for intelligent analysis and categorization
- Integrate with existing Gmail API operations
- Follow our performance requirements and error handling
- Maintain compatibility with existing email workflows

**Integration Points:**
- EmailAgent for intelligent email analysis
- GmailService for Gmail API operations
- OpenAI service for content analysis and categorization
- Database for storing email insights and user patterns
- SlackInterface for smart notification delivery

**Testing Requirements:**
- Unit tests for email categorization algorithms
- Integration tests for Gmail API advanced operations
- Performance tests for bulk email analysis
- User experience tests for smart features

**Format:** Provide enhanced email intelligence with:
1. Automatic email categorization and priority detection
2. Smart inbox management with actionable insights
3. Context-aware reply suggestions
4. Intelligent email search with natural language queries
5. Pattern recognition for user email habits
6. Proactive email management suggestions

**Example:** Follow the existing EmailAgent pattern but add intelligent analysis 
similar to how ContactAgent performs fuzzy matching and context evaluation.

**Specific Requirements:**
- Categorize emails by urgency, type, and required action
- Detect VIP senders and important topics automatically
- Suggest reply templates based on email content and context
- Enable natural language email search ("emails about the project from last week")
- Learn user patterns and suggest optimization
- Provide smart summaries for email threads and conversations
```

### **9. Proactive Intelligence**

```
**Architecture Context:** Based on our agent system and service architecture, I need to implement 
proactive intelligence that anticipates user needs, provides helpful suggestions, and delivers 
timely notifications without being intrusive.

**Goal:** Create intelligent background processing that learns user patterns, predicts needs, 
provides proactive suggestions, and delivers perfectly timed notifications and insights.

**Constraints:** 
- Follow our service architecture and background processing patterns
- Integrate with all existing agents and services
- Use database for pattern storage and user preferences
- Respect user notification preferences and privacy
- Follow our performance and error handling requirements

**Integration Points:**
- All agents for pattern analysis and suggestion generation
- Database for storing user patterns and preferences
- SlackInterface for proactive notification delivery
- Calendar and Email services for schedule and communication analysis
- Background job processing for periodic analysis

**Testing Requirements:**
- Unit tests for pattern recognition algorithms
- Integration tests for proactive notification delivery
- User experience tests for suggestion relevance and timing
- Performance tests for background processing efficiency

**Format:** Provide proactive intelligence system with:
1. User pattern analysis and learning algorithms
2. Intelligent suggestion generation based on context and habits
3. Perfectly timed notification system respecting user preferences
4. Daily/weekly digest generation with personalized insights
5. Predictive conflict detection and optimization suggestions
6. Smart reminder system that understands context and urgency

**Example:** Create new ProactiveIntelligenceService following BaseService pattern, 
similar to how our existing agents analyze and process information but focused on 
pattern recognition and prediction.

**Specific Requirements:**
- Analyze user communication and scheduling patterns
- Suggest optimal meeting times based on historical preferences
- Provide daily digest with personalized prioritization
- Predict scheduling conflicts before they happen
- Suggest email response timing based on recipient patterns
- Learn and adapt to user feedback on suggestions
- Respect user privacy and provide opt-out options for all proactive features
```

---

## 🛠 **Universal Implementation Guidelines**

### **Code Quality Standards**
- Follow TypeScript strict mode requirements
- Implement comprehensive error handling with our established patterns
- Use structured logging with appropriate context
- Follow our established testing patterns and coverage requirements
- Maintain backward compatibility unless explicitly breaking changes are needed

### **Performance Requirements**
- All agent responses under 2 seconds
- Database queries optimized with proper indexing
- Background processing for non-critical operations
- Efficient memory management for long-running conversations

### **Security Requirements**
- Validate all user inputs with Zod schemas
- Implement proper authentication and authorization checks
- Audit all sensitive operations
- Follow OAuth security best practices
- Sanitize all data before storage or display

### **User Experience Standards**
- Provide immediate feedback for all user actions
- Use progressive disclosure for complex workflows
- Implement graceful degradation for service failures
- Maintain conversation context and user preferences
- Follow Slack design guidelines for all UI elements

---

## 📝 **Prompt Usage Template**

When using these prompts, always:

1. **Read the relevant documentation** mentioned in the Architecture Context
2. **Understand the existing codebase** patterns you're extending
3. **Copy the complete prompt** including all sections
4. **Customize the specific requirements** for your exact use case
5. **Reference existing code examples** mentioned in the prompt
6. **Validate against our architecture** before implementing

**Example Usage:**
```
[Copy complete prompt from above]

**Additional Context:** I'm specifically working on [your specific scenario]
**Modified Requirements:** [Any changes to the standard requirements]
**Integration Notes:** [Any specific integration considerations]
```

This structured approach ensures all implementations follow our established patterns while building toward the vision of an intelligent, conversational Slack assistant.
