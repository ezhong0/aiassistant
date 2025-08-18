# Voice-Controlled Workplace Automation MVP - Technical Specification

## Vision: Beyond Email Assistant
This MVP is the foundation for a comprehensive **voice-controlled workplace automation platform with AI assistance**. Starting with Gmail + Google Calendar, we'll expand to Microsoft 365, Slack, CRM systems, and project management tools - becoming the neutral "Switzerland" of productivity AI that works across all platforms.

## Architecture Overview

```
React Native Mobile App (Dark Mode)
      ↓ HTTPS/WebSocket
n8n Cloud Workflow Engine
      ↓ OAuth API Calls
Gmail API + Google Calendar API + OpenAI API
    ↓ Future Expansion
Microsoft 365 + Slack + Salesforce + Notion + More
```

## Tech Stack Decisions

### Frontend
- **Platform:** React Native (iOS/Android)
- **UI Style:** Card-based interface with dark mode default
- **Voice Input:** Push-to-talk with unlimited recording length
- **Authentication:** OAuth integration for Google services only

### Backend
- **Orchestration:** n8n Cloud workflows
- **Voice Processing:** OpenAI Whisper API (server-side in n8n)
- **AI Model:** GPT-4o-mini (cost-optimized)
- **Storage:** 30-minute context windows, no cross-session persistence

### Security
- **Authentication:** Google OAuth 2.0 (no username/password)
- **Data:** 30-minute context windows for natural conversation, no cross-session storage
- **Privacy:** All requests processed server-side via n8n

## Core User Flow

### 1. App Launch & Authentication
```
App Opens → Google OAuth Login → Gmail/Calendar Permissions → Main Interface
```

### 2. Voice Command Flow
```
User: Hold "Push-to-Talk" button
App: Records audio → Sends to n8n workflow with context
n8n: Audio → Whisper API → Text → GPT-4o-mini Classification (with context)
n8n: Generates action preview → Returns to app
App: Shows preview card with Confirm/Edit/Cancel buttons
User: Confirms → n8n executes action → Updates context → Shows result
```

### 3. Card Interface Elements
- **Voice Input Card:** Push-to-talk button, audio waveform display
- **Action Preview Card:** Intent summary, proposed action details
- **Confirmation Card:** Confirm/Edit/Cancel with status indicators
- **Result Card:** Success/error feedback with action summary

## Context Handling Strategy

### The Problem
Users need context for natural conversation:
- Email threads: "Reply to that email from John about the meeting"
- Follow-ups: "Schedule that call we discussed"
- Corrections: "Actually, make it 3pm instead"

### Solution: 30-Minute Context Windows

#### Level 1: Basic Context (MVP)
```javascript
// Store in mobile app memory during session
const sessionContext = {
  lastEmailThread: { threadId, subject, participants },
  lastCalendarAction: { eventId, title, datetime },
  conversationHistory: [/* last 5 voice commands */],
  sessionId: "uuid-for-n8n-correlation",
  expires: Date.now() + (30 * 60 * 1000) // 30min TTL
}
```

#### Level 2: Enhanced Context (Post-MVP)
```javascript
// 30-minute rolling context window
const contextWindow = {
  emails: {
    recent: [/* last 10 emails viewed/sent */],
    currentThread: { /* active conversation */ },
    drafts: [/* unsent previews */]
  },
  calendar: {
    recentEvents: [/* last created/modified */],
    conflicts: [/* detected scheduling conflicts */],
    pendingInvites: [/* awaiting response */]
  },
  voice: {
    lastCommand: "reply to john",
    clarifications: [/* if user said 'actually, change that' */],
    confidence: 0.89
  },
  expires: Date.now() + (30 * 60 * 1000) // 30min TTL
}
```

### Privacy-First Context Implementation
**What to Store Temporarily:**
- Email thread IDs (not content)
- Calendar event IDs (not details)  
- Voice command patterns (not recordings)
- User preferences (timezone, typical meeting length)

**What Never to Store:**
- Actual email content
- Voice recordings
- Personal information
- Cross-session data

### Context Technical Implementation

#### Mobile App Context Manager
```javascript
// React Native AsyncStorage (session only)
class ContextManager {
  constructor() {
    this.context = new Map();
    this.ttl = 30 * 60 * 1000; // 30 minutes
  }
  
  addEmailContext(threadId, subject, participants) {
    this.context.set('lastEmail', {
      threadId, subject, participants,
      timestamp: Date.now()
    });
  }
  
  getRelevantContext(voiceCommand) {
    // Parse for references: "that email", "the meeting", "it"
    return this.findReferences(voiceCommand);
  }
}
```

#### n8n Context Handling
```json
{
  "voiceCommand": "reply to that email",
  "context": {
    "lastEmail": { 
      "threadId": "thread_123", 
      "subject": "Project Update" 
    },
    "sessionId": "session_456"
  }
}
```

## n8n Workflow Structure

### Main Orchestrator Workflow
1. **HTTP Webhook:** Receives audio file + context from mobile app
2. **OpenAI Whisper Node:** Converts audio to text
3. **Context Parser:** Resolves references ("that email" → thread_123)
4. **GPT-4o-mini Node:** Classifies intent with contextual understanding
5. **Switch Node:** Routes to specific action workflows
6. **Context Updater:** Updates session context with new information
7. **Response Node:** Returns preview data to mobile app

### Email Reply Workflow
1. **Context Resolution:** Determine which email thread to reply to
2. **Gmail Node:** Fetch conversation thread context
3. **GPT-4o-mini Node:** Generate reply content with full thread context
4. **Context Update:** Store reply draft information
5. **Format Response:** Structure preview data
6. **Return Preview:** Send back to app for confirmation

### Email Compose Workflow
1. **GPT-4o-mini Node:** Extract recipients, subject, body from intent
2. **Format Response:** Structure email draft
3. **Return Preview:** Send back to app for confirmation

### Calendar Event Workflow
1. **Google Calendar Node:** Check for conflicts (optional)
2. **GPT-4o-mini Node:** Structure event details
3. **Format Response:** Event preview with recurring settings
4. **Return Preview:** Send back to app for confirmation

### Confirmation Handler Workflow
1. **HTTP Webhook:** Receives confirmation from mobile app
2. **Context Retrieval:** Get stored action details
3. **Switch Node:** Routes to execution workflows
4. **Execute Action:** Gmail Send or Calendar Create
5. **Context Update:** Store successful action in context
6. **Return Status:** Success/failure response with updated context

## Mobile App Structure

### Core Components
```
App.js
├── AuthScreen.js (Google OAuth)
├── MainScreen.js (Primary interface)
├── Components/
│   ├── VoiceInput.js (Push-to-talk)
│   ├── ActionPreview.js (Preview cards)
│   ├── ConfirmationButtons.js
│   └── StatusFeedback.js
├── Services/
│   ├── AudioRecorder.js
│   ├── ApiClient.js (n8n communication)
│   ├── AuthService.js (OAuth handling)
│   └── ContextManager.js (30-min context windows)
└── Utils/
    ├── Constants.js
    └── Helpers.js
```

### Key Features
- **Push-to-Talk:** Long press to record, release to send
- **Dark Mode:** Default theme with card-based layouts
- **Real-time Feedback:** Audio waveforms, processing indicators
- **Error Handling:** Clear error messages, retry options

## API Integration Details

### n8n Webhook Endpoints
```
POST /webhook/voice-command
- Body: { audioFile: base64, sessionId: string, context: object }
- Response: { intent: string, preview: object, actionId: string, updatedContext: object }

POST /webhook/confirm-action  
- Body: { actionId: string, confirmed: boolean, modifications?: string, context: object }
- Response: { status: string, result: object, updatedContext: object }
```

### Google API Scopes Required
```
https://www.googleapis.com/auth/gmail.modify
https://www.googleapis.com/auth/calendar.events
```

## Cost Estimation (Monthly)

### OpenAI API Costs
- **Whisper:** ~$0.006 per minute of audio
- **GPT-4o-mini:** ~$0.15 per 1M input tokens
- **Estimated:** 1000 commands/month = ~$15-25

### n8n Cloud
- **Starter Plan:** $20/month (5,000 workflow executions)
- **Estimated Usage:** ~2,000 executions/month

### Development Tools
- **React Native:** Free
- **Google APIs:** Free (within limits)

**Total Monthly Operating Cost:** ~$35-45

## Development Timeline

### Phase 1: Core Infrastructure + Context (Week 1-2)
- [ ] Set up React Native project with OAuth
- [ ] Create basic n8n workflows (voice → text → classification)
- [ ] Implement push-to-talk audio recording
- [ ] **Implement Level 1 Context Manager**
- [ ] **Context-aware command parsing**
- [ ] Basic card UI with dark mode

### Phase 2: Email Integration + Smart Context (Week 3)
- [ ] Gmail API integration in n8n
- [ ] Email reply workflow with context resolution
- [ ] **Handle "reply to that email" commands**
- [ ] Basic email compose workflow
- [ ] Preview card UI for email actions
- [ ] **Context-aware conversation flow**

### Phase 3: Calendar Integration + Corrections (Week 4)
- [ ] Google Calendar API integration
- [ ] Calendar event creation with recurring options
- [ ] **Handle "actually, make it 3pm instead" corrections**
- [ ] Calendar preview cards
- [ ] Conflict detection (basic)
- [ ] **Cross-reference calendar and email context**

### Phase 4: Polish & Testing (Week 5)
- [ ] Error handling and user feedback
- [ ] UI polish and animations
- [ ] End-to-end testing
- [ ] Performance optimization

## Security Implementation

### OAuth Flow
1. **App Launch:** Check for stored tokens
2. **First Time:** Redirect to Google OAuth consent screen
3. **Token Management:** Store securely, handle refresh automatically
4. **API Calls:** Include OAuth tokens in n8n webhook headers

### Data Privacy
- **30-Minute Context:** All context expires automatically, no cross-session storage
- **ID-Only Storage:** Store thread/event IDs, never actual content
- **Session Only:** Use temporary session IDs for workflow correlation
- **API Security:** All external API calls handled server-side in n8n

## Error Handling Strategy

### Mobile App Errors
- **Network Issues:** Show "Connection Error" with retry button
- **Audio Issues:** Clear error message, microphone permission check
- **OAuth Errors:** Re-authentication flow

### n8n Workflow Errors
- **AI API Failures:** Return error response with fallback suggestions
- **Gmail/Calendar API Errors:** Specific error messages (rate limits, permissions)
- **Timeout Handling:** 30-second timeout for voice processing

## Success Metrics for MVP

### Functionality Goals
- [ ] Voice command recognition accuracy > 90%
- [ ] **Context resolution accuracy > 85% ("that email", "the meeting")**
- [ ] Email reply generation within 10 seconds
- [ ] Calendar event creation success rate > 95%
- [ ] App crash rate < 1%

### User Experience Goals
- [ ] Push-to-talk response time < 1 second
- [ ] **Natural conversation flow with context awareness**
- [ ] Clear error messages and recovery options
- [ ] Intuitive card-based interface
- [ ] Smooth OAuth authentication flow

## Next Steps

1. **Set up development environment**
   - React Native CLI
   - n8n Cloud account
   - Google Cloud Console project for APIs

2. **Create basic project structure**
   - Initialize React Native app
   - Set up OAuth configuration
   - Create initial n8n workflows

3. **Start with voice input pipeline**
   - Implement push-to-talk recording
   - Test audio upload to n8n
   - Verify Whisper API integration

4. **Build incrementally**
   - Start with "reply to last email"
   - Add "create meeting tomorrow at 3pm"
   - Polish UI and error handling

This MVP proves voice-to-email/calendar works reliably before adding complexity.