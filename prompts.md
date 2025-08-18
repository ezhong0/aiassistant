# Multi-Agent Assistant - Claude Code Prompts

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

## Phase 1: Foundation & Core Infrastructure

### Prompt 1.1: Project Setup & Backend Foundation
```
Create a complete multi-agent assistant project with the following structure:

1. Root directory with proper .gitignore for Node.js and iOS
2. Backend folder with Node.js/TypeScript/Express setup including:
   - package.json with all necessary dependencies (express, typescript, googleapis, openai, winston, dotenv, jest, eslint, prettier)
   - TypeScript configuration (tsconfig.json)
   - ESLint and Prettier configs
   - Basic folder structure: /src/agents, /src/services, /src/middleware, /src/routes, /src/types
   - Environment configuration with .env.example
   - Basic Express server with error handling middleware
   - Winston logging setup
   - Health check endpoint

Please create all the foundational files and configurations needed to get started.
```

### Prompt 1.2: iOS Project Setup
```
Add an iOS project to the existing codebase in an 'ios' folder. Create:

1. A complete iOS project structure for "MultiAgentAssistant" app
2. SwiftUI-based app with:
   - Main App file
   - ContentView with basic navigation
   - Authentication view structure
   - Basic UI components for the assistant interface
3. Project configuration files (Info.plist, etc.)
4. Basic folder structure for Views, Models, Services, and Utilities
5. Swift package dependencies setup for Google Sign-In

The iOS app should be ready to build and run with placeholder UI.
```

### Prompt 1.3: Google OAuth Backend Implementation
```
Implement Google OAuth 2.0 integration for the backend:

1. Create OAuth service in /src/services/auth.service.ts with:
   - Google OAuth client setup
   - Token exchange and refresh logic
   - Token validation functions
2. Add authentication routes in /src/routes/auth.routes.ts:
   - GET /auth/google (initiate OAuth)
   - GET /auth/callback (handle callback)
   - POST /auth/refresh (refresh tokens)
3. Create authentication middleware for protecting routes
4. Add proper TypeScript interfaces for OAuth tokens and user data
5. Include error handling for OAuth failures

Use environment variables for Google OAuth credentials.
```

### Prompt 1.4: iOS Google OAuth Integration
```
Implement Google Sign-In for the iOS app:

1. Add Google Sign-In SDK integration
2. Create AuthenticationManager class for handling:
   - Google sign-in flow
   - Token storage in Keychain
   - Token refresh logic
   - Authentication state management
3. Create LoginView with Google Sign-In button
4. Implement proper error handling and user feedback
5. Add authentication state to the main app
6. Create authenticated and unauthenticated view states

The app should handle the complete OAuth flow and store tokens securely.
```

---

## Phase 2: Core Agent System

### Prompt 2.1: Master Assistant Agent
```
Create the master assistant agent system:

1. Implement OpenAI service in /src/services/openai.service.ts with:
   - GPT-4o-mini integration for intent classification
   - Prompt templates for determining user intent
   - Agent routing logic
2. Create master agent in /src/agents/master.agent.ts that:
   - Analyzes user input to determine intent
   - Routes to appropriate specialized agents
   - Manages conversation context
   - Handles agent responses and formatting
3. Add session management in /src/services/session.service.ts:
   - In-memory session storage
   - 30-minute expiration
   - Context tracking
4. Define TypeScript interfaces for agent communication
5. Create the main assistant endpoint that ties everything together

Include comprehensive error handling and logging.
```

### Prompt 2.2: Google API Services Foundation
```
Create the foundation services for Google APIs:

1. Gmail service (/src/services/gmail.service.ts):
   - Gmail API wrapper with authentication
   - Functions for: send email, get emails, reply to email, search emails
   - Email parsing and formatting utilities
   - Contact resolution from email addresses
2. Calendar service (/src/services/calendar.service.ts):
   - Google Calendar API wrapper
   - Functions for: create event, get events, update event, delete event
   - Date/time parsing utilities
   - Attendee management
3. Contact service (/src/services/contact.service.ts):
   - Contact data structure and interfaces
   - Contact search and lookup functions
   - Basic CRUD operations
4. Add proper error handling for API rate limits and failures
5. Include TypeScript interfaces for all data structures

These services should be ready for the specialized agents to use.
```

### Prompt 2.3: Specialized Agents Implementation
```
Create the specialized agents that use the Google API services:

1. Email Agent (/src/agents/email.agent.ts):
   - Handle email-related intents (send, reply, search, draft)
   - Parse email commands from natural language
   - Use Gmail service for operations
   - Return formatted responses
2. Calendar Agent (/src/agents/calendar.agent.ts):
   - Handle calendar intents (create event, get schedule, update, delete)
   - Parse date/time from natural language
   - Use Calendar service for operations
   - Handle timezone considerations
3. Contact Agent (/src/agents/contact.agent.ts):
   - Handle contact lookup and management
   - Integrate with email and calendar agents
   - Provide contact resolution services
4. Create agent registry and factory pattern for easy agent management
5. Add comprehensive logging and error handling

Each agent should have a consistent interface and be easily testable.
```

---

## Phase 3: MVP Implementation

### Prompt 3.1: Core API Endpoints
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