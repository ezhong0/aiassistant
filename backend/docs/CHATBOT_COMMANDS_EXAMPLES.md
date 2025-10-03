# Email & Calendar Intelligence: Essential Query Library

## Document Purpose

This document catalogs the queries users **actually need** to manage their email and calendar effectively. Focus is on the 80/20 - the 20% of queries that solve 80% of user pain points.

**Core insight**: Users don't want analytics about their email behavior. They want to **quickly find what matters** and **avoid dropping balls**.

---

## Current API Support Status

✅ **Currently Supported by Codebase:**
- **Labels**: Full Gmail label management (create, update, delete, add/remove from emails)
- **Meeting Accept/Decline**: Calendar invite responses via `respondToEvent()` function
- **Basic Email Management**: Send, reply, forward, search, drafts, mark read/unread
- **Calendar Management**: Create, update, delete events, find available times
- **Email Threading**: Get full email conversation threads
- **Attachment Handling**: Upload and download email attachments

❌ **Not Currently Supported (Post-MVP):**
- **Snooze/Boomerang**: No scheduled email resurfacing functionality
- **Automatic Unsubscribe**: No newsletter/sender subscription management
- **Advanced Reminders**: No smart reminder scheduling or patterns
- **Smart Organization**: No AI-powered auto-categorization

⚠️ **Implementation Priority**: Focus on the core read/write commands below first. Advanced features marked "POST-MVP" require additional infrastructure for scheduled processing, AI-powered organization, and complex reminder workflows.

---

## The Essential Categories

### Read Commands (Queries)
1. [What Needs My Attention Right Now](#what-needs-my-attention-right-now)
2. [Did I Drop the Ball?](#did-i-drop-the-ball)
3. [What Am I Forgetting?](#what-am-i-forgetting)
4. [Finding Specific Things](#finding-specific-things)
5. [Calendar & Meeting Queries](#calendar--meeting-queries)
6. [Context Recovery](#context-recovery)
7. [Cross-Account Queries](#cross-account-queries)

### Write Commands (Actions)
8. [Email Replies & Responses](#email-replies--responses)
9. [Email Management Actions](#email-management-actions)
10. [Calendar & Meeting Actions](#calendar--meeting-actions)
11. [Bulk Operations](#bulk-operations)

### Post-MVP Advanced Features (Future Roadmap)
12. [Follow-Up & Reminder Actions](#follow-up--reminder-actions)
13. [Advanced Email Management](#advanced-email-management)
14. [Advanced Calendar Features](#advanced-calendar-features)

---

## What Needs My Attention Right Now

**The #1 user pain point: "I have 200 emails. What actually matters?"**

### Urgent & Time-Sensitive

```
"What needs my attention today?"
"Show me urgent emails"
"What emails are time-sensitive?"
"Show me emails with deadlines this week"
"Find emails marked important or urgent"
"What's actually urgent vs. fake urgent?"
"Show me emails that need a response by end of day"
```

### From Important People

```
"Show me emails from my manager"
"What did the CEO send?"
"Emails from clients"
"Show me emails from my team"
"What did the board send me?"
"Emails from [specific person]"
"Show me external emails" (vs. internal noise)
```

### Waiting on Me

```
"What emails am I blocking people on?"
"Show me where people are waiting for my response"
"What questions haven't I answered?"
"Find emails asking me to do something"
"Show me requests I haven't responded to"
"What emails have 'following up' or 'checking in'?"
```

### High-Impact Items

```
"Show me emails about [important project]"
"What came in about the deal/launch/event?"
"Emails mentioning budget or money"
"Show me contract or legal emails"
"Find emails with invoices or payment requests"
"What came in about hiring or firing?"
```

---

## Did I Drop the Ball?

**The #2 pain point: "Did I forget to respond to someone important?"**

### Unanswered Emails

```
"What emails haven't I responded to?"
"Show me unanswered emails from this week"
"Find emails I've been ignoring for 3+ days"
"What haven't I replied to from clients?"
"Show me unanswered emails from my boss"
"Find unanswered questions"
"What emails am I leaving people hanging on?"
```

### Multiple Follow-Ups (Bad Sign)

```
"Show me emails where someone followed up multiple times"
"Find 'second reminder' or 'third try' emails"
"What emails have 'still waiting' or 'haven't heard back'?"
"Show me people who emailed me twice with no response"
"Find frustrated follow-ups" (people getting annoyed)
```

### Threads That Went Silent

```
"Show me conversations that died after my last message"
"Find threads where I responded and got no reply"
"What discussions just stopped?"
"Show me threads that went quiet after I asked a question"
```

### From Specific People

```
"Have I responded to Sarah recently?"
"When did I last email [person]?"
"Show me unanswered emails from [specific person]"
"Did I ever reply to [person's] question about X?"
"What's outstanding with the client?"
```

---

## What Am I Forgetting?

**The #3 pain point: "What did I commit to that I haven't done?"**

### Commitments & Promises

```
"What did I say I'd do?"
"Show me emails where I said 'I'll handle this'"
"Find places where I said 'I'll get back to you'"
"What did I promise to send/do/deliver?"
"Show me commitments from the last 2 weeks"
"Find emails where I agreed to something"
```

### With Deadlines

```
"What commitments have deadlines this week?"
"Show me promises I made with specific due dates"
"What's due today that I committed to?"
"Find 'by Friday' or 'by end of week' commitments"
"Show me overdue commitments"
```

### Never Followed Up

```
"What did I say I'd do but never did?"
"Show me 'I'll get back to you' emails where I never got back"
"Find promises I made over a week ago with no follow-up"
"What action items did I never complete?"
"Show me things I said I'd send but never sent"
```

### Meeting Action Items

```
"What did I commit to in meetings this week?"
"Show me action items from meeting notes"
"Find todos from calendar event descriptions"
"What am I supposed to deliver based on meetings?"
"Show me meeting follow-ups I haven't done"
```

---

## Finding Specific Things

**The #4 pain point: "I know I got an email about X, but I can't find it"**

### By Person

```
"Show me emails from John"
"Find all emails from anyone at Acme Corp"
"What did Sarah send me about the project?"
"Show me emails from [specific person] from last month"
"Find the last email from my accountant"
```

### By Topic/Project

```
"Find emails about the product launch"
"Show me everything about Project Phoenix"
"What emails mention the budget?"
"Find emails about hiring"
"Show me emails related to the conference"
"Find all discussion about the vendor contract"
```

### By Content Type

```
"Show me emails with attachments"
"Find emails with PDFs"
"Show me emails with contracts"
"Find emails with calendar invites"
"Show me emails with links to documents"
"Find emails with presentations or spreadsheets"
```

### By Time + Context

```
"Find emails from January about Q4 planning"
"Show me what came in while I was on vacation"
"What emails did I get last week about the client meeting?"
"Find the email thread from 2 months ago about pricing"
"Show me emails from before the reorg about my role"
```

### Recent Lookups

```
"What came in today?"
"Show me this week's emails"
"What did I get this morning?"
"Find emails from the last hour"
"Show me yesterday's emails"
"What came in over the weekend?"
```

---

## Calendar & Meeting Queries

**The #5 pain point: "What's on my calendar and am I prepared?"**

### Basic Schedule

```
"What's on my calendar today?"
"Show me tomorrow's meetings"
"What meetings do I have this week?"
"What's my schedule for Friday?"
"Show me next week's calendar"
"What do I have scheduled this afternoon?"
```

### Specific Meeting Info

```
"When is my meeting with Sarah?"
"What time is the product review?"
"Where is the all-hands meeting?"
"Who's invited to the budget meeting?"
"What's the Zoom link for my 2pm?"
"When is the client call?"
```

### Availability

```
"Am I free Tuesday at 2pm?"
"When am I available this week?"
"Show me open time slots tomorrow"
"When can I schedule a 1-hour meeting?"
"Do I have any free time on Thursday?"
"What's my first available slot next week?"
```

### Meeting Preparation

```
"What meetings do I have today that I'm not prepared for?"
"Show me meetings with no agenda"
"What emails relate to my 2pm meeting?"
"Find background on tomorrow's client call"
"What did we discuss last time we met?" (with specific person/group)
"Show me previous emails with today's meeting attendees"
```

### Meeting Types

```
"What 1:1s do I have this week?"
"Show me external meetings" (vs. internal)
"Find all-hands or large meetings"
"What recurring meetings do I have?"
"Show me client meetings this month"
"Find meetings I'm hosting vs. attending"
```

### Conflicts & Issues

```
"Do I have any double-booked time?"
"Show me calendar conflicts"
"Find back-to-back meetings with no break"
"What meetings overlap?"
"Show me days that are completely packed"
```

---

## Context Recovery

**The #6 pain point: "I need to get up to speed quickly on something"**

### Thread History

```
"Catch me up on the Johnson project"
"What's been happening with the vendor negotiation?"
"Summarize emails about the product launch"
"What's the latest on [project/topic]?"
"Give me context on the client situation"
"What happened in the budget discussion?"
```

### Decisions Made

```
"What was decided about pricing?"
"Show me where we decided to move forward"
"Find the email where we chose the vendor"
"What did we agree on for the timeline?"
"Show me decisions from the Q4 planning emails"
```

### Last Contact

```
"When did I last talk to [person]?"
"What was our last conversation about?"
"Show me the last email exchange with the client"
"When did I last meet with [person]?"
"What did we discuss in our last meeting?"
```

### Getting CC'd Mid-Thread

```
"Catch me up on this thread"
"What happened before I was added?"
"Summarize this conversation"
"Why was I added to this email?"
"What's the context here?"
```

### Status Updates

```
"What's the status of [project]?"
"Where are we on [topic]?"
"Has anyone responded to my question about X?"
"What's the latest update on [issue]?"
"Show me recent activity on [project]"
```

---

## Cross-Account Queries

**The #7 pain point: "I have work, personal, and side-project emails - I need to see everything"**

### Unified View

```
"Show me all emails from today" (across all accounts)
"What needs my attention across all accounts?"
"Show me everything from Sarah" (she emails me at multiple addresses)
"Find all emails about [topic]" (across work and personal)
"What emails am I blocking people on?" (all accounts)
```

### Account-Specific

```
"Show me work emails only"
"What personal emails need responses?"
"Find emails in my consulting account"
"Show me side-project emails"
"What came to my volunteer email?"
```

### Cross-Account People

```
"Show me all emails from [person] across all accounts"
"Find everyone who emails me at multiple addresses"
"What emails did clients send to wrong address?"
"Show me people who mix work and personal email"
```

### Calendar Across Accounts

```
"Show me all meetings today" (work + personal)
"Do I have conflicts between calendars?"
"What's my full schedule across all calendars?"
"Find double-bookings between work and personal"
"Show me personal appointments during work hours"
```

---

## The Power of Combinations

**The real magic: Combining simple queries into complex ones**

### Time + People

```
"Show me unanswered emails from clients this week"
"What did my boss send me today that I haven't responded to?"
"Find emails from Sarah in the last 3 days"
"Show me what the team sent while I was out"
```

### Time + Topic

```
"Find emails about the launch from this month"
"Show me budget emails from Q4"
"What came in about hiring this week?"
"Find contract discussions from January"
```

### People + Status

```
"What have I not responded to from VIPs?"
"Show me unanswered emails from external contacts"
"Find ignored emails from my manager"
"What questions from clients haven't I answered?"
```

### Topic + Status

```
"What emails about the project am I blocking people on?"
"Show me unanswered questions about the budget"
"Find ignored emails about the deadline"
"What commitments about the launch haven't I followed up on?"
```

### Meeting + Email

```
"What emails relate to today's meetings?"
"Show me background for tomorrow's client call"
"Find action items from last week's meetings"
"What emails mention my 2pm meeting?"
```

---

## Email Replies & Responses

**The #1 write action: "Send a quick response without switching apps"**

### Simple Confirmations & Acknowledgments

```
"Reply to Jeff saying yes"
"Tell Sarah I got it"
"Reply to the client saying thanks"
"Tell Mike I agree"
"Respond to Lisa saying sounds good"
"Reply saying I'm on it"
"Tell them I received the document"
"Reply to John confirming"
```

### Quick Declines

```
"Reply to the meeting invite saying I can't make it"
"Tell them I'm not available"
"Decline the calendar invite"
"Reply saying I'll have to pass"
"Tell them I'm booked"
"Politely decline the invitation"
```

### Scheduling Responses

```
"Reply to Jeff saying I can meet him at 2pm"
"Tell Sarah I'm free Tuesday afternoon"
"Respond saying Thursday at 3pm works for me"
"Reply saying any time next week is fine"
"Tell them I'm available Monday or Wednesday"
"Respond with my availability this week"
"Reply saying let's do 10am tomorrow"
```

### Information Requests

```
"Reply asking for more details"
"Ask them to send the document"
"Reply asking when they need this by"
"Ask for the meeting agenda"
"Reply asking who else will be there"
"Ask them to clarify what they need"
"Reply asking for the deadline"
```

### Status Updates

```
"Reply saying I'm working on it"
"Tell them it'll be ready by Friday"
"Respond saying I'm halfway done"
"Reply with a status update on the project"
"Tell them I'm running a day behind"
"Respond saying it's been sent to legal"
"Reply saying I'm waiting on approval"
```

### Simple Answers

```
"Reply to their question saying [answer]"
"Tell them the budget is $50k"
"Respond saying the deadline is next Tuesday"
"Reply that the meeting is at 3pm in Conference Room B"
"Tell them John is handling that"
"Respond saying check the shared drive"
"Reply with the document link"
```

### Apologies & Delays

```
"Apologize for the delay and say I'll respond tomorrow"
"Reply saying sorry, I missed this"
"Tell them I apologize and I'm on it now"
"Respond apologizing and asking for an extension"
"Reply saying sorry for the late response"
"Tell them I apologize, I was out sick"
```

### Complex Responses (AI-Assisted)

```
"Draft a reply to the client explaining why we're behind schedule"
"Write a response declining the meeting but offering alternatives"
"Reply to John's proposal with my concerns about the timeline"
"Draft an email explaining the budget constraints to the team"
"Write a response to the complaint addressing each point they raised"
"Reply to the vendor pushing back on their pricing"
"Draft a diplomatic response to the difficult client"
```

### Follow-Up Responses

```
"Reply saying I'll follow up tomorrow"
"Tell them I'll get back to them by end of week"
"Respond saying I need to check with the team first"
"Reply saying let me look into this and circle back"
"Tell them I'll send details after the meeting"
"Respond saying I'll have an answer Monday"
```

### Forwarding & Delegating

```
"Forward this to Sarah and ask her to handle it"
"Send this to the team with context"
"Forward to Mike saying he should take this"
"Send this to legal for review"
"Forward to my assistant asking them to schedule it"
"Send this to [person] and say they're the expert"
```

### Reply All vs. Individual

```
"Reply all saying I agree"
"Reply just to Jeff saying let's discuss offline"
"Reply all with the updated numbers"
"Reply only to Sarah about this"
"Reply all confirming the meeting time"
"Reply just to the sender"
```

---

## Email Management Actions

**The #2 write action: "Clean up my inbox without manual clicking"**

### Archiving

```
"Archive this email"
"Archive all emails from this sender"
"Archive everything from today's newsletters"
"Move this thread to archive"
"Archive all emails about [completed project]"
"Archive everything older than 30 days that I've read"
"Clean up my inbox - archive what's done"
```

### Categorizing & Labeling ✅

```
"Label this as urgent"
"Tag this email as [project name]"
"Mark this as important"
"Add this to my 'client communications' folder"
"Label all emails from this client"
"Categorize this as 'needs review'"
"Flag this for follow-up"
```

### Snoozing & Reminders ⚠️ Post-MVP

```
"Snooze this until tomorrow"
"Remind me about this on Monday"  
"Snooze this for 3 days"
"Bring this back next week"
"Remind me about this before the meeting"
"Snooze until I have time to deal with it"
"Show me this again on Friday"
```

### Unsubscribing & Filtering ⚠️ Post-MVP

```
"Unsubscribe from this newsletter"
"Block emails from this sender"
"Create a filter to auto-archive these"
"Stop getting emails from this mailing list"  
"Auto-archive future emails from this sender"
"Unsubscribe from all marketing emails"
"Block this domain"
```

### Marking & Organizing

```
"Mark this as read"
"Mark all emails from today as read"
"Star this email"
"Move this to spam"
"Mark as not spam"
"Pin this to the top of my inbox"
"Move this to [folder]"
```

### Delegation & Sharing

```
"Share this with my team"
"Give Sarah access to this thread"
"Forward all emails about [topic] to Mike"
"CC my assistant on future emails from this client"
"Share this calendar invite with the team"
```

---

## Calendar & Meeting Actions

**The #3 write action: "Schedule, reschedule, or cancel without app-switching"**

### Creating Meetings

```
"Schedule a meeting with Jeff tomorrow at 2pm"
"Set up a 30-minute call with Sarah next Tuesday"
"Create a team meeting for Thursday at 10am"
"Schedule a 1:1 with Mike next week"
"Book a conference room for Monday at 3pm"
"Set up a client call for Friday afternoon"
"Schedule recurring weekly check-ins with the team"
```

### With Details

```
"Schedule a meeting with Jeff tomorrow at 2pm, title it 'Budget Review', invite Sarah too"
"Create a 1-hour planning meeting next Monday at 10am with the entire team"
"Set up a call with the client next Wednesday at 2pm, include the Zoom link"
"Schedule a working session with Mike for Thursday afternoon, add 'Needs prep' to the description"
"Book Conference Room A for tomorrow at 3pm for the product review"
```

### Rescheduling

```
"Move my 2pm meeting to 4pm"
"Reschedule tomorrow's call to next week"
"Push my meeting with Jeff to Thursday"
"Move all of today's meetings to tomorrow"
"Reschedule the 10am to any time this afternoon"
"Change Tuesday's meeting to Wednesday same time"
```

### Proposing Times

```
"Ask Jeff if he can do 2pm or 4pm tomorrow"
"Propose three meeting times to the client this week"
"Send Sarah my availability for next week"
"Ask when they're free for a 30-minute call"
"Offer meeting slots on Tuesday or Thursday"
```

### Canceling

```
"Cancel my 2pm meeting"
"Cancel all meetings for tomorrow"
"Decline the team standup"
"Cancel today's 1:1 with Sarah"
"Remove me from the product review meeting"
"Cancel recurring meeting with Mike"
```

### Accepting & Declining ✅

```
"Accept the meeting invite"
"Decline the all-hands and say I'm in a client meeting"
"Accept tentatively and ask for the agenda"
"Decline and suggest an alternative time"
"Accept the invite and ask who else is coming"
```

### Meeting Details Updates

```
"Add Zoom link to my 2pm meeting"
"Update the meeting agenda to include budget discussion"
"Add Sarah to tomorrow's planning meeting"
"Change the meeting location to Conference Room B"
"Add notes to the meeting: 'Review Q4 numbers'"
"Update the meeting description with prep materials"
```

### Quick Additions

```
"Add this to my calendar"
"Block 2 hours tomorrow afternoon for focus time"
"Add a reminder for Friday at 9am"
"Put 'Call the client' on my calendar for tomorrow"
"Block my calendar for the conference next week"
"Add travel time before my offsite meeting"
```

---

## Bulk Operations

**The #4 write action: "Clean up or act on multiple things at once"**

### Batch Archiving

```
"Archive all newsletters from today"
"Archive all read emails from this week"
"Archive everything from [completed project]"
"Archive all automated emails"
"Archive all emails older than 3 months"
"Clean up all recruiting emails"
"Archive everything from [sender] from last month"
```

### Batch Responses

```
"Reply to all unanswered emails from clients saying I'll respond tomorrow"
"Send a quick 'got it' to everyone waiting on me"
"Decline all meeting invites for Friday"
"Accept all calendar invites from my manager"
"Reply to all outstanding emails with a status update"
```

### Batch Organization

```
"Label all emails from this client as 'Acme Corp'"
"Star all emails from my direct reports"
"Mark all emails from today as read"
"Move all project emails to the project folder"
"Flag all emails mentioning deadlines"
"Categorize all emails from vendors"
```

### Batch Unsubscribe

```
"Unsubscribe from all newsletters I haven't opened in 3 months"
"Stop all promotional emails"
"Unsubscribe from all daily digest emails"
"Block all marketing emails"
"Remove me from all automated reports I don't read"
```

### Batch Calendar Actions

```
"Decline all meetings tomorrow afternoon"
"Accept all recurring 1:1s"
"Cancel all meetings while I'm on vacation"
"Move all of today's meetings to tomorrow"
"Decline all optional meetings this week"
```

---

## Follow-Up & Reminder Actions

**The #5 write action: "Don't let me forget important things"**

⚠️ **POST-MVP FEATURE**: These commands require scheduled background processing and advanced reminder infrastructure.

### Setting Follow-Up Reminders

```
"Remind me to follow up with Jeff if I don't hear back by Friday"
"Set a reminder to check on this next week"
"Follow up on this in 3 days if no response"
"Remind me about this before the deadline"
"Ping me if the client doesn't respond by tomorrow"
"Check back on this thread in a week"
```

### Boomerang-Style Actions

```
"Bring this back to my inbox if no reply in 2 days"
"Follow up automatically if they don't respond by Monday"
"Resurface this on Friday if still unread"
"Remind me about this commitment next week"
"Bring this back before the meeting"
```

### Commitment Tracking

```
"Remind me that I promised to send this by Friday"
"Track this commitment and alert me before the deadline"
"Make sure I follow up on what I said I'd do"
"Don't let me forget I agreed to review this"
"Keep track of my promise to call them back"
```

### Proactive Nudges

```
"Remind me if I haven't responded to Sarah by tomorrow"
"Alert me if this becomes urgent"
"Notify me if they follow up again"
"Warn me if a deadline is approaching"
"Remind me if I haven't prepared for this meeting"
```

### Recurring Follow-Ups

```
"Check in with this client every Monday"
"Remind me to send weekly updates to the team"
"Monthly reminder to review this project"
"Quarterly follow-up with this contact"
"Remind me to reach out to them every 2 weeks"
```

---

## Advanced Email Management

⚠️ **POST-MVP FEATURES**: These require advanced email processing capabilities.

### Snooze & Boomerang Features

```
"Snooze this until tomorrow"
"Bring this back to my inbox next week"
"Snooze until Friday morning"
"Delay this email until Monday"
"Hide this for 3 days"
"Resurface this when I'm back from vacation"
```

### Advanced Labeling & Organization

```
"Smart sort my inbox"
"Auto-label emails from clients as 'client communications'"
"Move meeting emails to 'meetings' folder"
"Categorize emails by project automatically"
"Label urgent emails with red priority"
"Create smart labels based on email patterns"
```

### Smart Unsubscribe & Filtering

```
"Unsubscribe from newsletters I don't read"
"Auto-archive promotional emails"
"Block emails from this domain"
"Create filters for all automated reports"
"Stop emails from this mailing list"
"Set up smart filters to reduce inbox noise"
```

---

## Advanced Calendar Features

⚠️ **POST-MVP FEATURES**: These require more sophisticated calendar scheduling logic.

### Smart Meeting Features

```
"Accept meeting and add it to my calendar"
"Decline meeting but propose better times"
"Accept tentatively and ask for agenda"
"Auto-decline meetings during lunch hour"
"Suggest meeting alternatives if conflicted"
"Auto-accept meetings from my manager"
```

### Recurring Reminder Patterns

```
"Remind me every Monday to check on project status"
"Weekly reminder to send team updates"
"Monthly reminder to review client accounts"
"Quarterly calendar cleanup reminder"
"Daily standup preparation reminder"
"Recurring reminder for expense reports"
```

### Smart Scheduling Intelligence

```
"Schedule meetings when everyone's available"
"Find optimal meeting times across time zones"
"Avoid scheduling meetings back-to-back"
"Block focus time automatically after meetings"
"Suggest shorter meeting durations"
"Auto-detect and prevent double-bookings"
```

---

## Complex Write Commands (AI-Assisted)

**The hardest actions: Multi-step operations requiring intelligence**

### Context-Aware Drafting

```
"Draft a professional decline to this meeting, referencing my conflict"
"Write a response addressing all three questions they asked"
"Compose a follow-up email recapping what we discussed"
"Draft an update email for the team covering the key decisions"
"Write a client-ready response explaining the delay"
"Compose an email introducing Sarah to Mike for the collaboration"
```

### Tone & Style Adjustments

```
"Reply saying no but make it sound positive"
"Write a firm but polite response pushing back on their timeline"
"Draft a warm follow-up that doesn't sound pushy"
"Compose a professional apology that takes responsibility"
"Write an enthusiastic acceptance"
"Draft a diplomatic response to their complaint"
```

### Information Synthesis

```
"Reply with a summary of what we've decided so far"
"Write an email compiling everyone's feedback"
"Draft a response with the status of all open items"
"Compose an update email covering the last month's progress"
"Write a recap email of today's meeting for the team"
"Draft an email answering their questions based on our previous discussions"
```

### Multi-Step Actions

```
"Reply to Jeff confirming 2pm, then add it to my calendar, and set a reminder to prepare"
"Decline this meeting, propose alternative times, and send my availability"
"Archive all these emails, unsubscribe from the sender, and create a filter"
"Reply to the client, CC my manager, and create a follow-up task"
"Accept the meeting, ask for the agenda, and block prep time before it"
```

### Smart Scheduling

```
"Find a time that works for me, Sarah, and Jeff next week and send invites"
"Schedule a meeting with the team when everyone's available"
"Find the next time I have a 2-hour block and schedule deep work"
"Coordinate a meeting with external stakeholders based on everyone's calendars"
"Schedule 1:1s with all my direct reports next week"
```

### Intelligent Batch Actions

```
"Reply to all unanswered client emails with appropriate status updates"
"Decline all conflicting meetings and propose alternatives"
"Follow up with everyone I said I'd get back to but haven't"
"Send reminders to everyone waiting on action items from me"
"Update all affected stakeholders about the timeline change"
```

---

## Implementation Priority for Write Commands

### Phase 1: Simple Actions (Weeks 1-4)
Basic write commands that require minimal AI:

```
✓ Simple replies: "Reply saying yes/no/thanks"
✓ Basic archiving: "Archive this email"
✓ Simple scheduling: "Schedule a meeting at [time]"
✓ Basic marking: "Mark as read", "Star this"
✓ Calendar actions: "Accept/decline meeting"
```

### Phase 2: AI-Assisted Drafts (Weeks 5-8)
Actions requiring AI to compose text:

```
✓ Complex replies: "Reply declining and proposing alternatives"
✓ AI drafts: "Draft a response addressing their concerns"
✓ Status updates: "Reply with project status"
✓ Tone-aware responses: "Reply firmly but politely"
✓ Context synthesis: "Reply summarizing what we decided"
```

### Phase 3: Multi-Step Actions (Weeks 9-12)
Compound operations requiring multiple steps:

```
✓ Chained actions: "Reply and schedule a follow-up meeting"
✓ Smart scheduling: "Find time that works for everyone and send invites"
✓ Bulk intelligent actions: "Reply to all clients with appropriate updates"
✓ Conditional reminders: "Follow up if no response in 2 days"
✓ Complex workflows: "Decline, propose times, and update my availability"
```

---

## Write Command Success Criteria

### Every write command must:

1. **Preview before sending** (for email replies) - User sees draft and can approve/edit
2. **Confirm destructive actions** - "Archive 47 emails - are you sure?"
3. **Be undoable** - "Undo last action" for recent commands
4. **Show what happened** - "Sent reply to Jeff", "Meeting scheduled for 2pm"
5. **Fail gracefully** - Clear error messages if something goes wrong
6. **Handle ambiguity** - Ask clarifying questions when needed

### Red flags for write commands:

- Sends email without showing user first
- Can't undo destructive actions
- Silently fails without telling user
- Misinterprets intent and does wrong action
- No confirmation for bulk operations
- Can't handle "actually, don't send that"

---

## The Read → Write Flow

**The killer feature: Seamless transition from query to action**

### Natural Query-to-Action Sequences

```
User: "What emails haven't I responded to from clients?"
AI: [Shows 5 emails]
User: "Reply to the first one saying I'll have this ready by Friday"
AI: [Shows draft] → User approves → Sent
```

```
User: "Show me calendar conflicts tomorrow"
AI: [Shows 2 overlapping meetings]
User: "Move the 2pm to Thursday"
AI: "Moved to Thursday at 2pm. Updated attendees notified."
```

```
User: "What did I commit to this week?"
AI: [Shows 3 commitments, one overdue]
User: "Send an update to Sarah about the overdue one"
AI: [Drafts apology + status update] → User edits → Sent
```

### Context Carries Forward

The AI remembers what you were just looking at:

```
User: "Show me emails from my boss"
AI: [Shows 5 emails]
User: "Reply to the one about budget saying I'm working on it"
AI: [Knows which thread, drafts reply]
```

```
User: "What meetings do I have tomorrow?"
AI: [Shows 4 meetings]
User: "Cancel the 10am one"
AI: [Knows which meeting, cancels it]
```

### Bulk Actions from Query Results

```
User: "Show me all newsletters from today"
AI: [Shows 12 newsletters]
User: "Archive all of them"
AI: "Archived 12 emails. Undo?"
```

```
User: "Find all unanswered emails from this week"
AI: [Shows 8 emails]
User: "Reply to all of them saying I'll respond by Monday"
AI: [Shows 8 drafts for review]
```

---

## What NOT to Build for Write Commands

### Fully Automated Actions (Too Risky)

```
❌ Auto-reply to emails without user approval
❌ Auto-archive emails based on "learning your behavior"
❌ Auto-decline meetings without confirmation
❌ Auto-send scheduled follow-ups without review
❌ Auto-create calendar events from email mentions
```

**Why not?** Users need control. Email and calendar mistakes are embarrassing and costly. Always preview, always allow editing, always get confirmation.

### Complex Workflow Automation (Too Early)

```
❌ "Automatically reschedule conflicts and notify everyone"
❌ "Auto-respond to common questions based on my previous replies"
❌ "Smart auto-forwarding based on topic detection"
❌ "Predictive email composition before user asks"
```

**Why not?** These are advanced features that require near-perfect accuracy. Build the basics first, add automation later once you prove reliability.

### Ambiguous Commands (Too Hard)

```
❌ "Handle my inbox" (what does this mean?)
❌ "Deal with the client situation" (too vague)
❌ "Fix my calendar" (unclear intent)
❌ "Clean everything up" (too broad)
```

**Why not?** Users need to be specific about actions. If the command is ambiguous, ask clarifying questions rather than guessing.

---

## Success Metrics for Write Commands

### What matters:

- **Draft acceptance rate**: How often users approve AI-generated drafts without major edits (target 80%+)
- **Action completion rate**: Commands that successfully complete (target 95%+)
- **Time saved**: Time from intent to completion vs. manual (target 50% faster)
- **Error rate**: Commands that do the wrong thing (target <2%)
- **Undo usage**: How often users undo actions (lower is better, target <5%)

### Don't measure:

- ❌ Total number of write commands available
- ❌ Average command complexity
- ❌ Longest successful command
- ❌ Number of parameters per command

---

## The Competitive Advantage for Write Commands

**Gmail/Outlook can do:**
- Basic compose and send
- Calendar creation
- Simple quick replies

**Gmail/Outlook struggle with:**
- Natural language commands: "Reply declining but propose alternatives"
- Context-aware drafting: "Draft a response addressing all their concerns"
- Multi-step operations: "Reply confirming, schedule it, and remind me to prepare"
- Cross-account actions: "Schedule a meeting and send invite from my work account"
- Intelligent bulk operations: "Reply to all clients with appropriate status updates"

**Your advantage**: Commands that require **understanding context, composing intelligent responses, and executing multi-step workflows** through simple natural language.

The magic is users can stay in the chat interface - they don't have to switch to Gmail, compose, format, send. They just say what they want done, review the draft, approve. Done.

### Phase 1: Must-Have (Weeks 1-4)
These solve the biggest pain points:

```
✓ "What needs my attention?"
✓ "What emails haven't I responded to?"
✓ "Show me emails from [person]"
✓ "Find emails about [topic]"
✓ "What's on my calendar today?"
✓ "Catch me up on [thread/topic]"
```

### Phase 2: High Value (Weeks 5-8)
These prevent ball-dropping:

```
✓ "What did I commit to?"
✓ "Show me where people are waiting on me"
✓ "What meetings am I not prepared for?"
✓ "Find emails I've been ignoring for 3+ days"
✓ "What decisions were made about X?"
```

### Phase 3: Differentiation (Weeks 9-12)
These are hard for competitors:

```
✓ Cross-account unified queries
✓ Thread synthesis and summarization
✓ Commitment tracking with deadlines
✓ Meeting context + email background
✓ "What am I forgetting?" proactive detection
```

---

## Query Success Criteria

### Every query must:

1. **Return accurate results** (95%+ precision)
2. **Be fast** (<3 seconds for simple, <5 seconds for complex)
3. **Be actionable** (user can do something with the results)
4. **Be unambiguous** (clear what the results mean)
5. **Handle edge cases** (no account, no results, stale data, etc.)

### Red flags that indicate problems:

- Query returns emails the user definitely responded to
- Query misses obvious results
- Query is too slow to be useful
- Results are confusing or require explanation
- Query fails silently or gives wrong answer

---

## What NOT to Build

### Analytics Queries (Users Don't Care)

```
❌ "What's my average response time?"
❌ "Who do I email most frequently?"
❌ "What percentage of emails are newsletters?"
❌ "Show me my email volume patterns"
❌ "What time of day do I respond fastest?"
```

**Why not?** Users don't want to analyze their behavior - they want to **get things done**.

### Behavioral Insights (Not Useful)

```
❌ "What emails do I typically ignore?"
❌ "Show me patterns in what I archive"
❌ "Find my communication style trends"
❌ "What types of subject lines do I open fastest?"
```

**Why not?** Interesting data, but doesn't help users accomplish their goals.

### Network Analysis (Too Abstract)

```
❌ "Who are the connectors in my network?"
❌ "Show me information brokers"
❌ "Find my most well-connected contacts"
❌ "What topics spread through my network?"
```

**Why not?** Users just want to know if they've responded to Sarah, not analyze their social graph.

### Predictive Queries (Premature)

```
❌ "What emails will likely need follow-up tomorrow?"
❌ "Show me threads that might go silent"
❌ "What commitments am I likely to miss?"
```

**Why not?** Could be valuable eventually, but only after you nail the basic queries. Don't predict - just show what's actually happening.

---

## User Testing Framework

### For each query, test with real users:

1. **Give them a scenario**: "You just got back from vacation and have 200 emails"
2. **Watch what they ask**: Do they actually use this query?
3. **Check if it helps**: Did the query solve their problem?
4. **Measure speed to action**: How fast did they go from query to taking action?
5. **Note follow-up queries**: What did they ask next?

### Good signs:

- User uses query multiple times per day
- User immediately acts on results (replies, archives, schedules)
- User saves the query for repeated use
- User shows query to coworkers saying "look at this"

### Bad signs:

- User tries query once and never again
- User confused by results
- User says "that's interesting" but takes no action
- Query too slow, user gives up waiting

---

## The Real Competitive Advantage

**Gmail/Outlook can do**: Basic search by sender, subject, date

**Gmail/Outlook struggle with**:
- "What emails am I blocking people on?" (requires understanding waiting state)
- "What did I commit to?" (requires parsing commitments from natural language)
- "Catch me up on this project" (requires thread synthesis across multiple emails)
- "Show me everything across all my accounts" (they each only see one account)
- "What meetings am I not prepared for?" (requires connecting calendar + email context)

**Your advantage**: Queries that require **understanding context, relationships, and commitments** across multiple accounts and data sources.

---

## Success Metrics

### Usage Metrics (What matters)

- **Daily active queries**: Target 5+ per user per day
- **Query success rate**: User gets what they needed (target 90%+)
- **Time to action**: Query → action in <30 seconds (target 80% of queries)
- **Saved queries**: Users save queries they use repeatedly (target 3+ per user)
- **Cross-account adoption**: Users connect multiple accounts (target 70%+)

### Don't measure (Vanity metrics)

- ❌ Total number of queries available
- ❌ Average query length
- ❌ Query complexity score
- ❌ Number of results returned

---

## Conclusion

**The winning formula**: 
1. **Nail the top 20 queries** that solve real pain points
2. **Make them fast and accurate** (speed + precision)
3. **Enable natural combinations** (time + people + topic)
4. **Focus on action**, not analytics

Users don't want to analyze their email behavior. They want to:
- **Quickly find** what matters
- **Avoid dropping** balls
- **Remember** commitments
- **Get context** fast

If you can do these four things across multiple accounts better than Gmail/Outlook, you have a product worth paying for.

**The test**: Can a user come back from vacation, have 200 emails across 3 accounts, and in 60 seconds know exactly what needs their attention? That's the product.

---

## Post-MVP Development Roadmap

### Phase 1: Core Features (Current Focus)
Focus on the essential queries and basic write actions that directly address user pain points:

✅ **Read Commands**: All query categories (1-7)
✅ **Write Commands**: Email replies, basic management, calendar actions, bulk ops (8-11)

### Phase 2: Advanced Infrastructure (Future)
Build the infrastructure needed for intelligent automation:

⚠️ **Scheduled Processing**: Background job system for reminders
⚠️ **AI Organization**: Smart categorization and automations  
⚠️ **Advanced Reminders**: Boomerang-style email management
⚠️ **Smart Scheduling**: Intelligent meeting coordination

### Phase 3: Competitive Differentiation (Long-term)
Features that create strong competitive moats:

⚠️ **Cross-Account Intelligence**: Unified insights across all email providers
⚠️ **Predictive Features**: Proactive notification of deadlines and commitments
⚠️ **Natural Language Growth**: Support for increasingly complex commands
⚠️ **Workflow Automation**: Multi-step business process automation

The key is to nail Phase 1 first - proven user value with simple, reliable commands. Then build advanced features on top of that foundation.