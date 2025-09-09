# AI Assistant MVP Specification

This document outlines the natural language inputs and ideal outputs for the AI Assistant Slack bot, targeting startup founders and early-stage teams. It covers core email and calendar functionalities, with additional commands relevant for an MVP or user needs as of September 07, 2025, 05:39 PM PDT.

## Product Overview

A conversational Slackbot that handles Gmail and Google Calendar management through natural language commands. Users can send emails, check their inbox, schedule meetings, and manage basic productivity tasks without leaving Slack.

**Target Users**: Startup founders and early-stage teams who live in Slack
**Core Value**: Zero-friction productivity management through conversational AI

## Inputs and Ideal Outputs

### 1. Send Email

**Input**: "send an email to john asking if he wants to have dinner at 8"

**Output**:
```
✅ Action Preview
Send Email: Dinner Invitation

To: john@example.com
Subject: Dinner Invitation
Content: Hi John, I hope this message finds you well. I wanted to see if you'd like to join me for dinner tonight at 8 PM. Let me know if you're available! Best, [Your Name]

Recipients: 1
Risk Level: LOW
Risk Factors: Standard email operation
Estimated Execution Time: 2-5 seconds
Reversible: No

Do you want to proceed with this action?
Reply with "yes" to confirm or "no" to cancel.
```

**Input**: "email the team about the 9 am meeting tomorrow"

**Output**:
```
✅ Action Preview
Send Email: Team Meeting Reminder

To: team@startup.com
Subject: Meeting Reminder
Content: Hi Team, Just a reminder about our meeting tomorrow at 9 AM. Looking forward to it! Best, [Your Name]

Recipients: 1
Risk Level: LOW
Risk Factors: Standard email operation
Estimated Execution Time: 2-5 seconds
Reversible: No

Do you want to proceed with this action?
Reply with "yes" to confirm or "no" to cancel.
```

### 2. List Pending Emails

**Input**: "what emails do i have to respond to still?"

**Output**:
```
📧 Pending Emails

From: jane@startup.com - Subject: Feedback on Pitch (received 3 hours ago)
From: investor@vc.com - Subject: Follow-up Call (received 1 day ago)
From: team@project.com - Subject: Update Needed (received 6 hours ago)

(Showing top 3. Use "show more" for additional emails.)
```

**Input**: "show more pending emails"

**Output**:
```
📧 Additional Pending Emails

From: partner@co.com - Subject: Proposal Review (received 2 days ago)
From: support@tool.com - Subject: Account Issue (received 4 hours ago)

(Showing all 5 pending emails.)
```

### 3. View Calendar

**Input**: "what is on my calendar today?"

**Output**:
```
📅 Today's Calendar (September 07, 2025)

10:00 AM - 11:00 AM: Team Standup
2:00 PM - 3:00 PM: Client Demo with ABC Corp
5:30 PM - 6:00 PM: Quick Sync with John

Nothing else scheduled.
```

**Input**: "what's on my calendar this week?"

**Output**:
```
📅 This Week's Calendar (September 07-13, 2025)

Mon 07: 10:00 AM - 11:00 AM: Team Standup
Mon 07: 2:00 PM - 3:00 PM: Client Demo with ABC Corp
Tue 08: 9:00 AM - 10:00 AM: Investor Update
Fri 12: 1:00 PM - 2:00 PM: Team Planning
```

### 4. Schedule Meeting

**Input**: "schedule a meeting with john at 7"

**Output**:
```
✅ Action Preview
Schedule Meeting

Title: Meeting with John
Time: 7:00 PM - 7:30 PM, September 07, 2025
Attendees: john@example.com

Risk Level: LOW
Risk Factors: Standard calendar operation
Estimated Execution Time: 2-5 seconds
Reversible: Yes (undo within 30 seconds)

Do you want to proceed with this action?
Reply with "yes" to confirm or "no" to cancel.
```

**Input**: "book a 30-minute call with jane tomorrow at 10"

**Output**:
```
✅ Action Preview
Schedule Meeting

Title: Call with Jane
Time: 10:00 AM - 10:30 AM, September 08, 2025
Attendees: jane@example.com

Risk Level: LOW
Risk Factors: Standard calendar operation
Estimated Execution Time: 2-5 seconds
Reversible: Yes (undo within 30 seconds)

Do you want to proceed with this action?
Reply with "yes" to confirm or "no" to cancel.
```

### 5. Cancel or Modify Events

**Input**: "cancel the meeting with john at 7"

**Output**:
```
❌ Action Preview
Cancel Meeting

Title: Meeting with John
Time: 7:00 PM - 7:30 PM, September 07, 2025
Attendees: john@example.com

Risk Level: LOW
Risk Factors: Standard calendar operation
Estimated Execution Time: 2-5 seconds
Reversible: No (after execution)

Do you want to proceed with this action?
Reply with "yes" to confirm or "no" to cancel.
```

**Input**: "reschedule the meeting with john to 8 pm"

**Output**:
```
✅ Action Preview
Reschedule Meeting

Original: Meeting with John, 7:00 PM - 7:30 PM, September 07, 2025
New: Meeting with John, 8:00 PM - 8:30 PM, September 07, 2025
Attendees: john@example.com

Risk Level: LOW
Risk Factors: Standard calendar operation
Estimated Execution Time: 2-5 seconds
Reversible: Yes (undo within 30 seconds)

Do you want to proceed with this action?
Reply with "yes" to confirm or "no" to cancel.
```

### 6. Additional Relevant Commands

**Input**: "send a follow-up email to investor about the pitch"

**Output**:
```
✅ Action Preview
Send Email: Follow-up on Pitch

To: investor@vc.com
Subject: Follow-up on Pitch Deck
Content: Hi [Investor Name], Just following up on the pitch deck I sent last week. Let me know if you have any feedback or questions! Best, [Your Name]

Recipients: 1
Risk Level: LOW
Risk Factors: Standard email operation
Estimated Execution Time: 2-5 seconds
Reversible: No

Do you want to proceed with this action?
Reply with "yes" to confirm or "no" to cancel.
```

*Note: Assumes "investor" is a resolved contact from prior emails.*

**Input**: "set a reminder for the demo at 1 pm"

**Output**:
```
✅ Action Preview
Set Reminder

Title: Demo Reminder
Time: 1:00 PM, September 07, 2025
Content: Reminder: Client Demo with ABC Corp starts soon!

Risk Level: LOW
Risk Factors: Standard calendar operation
Estimated Execution Time: 2-5 seconds
Reversible: Yes (undo within 30 seconds)

Do you want to proceed with this action?
Reply with "yes" to confirm or "no" to cancel.
```

**Input**: "what tasks do i have due today?"

**Output**:
```
📋 Today's Tasks

10:00 AM: Prepare for Team Standup
2:00 PM: Run Client Demo with ABC Corp
5:30 PM: Follow-up with John

(Based on calendar events. No separate task list yet.)
```

**Input**: "help" or "what can you do?"

**Output**:
```
🤖 AI Assistant Help

I can help with:

• Send emails (e.g., "send email to john about dinner at 8")
• List pending emails (e.g., "what emails do I have to respond to?")
• View calendar (e.g., "what's on my calendar today?")
• Schedule meetings (e.g., "schedule a meeting with john at 7")
• Cancel/reschedule events (e.g., "cancel the meeting with john")
• Set reminders (e.g., "set a reminder for the demo at 1 pm")
• List tasks (e.g., "what tasks do I have due today?")

Reply with a command to get started!
```

## Technical Requirements

### Slack Integration
- Slash commands for setup and configuration
- @mentions in channels and DMs for natural language commands
- Rich message formatting with structured previews
- Confirmation flows using reply messages
- Error handling with helpful user messages

### Gmail Integration
- OAuth 2.0 authentication with Gmail API
- Read inbox and sent items
- Send emails with proper formatting
- Contact resolution from previous emails
- Handle API rate limits gracefully

### Google Calendar Integration
- OAuth 2.0 authentication with Calendar API
- Read calendar events across timeframes
- Create, modify, and delete events
- Send calendar invitations to attendees
- Handle timezone considerations

### Natural Language Processing
- Intent recognition for all command types
- Entity extraction (contacts, times, dates, subjects)
- Context awareness for follow-up commands
- Ambiguity resolution with clarifying questions
- Smart defaults for missing information

## Implementation Notes

### Time Handling
- Uses current date/time (05:39 PM PDT, September 07, 2025) as reference for "today" or "tomorrow"
- Intelligent parsing of relative times ("at 7" → 7:00 PM today)
- Timezone awareness based on user settings

### Contact Resolution
- If a name (e.g., "john") isn't resolved, respond: "Couldn't find 'john'. Please provide an email or clarify."
- Learn from previous interactions to build contact database
- Fuzzy matching for common name variations

### Confirmation Flow
- All write operations require explicit confirmation
- After "yes" confirmation, follow with: `✅ **Action Completed Successfully** Operation completed.`
- "No" cancellation returns to normal conversation

### Response Limits
- Cap pending emails/tasks at 5-10 per response
- Calendar shows all relevant events for requested timeframe
- Use "show more" pattern for additional items

### Edge Cases
- Handle vague times with intelligent defaults
- Auto-generate polite content for brief requests
- Graceful degradation when APIs are unavailable
- Clear error messages without technical details

## Success Metrics

### Primary KPIs
- **Daily Active Users**: Users who send at least 1 command per day
- **Commands per User**: Average commands executed per active user
- **Action Completion Rate**: % of previewed actions that get confirmed
- **User Retention**: % of users active after 7, 30, and 90 days

### Secondary KPIs
- **Setup Completion Rate**: % of users who complete OAuth for both email and calendar
- **Error Rate**: % of commands that fail to execute properly
- **Response Time**: Average time from command to preview/completion
- **Feature Usage**: Distribution of command types used

## MVP Scope

These commands cover core productivity needs for startup founders and early-stage teams:

### Phase 1: Core Email & Calendar
- Send emails with natural language
- Check pending emails
- View calendar schedules
- Schedule and modify meetings
- Basic reminder system

### Phase 2: Enhanced Features
- Email templates and signatures
- Advanced calendar management (recurring events)
- Integration with team calendars
- Proactive notifications

### Phase 3: Team Collaboration
- Shared team commands
- Meeting coordination across multiple attendees
- Integration with project management tools
- Advanced analytics and insights

## Future Roadmap

### V2 Enhancements
- Attachment handling for emails
- Advanced email filtering and organization
- Multiple calendar support
- Integration with common startup tools (Notion, Airtable, etc.)

### V3 Expansions
- Voice command support
- Mobile app companion
- AI-powered scheduling suggestions
- Advanced workflow automation

This specification provides a comprehensive foundation for building a conversational productivity assistant that serves the specific needs of startup teams while maintaining the flexibility to expand into additional use cases.