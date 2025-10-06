# Modern AI Email & Calendar Assistant - Design Document

> **TL;DR**: A mobile-first email+calendar assistant powered by GPT-5 mini function calling, designed to solve the "dropped ball" problem and eliminate email anxiety. Cost: ~$20-100/month to run, 10x simpler than custom orchestration.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [User Research & Pain Points](#user-research--pain-points)
3. [Product Vision & Core Features](#product-vision--core-features)
4. [System Architecture](#system-architecture)
5. [Technical Design](#technical-design)
6. [LLM Integration Patterns](#llm-integration-patterns)
7. [UX Design Patterns](#ux-design-patterns)
8. [Advanced Features](#advanced-features)
9. [Security & Privacy](#security--privacy)
10. [Cost Optimization](#cost-optimization)
11. [Scalability & Performance](#scalability--performance)
12. [Implementation Roadmap](#implementation-roadmap)

---

## Executive Summary

### The Problem
Knowledge workers receive 200+ emails daily. Critical messages get buried. Commitments are forgotten. Calendar chaos wastes hours. Existing tools (Gmail, Outlook, Superhuman) only search—they don't **understand context** or **prevent dropped balls**.

### The Solution
A mobile-first AI assistant that:
- **Predicts** what needs attention (not just filters)
- **Remembers** your commitments (tracks what you promised)
- **Prevents** dropped balls (proactive reminders)
- **Adapts** to your work style (learns patterns)

### Key Innovation
**GPT-5 mini function calling** replaces complex custom orchestration:
- Natural language → Tool calls (automatic)
- Parallel execution (built-in)
- Cost: $0.0065 per query vs. $0.10+ with custom architecture
- Development: Days, not months

### Success Metrics
- **Primary**: 80% reduction in "Oh no, I forgot to respond" moments
- **Secondary**: 50% faster inbox processing
- **Tertiary**: 90% of users check app < 3x/day (vs. 20+ for email)

---

## User Research & Pain Points

### Primary Personas

#### 1. **The Overwhelmed Executive** (Sarah, 45, VP Product)
**Pain Points:**
- 300+ emails/day, can't find signal in noise
- Misses critical client emails in CC threads
- Double-books meetings, no time to prep
- Feels constant anxiety about "what am I missing?"

**Jobs to Be Done:**
- "Help me find what's actually urgent vs. what's just loud"
- "Tell me if I'm about to drop the ball on a commitment"
- "Prep me for meetings without me having to search"

#### 2. **The Startup Founder** (Marcus, 32, CEO)
**Pain Points:**
- Juggles investor updates, customer support, hiring
- Commits to things in meetings, forgets to follow up
- No executive assistant, drowning in admin work
- Needs to be responsive but can't live in inbox

**Jobs to Be Done:**
- "Track what I promised and hold me accountable"
- "Triage my inbox so I only see what matters"
- "Auto-draft simple responses so I can be fast"

#### 3. **The Consultant/Freelancer** (Priya, 28, Designer)
**Pain Points:**
- Multiple clients, each with their own threads
- Loses track of deliverable deadlines in email
- Misses follow-ups = lost revenue
- Needs to appear professional/responsive

**Jobs to Be Done:**
- "Surface client requests before they escalate"
- "Remind me of deliverables I committed to"
- "Help me find that one email about the brand guidelines"

### Core Insight
Users don't need **better search**. They need:
1. **Proactive alerts** ("You forgot to respond to X")
2. **Context on demand** ("Catch me up on this client")
3. **Accountability** ("You said you'd send this by Friday")
4. **Peace of mind** ("You're on top of everything")

---

## Product Vision & Core Features

### North Star Metric
**"Days without a dropped ball"** - How long users go without forgetting a commitment

### Core Features (MVP)

#### 1. **Smart Inbox (AI Triage)**
Instead of folders/labels, AI surfaces:
- **Critical** - Needs response <24h (client escalations, boss questions)
- **Commitments** - Things you promised to do
- **FYI** - Read when you have time
- **Noise** - Auto-archived (newsletters, receipts)

**UX Pattern:** Card-based feed (like Tinder for email)
- Swipe right = "I'll handle this" (added to commitments)
- Swipe left = "Not important" (archived)
- Tap = "Tell me more" (AI summarizes context)

#### 2. **Commitment Tracker**
AI detects when you say:
- "I'll send this by Friday"
- "Let me get back to you"
- "I'll review and respond"

Creates trackable commitment with:
- ✅ What you promised
- 📅 Deadline (inferred from context)
- 👤 Who you promised it to
- 🔔 Reminder (before deadline)

**UX Pattern:** Kanban board
- **To Do** → **In Progress** → **Done**
- Tap to mark complete, auto-archives related emails

#### 3. **Meeting Prep Assistant**
30 min before each meeting:
- Notification: "Your meeting with Sarah in 30min"
- Tap to see:
  - Last conversation summary
  - Relevant emails from attendees
  - Action items from previous meeting
  - Suggested talking points

**UX Pattern:** Bottom sheet with tabs
- **Context** | **Emails** | **Past Meetings** | **Suggested Topics**

#### 4. **Natural Language Everything**
Unified search/command bar:
```
"Show me urgent emails from clients"
"What did I commit to this week?"
"When am I free for a 1hr meeting with John?"
"Catch me up on the Acme project"
"Reply yes and suggest Thursday 2pm"
```

**UX Pattern:** Chat interface (like ChatGPT)
- But results are **actionable** (tap email to open, tap meeting to accept)

#### 5. **Proactive Alerts (The Secret Sauce)**
AI monitors for:
- **Dropped balls**: "You said you'd respond to Jane by today - still pending"
- **Follow-ups**: "Michael sent 2nd reminder about proposal review"
- **Escalations**: "Client email tone changed from polite → urgent"
- **Conflicts**: "You have 3 meetings at 2pm tomorrow"

**UX Pattern:** Smart notifications
- Not spam (max 3/day)
- Actionable ("Respond now" opens draft)
- Snooze with context ("Remind me after client call")

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Mobile App (React Native)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Smart Inbox  │  │ Commitments  │  │  Meeting Prep    │  │
│  │  (Feed UI)   │  │ (Kanban)     │  │  (Bottom Sheet)  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Unified Command Bar (Chat Interface)         │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │   Local State: SQLite + AsyncStorage + Sync Queue    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↕ HTTPS (REST + WebSocket)
┌─────────────────────────────────────────────────────────────┐
│                       Backend (Node.js)                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │               API Gateway (Express.js)                │  │
│  │  /chat  /sync  /commitments  /calendar  /alerts      │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          GPT-5 Mini Function Calling Engine           │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │  │
│  │  │  Gmail   │  │ Calendar │  │  Commitment      │   │  │
│  │  │  Tool    │  │  Tool    │  │  Detector Tool   │   │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘   │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │  │
│  │  │ Urgency  │  │ Context  │  │  Draft Reply     │   │  │
│  │  │ Analyzer │  │ Builder  │  │  Generator       │   │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Background Jobs (Cron + Bull Queue)           │  │
│  │  • Email sync (5min)  • Alert detection (15min)      │  │
│  │  • Commitment check (hourly)  • Meeting prep (30min) │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                    Data & External Services                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │PostgreSQL│  │  Redis   │  │  Gmail   │  │  Google   │  │
│  │(User data│  │ (Cache)  │  │   API    │  │ Calendar  │  │
│  │+ commits)│  │          │  │          │  │    API    │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Architecture Principles

#### 1. **Offline-First Mobile App**
```typescript
// Local-first architecture
SQLite (on-device):
  ├── emails (last 7 days, ~5MB)
  ├── calendar_events (next 30 days)
  ├── commitments (active + completed)
  └── sync_queue (pending actions)

AsyncStorage:
  ├── user_preferences
  ├── conversation_history (chat)
  └── triage_decisions (swipe left/right history)

Sync Strategy:
  • On app open: Pull latest (if online)
  • On action: Add to sync_queue
  • Background sync: Every 5min (if online)
  • Optimistic updates: Instant UI response
```

**Why:** Users check email on subway, planes, bad connections. Offline = non-negotiable.

#### 2. **Stateless Backend with Smart Caching**
```typescript
// Every request is independent
POST /chat
{
  "message": "Show me urgent emails",
  "user_id": "abc123",
  "context": {
    "last_emails_synced_at": "2025-01-06T10:00:00Z",
    "conversation_history": [...] // Last 5 messages
  }
}

// Backend is stateless - scales horizontally
// State stored in:
//   - PostgreSQL (user data, commitments)
//   - Redis (hot cache: email metadata, calendar)
//   - Client (conversation history, local data)
```

**Why:** No session affinity needed. Load balancer distributes freely. Add servers = linear scaling.

#### 3. **Background Jobs for Proactive Intelligence**
```typescript
// Cron jobs analyze in background, push alerts
Hourly Jobs:
  • Commitment checker (scan for overdue promises)
  • Follow-up detector (find 2nd/3rd reminders)
  • Escalation monitor (detect tone changes)

Pre-Meeting Jobs (30min before):
  • Fetch attendee emails (last 30 days)
  • Summarize last meeting notes
  • Generate suggested talking points

Daily Jobs:
  • Inbox triage (overnight classification)
  • Weekly summary prep (Sunday evening)
```

**Why:** Proactive > Reactive. Alerts arrive before users realize they need them.

---

## Technical Design

### Core Data Models

#### 1. **Email Metadata (Cached)**
```typescript
interface Email {
  id: string;
  thread_id: string;
  from: { name: string; email: string };
  to: Array<{ name: string; email: string }>;
  subject: string;
  snippet: string; // First 200 chars
  date: Date;

  // AI-enriched metadata (computed on sync)
  urgency_score: number; // 0-100
  requires_response: boolean;
  sentiment: 'positive' | 'neutral' | 'negative' | 'frustrated';
  contains_question: boolean;
  mentions_deadline: boolean;
  inferred_deadline?: Date;

  // Triage decision
  category: 'critical' | 'commitment' | 'fyi' | 'noise';
  ai_reasoning: string; // "Marked critical because client escalation"
}
```

#### 2. **Commitment Tracking**
```typescript
interface Commitment {
  id: string;
  user_id: string;

  // What & When
  description: string; // "Send Q4 proposal to Acme Corp"
  deadline: Date;
  created_at: Date;

  // Where it came from
  source_type: 'email' | 'meeting' | 'manual';
  source_id: string; // email_id or calendar_event_id
  extracted_phrase: string; // "I'll send this by Friday"

  // Who & Context
  stakeholder: { name: string; email: string };
  related_thread_id?: string;
  related_project?: string;

  // Status
  status: 'pending' | 'in_progress' | 'completed' | 'snoozed';
  completed_at?: Date;
  completion_evidence?: string; // "Sent email with subject 'Q4 Proposal'"

  // Reminders
  reminder_sent: boolean;
  reminder_count: number;
}
```

#### 3. **Meeting Context**
```typescript
interface MeetingContext {
  event_id: string;
  title: string;
  start_time: Date;
  attendees: Array<{ name: string; email: string }>;

  // Pre-generated context (30min before meeting)
  context_generated_at?: Date;
  last_conversation_summary?: string;
  relevant_emails: Email[]; // Last 30 days from attendees
  previous_meeting_notes?: string;
  suggested_topics: string[];

  // Post-meeting
  commitments_extracted: Commitment[];
}
```

#### 4. **User Preferences (Learning)**
```typescript
interface UserPreferences {
  user_id: string;

  // Learned patterns
  vip_contacts: string[]; // Auto-detected from response times
  typical_work_hours: { start: string; end: string }; // "9am-6pm"
  response_time_patterns: {
    [contact: string]: { avg_hours: number; priority: 'high' | 'medium' | 'low' }
  };

  // Explicit settings
  commitment_reminder_lead_time: number; // Hours before deadline
  max_daily_alerts: number; // Default: 3
  triage_sensitivity: 'strict' | 'balanced' | 'relaxed';

  // Inbox learning
  swipe_left_patterns: string[]; // Auto-archive: "newsletters", "receipts"
  swipe_right_patterns: string[]; // Always show: "from:boss@", "urgent"
}
```

### API Design

#### Core Endpoints

```typescript
// 1. Unified chat/command interface
POST /api/chat
Request:
{
  "message": "Show me urgent emails from clients",
  "conversation_history": [...], // Last 5 messages for context
  "context": {
    "current_view": "inbox" | "commitments" | "calendar",
    "selected_email_id"?: "email_123",
    "selected_meeting_id"?: "event_456"
  }
}

Response:
{
  "reply": {
    "text": "I found 3 urgent client emails...",
    "type": "search_results" | "action_confirmation" | "context_summary"
  },
  "actions": [
    {
      "type": "show_emails",
      "emails": [...], // Enriched email objects
      "reasoning": "Filtered for client senders + urgency score > 70"
    }
  ],
  "suggested_follow_ups": [
    "Mark all as read",
    "Draft responses",
    "Add to commitments"
  ]
}

// 2. Background triage (runs every 5min)
POST /api/triage/inbox
Request:
{
  "user_id": "abc123",
  "since": "2025-01-06T10:00:00Z" // Last sync time
}

Response:
{
  "new_emails": [...], // With AI categories
  "alerts": [
    {
      "type": "dropped_ball",
      "message": "You haven't responded to Jane's request (3 days old)",
      "email_id": "email_789",
      "suggested_action": "Draft reply"
    }
  ]
}

// 3. Commitment management
GET /api/commitments?status=pending&overdue=true
POST /api/commitments/:id/complete
{
  "completion_note": "Sent proposal via email",
  "evidence_email_id": "email_101"
}

// 4. Meeting prep (called 30min before)
GET /api/meetings/:id/context

Response:
{
  "meeting": {...},
  "context": {
    "last_conversation": "You discussed Q4 roadmap priorities...",
    "relevant_emails": [...],
    "previous_commitments": [...],
    "suggested_topics": [
      "Follow up on design feedback",
      "Discuss timeline for launch"
    ]
  }
}

// 5. Sync (offline → online)
POST /api/sync
Request:
{
  "actions": [
    { "type": "archive_email", "email_id": "123", "timestamp": "..." },
    { "type": "mark_read", "email_ids": ["456", "789"] },
    { "type": "complete_commitment", "commitment_id": "c_123" }
  ]
}
```

---

## LLM Integration Patterns

### GPT-5 Mini Function Calling Architecture

```typescript
// Tool definitions (registered once at startup)
const tools = [
  // 1. Email operations
  {
    name: 'search_emails',
    description: 'Search Gmail with filters and time ranges',
    parameters: {
      query: 'string', // Gmail query syntax
      max_results: 'number',
      time_range: 'string' // 'today', 'last_7_days', etc.
    },
    execute: async (params, userId) => {
      const cacheKey = `emails:${userId}:${hash(params)}`
      let emails = await redis.get(cacheKey)

      if (!emails) {
        emails = await gmail.search(userId, params)
        await redis.set(cacheKey, emails, 300) // 5min cache
      }

      return emails
    }
  },

  // 2. AI analysis tools
  {
    name: 'analyze_urgency',
    description: 'Analyze emails for urgency signals',
    parameters: {
      email_ids: 'string[]'
    },
    execute: async (params, userId) => {
      const emails = await getEmailsFromCache(params.email_ids)

      // Batch analysis (10x cheaper than individual calls)
      const analysis = await gpt5Mini.analyze({
        prompt: URGENCY_ANALYSIS_PROMPT,
        emails: emails.map(e => ({
          from: e.from,
          subject: e.subject,
          snippet: e.snippet,
          date: e.date
        }))
      })

      return analysis.scores // [{ email_id, urgency: 85, reasoning: "..." }]
    }
  },

  {
    name: 'detect_commitments',
    description: 'Extract commitments from email text',
    parameters: {
      email_id: 'string',
      sender_name: 'string'
    },
    execute: async (params, userId) => {
      const email = await getFullEmail(userId, params.email_id)

      const commitments = await gpt5Mini.extract({
        prompt: COMMITMENT_EXTRACTION_PROMPT,
        text: email.body,
        context: {
          from: params.sender_name,
          date: email.date
        }
      })

      // Save to database
      for (const c of commitments) {
        await db.commitments.create({
          user_id: userId,
          description: c.description,
          deadline: c.deadline,
          source_type: 'email',
          source_id: params.email_id,
          ...
        })
      }

      return commitments
    }
  },

  // 3. Calendar operations
  {
    name: 'get_calendar_events',
    description: 'Get calendar events for time range',
    parameters: {
      time_range: 'string', // 'today', 'tomorrow', 'this_week'
      include_prep: 'boolean' // Include meeting prep context
    },
    execute: async (params, userId) => {
      const { timeMin, timeMax } = parseTimeRange(params.time_range)
      const events = await calendar.getEvents(userId, { timeMin, timeMax })

      if (params.include_prep) {
        // Enrich with pre-generated context
        for (const event of events) {
          event.context = await db.meetingContext.findOne({
            event_id: event.id
          })
        }
      }

      return events
    }
  },

  {
    name: 'find_availability',
    description: 'Find available time slots',
    parameters: {
      duration_minutes: 'number',
      time_range: 'string',
      attendees: 'string[]' // Optional
    },
    execute: async (params, userId) => {
      const events = await calendar.getEvents(userId, ...)
      const busyTimes = events.map(e => ({ start: e.start, end: e.end }))

      // Find gaps
      const availability = findTimeSlots(busyTimes, {
        duration: params.duration_minutes,
        workingHours: userPrefs.typical_work_hours
      })

      return availability // [{ start: '2pm', end: '3pm', date: '2025-01-07' }]
    }
  },

  // 4. Context building
  {
    name: 'build_meeting_context',
    description: 'Build context for upcoming meeting',
    parameters: {
      meeting_id: 'string'
    },
    execute: async (params, userId) => {
      const meeting = await calendar.getEvent(userId, params.meeting_id)
      const attendeeEmails = meeting.attendees.map(a => a.email)

      // Parallel context gathering
      const [recentEmails, previousMeeting, commitments] = await Promise.all([
        // Get recent emails from attendees
        gmail.search(userId, {
          query: attendeeEmails.map(e => `from:${e}`).join(' OR '),
          time_range: 'last_30_days'
        }),

        // Find previous meeting with same attendees
        calendar.findPreviousMeeting(userId, {
          attendees: attendeeEmails,
          before: meeting.start
        }),

        // Get related commitments
        db.commitments.find({
          user_id: userId,
          stakeholder_email: { $in: attendeeEmails },
          status: 'pending'
        })
      ])

      // Summarize with LLM
      const summary = await gpt5Mini.summarize({
        prompt: MEETING_CONTEXT_PROMPT,
        recent_emails: recentEmails,
        previous_meeting: previousMeeting,
        pending_commitments: commitments
      })

      return {
        summary,
        suggested_topics: summary.topics,
        relevant_emails: recentEmails.slice(0, 5)
      }
    }
  },

  // 5. Action tools
  {
    name: 'draft_reply',
    description: 'Generate draft email reply',
    parameters: {
      email_id: 'string',
      intent: 'string', // 'accept', 'decline', 'ask_clarification', etc.
      custom_message: 'string' // Optional user input
    },
    execute: async (params, userId) => {
      const originalEmail = await getFullEmail(userId, params.email_id)
      const userSignature = await getUserSignature(userId)

      const draft = await gpt5Mini.generate({
        prompt: EMAIL_REPLY_PROMPT,
        original_email: originalEmail,
        intent: params.intent,
        custom_message: params.custom_message,
        signature: userSignature,
        tone: 'professional' // Could be user preference
      })

      return {
        subject: `Re: ${originalEmail.subject}`,
        body: draft,
        to: originalEmail.from
      }
    }
  },

  {
    name: 'check_commitment_status',
    description: 'Check if commitment was fulfilled',
    parameters: {
      commitment_id: 'string'
    },
    execute: async (params, userId) => {
      const commitment = await db.commitments.findById(params.commitment_id)

      // Search sent emails for evidence
      const sentEmails = await gmail.search(userId, {
        query: `in:sent to:${commitment.stakeholder.email} after:${commitment.created_at}`,
        max_results: 20
      })

      // Use LLM to check if any email fulfills commitment
      const check = await gpt5Mini.analyze({
        prompt: COMMITMENT_CHECK_PROMPT,
        commitment: commitment.description,
        sent_emails: sentEmails
      })

      if (check.fulfilled) {
        await db.commitments.update(params.commitment_id, {
          status: 'completed',
          completion_evidence: check.evidence_email_id,
          completed_at: check.completion_date
        })
      }

      return check
    }
  }
]

// Main chat handler
async function handleChatMessage(userId: string, message: string, history: Message[]) {
  // Build conversation with system prompt
  const messages = [
    {
      role: 'system',
      content: SYSTEM_PROMPT // See below
    },
    ...history.slice(-5), // Last 5 messages for context
    {
      role: 'user',
      content: message
    }
  ]

  // Call GPT-5 mini with tools
  const response = await openai.chat.completions.create({
    model: 'gpt-5-mini',
    messages,
    tools: tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    })),
    parallel_tool_calls: true, // Enable parallel execution
    temperature: 0.3 // Lower = more consistent
  })

  // Execute tool calls (in parallel if possible)
  if (response.choices[0].finish_reason === 'tool_calls') {
    const toolCalls = response.choices[0].message.tool_calls

    // Execute all tools in parallel
    const toolResults = await Promise.all(
      toolCalls.map(async (call) => {
        const tool = tools.find(t => t.name === call.function.name)
        const params = JSON.parse(call.function.arguments)

        try {
          const result = await tool.execute(params, userId)
          return {
            tool_call_id: call.id,
            role: 'tool',
            content: JSON.stringify(result)
          }
        } catch (error) {
          return {
            tool_call_id: call.id,
            role: 'tool',
            content: JSON.stringify({ error: error.message })
          }
        }
      })
    )

    // Get final response with tool results
    const finalResponse = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        ...messages,
        response.choices[0].message,
        ...toolResults
      ],
      temperature: 0.3
    })

    return finalResponse.choices[0].message.content
  }

  return response.choices[0].message.content
}
```

### System Prompt (Critical for Behavior)

```typescript
const SYSTEM_PROMPT = `You are an AI email & calendar assistant. Your goal is to help users stay on top of their commitments and never drop the ball.

CORE BEHAVIORS:
1. **Proactive, not reactive**: Surface insights users didn't ask for ("I noticed you haven't responded to X")
2. **Context-aware**: Remember what the user cares about (VIPs, projects, deadlines)
3. **Accountable**: Track commitments and hold users accountable
4. **Efficient**: Minimize back-and-forth, take actions when clear

TOOL USAGE PATTERNS:

For "Show me urgent emails":
1. search_emails(query: "is:unread", time_range: "last_3_days")
2. analyze_urgency(email_ids: [...]) // Parallel with search
3. Present top 5 with reasoning

For "What did I commit to?":
1. Get from commitments database (already tracked)
2. If asking about new source: detect_commitments(email_id: X)
3. Group by deadline, highlight overdue

For "Catch me up on [project]":
1. search_emails(query: "subject:[project]", time_range: "last_30_days")
2. Get most recent 5 emails
3. Summarize: What happened → Current status → Next steps

For "When am I free for 1hr with John?":
1. get_calendar_events(time_range: "next_7_days")
2. find_availability(duration: 60, attendees: ["john@..."])
3. Suggest top 3 slots

For "Reply yes and suggest Thursday 2pm":
1. draft_reply(email_id: X, intent: "accept", custom: "Thursday 2pm works")
2. Return draft for user approval

COMMUNICATION STYLE:
- Concise: Get to the point in 1-2 sentences
- Actionable: Always suggest next steps
- Honest: If uncertain, say so ("I'm not sure if this is urgent, but...")
- Personal: Use "you" and "I", not "the user"

CURRENT CONTEXT:
- User timezone: {{user_timezone}}
- Current time: {{current_time}}
- VIP contacts: {{vip_contacts}}
- Active projects: {{active_projects}}`
```

### Cost Optimization with Caching

```typescript
// 1. Prompt caching (90% discount on cached tokens)
const CACHED_SYSTEM_PROMPT = {
  role: 'system',
  content: SYSTEM_PROMPT,
  cache_control: { type: 'ephemeral' } // OpenAI auto-caches for 5min
}

// 2. Email metadata caching (avoid re-analyzing)
async function analyzeUrgency(emailIds: string[], userId: string) {
  const cacheKeys = emailIds.map(id => `urgency:${id}`)
  const cached = await redis.mget(cacheKeys)

  const toAnalyze = emailIds.filter((id, i) => !cached[i])

  if (toAnalyze.length > 0) {
    const scores = await gpt5Mini.analyze({ emails: toAnalyze })

    // Cache for 1 hour
    for (const score of scores) {
      await redis.set(`urgency:${score.email_id}`, score, 3600)
    }
  }

  return [...cached.filter(Boolean), ...newScores]
}

// 3. Batch operations (10x cheaper)
// Instead of: 10 individual LLM calls
// Do: 1 batch call analyzing 10 emails
async function batchAnalyzeEmails(emails: Email[]) {
  return await gpt5Mini.analyze({
    prompt: "Analyze each email for: urgency (0-100), requires_response (bool), sentiment",
    emails: emails.map(e => ({ id: e.id, from: e.from, subject: e.subject, snippet: e.snippet }))
  })
}
```

---

## UX Design Patterns

### 1. **Smart Inbox Feed** (Primary View)

```
┌─────────────────────────────────────┐
│  [☰]  Inbox            [🔍] [👤]   │
├─────────────────────────────────────┤
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 🔴 CRITICAL                   │ │
│  │                               │ │
│  │ Sarah Chen (Acme Corp)        │ │
│  │ "Need proposal by EOD"        │ │
│  │                               │ │
│  │ 2 hours ago                   │ │
│  │ ⚠️ Client escalation detected │ │
│  │                               │ │
│  │ [Respond Now] [Snooze 1hr]    │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 📌 COMMITMENT                 │ │
│  │                               │ │
│  │ You promised: Send Q4 roadmap │ │
│  │ To: Marcus (CEO)              │ │
│  │ Due: Tomorrow 5pm             │ │
│  │                               │ │
│  │ [Mark Done] [View Thread]     │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 📬 FYI                        │ │
│  │                               │ │
│  │ Weekly team update from Jane  │ │
│  │ "Sprint 23 recap and..."      │ │
│  │                               │ │
│  │ [← Archive]  [Read →]         │ │
│  └───────────────────────────────┘ │
│                                     │
│  [Show 12 more in Noise]            │
│                                     │
└─────────────────────────────────────┘

Interaction:
- Swipe left: Archive (for FYI/Noise)
- Swipe right: Add to commitments
- Tap: Expand for full context
- Long press: Bulk actions
```

### 2. **Commitment Tracker** (Kanban View)

```
┌─────────────────────────────────────┐
│  [←]  Commitments                   │
├─────────────────────────────────────┤
│                                     │
│  TODO (3)  |  IN PROGRESS (2)  | ✓  │
│                                     │
│  ┌─────────┐  ┌────────────┐   🎉  │
│  │Send Q4  │  │Review      │   All │
│  │roadmap  │  │design doc  │  done!│
│  │         │  │            │       │
│  │Due: Fri │  │Due: Today  │       │
│  │@ 5pm    │  │@ 3pm       │       │
│  │         │  │            │       │
│  │To:Marcus│  │To:Design   │       │
│  └─────────┘  │   team     │       │
│               └────────────┘       │
│  ┌─────────┐                        │
│  │Follow up│  [Drag to move]        │
│  │with Jane│                        │
│  │         │                        │
│  │Due: Mon │                        │
│  └─────────┘                        │
│                                     │
│  [+ Add Commitment]                 │
│                                     │
└─────────────────────────────────────┘

Tap card:
  ┌─────────────────────────────┐
  │ Send Q4 Roadmap to Marcus   │
  ├─────────────────────────────┤
  │ Source: Meeting on Jan 3    │
  │ You said: "I'll have this   │
  │ ready by Friday afternoon"  │
  │                             │
  │ [View Email Thread]         │
  │ [Draft Response]            │
  │ [Mark Complete]             │
  │ [Snooze until...]           │
  └─────────────────────────────┘
```

### 3. **Meeting Prep Sheet** (Bottom Sheet)

```
30 minutes before meeting:
┌─────────────────────────────────────┐
│  ⏰ Meeting in 30 min               │
│  "Product Roadmap Review"           │
│  with Sarah, Marcus, Jane           │
│                                     │
│  [Tap to prepare]                   │
└─────────────────────────────────────┘

Tap opens bottom sheet:
┌─────────────────────────────────────┐
│  [━━━]                              │ ← Drag handle
│                                     │
│  Product Roadmap Review             │
│  2:00pm - 3:00pm                    │
│  📍 Conference Room A               │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 📧 Recent Context           │   │
│  │                             │   │
│  │ • Sarah sent design mockups │   │
│  │   2 days ago                │   │
│  │ • You approved v2 yesterday │   │
│  │ • Marcus asked about        │   │
│  │   timeline this morning     │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ ✅ Last Meeting (Dec 20)    │   │
│  │                             │   │
│  │ Decided: Ship Q1 features   │   │
│  │ first, Q2 nice-to-haves     │   │
│  │                             │   │
│  │ Your action items:          │   │
│  │ ☑ Review designs (Done)     │   │
│  │ ☐ Approve timeline (Pending)│   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 💡 Suggested Topics         │   │
│  │                             │   │
│  │ • Address Marcus's timeline │   │
│  │   questions                 │   │
│  │ • Discuss resource needs    │   │
│  │   for Q2 features           │   │
│  │ • Review final mockups      │   │
│  └─────────────────────────────┘   │
│                                     │
│  [View All Emails] [Join Meeting]   │
│                                     │
└─────────────────────────────────────┘
```

### 4. **Command Bar** (Unified Search)

```
┌─────────────────────────────────────┐
│  🔍  Ask me anything...             │
└─────────────────────────────────────┘

User types: "show urgent emails from clients"

┌─────────────────────────────────────┐
│  show urgent emails from clients    │
├─────────────────────────────────────┤
│  🤖 Found 3 urgent client emails:   │
│                                     │
│  1. Sarah Chen (Acme Corp)          │
│     "Need proposal ASAP"            │
│     ⚡ Urgency: 95/100              │
│     [View] [Respond]                │
│                                     │
│  2. John Park (TechStart)           │
│     "Following up on invoice"       │
│     ⚡ Urgency: 78/100              │
│     [View] [Respond]                │
│                                     │
│  3. Lisa Wong (GlobalCo)            │
│     "Contract deadline Friday"      │
│     ⚡ Urgency: 88/100              │
│     [View] [Respond]                │
│                                     │
│  💡 Suggested actions:              │
│  • Draft responses to all 3         │
│  • Add contract deadline to commits │
│  • Schedule follow-up call          │
│                                     │
│  [Do this] [Not now]                │
└─────────────────────────────────────┘

Follow-up commands:
- "draft responses to all"
- "add contract to commitments"
- "when am I free for a call with Lisa?"
```

### 5. **Proactive Alert System**

```
Smart notification (max 3/day):

┌─────────────────────────────────────┐
│  📬 Commitment Reminder             │
│                                     │
│  You promised to send the Q4        │
│  proposal to Marcus by 5pm today.   │
│                                     │
│  Status: Not sent yet               │
│                                     │
│  [Draft Now] [Mark Done] [Snooze]   │
└─────────────────────────────────────┘

Dropped ball alert:

┌─────────────────────────────────────┐
│  ⚠️ Possible Dropped Ball           │
│                                     │
│  Jane sent a 2nd follow-up about    │
│  the budget review (3 days ago).    │
│                                     │
│  Original message: "When can we     │
│  discuss Q1 budget?"                │
│                                     │
│  [Respond Now] [Not Important]      │
└─────────────────────────────────────┘

Escalation warning:

┌─────────────────────────────────────┐
│  🚨 Client Escalation               │
│                                     │
│  Sarah's tone changed:              │
│  First email: "When convenient..."  │
│  Latest: "Need this ASAP or we'll   │
│  have to look elsewhere"            │
│                                     │
│  [High Priority] [View Thread]      │
└─────────────────────────────────────┘
```

---

## Advanced Features

### Phase 2 Features (Post-MVP)

#### 1. **Smart Batching** (Reduce Interruptions)
```
User preference: "Batch mode"

Instead of:
- 8am: "Email from boss" (notification)
- 9am: "Meeting in 30min" (notification)
- 10am: "Dropped ball alert" (notification)

Show:
- 8:30am: "Morning briefing ready" (1 notification)

  ┌─────────────────────────────────┐
  │  ☀️ Morning Briefing            │
  │                                 │
  │  🔴 3 urgent items:             │
  │  • Email from boss (respond)    │
  │  • Client proposal due today    │
  │  • Meeting prep needed          │
  │                                 │
  │  📊 Today's schedule:           │
  │  • 9:30am - Team sync           │
  │  • 2pm - Client call            │
  │  • 4pm - 1:1 with Sarah         │
  │                                 │
  │  ✅ Commitments due:            │
  │  • Send Q4 roadmap (5pm)        │
  │                                 │
  │  [Start Day] [Customize]        │
  └─────────────────────────────────┘
```

#### 2. **Relationship Intelligence**
```
Track communication patterns:

For each contact:
- Average response time (user → them, them → user)
- Typical communication style (formal vs casual)
- Topics discussed
- Meeting frequency
- Commitment history

Use cases:
1. "Sarah usually responds within 2 hours. It's been 2 days - might be urgent"
2. "You typically meet with Marcus every 2 weeks. It's been 3 weeks."
3. "Investors usually get formal emails from you. This draft is too casual."

UI: Contact card with relationship insights
  ┌─────────────────────────────────┐
  │  Sarah Chen                     │
  │  VP Product @ Acme Corp         │
  │                                 │
  │  📊 Relationship Stats:         │
  │  • Last contact: 3 days ago     │
  │  • Avg response: 4 hours        │
  │  • Meeting frequency: Weekly    │
  │  • Open commitments: 2          │
  │                                 │
  │  💡 Insights:                   │
  │  • Usually responds faster      │
  │  • Overdue for weekly check-in  │
  │                                 │
  │  [View History] [Schedule Call] │
  └─────────────────────────────────┘
```

#### 3. **Email Templates with Learning**
```
AI learns from sent emails:

User: "Reply accepting the meeting"

Instead of generic:
"Thanks for the invite. I'll be there."

AI generates in user's style:
"Hey Sarah! Works for me - looking forward to discussing the roadmap. See you Thursday at 2pm."

Learning signals:
- User edits drafts → Learn preferences
- User approves drafts → Reinforce style
- High response rates → Effective templates

Templates adapt to:
- Recipient (formal for boss, casual for peers)
- Context (urgent vs routine)
- User mood (time of day, workload)
```

#### 4. **Cross-Platform Sync**
```
Devices:
- Mobile (iOS/Android)
- Desktop (Electron app)
- Web (PWA)
- Email client plugin (Gmail/Outlook)

Sync strategy:
1. SQLite on mobile/desktop
2. WebSocket for real-time updates
3. Conflict resolution (last-write-wins for most, manual for commitments)

Example flow:
Mobile (offline):
  - User archives email
  - Adds to sync queue
  - Shows as archived (optimistic)

Desktop (online):
  - Receives sync: "mobile_device archived email_123"
  - Updates local DB
  - Broadcasts to other devices

Web:
  - Receives broadcast
  - Updates UI real-time
```

#### 5. **Voice Interface**
```
Siri/Google Assistant integration:

"Hey Siri, ask InboxZero what's urgent"
→ "You have 2 urgent emails: One from Sarah about..."

"Hey Siri, tell InboxZero I'm done with the proposal"
→ Marks commitment complete, archives related emails

"Hey Siri, when's my next meeting?"
→ "Team sync in 15 minutes. Want me to pull up the prep?"

CarPlay/Android Auto support:
- Read important emails while driving
- Voice reply: "Draft a response saying I'll call them later"
- Meeting alerts: "Your call with Sarah starts in 5 min. Pull over to join?"
```

#### 6. **Team Mode** (B2B Feature)
```
Shared inboxes with AI:

Team features:
- Shared commitment board (who promised what)
- Round-robin email assignment
- Escalation detection (customer getting frustrated)
- Response time SLAs

Example:
Support team inbox:
┌─────────────────────────────────────┐
│  🎫 Unassigned (5)                  │
│                                     │
│  🔴 URGENT                          │
│  Customer X: "Data loss - critical" │
│  ⚡ Auto-assign to: Sarah (on-call) │
│  [Assign] [Escalate]                │
│                                     │
│  📊 Team Stats:                     │
│  • Avg response time: 2.3 hours     │
│  • SLA breaches today: 0            │
│  • Open commitments: 12             │
│                                     │
│  [View Board] [Team Analytics]      │
└─────────────────────────────────────┘
```

---

## Security & Privacy

### Core Principles
1. **User data stays user data** - Never train on user emails
2. **Zero-knowledge where possible** - Encrypt sensitive data
3. **Minimal retention** - Delete what's not needed
4. **Transparent AI** - Show why decisions were made

### Implementation

#### 1. **Data Encryption**
```typescript
// At rest (database)
interface EncryptedEmail {
  id: string;
  user_id: string;
  encrypted_body: string; // AES-256-GCM
  encrypted_subject: string;
  // Metadata NOT encrypted (for indexing)
  from_email: string;
  date: Date;
  urgency_score: number; // Computed, then original deleted
}

// Encryption key derivation
const userKey = await deriveKey(
  userPassword, // User-specific
  USER_SALT,
  100000 // PBKDF2 iterations
)

// Encrypt before storage
const encryptedBody = await encrypt(email.body, userKey)

// Decrypt on demand (never store decrypted)
const body = await decrypt(encryptedEmail.encrypted_body, userKey)
```

#### 2. **LLM Privacy**
```typescript
// Minimize data sent to OpenAI
function prepareForLLM(email: Email): EmailSnippet {
  return {
    id: email.id,
    from: email.from.name, // Not email address
    subject: redactPII(email.subject), // Remove emails, phones
    snippet: email.snippet.substring(0, 200), // Limit exposure
    date: email.date
    // NEVER send: full body, attachments, raw headers
  }
}

// For sensitive analysis, use local models
if (email.contains_ssn || email.contains_financial_data) {
  // Use on-device ML (Core ML / TensorFlow Lite)
  const urgency = await localModel.analyzeUrgency(email)
} else {
  // Use GPT-5 mini
  const urgency = await gpt5Mini.analyzeUrgency(emailSnippet)
}
```

#### 3. **OAuth Token Security**
```typescript
// Token storage (device keychain)
import * as Keychain from 'react-native-keychain'

// Store OAuth tokens securely
await Keychain.setGenericPassword(
  'oauth_tokens',
  JSON.stringify({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token
  }),
  {
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE
  }
)

// Backend stores encrypted tokens
const encryptedTokens = encrypt(tokens, BACKEND_ENCRYPTION_KEY)
await db.userTokens.upsert({
  user_id,
  encrypted_access_token: encryptedTokens.access,
  encrypted_refresh_token: encryptedTokens.refresh,
  expires_at: tokens.expires_at
})
```

#### 4. **Audit Logging**
```typescript
// Log all AI decisions for transparency
interface AuditLog {
  timestamp: Date;
  user_id: string;
  action: 'triage' | 'commitment_detection' | 'urgency_analysis';
  input: string; // What was analyzed
  output: string; // What AI decided
  reasoning: string; // Why it decided that
  llm_model: string; // Which model
  tokens_used: number;
}

// User can view audit log
GET /api/audit-log?action=triage&date=2025-01-06

Response:
{
  "logs": [
    {
      "time": "10:23am",
      "action": "Marked email as URGENT",
      "email": "From Sarah Chen: Need proposal...",
      "reasoning": "Client escalation detected. Keywords: 'ASAP', 'need', deadline mentioned",
      "confidence": 92
    }
  ]
}
```

#### 5. **Data Retention**
```typescript
// Aggressive retention policies
const RETENTION = {
  email_bodies: '7_days', // Then deleted, only metadata kept
  conversation_history: '30_days',
  commitment_history: '1_year', // For accountability
  audit_logs: '90_days',
  deleted_emails: '0_days' // Immediately purged
}

// Cron job for cleanup
async function cleanupOldData() {
  await db.emails.deleteWhere({
    created_at: { $lt: subDays(new Date(), 7) }
  })

  await db.conversationHistory.deleteWhere({
    created_at: { $lt: subDays(new Date(), 30) }
  })
}
```

#### 6. **User Control**
```
Settings → Privacy

┌─────────────────────────────────────┐
│  🔒 Privacy Settings                │
│                                     │
│  AI Analysis:                       │
│  ☑ Urgency detection                │
│  ☑ Commitment tracking              │
│  ☐ Sentiment analysis               │
│  ☐ Relationship insights            │
│                                     │
│  Data Retention:                    │
│  • Email bodies: 7 days ▼           │
│  • Conversation: 30 days ▼          │
│  • Commitments: 1 year ▼            │
│                                     │
│  ☑ Delete data on account deletion  │
│  ☐ Share anonymized usage data      │
│                                     │
│  [Export My Data] [Delete Account]  │
└─────────────────────────────────────┘
```

---

## Cost Optimization

### Target: <$100/month for 1000 daily queries

#### 1. **Aggressive Caching Strategy**
```typescript
// Multi-layer cache
const CACHE_HIERARCHY = {
  L1_Device: {
    // On-device cache (instant, free)
    storage: 'SQLite',
    ttl: '24_hours',
    size: '50MB',
    contents: ['recent_emails', 'calendar_events', 'commitments']
  },

  L2_Redis: {
    // Shared cache (fast, cheap)
    ttl: '5_minutes',
    contents: ['email_metadata', 'urgency_scores', 'user_preferences']
  },

  L3_CloudFront: {
    // CDN cache (for static assets)
    ttl: '1_hour',
    contents: ['profile_pictures', 'email_signatures', 'templates']
  }
}

// Cache hit rate target: 70%
// Impact: 70% of queries cost $0 (served from cache)

async function getCachedOrCompute<T>(
  key: string,
  computeFn: () => Promise<T>,
  ttl: number
): Promise<T> {
  // L1: Check device
  const deviceCache = await AsyncStorage.getItem(key)
  if (deviceCache) {
    return JSON.parse(deviceCache)
  }

  // L2: Check Redis
  const redisCache = await redis.get(key)
  if (redisCache) {
    // Populate L1 for next time
    await AsyncStorage.setItem(key, redisCache)
    return JSON.parse(redisCache)
  }

  // L3: Compute (expensive)
  const result = await computeFn()

  // Populate all caches
  await redis.set(key, JSON.stringify(result), 'EX', ttl)
  await AsyncStorage.setItem(key, JSON.stringify(result))

  return result
}
```

#### 2. **Prompt Caching (90% Discount)**
```typescript
// System prompt is same across requests
// OpenAI caches it automatically for 5min
// Cost: $1.25/1M → $0.125/1M (90% off)

const response = await openai.chat.completions.create({
  model: 'gpt-5-mini',
  messages: [
    {
      role: 'system',
      content: SYSTEM_PROMPT, // Same every time = cached
      cache_control: { type: 'ephemeral' }
    },
    {
      role: 'user',
      content: userMessage // Only this costs full price
    }
  ]
})

// Savings example:
// System prompt: 500 tokens @ $0.125/1M (cached) = $0.0000625
// User message: 100 tokens @ $1.25/1M = $0.000125
// Total: $0.0001875 (vs $0.00075 without caching = 75% savings)
```

#### 3. **Batch Processing**
```typescript
// Instead of 10 individual calls (10x cost)
// Do 1 batch call (1x cost)

// ❌ Bad: Individual analysis
for (const email of emails) {
  const urgency = await gpt5Mini.analyzeUrgency(email)
}
// Cost: 10 calls × 2000 tokens × $1.25/1M = $0.025

// ✅ Good: Batch analysis
const urgencyScores = await gpt5Mini.analyzeBatch({
  prompt: "Analyze urgency for each email (0-100 scale)",
  emails: emails.map(e => ({ id: e.id, from: e.from, subject: e.subject }))
})
// Cost: 1 call × 3000 tokens × $1.25/1M = $0.00375
// Savings: 85%
```

#### 4. **Smart Model Selection**
```typescript
// Route to cheapest model that can handle task
function selectModel(task: Task): string {
  if (task.type === 'simple_classification') {
    // "Is this email urgent?" → gpt-5-nano
    return 'gpt-5-nano' // $0.05/1M input
  }

  if (task.type === 'extraction') {
    // "Extract commitment deadlines" → gpt-5-mini
    return 'gpt-5-mini' // $0.25/1M input
  }

  if (task.type === 'complex_reasoning') {
    // "Should I prioritize email A or B given context?" → gpt-5
    return 'gpt-5' // $1.25/1M input
  }

  if (task.type === 'creative_writing') {
    // "Draft apology email" → gpt-5
    return 'gpt-5'
  }

  return 'gpt-5-mini' // Default
}

// Cost breakdown (1000 queries/day):
// 70% simple (nano): 700 × $0.0013 = $0.91/day
// 20% medium (mini): 200 × $0.0065 = $1.30/day
// 10% complex (gpt-5): 100 × $0.0325 = $3.25/day
// Total: $5.46/day = $164/month

// With 70% cache hit rate:
// Actual: $5.46 × 0.3 = $1.64/day = $49/month ✅
```

#### 5. **Background Pre-computation**
```typescript
// Compute during off-peak (free time)
// Store results, serve instantly

// Run overnight (when user sleeps)
cron.schedule('0 2 * * *', async () => { // 2am daily
  const users = await db.users.find({ timezone: 'America/Los_Angeles' })

  for (const user of users) {
    // Pre-compute morning briefing
    const briefing = await generateMorningBriefing(user.id)
    await redis.set(`briefing:${user.id}`, briefing, 28800) // Cache 8 hours

    // Pre-analyze today's calendar
    const meetingPreps = await prepareMeetingContexts(user.id)
    for (const prep of meetingPreps) {
      await redis.set(`meeting_prep:${prep.event_id}`, prep, 86400) // 24 hours
    }
  }
})

// User wakes up, opens app
// Everything is pre-computed = instant, $0
```

#### 6. **Rate Limiting & Budgets**
```typescript
// Per-user cost tracking
interface UserUsage {
  user_id: string;
  month: string; // "2025-01"
  llm_calls: number;
  tokens_used: number;
  estimated_cost: number; // USD
  budget_limit: number; // Default: $5/month
}

// Middleware: Check budget before LLM call
async function checkBudget(userId: string) {
  const usage = await db.usage.findOne({ user_id: userId, month: currentMonth() })

  if (usage.estimated_cost >= usage.budget_limit) {
    throw new Error('Monthly budget exceeded. Upgrade to Pro for unlimited.')
  }
}

// Graceful degradation
async function handleQuery(query: string, userId: string) {
  try {
    await checkBudget(userId)
    return await gpt5Mini.chat({ messages: [...] })
  } catch (error) {
    if (error.message.includes('budget exceeded')) {
      // Fallback to keyword search (free)
      return await keywordSearch(query)
    }
    throw error
  }
}
```

### Cost Projection Summary

| Scenario | Queries/Day | Cache Hit Rate | Cost/Month |
|----------|-------------|----------------|------------|
| **Light user** | 50 | 70% | $2 |
| **Average user** | 200 | 70% | $10 |
| **Power user** | 1000 | 70% | $49 |
| **Heavy user** | 5000 | 60% | $320 |

**Pricing tiers:**
- **Free**: $0/month (50 queries/day, basic features)
- **Pro**: $10/month (1000 queries/day, all features)
- **Teams**: $25/user/month (unlimited, team features)

---

## Scalability & Performance

### Target Metrics
- **P50 latency**: <500ms (perceived instant)
- **P99 latency**: <2s
- **Uptime**: 99.9% (43 min downtime/month)
- **Concurrent users**: 100K+

### Architecture for Scale

#### 1. **Horizontal Scaling**
```typescript
// Stateless backend = add servers linearly
// Load balancer (AWS ALB / Cloudflare)
//   ↓
// Auto-scaling group (3-20 instances)
//   ↓
// Each instance: Node.js server

// Scale trigger:
if (cpu > 70% for 5min) {
  scaleUp(instances + 2)
}

if (cpu < 30% for 15min) {
  scaleDown(instances - 1, min: 3)
}
```

#### 2. **Database Optimization**
```sql
-- Indexes for common queries
CREATE INDEX idx_emails_user_date ON emails(user_id, date DESC);
CREATE INDEX idx_emails_urgency ON emails(user_id, urgency_score DESC);
CREATE INDEX idx_commitments_user_status ON commitments(user_id, status, deadline);

-- Partitioning by user_id (for multi-tenancy)
CREATE TABLE emails (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  ...
) PARTITION BY HASH(user_id);

-- Read replicas for queries (writes to primary, reads from replicas)
const readPool = new Pool({ host: 'replica-1.db.amazonaws.com' })
const writePool = new Pool({ host: 'primary.db.amazonaws.com' })

// Route queries
async function getUserEmails(userId: string) {
  return await readPool.query('SELECT * FROM emails WHERE user_id = $1', [userId])
}

async function insertEmail(email: Email) {
  return await writePool.query('INSERT INTO emails ...', [...])
}
```

#### 3. **Background Job Queue**
```typescript
// Redis-backed queue (Bull)
import Queue from 'bull'

const emailSyncQueue = new Queue('email-sync', {
  redis: { host: 'redis.cache.amazonaws.com' }
})

// Producer: Add jobs
await emailSyncQueue.add('sync-inbox', {
  user_id: 'abc123',
  since: lastSyncTime
}, {
  priority: 1, // Higher priority = processes first
  attempts: 3, // Retry on failure
  backoff: { type: 'exponential', delay: 2000 }
})

// Consumer: Process jobs (multiple workers)
emailSyncQueue.process('sync-inbox', 10, async (job) => { // 10 concurrent
  const { user_id, since } = job.data
  const emails = await gmail.fetchNew(user_id, since)
  await db.emails.insertMany(emails)
})

// Scales to millions of jobs
// Add more worker instances as needed
```

#### 4. **CDN for Static Assets**
```typescript
// Cloudflare / AWS CloudFront
// Cached at edge locations worldwide

// Assets:
- Profile pictures → S3 + CloudFront
- Email attachments → S3 + signed URLs (expire 1 hour)
- App bundles (React Native) → CloudFront

// Configuration:
cloudfront.createDistribution({
  origins: [{
    domainName: 's3.amazonaws.com',
    originPath: '/user-assets'
  }],
  cacheBehaviors: [{
    pathPattern: '/profile-pictures/*',
    ttl: 86400 // 24 hours
  }]
})

// Result: <50ms latency globally for static assets
```

#### 5. **Rate Limiting (Prevent Abuse)**
```typescript
// Redis-based rate limiter
import rateLimit from 'express-rate-limit'
import RedisStore from 'rate-limit-redis'

const limiter = rateLimit({
  store: new RedisStore({ client: redis }),
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute per user
  message: 'Too many requests, please slow down',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user.id // Rate limit per user
})

app.use('/api/chat', limiter)

// DDoS protection (Cloudflare)
// - Challenge suspicious traffic
// - Block known bad actors
// - Auto-scale to handle spikes
```

#### 6. **Monitoring & Observability**
```typescript
// Metrics (Prometheus + Grafana)
const metrics = {
  http_request_duration: new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request latency',
    labelNames: ['method', 'route', 'status']
  }),

  llm_tokens_used: new Counter({
    name: 'llm_tokens_total',
    help: 'Total LLM tokens consumed',
    labelNames: ['model', 'user_id']
  }),

  cache_hit_rate: new Gauge({
    name: 'cache_hit_rate',
    help: 'Cache hit rate (0-1)',
    labelNames: ['cache_layer']
  })
}

// Alerts (PagerDuty / Slack)
if (p99_latency > 5000) { // 5 seconds
  alert('High latency detected')
}

if (error_rate > 5%) {
  alert('Error rate spike')
}

if (llm_cost_per_hour > $50) {
  alert('LLM cost spike - possible runaway loop')
}

// Tracing (OpenTelemetry)
const span = tracer.startSpan('chat-request')
span.setAttributes({
  'user.id': userId,
  'query': query
})

try {
  const response = await handleChat(query)
  span.setStatus({ code: SpanStatusCode.OK })
  return response
} catch (error) {
  span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
  throw error
} finally {
  span.end()
}
```

---

## Implementation Roadmap

### Phase 1: MVP (4 weeks)

**Week 1: Core Infrastructure**
- [ ] Backend scaffold (Express + PostgreSQL + Redis)
- [ ] OAuth 2.0 (Google) authentication
- [ ] Gmail API integration (read-only)
- [ ] Calendar API integration (read-only)
- [ ] GPT-5 mini function calling setup
- [ ] Basic tools: search_emails, get_calendar_events

**Week 2: Smart Inbox**
- [ ] Email sync background job (5min interval)
- [ ] Urgency analysis tool (batch processing)
- [ ] Triage logic (Critical/Commitment/FYI/Noise)
- [ ] Mobile app: Inbox feed UI (React Native)
- [ ] Swipe gestures (archive, commit)
- [ ] Offline-first storage (SQLite)

**Week 3: Commitment Tracking**
- [ ] Commitment detection tool
- [ ] Commitment database schema
- [ ] Kanban board UI
- [ ] Reminder notifications (30min before deadline)
- [ ] Mark complete flow

**Week 4: Command Bar + Polish**
- [ ] Unified chat interface
- [ ] Natural language query handling
- [ ] Meeting prep tool (30min before meetings)
- [ ] Proactive alerts (dropped balls, follow-ups)
- [ ] Testing + bug fixes
- [ ] **Launch to beta users**

### Phase 2: Advanced Features (6 weeks)

**Week 5-6: Relationship Intelligence**
- [ ] Communication pattern tracking
- [ ] Contact insights (response times, meeting frequency)
- [ ] VIP auto-detection
- [ ] Relationship health score

**Week 7-8: Smart Actions**
- [ ] Draft reply tool (multi-tone support)
- [ ] Calendar write operations (create meetings, accept/decline)
- [ ] Bulk actions (archive all from sender, mark all read)
- [ ] Email templates with learning

**Week 9-10: Polish & Optimization**
- [ ] Aggressive caching (70% hit rate target)
- [ ] Prompt caching (90% discount)
- [ ] Model routing (nano/mini/gpt-5)
- [ ] Performance optimization (P50 <500ms)
- [ ] Cost monitoring & budgets

### Phase 3: Scale & Team Features (8 weeks)

**Week 11-14: Team Mode (B2B)**
- [ ] Shared inboxes
- [ ] Team commitment board
- [ ] Round-robin assignment
- [ ] SLA tracking
- [ ] Analytics dashboard

**Week 15-18: Enterprise Polish**
- [ ] SSO (SAML, Okta)
- [ ] Advanced permissions
- [ ] Audit logging (SOC 2 compliance)
- [ ] On-premise deployment option
- [ ] 99.9% SLA guarantee

### Launch Checklist

**Pre-Launch:**
- [ ] Security audit (penetration testing)
- [ ] Privacy policy (GDPR, CCPA compliant)
- [ ] Load testing (100K concurrent users)
- [ ] Monitoring setup (alerts, dashboards)
- [ ] Documentation (user guide, API docs)
- [ ] Marketing site + demo video

**Launch Day:**
- [ ] Deploy to production
- [ ] Enable monitoring
- [ ] Announce on ProductHunt, HN, Twitter
- [ ] Support team on standby
- [ ] Track metrics (signups, retention, NPS)

**Post-Launch (30 days):**
- [ ] Fix critical bugs (P0 within 24h)
- [ ] Optimize based on usage patterns
- [ ] A/B test features (triage sensitivity, notification frequency)
- [ ] Gather user feedback
- [ ] Plan next iteration

---

## Success Metrics

### North Star Metric
**"Days without a dropped ball"** - How long users go without forgetting a commitment

Target: 30 days → 90 days (3x improvement)

### Primary Metrics

| Metric | Current (Gmail) | Target (Our App) | Impact |
|--------|-----------------|------------------|--------|
| **Time to inbox zero** | 45 min/day | 10 min/day | 78% faster |
| **Dropped balls per week** | 3-5 | 0-1 | 80% reduction |
| **Email anxiety score** | 7/10 | 3/10 | Peace of mind |
| **Meeting prep time** | 15 min/meeting | 2 min/meeting | 87% faster |

### Secondary Metrics

**Engagement:**
- Daily active users (DAU) / Monthly active users (MAU): Target 60%
- Sessions per day: Target <3 (less is better!)
- Time in app: Target <10 min/day (efficient)

**Retention:**
- Day 1 retention: >80%
- Day 7 retention: >60%
- Day 30 retention: >40%
- 6-month churn: <10%

**Viral Growth:**
- Net Promoter Score (NPS): >50
- Referral rate: >30%
- Word-of-mouth coefficient: >0.5

**Business:**
- Free → Pro conversion: >10%
- Pro → Teams conversion: >5%
- Average revenue per user (ARPU): $15/month
- Lifetime value (LTV): $180 (12 months)
- Customer acquisition cost (CAC): <$30 (LTV/CAC = 6)

---

## Conclusion

### Why This Design Wins

**1. Simpler Architecture**
- GPT-5 mini function calling replaces 72,000 lines of custom code
- 500 lines of tool definitions vs. 3-layer DAG orchestration
- OpenAI maintains complexity, you maintain features

**2. Better Economics**
- $0.0065 per query (GPT-5 mini) vs. $0.10+ (custom architecture)
- 70% cache hit rate → $49/month for 1000 daily queries
- 90% prompt caching discount → Aggressive cost optimization

**3. Faster Iteration**
- New feature = new tool (10 lines of code)
- No DAG redesign, no execution graph validation
- Ship features in hours, not weeks

**4. Stronger Product**
- Focuses on **user problems** (dropped balls, anxiety) not **tech problems** (orchestration)
- Proactive alerts > Reactive search
- Commitment tracking > Folder organization
- Peace of mind > Inbox zero

### Key Takeaways

Your current architecture is **impressive engineering** but **over-engineered** for the problem.

The modern approach:
- ✅ Accomplishes all 700+ use cases
- ✅ 10x simpler to build & maintain
- ✅ 10x cheaper to run
- ✅ Ships in weeks, not months

**Final Recommendation:**
- Keep your current codebase as a **portfolio piece** (shows system design skills)
- Build the **new version** with GPT-5 mini function calling for **shipping a product**
- Use learnings from v1 to make v2 exceptional

The best engineers know when **not** to build. Let OpenAI handle orchestration. You focus on solving user problems.

---

**Next Steps:**
1. Validate user pain points (interview 10 potential users)
2. Prototype smart inbox in 1 week (React Native + GPT-5 mini)
3. Beta test with 50 users
4. Iterate based on feedback
5. Launch publicly

**Questions to Consider:**
- Who is your primary user persona? (Executive vs. Founder vs. Freelancer)
- What's the #1 pain point to solve first? (Dropped balls vs. Inbox overload)
- Freemium or paid-only? (Recommendation: Freemium with 50 query/day limit)
- Mobile-only or multi-platform? (Start mobile, expand to desktop)

Want me to dive deeper into any section? Or start prototyping the MVP?
