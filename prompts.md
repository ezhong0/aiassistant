# Multi-Agent Assistant - Claude Code Prompts

## 🎯 CURRENT STATUS

### ✅ **COMPLETED - Phase 1: Foundation & Core Infrastructure**
- **Backend**: Node.js/TypeScript/Express server with Google OAuth ✅
- **iOS App**: SwiftUI app with GoogleSignIn SDK integration ✅ 
- **Authentication**: Complete OAuth 2.0 flow working end-to-end ✅
- **Security**: All credentials secured, GitHub secrets removed ✅
- **Build System**: Both iOS and backend building successfully ✅

### 🎯 **NEXT UP - Phase 2: Master Agent System**
**Ready to start**: Prompt 2.1 - Master Agent Core with Routing Logic
- Build the core AI agent that routes user queries to specialized tools
- Implement OpenAI service with GPT-4o-mini
- Create tool interface system
- Add session management

### 📋 **ROADMAP AHEAD**
- **Phase 2**: Master Agent + Core Services (Gmail, Calendar, Contacts)
- **Phase 3**: MVP Implementation (API endpoints, iOS UI)
- **Phase 4**: Testing & Polish
- **Phase 5**: Deployment Preparation

---

## Recommended Project Structure
```
multi-agent-assistant/
├── backend/                 # Node.js/TypeScript backend
│   ├── src/
│   ├── package.json
│   └── ...
├── ios/                    # iOS SwiftUI app
│   ├── MultiAgentAssistant/
│   ├── MultiAgentAssistant.xcodeproj
│   └── ...
├── shared/                 # Shared types/interfaces
├── docs/
├── .gitignore
└── README.md
```

---

## Phase 1: Foundation & Core Infrastructure ✅ COMPLETED

### ✅ Prompt 1.1: Project Setup & Backend Foundation - DONE
```
✅ Root directory with proper .gitignore for Node.js and iOS
✅ Backend folder with Node.js/TypeScript/Express setup including:
   ✅ package.json with all necessary dependencies
   ✅ TypeScript configuration (tsconfig.json)
   ✅ ESLint and Prettier configs
   ✅ Basic folder structure: /src/agents, /src/services, /src/middleware, /src/routes, /src/types
   ✅ Environment configuration (.env created and configured)
   ✅ Basic Express server with error handling middleware
   ✅ Winston logging setup
   ✅ Health check endpoint
```

### ✅ Prompt 1.2: iOS Project Setup - DONE
```
✅ Complete iOS project structure for "AssistantApp" 
✅ SwiftUI-based app with:
   ✅ Main App file (AssistantAppApp.swift)
   ✅ ContentView with basic navigation
   ✅ Authentication view structure (SignInView.swift, MainAppView.swift)
   ✅ Basic UI components for the assistant interface
✅ Project configuration files (Info.plist in Supporting Files/)
✅ Basic folder structure complete
✅ Swift package dependencies setup for GoogleSignIn SDK 7.1.0
✅ App builds and runs successfully
```

### ✅ Prompt 1.3: Google OAuth Backend Implementation - DONE
```
✅ OAuth service in /src/services/auth.service.ts with:
   ✅ Google OAuth client setup
   ✅ Token exchange and refresh logic
   ✅ Token validation functions
✅ Authentication routes in /src/routes/auth.routes.ts:
   ✅ Mobile token exchange endpoint
   ✅ Logout endpoint
✅ Authentication middleware for protecting routes
✅ TypeScript interfaces for OAuth tokens and user data
✅ Comprehensive error handling for OAuth failures
✅ Environment variables configured for Google OAuth credentials
```

### ✅ Prompt 1.4: iOS Google OAuth Integration - DONE
```
✅ GoogleSignIn SDK integration (7.1.0)
✅ AuthenticationManager class handling:
   ✅ Google sign-in flow
   ✅ Token storage in Keychain
   ✅ Token refresh logic (updated to new API)
   ✅ Authentication state management
   ✅ Backend communication for token exchange
✅ SignInView with Google Sign-In button
✅ Comprehensive error handling and user feedback
✅ Authentication state in main app
✅ Authenticated and unauthenticated view states
✅ Complete OAuth flow working end-to-end
```

---

## Phase 2: Master Agent System 🚧 NEXT PHASE

### 🎯 Prompt 2.1: Master Agent Core with Routing Logic - READY TO START
```
Create the ultimate personal assistant master agent that routes to specialized tools:

1. Create master agent in /src/agents/master.agent.ts with this exact prompt structure:
   ```
   # Overview
   You are the ultimate personal assistant. Your job is to send the user's query to the correct tool. You should never be writing emails, or creating even summaries, you just need to call the correct tool.

   ## Tools
   - Think: Use this to think deeply or if you get stuck
   - emailAgent: Use this tool to take action in email
   - calendarAgent: Use this tool to take action in calendar
   - contactAgent: Use this tool to get, update, or add contacts
   - contentCreator: Use this tool to create blog posts
   - Tavily: Use this tool to search the web

   ## Rules
   - Some actions require you to look up contact information first. For the following actions, you must get contact information and send that to the agent who needs it:
     - sending emails
     - drafting emails
     - creating calendar event with attendee

   ## Instructions
   1) Call the necessary tools based on the user request
   2) Use the "Think" tool to verify you took the right steps. This tool should be called every time.

   ## Examples
   1) 
   - Input: send an email to nate herkelman asking him what time he wants to leave
     - Action: Use contactAgent to get nate herkelman's email
     - Action: Use emailAgent to send the email. You will pass the tool a query like "send nate herkelman an email to ask what time he wants to leave. here is his email: [email address]"
   - Output: The email has been sent to Nate Herkelman. Anything else I can help you with?

   ## Final Reminders
   Here is the current date/time: {{ $now }}
   ```

2. Implement OpenAI service in /src/services/openai.service.ts with:
   - GPT-4o-mini integration for the master agent
   - Function calling setup for tool routing
   - Conversation context management

3. Create tool interface in /src/types/tools.ts:
   - Standard tool input/output interfaces
   - Tool execution tracking
   - Result formatting

4. Add session management in /src/services/session.service.ts:
   - In-memory session storage with 30-minute expiration
   - Tool execution history
   - Context passing between tools

Include comprehensive error handling and logging for tool routing decisions.
```

### 🔄 Prompt 2.2: Core Service Layer (Google APIs + External Tools) - PENDING
```
Create the foundation services that power the specialized agents:

1. Gmail service (/src/services/gmail.service.ts):
   - Gmail API wrapper with OAuth authentication
   - Functions: send email, get emails, reply to email, search emails
   - Email parsing and formatting utilities
   - Thread management for replies

2. Calendar service (/src/services/calendar.service.ts):
   - Google Calendar API wrapper with authentication
   - Functions: create event, get events, update event, delete event
   - Natural language date/time parsing
   - Attendee management and conflict detection

3. Contact service (/src/services/contact.service.ts):
   - Google Contacts API integration
   - Contact search by name, email, or partial match
   - Contact data normalization and formatting
   - Basic contact CRUD operations

4. Tavily service (/src/services/tavily.service.ts):
   - Tavily API integration for web search
   - Search result processing and formatting
   - Source attribution and summarization

5. Content creation service (/src/services/content.service.ts):
   - OpenAI integration for blog post generation
   - Content templates and formatting
   - SEO optimization helpers

Include proper error handling for API rate limits, authentication failures, and network issues.
```

### 🔄 Prompt 2.3: Specialized Tool Agents - PENDING
```
Create the specialized agents that implement each tool for the master agent:

1. Think Tool (/src/agents/think.agent.ts):
   - Reflection and verification agent
   - Analyzes if the right steps were taken
   - Provides reasoning about tool usage decisions
   - Returns verification status and suggestions

2. Email Agent (/src/agents/email.agent.ts):
   - Accepts queries with contact information already resolved
   - Handles: send email, reply, search, draft
   - Uses Gmail service for all operations
   - Returns execution status and confirmation

3. Calendar Agent (/src/agents/calendar.agent.ts):
   - Accepts queries with attendee emails already resolved
   - Handles: create event, get schedule, update, delete
   - Uses Calendar service for operations
   - Manages timezone and recurring event logic

4. Contact Agent (/src/agents/contact.agent.ts):
   - Primary contact lookup and resolution service
   - Searches by name, partial name, or email
   - Returns formatted contact information for other agents
   - Handles contact creation and updates

5. Content Creator Agent (/src/agents/content.agent.ts):
   - Blog post and content generation
   - SEO-optimized content creation
   - Multiple format support (markdown, HTML, etc.)
   - Topic research and outline generation

6. Tavily Agent (/src/agents/tavily.agent.ts):
   - Web search and information retrieval
   - Search result summarization
   - Source verification and attribution
   - Real-time information lookup

7. Agent Registry (/src/services/agent.registry.ts):
   - Tool registration and discovery
   - Agent factory pattern for clean instantiation
   - Tool execution pipeline with logging

Each agent should follow a consistent interface pattern and include comprehensive error handling.
```

---

## Phase 3: MVP Implementation ⏳ FUTURE

### ⏳ Prompt 3.1: Core API Endpoints - FUTURE
```
Create the main API endpoints for the assistant:

1. Main assistant endpoint (POST /api/assistant/text-command):
   - Validate and sanitize input
   - Check authentication
   - Route to master agent
   - Handle pending actions and confirmations
   - Return formatted responses
2. Session management endpoints:
   - GET /api/assistant/session/:id
   - DELETE /api/assistant/session/:id
3. Action confirmation endpoint (POST /api/assistant/confirm-action)
4. Update the health check endpoint with proper status
5. Add rate limiting middleware
6. Create comprehensive API documentation with examples
7. Add request/response logging

Include proper TypeScript interfaces for all request/response objects.
```

### Prompt 3.2: iOS App Core UI
```
Create the main iOS app interface:

1. Main Dashboard view with:
   - Hardcoded input button for testing
   - Text input field for commands
   - Response display area
   - Loading states
2. API service layer (APIService.swift):
   - HTTP client setup with URLSession
   - Methods for calling backend endpoints
   - Token management integration
   - Error handling and retry logic
3. Command input interface:
   - Text field with send button
   - Command history
   - Quick action buttons for common tasks
4. Response display view:
   - Formatted response text
   - Action confirmation buttons
   - Error message handling
5. Navigation between authenticated/unauthenticated states
6. Add proper loading indicators and user feedback

The UI should be clean, intuitive, and handle all response types.
```

### Prompt 3.3: Agent Integration Testing
```
Create a complete testing setup for the agent system:

1. Backend testing with Jest:
   - Unit tests for each agent
   - Integration tests for API endpoints
   - Mock Google API responses
   - Test session management
   - Test authentication middleware
2. iOS testing setup:
   - Unit tests for APIService
   - UI tests for authentication flow
   - Test command input and response handling
3. End-to-end testing scenarios:
   - Complete user flow from login to command execution
   - Test all agent types with sample commands
   - Error handling scenarios
4. Create test data and mock responses
5. Add testing documentation and examples

Include comprehensive test coverage for critical functionality.
```

---

## Phase 4: Testing & Polish

### Prompt 4.1: Error Handling & Production Readiness
```
Implement comprehensive error handling and production features:

1. Backend error handling:
   - Google API rate limit handling
   - Network error recovery
   - Graceful service degradation
   - User-friendly error messages
   - Proper HTTP status codes
2. iOS error handling:
   - Network connectivity issues
   - API error responses
   - Token expiration handling
   - User-friendly error alerts
3. Add logging and monitoring:
   - Request/response logging
   - Error tracking
   - Performance monitoring
   - Security audit logging
4. Input validation and sanitization
5. Security headers and CORS configuration
6. Add environment-specific configurations

Focus on reliability and user experience.
```

### Prompt 4.2: UX Improvements & Final Polish
```
Add final UX improvements and polish:

1. iOS UI enhancements:
   - Loading animations and progress indicators
   - Confirmation dialogs for important actions
   - Success/failure feedback with animations
   - Command examples and help text
   - Improved typography and spacing
2. Backend improvements:
   - Response time optimization
   - Better error messages
   - Command suggestion system
   - Usage analytics preparation
3. Add onboarding flow:
   - Welcome screens
   - Permission explanations
   - Sample commands tutorial
4. Documentation:
   - User guide
   - API documentation
   - Deployment instructions
5. Add app icons and branding elements

Make the app feel polished and professional.
```

---

## Phase 5: Deployment Preparation

### Prompt 5.1: Backend Deployment Setup
```
Prepare the backend for production deployment:

1. Create deployment configuration:
   - Docker configuration (Dockerfile, docker-compose.yml)
   - Environment variable management
   - Production logging configuration
   - Health check endpoints
2. CI/CD pipeline with GitHub Actions:
   - Automated testing
   - Build and deployment
   - Environment-specific deployments
3. Production optimizations:
   - Process management (PM2 configuration)
   - Security hardening
   - Performance monitoring setup
4. Deployment scripts and documentation
5. Choose and configure deployment platform (Railway/Render/DigitalOcean)

Include complete deployment instructions and rollback procedures.
```

### Prompt 5.2: iOS App Store Preparation
```
Prepare the iOS app for App Store submission:

1. App Store assets:
   - App icons in all required sizes
   - Launch screen
   - App Store screenshots
   - App description and keywords
2. Legal requirements:
   - Privacy policy
   - Terms of service
   - App Store compliance check
3. TestFlight setup:
   - Beta testing configuration
   - Test user management
   - Feedback collection
4. Final app configuration:
   - Bundle ID and versioning
   - Signing certificates
   - App Store Connect setup
5. Submission checklist and guidelines

Ensure the app meets all App Store requirements.
```

---

## Usage Tips for Claude Code:

1. **Start with Prompt 1.1** and work sequentially through each prompt
2. **Review and test** each phase before moving to the next
3. **Customize prompts** based on your specific requirements
4. **Ask follow-up questions** if you need clarification on any implementation
5. **Request specific files** if you want to see individual components
6. **Test incrementally** - each prompt should result in working code

Each prompt is designed to be comprehensive enough for Claude to generate complete, working code while building on the previous phases.