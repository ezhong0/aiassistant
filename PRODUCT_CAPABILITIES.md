# Product Capabilities: What the AI Assistant Must Do

This document defines the core capabilities the AI assistant must have to serve independent consultants. This is the technical reference for what the product needs to be able to execute.

---

## Core Design Principles

1. **Natural Language First:** No forms, dropdowns, or structured inputs. Consultants describe what they want in plain English.
2. **Context-Aware:** The AI understands conversation history, client relationships, project stages, and urgency.
3. **Preview-Based Confirmation:** Show what will happen before it happens. Different preview levels based on risk.
4. **Multi-Step Workflows:** Single commands can trigger complex sequences (respond → schedule → confirm).
5. **Gmail/Calendar/Contacts Only (MVP):** No external dependencies. Work with what consultants already use.

---

## 1. Email Capabilities (Gmail API)

### 1.1 Email Retrieval & Search

**What it must do:**
- Search emails by sender, recipient, subject, date range, keywords
- Retrieve full conversation threads (not just individual emails)
- Identify email type (inquiry, proposal follow-up, client update, meeting request)
- Extract context: who is the sender, what's the relationship, what's the history
- Find attachments and their types

**Example commands:**
- "Show me all emails from Sarah Johnson"
- "Find all proposals I sent in the last 30 days"
- "Search for emails about the TechCo project"
- "Show me all unanswered inquiries from this week"
- "Find emails with proposals waiting for response over 5 days"

**Technical requirements:**
- Gmail API: `users.messages.list()`, `users.messages.get()`, search queries
- Thread-aware: group emails by conversation thread
- Extract metadata: sender, recipient, date, subject, labels
- Parse email bodies (handle HTML, plain text, quoted replies)

---

### 1.2 Email Drafting & Sending

**What it must do:**
- Draft personalized emails based on context (relationship stage, conversation history, industry)
- Match tone to situation (professional for inquiries, warm for past clients, consultative for proposals)
- Include relevant details (meeting times, project specifics, next steps)
- Handle replies vs new emails (threading, subject lines, references)
- Personalize at scale (bulk operations with individual customization)

**Example commands:**
- "Respond to this inquiry offering discovery call times"
- "Follow up with all open proposals asking about decision timeline"
- "Send project update to Acme Corp about Phase 1 completion"
- "Draft thank you email to client after successful project"
- "Send check-in to 20 past clients I haven't talked to in 6 months - personalize by industry"

**Technical requirements:**
- Gmail API: `users.messages.send()`, `users.drafts.create()`
- Generate email content using LLM (Claude/GPT-4)
- Construct proper email format (headers, threading, reply-to)
- Handle CC/BCC
- Support both new emails and replies to existing threads

**Personalization variables:**
- Recipient name, company, industry
- Relationship context (new lead, active client, past client)
- Conversation history (what have we discussed?)
- Calendar availability (for scheduling)
- Project details (phase, deliverables, timeline)

---

### 1.3 Email Analysis & Intelligence

**What it must do:**
- Classify email intent (inquiry, question, request, update, casual check-in)
- Identify urgency (hot lead, time-sensitive request, casual nurture)
- Extract action items (needs response, needs scheduling, needs follow-up)
- Track communication patterns (who responds quickly, who needs follow-up)
- Identify opportunities (warm leads ready to engage, referral opportunities)

**Example commands:**
- "Show me all inquiries that need immediate response"
- "Which proposals are most likely to close based on email engagement?"
- "List all clients I haven't contacted in 90+ days"
- "Identify emails that need follow-up this week"
- "Analyze response rates from cold outreach last month"

**Technical requirements:**
- LLM analysis of email content and patterns
- Sentiment analysis (positive, neutral, negative)
- Engagement tracking (response time, email length, back-and-forth frequency)
- Relationship scoring (hot, warm, cold based on interaction patterns)

---

## 2. Calendar Capabilities (Google Calendar API)

### 2.1 Availability Checking

**What it must do:**
- Check consultant's availability across multiple calendars
- Identify open time slots by duration (30 min, 60 min, etc.)
- Respect working hours and time zones
- Handle recurring events and blocked time
- Suggest optimal meeting times (not back-to-back, buffer time)

**Example commands:**
- "When am I free this week for discovery calls?"
- "Find 3 time slots tomorrow afternoon for a 1-hour meeting"
- "Check my availability next week - need to schedule 5 client check-ins"
- "Do I have any conflicts on Friday?"
- "Show me my schedule for next week"

**Technical requirements:**
- Google Calendar API: `calendars.list()`, `events.list()`, `freebusy.query()`
- Parse all calendars (primary + secondary)
- Calculate free slots based on business hours (default 9am-6pm, configurable)
- Handle time zones (consultant's TZ vs client's TZ)
- Buffer time between meetings (default 15 min)

---

### 2.2 Event Creation & Management

**What it must do:**
- Create calendar events with proper details (title, description, attendees)
- Send calendar invitations to participants
- Add video conferencing links (Google Meet, Zoom if configured)
- Handle recurring meetings (weekly check-ins, monthly reviews)
- Update existing events (reschedule, add attendees, change details)
- Delete/cancel events and notify participants

**Example commands:**
- "Schedule discovery call with Sarah tomorrow at 2pm"
- "Book weekly check-in with Acme Corp every Monday at 10am"
- "Add project kickoff meeting next Tuesday at 3pm with CEO and CTO"
- "Reschedule Friday's meeting with TechCo to next week"
- "Cancel Wednesday's call and notify attendee"

**Technical requirements:**
- Google Calendar API: `events.insert()`, `events.update()`, `events.delete()`
- Generate proper event structure (summary, description, start, end, attendees)
- Send calendar invitations (attendees get email notification)
- Add video conferencing (Google Meet integration)
- Handle attendee responses and conflicts

**Event details format:**
```
Title: Discovery Call - [Client Name]
Description:
- Discuss [topic/project]
- Review [specific items if mentioned]
- Next steps
Duration: 30 or 60 minutes (inferred or specified)
Attendees: [client email]
Video: Google Meet link (auto-generated)
```

---

### 2.3 Calendar Analysis & Coordination

**What it must do:**
- Analyze meeting patterns (how many meetings per week, busy days)
- Identify scheduling conflicts (double-booked, overlapping)
- Calculate billable vs non-billable time
- Suggest optimal scheduling (batch discovery calls, protect deep work time)
- Coordinate multiple meetings (find time that works for multiple people)

**Example commands:**
- "How many meetings do I have next week?"
- "When am I most free for client calls this month?"
- "Find time that works for me and 3 other people for a workshop"
- "Show me my billable hours last week"
- "Block out deep work time every morning 9-11am"

**Technical requirements:**
- Aggregate calendar data across date ranges
- Calculate meeting density and patterns
- Multi-calendar coordination (check availability across multiple calendars)
- Time blocking (create focus time/buffer events)

---

## 3. Contact Capabilities (Google Contacts API)

### 3.1 Contact Retrieval & Search

**What it must do:**
- Search contacts by name, email, company, job title
- Retrieve full contact details (email, phone, company, notes)
- Identify contact type based on history (lead, prospect, client, past client, referral partner)
- Search by labels/groups (if consultant uses them)
- Handle multiple emails per contact

**Example commands:**
- "Find contact info for Sarah Johnson"
- "Show me all contacts at TechCo"
- "Get email for the CTO at Acme Corp"
- "Find all contacts labeled 'Active Client'"
- "Show me everyone I've worked with in SaaS industry"

**Technical requirements:**
- Google Contacts API: `people.list()`, `people.get()`, `people.searchContacts()`
- Parse contact fields (name, email, phone, organization, notes)
- Search across multiple fields (fuzzy matching)
- Handle contact groups/labels
- Deduplicate contacts (same person, multiple entries)

---

### 3.2 Contact Analysis & Segmentation

**What it must do:**
- Classify contacts by relationship stage (lead, prospect, active, past client)
- Identify high-value contacts (revenue, engagement, referral potential)
- Track communication frequency (last contact date, total emails)
- Segment by attributes (industry, project type, geographic region)
- Identify stale relationships (no contact in 90+ days)

**Example commands:**
- "Show me all past clients I haven't contacted in 6 months"
- "List all active project clients"
- "Find all leads from Q1 that never converted"
- "Show me contacts in fintech industry"
- "Which clients have I emailed most in the last 30 days?"

**Technical requirements:**
- Combine contact data with email history (Gmail search)
- Calculate last contact date (most recent email sent/received)
- Infer relationship stage from communication patterns and keywords
- Store/retrieve custom metadata (industry, project type, relationship stage)
- Segment contacts based on multiple criteria

---

### 3.3 Contact Enrichment & Context

**What it must do:**
- Maintain context about each contact (what they hired for, project outcomes, referral source)
- Track communication preferences (email vs phone, response times)
- Store relationship notes (personal details, business goals, challenges)
- Link contacts to projects/engagements
- Identify referral relationships (who introduced who)

**Example commands:**
- "What did I work on with Sarah at TechCo?"
- "Show me all projects with Acme Corp"
- "Who referred this new lead?"
- "What's the communication history with this contact?"
- "Find all clients who hired me for marketing strategy"

**Technical requirements:**
- Parse email threads for project context
- Extract metadata from email content (project names, deliverables, outcomes)
- Store custom contact fields (beyond default Google Contacts schema)
- Link contacts to calendar events (who meets with whom)
- Build relationship graph (referrals, introductions, co-workers)

---

## 4. Natural Language Understanding

### 4.1 Command Parsing & Intent Recognition

**What it must do:**
- Parse natural language commands into structured actions
- Identify primary intent (respond, schedule, follow up, search, update)
- Extract entities (names, dates, times, email addresses, companies)
- Handle ambiguity and ask clarifying questions
- Understand multi-step commands (respond AND schedule)

**Example commands and their parsed intents:**

| Command | Primary Intent | Entities | Sub-Actions |
|---------|---------------|----------|-------------|
| "Respond to Sarah's inquiry about marketing strategy" | RESPOND | Person: Sarah, Topic: marketing strategy | Find email, check calendar, draft response |
| "Follow up with all proposals sent last 2 weeks" | BULK_FOLLOW_UP | Time: last 2 weeks, Type: proposals | Search emails, filter, draft personalized follow-ups |
| "Schedule discovery call with TechCo CEO tomorrow at 2pm" | SCHEDULE | Company: TechCo, Role: CEO, Time: tomorrow 2pm | Find contact, create event, send invitation |
| "Send project update to Acme Corp about Phase 1 completion" | SEND_UPDATE | Company: Acme Corp, Context: Phase 1 done | Find contacts, draft update, send email |

**Technical requirements:**
- LLM-based intent classification (Claude/GPT-4 with structured output)
- Named entity recognition (dates, times, names, companies)
- Relationship resolution (Sarah = Sarah Johnson at TechCo based on context)
- Slot filling (if details missing, ask follow-up questions)
- Multi-intent handling (single command triggers multiple actions)

---

### 4.2 Context Awareness & Memory

**What it must do:**
- Remember conversation history within session (what was just discussed)
- Maintain long-term context about clients, projects, relationships
- Infer missing information from context (pronoun resolution, implicit references)
- Learn patterns and preferences (consultant's communication style, scheduling habits)
- Use context to personalize responses and actions

**Context types:**

**Conversation context (short-term):**
- "Respond to this inquiry" → AI knows which email from previous message
- "Send that to all active clients" → AI knows "that" refers to previously drafted message
- "Schedule with her tomorrow" → AI knows "her" refers to person mentioned earlier

**Relationship context (long-term):**
- Sarah Johnson = past client, hired for marketing strategy, project completed Q4 2024
- TechCo = SaaS company, 3 projects completed, active retainer client
- This is a hot lead = responded within 1 hour, asked detailed questions, high intent

**Behavioral context (learned):**
- Consultant prefers morning meetings for discovery calls
- Typical response style: warm but professional, 2-3 sentences
- Always follows up on proposals after 3 days and 7 days
- Prefers video calls for new clients, phone for quick check-ins

**Technical requirements:**
- Session-based conversation history (store in Redis, expire after 1 hour)
- Long-term context storage (PostgreSQL: contacts, projects, communication patterns)
- LLM context window management (include relevant history without exceeding token limits)
- Pattern learning from historical data (analyze past emails, meetings, behaviors)

---

### 4.3 Clarification & Confirmation

**What it must do:**
- Detect ambiguous or incomplete commands
- Ask clarifying questions naturally
- Present options when multiple interpretations exist
- Confirm high-stakes actions before executing
- Handle corrections gracefully ("actually, send it tomorrow not today")

**Example clarification flows:**

```
User: "Respond to this inquiry"
AI: "I see Sarah is asking about marketing strategy for a SaaS company.
     Should I offer discovery call times or ask qualifying questions first?"
User: "Offer times"
AI: "You're available Wednesday 2-4pm and Thursday 10am-3pm.
     Should I suggest both windows?"
User: "Yes"
AI: [Shows drafted email preview]
```

```
User: "Follow up with all open proposals"
AI: "I found 8 open proposals from the last 30 days:
     - 3 sent within last week (too early?)
     - 5 sent 7-30 days ago (ready for follow-up)
     Should I follow up with just the 5 older ones?"
User: "Yes, only the older ones"
AI: [Proceeds with personalized follow-ups]
```

**Technical requirements:**
- Confidence scoring (if confidence < 70%, ask for clarification)
- Multiple choice presentations (show options, let user pick)
- Incremental information gathering (ask one question at a time)
- Handle corrections mid-flow (don't start over, just update the detail)

---

## 5. Multi-Step Workflow Execution

### 5.1 Lead Response Workflow

**Command:** "New inquiry from Sarah about marketing strategy - respond and offer discovery call times this week"

**What the system must do:**
1. **Identify the inquiry email**
   - Search for recent email from Sarah
   - If multiple Sarahs, ask for clarification (Sarah Johnson? Sarah Lee?)
   - Extract inquiry content and context

2. **Check calendar availability**
   - Find open slots this week (30 or 60 min, based on "discovery call" = typically 30 min)
   - Prefer mornings/afternoons based on learned preferences
   - Get 2-3 time options

3. **Draft personalized response**
   - Thank for inquiry
   - Show understanding of their need (marketing strategy)
   - Offer specific times (not "when are you available")
   - Warm but professional tone
   - Include next steps (booking, prep questions)

4. **Show preview for approval**
   - Display drafted email
   - Allow edits or immediate send
   - If user says "send", execute

5. **Send email**
   - Send via Gmail API (reply to thread)
   - Confirm delivery
   - Store in conversation history

6. **Set follow-up reminder** (optional)
   - If no response in 2 days, remind consultant to follow up

**Technical flow:**
```
User command → Parse intent (RESPOND + SCHEDULE_AVAILABILITY) →
Search email (find Sarah's inquiry) → Check calendar (find times) →
Generate response with LLM (use email context + calendar times) →
Preview (show to user) → User approves → Send email (Gmail API) →
Confirm success
```

---

### 5.2 Proposal Follow-Up Workflow

**Command:** "Follow up with all proposals sent in last 2 weeks that haven't gotten responses"

**What the system must do:**
1. **Search for proposal emails**
   - Search Gmail for sent emails containing "proposal" or "scope of work" or "pricing"
   - Filter to last 14 days
   - Check if there's been a reply (thread has >1 message)
   - Identify proposals without responses

2. **Segment by urgency/temperature**
   - High value proposals (>$20K mentioned) = priority
   - Recent proposals (sent <7 days ago) = gentle follow-up
   - Older proposals (sent 7-14 days ago) = more assertive follow-up

3. **Draft personalized follow-ups**
   - Reference specific proposal details (project name, scope, timeline)
   - Different message tone based on age:
     - 3-7 days: "Just checking in, do you have any questions about the proposal?"
     - 7-14 days: "Want to make sure you received the proposal. Any concerns I can address?"
   - Include call-to-action (schedule call to discuss, request feedback)

4. **Show preview with list**
   - Display all follow-ups to be sent (recipient, preview of message)
   - Allow batch approval or individual edits
   - User can remove specific follow-ups from batch

5. **Send all follow-ups**
   - Send as reply to original proposal thread
   - Stagger sends (don't send all at once, space out by 2-3 min)
   - Confirm deliveries

6. **Track follow-up status**
   - Mark as "followed up" (store metadata)
   - Set reminder for next follow-up (7 days later if still no response)

**Technical flow:**
```
User command → Parse intent (BULK_FOLLOW_UP) →
Search sent emails (filter by keywords, date, no reply) →
Segment proposals (by value, age, response likelihood) →
Generate personalized follow-ups (LLM with proposal context) →
Preview batch (show all, allow edits) → User approves →
Send all (Gmail API, threaded replies, staggered) →
Confirm success + set reminders
```

---

### 5.3 Client Meeting Coordination Workflow

**Command:** "Schedule quarterly business reviews with all retainer clients this month"

**What the system must do:**
1. **Identify retainer clients**
   - Search contacts labeled "retainer" or "active client"
   - Or: infer from email history (recurring payments, monthly check-ins)
   - Or: ask user to specify which clients

2. **Check availability**
   - Find open time slots this month
   - Prefer 60-90 min slots for QBR (longer than normal meetings)
   - Aim for even distribution (not all in one week)

3. **Draft meeting invitations**
   - Personalized subject: "Q1 Business Review - [Client Name]"
   - Include agenda:
     - Review progress/results from last quarter
     - Discuss goals for next quarter
     - Address any challenges
     - Plan next steps
   - Request time confirmation or alternative times

4. **Send invitations**
   - Email invitation with calendar event attached
   - Or: send email first asking for time preference, then create event

5. **Handle responses**
   - If client confirms time, create calendar event
   - If client requests different time, find alternative and resend
   - Track confirmation status

**Technical flow:**
```
User command → Parse intent (BULK_SCHEDULE) →
Identify target contacts (retainer clients) →
Check calendar availability (60-90 min slots this month) →
Generate personalized invitations (LLM with client context) →
Preview batch (show all, allow edits) → User approves →
Send invitations (email + calendar events) →
Monitor responses → Handle confirmations/reschedules
```

---

### 5.4 Past Client Re-Engagement Workflow

**Command:** "Check in with past clients I haven't talked to in 6 months - personalize by industry"

**What the system must do:**
1. **Identify past clients**
   - Search contacts marked as "past client" or infer from email history
   - Filter to those with last communication >180 days ago
   - Exclude any with negative outcomes (project canceled, poor fit)

2. **Segment by industry**
   - Group by industry (SaaS, e-commerce, B2B services, etc.)
   - Or: ask user to specify industries if not stored

3. **Draft personalized check-ins**
   - Reference past project: "Hope things are going well since we wrapped up [project name]"
   - Industry-specific hook: "Noticed [industry trend], thought of you"
   - Soft re-engagement: "Would love to hear how things are going. Open to catching up if useful."
   - NO hard sell, just relationship nurture

4. **Show preview with list**
   - Display all check-ins grouped by industry
   - Show level of personalization (references to past work, industry trends)
   - Allow edits or removal

5. **Send check-ins**
   - Send as individual emails (not bulk CC)
   - Stagger sends (space out over several days to avoid spam impression)
   - Track opens and responses (if possible)

**Technical flow:**
```
User command → Parse intent (BULK_NURTURE) →
Identify past clients (contact data + email history analysis) →
Filter by last contact date (>6 months) →
Segment by industry → Generate personalized messages (LLM with context) →
Preview batch (grouped by industry) → User approves →
Send staggered (Gmail API, individual sends) →
Confirm success
```

---

## 6. Intelligence & Analysis Capabilities

### 6.1 Opportunity Identification

**What it must do:**
- Identify warm leads ready to re-engage (replied to initial outreach, went quiet)
- Flag proposals likely to close (high engagement, asked detailed questions)
- Detect referral opportunities (happy clients, successful projects, strong relationships)
- Find upsell opportunities (completed projects, clients growing, new needs mentioned)
- Highlight at-risk clients (communication drop-off, missed meetings, tone changes)

**Example insights:**
- "3 proposals sent 7+ days ago have had no follow-up - high priority"
- "Sarah at TechCo mentioned scaling challenges in last email - potential upsell"
- "5 past clients from 2023 haven't been contacted - re-engagement opportunity"
- "Acme Corp project completed successfully, good candidate for testimonial/referral ask"

**Technical requirements:**
- Email sentiment analysis (detect enthusiasm, concern, disengagement)
- Engagement scoring (response speed, email length, question quality)
- Pattern recognition (identify behaviors that precede closes/churn)
- Proactive suggestions (surface opportunities without being asked)

---

### 6.2 Communication Pattern Analysis

**What it must do:**
- Track response rates by email type (inquiry response, proposal, follow-up, check-in)
- Measure proposal-to-close conversion (how many proposals sent, how many accepted)
- Analyze optimal follow-up timing (when do prospects typically respond)
- Identify best-performing messages (which emails get highest response)
- Benchmark communication volume and distribution (how many emails per day/week)

**Example insights:**
- "Your inquiry response rate is 85% when sent within 1 hour, 40% after 24 hours"
- "Proposals followed up after 5 days have 60% higher close rate than no follow-up"
- "Warm leads that receive value content (not sales) re-engage 3x more"
- "You send 45 emails/week on average, 60% are client updates, 25% are new outreach"

**Technical requirements:**
- Track email metadata (sent time, response time, thread length)
- Correlate actions with outcomes (follow-up → response, proposal → close)
- Statistical analysis of patterns across time
- Visualization of trends (response rate over time, proposal pipeline)

---

### 6.3 Relationship Health Scoring

**What it must do:**
- Score each contact/client relationship (healthy, at-risk, dormant)
- Factors: communication frequency, recency, sentiment, engagement
- Alert when relationships degrade (went from weekly contact to nothing)
- Suggest relationship maintenance actions (check-in, value share, referral request)
- Prioritize relationship nurture (which relationships need attention most)

**Relationship health factors:**
```
HEALTHY:
- Last contact: <30 days
- Communication frequency: consistent (weekly or bi-weekly)
- Sentiment: positive (satisfied, engaged)
- Engagement: responds quickly, asks questions, shares updates

AT-RISK:
- Last contact: 30-90 days
- Communication frequency: declining (was weekly, now monthly)
- Sentiment: neutral (short responses, transactional)
- Engagement: delayed responses, minimal interaction

DORMANT:
- Last contact: >90 days
- Communication frequency: none
- Sentiment: N/A (no recent interaction)
- Engagement: none
```

**Example insights:**
- "Acme Corp relationship is at-risk: communication dropped from weekly to 45 days ago"
- "3 past clients are dormant but had successful projects - good re-engagement candidates"
- "Sarah at TechCo is a healthy relationship: frequent contact, positive sentiment, high engagement"

**Technical requirements:**
- Calculate relationship score from multiple signals
- Track score over time (trending up or down)
- Alert thresholds (notify when score drops below X)
- Suggested actions based on score (nurture, re-engage, maintain)

---

## 7. Bulk Operations & Personalization

### 7.1 Personalized Mass Communication

**What it must do:**
- Send personalized emails to 10-100+ recipients in a single command
- Personalize beyond just name: include industry, past project, specific details
- Use natural language data sources (spreadsheet, list in command, infer from contacts)
- Maintain individual threading (not group emails, individual 1:1 messages)
- Stagger sends to avoid spam appearance

**Example commands:**
- "Send quarterly update to all active clients mentioning their specific project"
- "Email these 50 leads [attach CSV] using this template [paste] with personalization"
- "Send holiday greetings to all contacts mentioning how we worked together"
- "Check in with all SaaS clients about recent industry regulation change"

**Personalization levels:**

**Level 1: Basic (name, company)**
```
Hi [Name],

Hope things are going well at [Company]...
```

**Level 2: Relationship context**
```
Hi Sarah,

Hope things are going well since we wrapped up the marketing strategy project for TechCo...
```

**Level 3: Deep personalization**
```
Hi Sarah,

Hope the new product launch at TechCo is going well! I remember you mentioned targeting enterprise
customers this quarter. I came across [relevant insight for SaaS companies targeting enterprise]...
```

**Technical requirements:**
- Parse bulk data sources (CSV, list in text, contact labels)
- Map data fields to personalization variables
- Generate individual messages with unique content (not just mail merge)
- Send staggered (2-3 min between sends to avoid rate limits)
- Track which messages were sent and delivery status

---

### 7.2 Template Management (Optional)

**What it must do:**
- Allow consultants to provide templates for common messages
- Support variable insertion (name, company, project, date, etc.)
- Use templates as starting point, then personalize with AI
- Learn from consultant's writing style to generate template-like consistency

**Template types:**
```
INQUIRY_RESPONSE:
"Hi [Name], thanks for reaching out about [topic]. I'd love to learn more.
I have availability for a discovery call on [times]. What works for you?"

PROPOSAL_FOLLOW_UP:
"Hi [Name], wanted to check in on the proposal I sent for [project] on [date].
Do you have any questions I can answer? Happy to schedule a call to discuss."

CLIENT_UPDATE:
"Hi [Name], quick update on [project]: [progress]. Next steps: [actions].
Let me know if you have any questions!"
```

**Technical requirements:**
- Store templates (in database, versioned)
- Parse template variables (identify placeholders like [Name], [Project])
- Fill variables from context (contact data, email history, calendar)
- Allow override (user can specify variable values in command)
- Generate new content that matches template structure and tone

---

## 8. Preview & Confirmation System

### 8.1 Risk-Based Preview Levels

**What it must do:**
- Determine preview level based on action risk
- Execute low-risk actions immediately (searches, calendar checks)
- Show preview for medium-risk actions (single emails, meeting creation)
- Require detailed approval for high-risk actions (bulk sends, pricing discussions)

**Preview levels:**

**IMMEDIATE EXECUTION (no preview):**
- Search/retrieval: "Find contact info", "Show emails from Sarah", "What's my schedule"
- Analysis: "How many proposals open?", "Who needs follow-up?"
- Calendar checks: "Am I free tomorrow?", "When is my next meeting?"

**QUICK PREVIEW (show draft, 1-click approve):**
- Single email responses: Show full email draft, user says "send" or makes edits
- Meeting creation: Show event details, user approves
- Single contact updates: Show what will change

**DETAILED APPROVAL (must review each item):**
- Bulk emails (10+ recipients): Show list of recipients and preview of each message
- First-time contact: "This is the first time emailing [person], please review"
- High-stakes content: Anything mentioning pricing, contracts, project terms

**Preview format example:**
```
📧 Ready to send to Sarah Johnson (sarah@techco.com)

Subject: Re: Marketing strategy inquiry

[Full email draft shown here]

From: [Your email]
To: sarah@techco.com
Subject: Re: Marketing strategy inquiry

Hi Sarah,

Thanks for reaching out about marketing strategy support for TechCo...

[rest of email]

---
✅ Send now | ✏️ Edit message | ❌ Cancel
```

**Technical requirements:**
- Risk scoring algorithm (classify action by risk level)
- Preview rendering (show formatted email, calendar event, contact update)
- Approval handling (wait for user confirmation before executing)
- Edit support (allow inline edits to draft before sending)
- Batch approval (approve all, approve individually, reject some)

---

### 8.2 Edit & Refinement

**What it must do:**
- Allow inline edits to drafted messages before sending
- Handle refinement commands ("make it more casual", "add a line about X")
- Regenerate portions while keeping rest intact
- Support multiple revision rounds without losing context
- Learn from edits (if user always changes X, start including it)

**Example refinement flow:**
```
AI: [Shows drafted email]
User: "Make the tone more casual and mention I saw their product launch"
AI: [Regenerates with adjustments, shows new draft]
User: "Perfect, send it"
AI: [Sends email]
```

**Technical requirements:**
- Store draft state (allow modifications without re-generating from scratch)
- Parse refinement instructions (identify what to change)
- Incremental regeneration (only regenerate changed parts)
- Version history (allow undo if refinement made it worse)
- Learning loop (track user edits, incorporate into future generations)

---

## 9. Integration & Data Sync

### 9.1 Gmail API Integration

**What it must support:**
- OAuth 2.0 authentication (user grants access to their Gmail)
- Read emails (inbox, sent, all folders)
- Send emails (as user, from their address)
- Search emails (by any criteria)
- Manage threads (reply in thread, not new email)
- Handle attachments (download, reference, include in responses)
- Respect rate limits (batch operations, handle quotas)

**Technical requirements:**
- Gmail API scopes: `gmail.readonly`, `gmail.send`, `gmail.modify`
- Token management (refresh tokens, handle expiration)
- Error handling (rate limits, quota exceeded, authentication errors)
- Webhook support (receive new emails in real-time via push notifications)

---

### 9.2 Google Calendar API Integration

**What it must support:**
- OAuth 2.0 authentication
- Read all calendars (primary + secondary)
- Create/update/delete events
- Check free/busy status
- Send calendar invitations
- Add video conferencing (Google Meet)
- Handle multiple time zones
- Respect rate limits

**Technical requirements:**
- Calendar API scopes: `calendar.readonly`, `calendar.events`
- Handle multiple calendars (aggregate free/busy across all)
- Event creation with attendees (send invitations)
- Google Meet integration (auto-generate meeting links)
- Time zone handling (convert between consultant TZ and client TZ)

---

### 9.3 Google Contacts API Integration

**What it must support:**
- OAuth 2.0 authentication
- Read contacts (all fields)
- Search contacts (by name, email, company)
- Create/update contacts (if needed)
- Handle contact groups/labels
- Respect rate limits

**Technical requirements:**
- People API scopes: `contacts.readonly`, `contacts` (if write needed)
- Parse contact data (names, emails, phones, organizations, notes)
- Search with fuzzy matching (handle typos, partial names)
- Contact deduplication (merge multiple entries for same person)
- Custom fields (store additional metadata like industry, relationship stage)

---

## 10. Error Handling & Reliability

### 10.1 Delivery Confirmation

**What it must do:**
- Confirm email was sent successfully (Gmail API response)
- Confirm calendar event was created and invitations sent
- Notify user if delivery fails (API error, authentication issue, rate limit)
- Retry failed operations (with exponential backoff)
- Provide clear error messages ("Email to Sarah failed: authentication expired")

**Delivery tracking:**
- Email sent: ✅ "Email sent to Sarah Johnson"
- Email failed: ❌ "Email to Sarah Johnson failed: [reason]. Retry?"
- Calendar event created: ✅ "Meeting scheduled with Sarah on March 15 at 2pm"
- Calendar failed: ❌ "Failed to create meeting: [reason]"

**Technical requirements:**
- Check API response status (200 = success, 4xx/5xx = error)
- Store operation status (pending, completed, failed)
- Retry logic (exponential backoff: wait 1s, 2s, 4s, 8s before retrying)
- User notifications (alert on failure, show success confirmations)

---

### 10.2 Data Consistency & Sync

**What it must do:**
- Keep local data in sync with Gmail/Calendar/Contacts
- Handle conflicts (user modifies in Gmail while AI is processing)
- Cache intelligently (don't re-fetch unchanged data)
- Invalidate cache when changes occur
- Handle eventual consistency (accept that data may be slightly stale)

**Technical requirements:**
- Webhook support (Gmail push notifications for new emails)
- Incremental sync (only fetch changes since last sync)
- Conflict resolution (last-write-wins or user-confirmation)
- Cache invalidation (clear cache on user action or webhook trigger)
- Eventual consistency acceptance (some lag is okay, prioritize reliability)

---

### 10.3 Failure Recovery

**What it must do:**
- Handle API outages gracefully (Gmail/Calendar temporarily unavailable)
- Queue operations that can't complete immediately
- Resume interrupted workflows (user closes app mid-workflow)
- Preserve user data (drafted emails, scheduled sends)
- Provide clear status ("Gmail is currently unavailable, will retry in 5 min")

**Technical requirements:**
- Message queue (Redis, RabbitMQ) for asynchronous operations
- Persistent storage (save draft state, pending operations)
- Background workers (process queued operations)
- Health checks (monitor API availability)
- User notifications (inform about issues and resolution)

---

## 11. Security & Privacy

### 11.1 Data Access & Storage

**What it must do:**
- Only access data consultant explicitly grants (OAuth scopes)
- Store minimal data (only what's needed for functionality)
- Encrypt sensitive data at rest (tokens, email content, contact info)
- Respect data retention policies (delete after N days if not needed)
- Provide data export (consultant can download their data)
- Provide data deletion (consultant can delete all their data)

**Data storage policies:**
- **Tokens:** Encrypted, stored securely, refreshed automatically
- **Emails:** Cache recent emails temporarily (7 days), don't store permanently
- **Contacts:** Sync from Google Contacts, don't duplicate permanently
- **Calendar:** Read in real-time, don't store events long-term
- **Conversation history:** Store for context (30 days), then archive or delete
- **Generated drafts:** Store temporarily (until sent or abandoned)

---

### 11.2 OAuth & Authentication

**What it must do:**
- Use OAuth 2.0 for all Google API access (never ask for passwords)
- Request minimum required scopes (don't ask for more than needed)
- Handle token expiration and refresh automatically
- Notify user when re-authentication is needed
- Revoke tokens on logout or account deletion

**Required OAuth scopes:**
- Gmail: `https://www.googleapis.com/auth/gmail.readonly`, `gmail.send`
- Calendar: `https://www.googleapis.com/auth/calendar.readonly`, `calendar.events`
- Contacts: `https://www.googleapis.com/auth/contacts.readonly`

---

### 11.3 Privacy & Compliance

**What it must do:**
- Never share consultant's data with third parties (except AI providers for processing)
- Use AI providers with strong privacy policies (Anthropic, OpenAI Enterprise)
- Don't train AI models on consultant's private data
- Comply with GDPR (for EU consultants), CCPA (for CA consultants)
- Provide transparency (what data is accessed, how it's used, how long it's stored)

**Privacy principles:**
- **Data minimization:** Only access what's needed
- **Purpose limitation:** Only use data for intended purpose (execute commands)
- **Transparency:** Clear disclosure of what data is accessed and why
- **User control:** Consultant can view, export, delete their data
- **No third-party sharing:** Data stays between consultant and assistant

---

## 12. Performance & Scalability

### 12.1 Response Time Targets

**What it must achieve:**
- **Search/retrieval:** <2 seconds (find emails, contacts, calendar events)
- **Email drafting:** <5 seconds (generate single personalized email)
- **Bulk operations:** <30 seconds for 50 emails (draft, not send)
- **Calendar operations:** <3 seconds (check availability, create event)
- **Workflow execution:** <10 seconds (end-to-end for simple workflows)

**Performance optimizations:**
- Cache frequently accessed data (contacts, recent emails)
- Parallel processing (check calendar while drafting email)
- Background processing (queue bulk operations, process asynchronously)
- Streaming responses (show partial results while generating)

---

### 12.2 Rate Limiting & Quotas

**What it must handle:**
- Gmail API: 250 quota units/user/second, 1 billion quota units/day
- Calendar API: 1 million requests/day, 5000 requests/100 seconds/user
- Contacts API: 600 requests/minute/user

**Rate limit handling:**
- Batch requests where possible (single API call for multiple items)
- Respect rate limits (track usage, slow down before hitting limit)
- Exponential backoff on rate limit errors (wait and retry)
- User notification if quota exceeded ("Daily quota reached, will resume tomorrow")

---

### 12.3 Scalability Considerations

**What the architecture must support:**
- 1,000 users at launch (MVP)
- 10,000 users at 12 months
- 100,000 users at 24 months
- Peak load: 1,000 concurrent users executing commands

**Scalability requirements:**
- Stateless backend (horizontal scaling, add more servers)
- Database scaling (read replicas, sharding if needed)
- Caching layer (Redis for session data, frequently accessed data)
- Background job processing (separate workers for async tasks)
- Load balancing (distribute requests across multiple servers)

---

## 13. What's NOT Supported (MVP)

### ❌ External System Dependencies

**Not supported in MVP (require integrations):**
- CRM systems (HubSpot, Pipedrive, Close)
- Project management tools (Asana, ClickUp, Notion)
- Document storage (Dropbox, Google Drive file management)
- Invoicing/accounting (QuickBooks, FreshBooks)
- Payment processing (Stripe, PayPal)
- Marketing automation (Mailchimp, ActiveCampaign)
- Slack/Teams (for team collaboration)
- Outlook/Microsoft 365 (different APIs)

**Why:** Each integration adds complexity, testing burden, and potential failure points. MVP focuses on Gmail + Calendar + Contacts only. Post-MVP can add integrations based on user demand.

---

### ❌ Advanced Features (Post-MVP)

**Not supported in MVP:**
- Automated workflows (trigger X when Y happens without user command)
- AI training on user data (learning custom patterns without explicit feedback)
- Multi-user collaboration (teams using shared assistant)
- Mobile app (MVP is Slack bot or web)
- Voice commands (Siri/Google Assistant integration)
- Browser extension (quick commands from Gmail UI)
- API access (for users to build custom integrations)
- Advanced analytics dashboard (visualize email patterns, proposal pipeline)

**Why:** These are valuable but not essential for core value proposition (save time on communication). Focus MVP on nailing the basics.

---

## Summary: Core Capabilities Checklist

**The MVP must be able to:**

✅ **Email:**
- Search emails by any criteria (sender, date, keywords, labels)
- Retrieve conversation threads with full context
- Draft personalized emails based on context (relationship, history, calendar)
- Send emails as replies or new threads
- Handle bulk personalized emailing (10-100+ recipients)

✅ **Calendar:**
- Check availability across all calendars
- Find optimal meeting times
- Create calendar events with invitations and video links
- Update and delete events
- Handle time zones and recurring meetings

✅ **Contacts:**
- Search contacts by name, email, company
- Retrieve full contact details
- Segment contacts by relationship stage, industry, engagement
- Track communication history and frequency

✅ **Natural Language:**
- Parse complex commands into structured actions
- Handle ambiguity and ask clarifying questions
- Maintain conversation context (short-term and long-term)
- Execute multi-step workflows from single commands

✅ **Intelligence:**
- Identify opportunities (proposals to follow up, warm leads, referral candidates)
- Analyze communication patterns (response rates, optimal timing)
- Score relationship health (healthy, at-risk, dormant)
- Provide proactive suggestions

✅ **Preview & Confirmation:**
- Risk-based preview levels (immediate, quick, detailed)
- Show drafts before sending
- Allow edits and refinements
- Batch approval for bulk operations

✅ **Reliability:**
- Confirm delivery of all actions
- Handle errors gracefully (retry, notify user)
- Recover from failures (queue, resume workflows)
- Maintain data consistency with Gmail/Calendar/Contacts

✅ **Security:**
- OAuth 2.0 authentication (never store passwords)
- Encrypt sensitive data
- Minimize data storage (only what's needed)
- Comply with privacy regulations (GDPR, CCPA)

---

**If the system can do all of the above, it delivers the core value proposition:**
**Save 8-10 hours/week on communication by executing natural language commands that automate repetitive email, calendar, and contact management workflows.**
