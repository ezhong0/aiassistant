# Core Use Cases: Executive Assistant Commands

This document contains example natural language commands that Executive Assistants (EAs) should be able to execute through the AI assistant. All examples focus on managing multiple executives simultaneously, coordinating calendars, triaging communications, and maintaining relationships.

**Key principle:** The AI understands natural language and executive context. You don't need formal templates or systems. Just describe what you want and which executive you're working for.

**Target User:** Executive Assistants at EA/VA agencies who manage 2-4 executives simultaneously

**Core Value:** Handle 3-4 executives with the same quality and responsiveness as handling 1-2 executives manually

---

## Multi-Executive Context Switching 🔄 (FOUNDATIONAL)

### Executive Profile Management

**The capability:**
The AI remembers each executive's communication style, preferences, priorities, and constraints. It switches context seamlessly when you say "for Mark" vs "for Jessica."

**Example profiles:**
- "Mark (CEO): Formal tone, hates small talk, morning meetings preferred, never before 9am, immediate response to board members"
- "Jessica (CMO): Warm and conversational, loves speaking opportunities, afternoon meetings preferred, can handle evening events"
- "David (CFO): Brief and direct, numbers-focused, no meetings during market hours (9:30am-4pm), hates evening commitments"

**Example commands:**
- "I'm handling emails for 3 executives today: Mark (CEO, formal tone), Jessica (CMO, warm/casual), David (CFO, brief/direct). Remember these profiles."
- "Mark prefers morning meetings, Jessica prefers afternoons, David needs open mornings for market analysis. Use this when scheduling."
- "Update Jessica's profile: she now wants all speaking opportunities flagged immediately"
- "David's project 'Phoenix' is confidential M&A. Jessica's project 'Lighthouse' is product launch. Mark oversees both. Remember for context."

### Context-Aware Response Generation

- "Draft response to this meeting request for Mark" (AI uses Mark's formal tone)
- "Jessica just got an inquiry about speaking at a conference. She loves speaking gigs. Respond enthusiastically and check her calendar for June."
- "David got invited to an investor dinner but he hates evening events. Politely decline."
- "Switch context: now handling emails for Sarah (startup founder, moves fast, conversational). Respond to this investor update request."

### Multi-Executive Same-Event Handling

- "Mark, Jessica, and David all got the same partnership proposal email. Draft different responses based on their roles and communication styles."
- "All three executives got invited to the same industry conference. Recommend who should go based on their priorities and schedules."
- "This vendor sent meeting requests to Mark and Jessica separately. Coordinate a single meeting with both."
- "Board presentation needs input from all three executives. Coordinate who provides what and by when."

---

## Email Triage & Prioritization 📨 (HIGHEST IMPACT)

### Urgent vs Important Filtering

**The workflow:**
EAs drown in executive inbox volume (50-200 emails/day per executive). The AI must filter noise, surface urgency, and route appropriately.

**Priority levels:**
1. **URGENT (immediate attention):** Board members, investors, top clients, family emergencies, PR crises
2. **IMPORTANT (today):** Direct reports, key partners, time-sensitive decisions, meeting prep
3. **ROUTINE (batch process):** Newsletters, FYIs, vendor updates, low-priority requests
4. **NOISE (auto-handle):** Sales pitches, spam, misdirected emails, irrelevant CC's

**Example commands:**
- "Mark got 47 emails overnight. Show me the 5 that need his attention today."
- "This email looks like a sales pitch pretending to be personal. Archive it."
- "This is from a board member - needs Mark's attention within 2 hours. Flag as urgent."
- "Jessica got an angry client email. This needs careful handling - draft response but flag for her review before sending."
- "Routine vendor invoice email for David - forward to accounting, confirm receipt."
- "Mark's college roommate emailed - personal, not business. Flag for evening review."
- "Someone wants to 'pick Mark's brain' - this is a disguised sales call. Politely decline."

### Relationship-Based Prioritization

- "This person is Mark's top investor. Any email from them is priority."
- "Jessica's direct reports always get same-day response. This is from one of them."
- "David hasn't responded to this key vendor in 3 emails. They're getting frustrated - handle tactfully and get David's attention."
- "This is Jessica's former boss who helped her career. Personal relationship - treat with care."

### Contextual Email Summarization

- "Mark wants all emails summarized in 2 sentences max. Condense this long email."
- "Jessica wants context on who people are when they email. Add background: 'This is John from Acme, you met at TechCrunch last year.'"
- "David only wants numbers and action items. Strip out the fluff from this update."
- "This email chain has 47 messages. Summarize the key decision needed from Mark."

### Auto-Handle Common Patterns

- "This is a meeting request with no context. Reply asking for agenda, objective, and proposed attendees before presenting to Mark."
- "Another recruiter trying to poach Jessica's team. Standard 'not interested' response."
- "Vendor asking for payment update. Check with accounting, reply with status."
- "Someone asking if David is speaking at an event. Check his calendar, confirm or decline."

---

## Calendar Coordination & Scheduling 📅 (EA'S CORE JOB)

### Multi-Party Complex Scheduling

**The workflow:**
Coordinating 5+ people across different organizations, time zones, and availability constraints is EA's highest-value skill. AI must actually solve this, not just suggest times.

**Example commands:**
- "Mark needs to meet with his leadership team (5 people) for 90 minutes this week. Find a time that works for everyone."
- "Book Mark's quarterly board meeting: need all 6 board members, 3-hour block, next month. Start with 3 proposed times."
- "Jessica wants weekly 1-on-1s with her 8 direct reports. Set up recurring meetings distributed across the week."
- "This meeting requires coordinating 4 different executives from 4 companies. Get their EAs' emails and start coordinating."
- "Mark needs to meet with another CEO whose EA is Sarah at sarah@company.com. Coordinate with Sarah to find time."
- "Jessica is speaking on a panel with 3 other executives. Get all their EAs on email to coordinate logistics."

### Schedule Optimization & Conflict Resolution

- "Jessica has back-to-back meetings all day. Someone wants 15 minutes urgent - find where we can squeeze it in."
- "David's morning meeting ran over, push all afternoon meetings back 30 minutes and notify everyone."
- "Mark has 8 meetings tomorrow. That's too many. Which 2-3 can be rescheduled or delegated?"
- "Jessica accepted a speaking engagement that conflicts with client meeting. Which is higher priority? Reschedule the other."
- "David double-booked himself. Investor meeting vs team offsite. Move the team offsite."

### Calendar Blocking & Protection

- "Find 2 hours this week for David to do deep work - no meetings, no interruptions. Block as 'Focus Time.'"
- "Mark travels every Tuesday-Thursday next month. Block travel days, mark as 'Remote/Limited Availability.'"
- "Jessica needs prep time before her board presentation Friday. Block Thursday afternoon, label 'Prep - Do Not Schedule.'"
- "David wants lunch blocked 12-1pm every day. Make recurring block, decline lunch meeting requests."
- "Mark's assistant noticed he's burned out. Block Friday afternoons for rest of quarter, label 'Personal Time.'"

### Travel Coordination & Logistics

- "Mark is traveling to NYC next Tuesday-Thursday. Block travel time, notify team he's remote, reschedule anything needing in-person."
- "Jessica's speaking at a conference next week. Book flights, hotel, ground transportation. Send itinerary by EOD."
- "David's flight was canceled, he has a client meeting in 4 hours in another city. Find alternatives immediately."
- "Mark has back-to-back travel: SF Monday-Tuesday, NYC Wednesday-Thursday, London Friday-Sunday. Map this out with buffer time."

### Recurring Meeting Management

- "Set up Mark's weekly leadership meeting: Mondays 9am, 90 minutes, all VPs, recurring indefinitely."
- "Jessica's monthly board meeting needs scheduling 6 months in advance. Book all 6 dates now."
- "David's quarterly investor updates: last Thursday of each quarter, 2-hour blocks, send calendar holds."
- "Mark's 1-on-1s with direct reports are too infrequent. Set up bi-weekly recurring meetings with all 6."

---

## Meeting Preparation & Follow-Up 📋 (EA LEVERAGE)

### Pre-Meeting Preparation

**The workflow:**
Executives show up to meetings prepared because EAs proactively send materials, context, and reminders at the right time.

**Example commands:**
- "Mark has a board meeting tomorrow at 2pm. Send him the materials, agenda, and pre-read by 6pm today."
- "Jessica's client call is in 30 minutes. Remind her, send Zoom link, attach the project brief."
- "David's investor meeting is next week. Prepare briefing doc: company metrics, investment thesis, Q&A prep."
- "Mark's speaking at a conference Thursday. Prepare: speech notes, company bio, travel itinerary, contact info for organizers."
- "Jessica meeting with potential acquisition target tomorrow. Send her: their financials, competitive analysis, our offer terms."

### Day-Of Reminders & Support

- "Mark's 9am meeting starts in 15 minutes. Send reminder with Zoom link and agenda."
- "Jessica's in back-to-back calls all morning. Send her the lunch meeting location 30 minutes before."
- "David needs his slides for 2pm presentation. He's in meetings until 1:45pm. Send at 1:30pm."
- "Mark's meeting with difficult board member in 1 hour. Send him the prep notes and last quarter's discussion summary."

### Post-Meeting Follow-Up

- "After today's leadership meeting, send recap to all attendees with action items and owners."
- "Mark just finished investor pitch. Send thank you email within 2 hours while we're top of mind."
- "Jessica's client call wrapped up. Draft follow-up email: recap agreements, confirm next steps, attach proposal."
- "David's board meeting ended. Circulate approved minutes, action items with deadlines, next meeting date."
- "Mark made 3 commitments in that meeting. Create reminders to follow up on each before the deadline."

### Meeting Decline & Alternative Handling

- "Mark got invited to low-priority industry panel. Decline gracefully, offer to send VP of Product instead."
- "Jessica wants to attend this conference but can't justify the time. Decline, ask for recordings or key takeaways."
- "David's calendar is full. This meeting request is 8th priority. Decline and suggest they work with his VP of Finance."
- "When declining meetings, Mark wants simple 'calendar conflict.' Jessica wants warm explanation. David wants nothing, just decline."

---

## Delegation & Workflow Management 🔀 (EA INTELLIGENCE)

### Appropriate Routing & Delegation

**The workflow:**
80% of requests to executives should be handled by someone else. EAs must know the org structure and route appropriately.

**Example commands:**
- "This request for Mark should actually go to his VP of Product. Forward appropriately with context."
- "Jessica got invited to a podcast but she's too busy. Offer to send her VP of Marketing instead."
- "David needs expense reports from last quarter. Route to his finance manager Sarah, CC David for visibility."
- "This partnership inquiry is interesting but premature. Route to BD team to evaluate first before bringing to Mark."
- "Mark's getting CCed on implementation details. This should go to engineering lead, not CEO. Redirect and ask to remove Mark from future emails."

### EA-to-EA Coordination

- "Mark needs to meet with another CEO whose EA is Sarah. Coordinate with Sarah to find time."
- "Jessica is speaking on a panel with 3 other executives. Get all their EAs on email to coordinate logistics."
- "This meeting requires coordinating 4 different executives from 4 companies. Start EA coordination thread."
- "Mark's old EA handed off 20 pending items. Prioritize and execute on the most important 5 this week."
- "David's EA is out sick, I'm covering for both. Triage both inboxes, handle urgent items only."

### Team Coordination & Communication

- "Mark decided to cancel Friday's all-hands. Notify entire company, explain briefly, offer Q&A session instead."
- "Jessica's team needs her decision on the rebrand. She's traveling all week. Get the 3 options, summarize for her, get decision by EOD."
- "David's direct report sent a good idea email that got buried. Resurface it to David with your recommendation."
- "Mark's leadership team has a conflict about budget allocation. Schedule 30-minute decision meeting with key stakeholders."

---

## Relationship Management & Follow-Through 🤝 (EA SECRET SAUCE)

### Relationship Maintenance & Tracking

**The workflow:**
EAs track promises, obligations, and relationship health that executives don't have time to monitor. This is where great EAs shine.

**Example commands:**
- "Mark hasn't talked to his top investor in 6 weeks. Suggest scheduling a check-in call."
- "Jessica promised to intro this person to someone in her network 2 weeks ago. Follow up on that intro."
- "David mentioned wanting to grab coffee with this advisor 3 months ago. Make it happen now."
- "This person has emailed Mark 3 times with no response. They're getting frustrated - handle tactfully with apology and response."
- "Important client's birthday is next week. Remind Jessica to send a personal note."

### Stakeholder Relationship Health

- "Mark's direct reports haven't had 1-on-1s in 6 weeks. That's too long - schedule catch-ups."
- "Jessica hasn't responded to this key partner in 2 weeks. They're important - prioritize response."
- "David's investor asked for quarterly update 10 days ago, still waiting. This is urgent."
- "Mark's mentor who helped him start the company emailed last week. Personal relationship - ensure response today."

### Gift & Appreciation Management

- "Holiday season - send appropriate gifts to each executive's key relationships. Mark: 10 investors, Jessica: 15 industry partners, David: 5 board members."
- "Mark's top customer's company just hit a milestone. Send congratulations with personal note."
- "Jessica's former assistant is getting married. Remind Jessica to send gift and note."
- "David's long-time accountant is retiring. Arrange farewell lunch and gift."

### Promise & Commitment Tracking

- "Mark said he'd get back to this person 'next week' (3 weeks ago). Follow up now."
- "Jessica committed to reviewing this proposal by Friday. It's Thursday - remind her."
- "David promised to intro this person to his CFO network. Make it happen."
- "In the board meeting, Mark committed to 3 deliverables by month-end. Track progress and remind him."

---

## Crisis Management & Urgent Escalation 🚨 (EA JUDGMENT)

### True Emergency Recognition

**The workflow:**
EAs must distinguish between "urgent" (can wait 1 hour) and "emergency" (interrupt immediately). Wrong judgment = fired.

**Example commands:**
- "Mark is in a meeting but his biggest customer just emailed saying they're canceling. Get his attention NOW - text him."
- "Press inquiry about sensitive acquisition rumor just came in. Don't respond - escalate to Mark and PR team immediately."
- "Mark's wife just called - family emergency. Clear his calendar for today, reschedule everything, notify his team (no details)."
- "David's laptop died right before board presentation. He needs slides on his phone NOW."
- "Jessica's keynote speech is in 2 hours, she's stuck in traffic 1 hour away. Find alternative: video call-in or reschedule."

### Rapid Response Coordination

- "Major client issue escalating. Mark needs to call the CEO immediately. Find their EA, get CEO on phone in 15 minutes."
- "Product launch has critical bug. Jessica (CMO) and David (CFO) need to loop in Mark (CEO) now. Set up emergency call."
- "Negative press article just published. Mark needs to see it immediately, loop in PR team, prepare response."
- "Investor threatening to pull funding. David needs Mark on the phone with investor in next 30 minutes."

### Sensitive Situation Handling

- "This email contains confidential M&A information. Never mention this to anyone. Mark's 'Phoenix' project."
- "Someone is asking about Mark's availability next month - but you know he's negotiating acquisition. Give vague availability, don't reveal why."
- "Recruiter asking if Jessica is happy in her role. Shut this down professionally without creating drama."
- "Mark's personal assistant CC'd you on something about his divorce. Pretend you didn't see it, handle with extreme discretion."

---

## Bulk Operations Across Multiple Executives 📊 (SCALE EFFICIENCY)

### Weekly/Monthly Recurring Communications

**Example commands:**
- "Send weekly schedule summary to Mark, Jessica, and David every Sunday evening - personalized for each."
- "Quarter end coming up - remind all executives about their board reporting deadlines (different dates for each)."
- "Schedule monthly EA sync meeting with all three executives to review priorities and upcoming travel."
- "Send monthly 'things falling through cracks' report to each executive with items needing their attention."

### Coordinated Event Management

- "All three executives got invited to the same industry conference. Coordinate who should go based on priorities, book travel."
- "Annual team offsite next month. Get availability from all 3 executives, propose dates to team leads."
- "Company holiday party planning. Get input from all executives on budget, date, venue preferences."
- "Board meeting requires all 3 executives presenting. Coordinate prep timeline, assign sections, schedule rehearsal."

### Cross-Executive Information Sharing

- "This industry trend affects both Jessica (CMO) and David (CFO). Send summary to both with different framing."
- "Mark made a strategic decision that impacts Jessica's marketing plans. Notify her with context."
- "David's budget cuts affect Mark's hiring plans. Schedule brief sync meeting."
- "All three executives need to see this competitive analysis. Send with executive summary tailored to their roles."

---

## Executive Preference Learning & Adaptation 🧠 (CONTINUOUS IMPROVEMENT)

### Communication Style Preferences

**The workflow:**
Great EAs learn each executive's style and adapt. The AI must do the same.

**Example commands:**
- "Mark prefers morning meetings, Jessica prefers afternoons. Remember this for future scheduling."
- "David always wants financial emails forwarded immediately. Jessica can wait until evening. Different urgency rules."
- "When Mark says 'sometime next week' he means schedule it. When Jessica says it, she means she'll get to it eventually. Different follow-up approaches."
- "Mark hates phone calls, Jessica loves them, David doesn't care. Handle meeting requests accordingly."

### Decision-Making Pattern Recognition

- "Mark needs 3 options with pros/cons before deciding. Jessica decides fast with gut. David needs data. Adjust presentation accordingly."
- "Jessica always says yes to speaking opportunities then regrets it. Start filtering - only bring her top-tier events."
- "David rejects 90% of networking requests. Only bring him investor/board-level intros."
- "Mark hates surprise meetings. Always ask before accepting on his behalf. Jessica trusts you to decide."

### Working Style & Energy Patterns

- "Mark is most productive 6am-9am. Protect that time for deep work, no meetings."
- "Jessica crashes after lunch. Schedule important meetings in mornings or late afternoons."
- "David needs decompression time after intense meetings. Don't schedule back-to-back board meetings and investor calls."
- "Mark travels every other week. On travel weeks, keep meetings light. On home weeks, pack the calendar."

### Historical Context & Project Memory

- "Mark's 'Phoenix' project = confidential acquisition of CompetitorCo. 'Lighthouse' = new product launch Q3. Use these code names."
- "Jessica had a bad experience with EventCorp as a vendor. Never book them for her speaking engagements."
- "David worked with this investment bank on last fundraise. Good relationship - prioritize their outreach."
- "Mark's board member Sarah always asks tough questions about burn rate. Prep extra detail when she's in meetings."

---

## Email Response Templates by Situation 📝 (EA EFFICIENCY)

### Meeting Request Responses

**For different scenarios:**

**Accept (available):**
- "Mark: 'Confirmed. See you Thursday 2pm. Please send agenda in advance.'"
- "Jessica: 'Happy to meet! Thursday 2pm works great. Looking forward to it.'"
- "David: 'Thursday 2pm confirmed.'"

**Decline (busy):**
- "Mark: 'Calendar conflict. Please propose alternative times.'"
- "Jessica: 'So sorry, I'm booked solid this week! Can we find time next week? I'd love to connect.'"
- "David: 'Not available.'"

**Decline (low priority):**
- "Mark: 'Unfortunately Mark's schedule is fully committed for the foreseeable future. If there's something urgent, please let me know.'"
- "Jessica: 'Jessica's traveling extensively over the next few months. If this is time-sensitive, perhaps someone on her team could help?'"
- "David: 'David's not available for this. Please reach out to [appropriate person].'"

**Delegate to someone else:**
- "This is a great fit for Jessica's VP of Marketing. Looping in Sarah (cc'd) who can take this meeting. Thanks!"

### Request for Information Responses

- "Mark: 'See attached. Let me know if you need anything else.'"
- "Jessica: 'Absolutely! Here's what you need. Happy to jump on a quick call if helpful!'"
- "David: 'Attached.'"

### Intro Request Responses

**Accept intro:**
- "Mark: 'Happy to connect you with [person]. I'll make the intro via email this week.'"
- "Jessica: 'Yes! [Person] is great. Let me intro you two - will send email shortly!'"

**Decline intro:**
- "Mark: 'Unfortunately I don't have a strong enough relationship with [person] to make that introduction.'"
- "Jessica: 'I don't think I'm the right person to make this intro, but you might try reaching out to [alternative].'"

### Sales/Pitch Responses

**Polite decline:**
- "Thanks for reaching out. Unfortunately this isn't a fit right now. Best of luck!"
- "Mark's calendar is fully committed. If you'd like to send information via email, I'll make sure he sees it."

**Interested but not now:**
- "Interesting! Not the right time for a conversation, but feel free to follow up in Q3 when we're looking at new vendors."

---

## Analysis & Reporting Capabilities 📈 (EA INSIGHTS)

### Email Volume & Pattern Analysis

**Example commands:**
- "How many emails did Mark get last week? What percentage were actually important?"
- "Show me Jessica's email response time trends. Is she falling behind?"
- "David's inbox has 147 unread emails. Which 10 need his attention this week?"
- "Who are Mark's most frequent correspondents? Are these the right people?"

### Calendar & Time Analysis

- "Mark had 32 meetings last week. That's too many. Analyze which could have been emails or delegated."
- "Show me Jessica's meeting breakdown: internal vs external, 1-on-1 vs group."
- "David's spending 60% of time in meetings, only 40% on deep work. That's out of balance."
- "All three executives have travel conflicts with Q2 board meeting. Find alternative dates."

### Relationship & Follow-Up Tracking

- "Show me all open commitments Mark has made in the last 30 days. Which are overdue?"
- "List all people Jessica promised to intro to someone else. Status on each?"
- "Who has emailed Mark 2+ times with no response? Priority order."
- "Which key relationships (investors, board, top clients) haven't been contacted in 60+ days?"

### Priority & Urgency Insights

- "What's truly urgent for Mark this week vs what can wait until next week?"
- "Jessica has 15 'urgent' requests. Rank them by actual urgency."
- "David's team is waiting on decisions from him. What's blocking them?"
- "Show me all time-sensitive deadlines across all three executives this month."

---

## EA-Specific Workflow Shortcuts ⚡ (SPEED COMMANDS)

### Quick Actions (No Explanation Needed)

- "Mark confirm" (accept meeting request in Mark's style)
- "Jessica decline busy" (decline meeting, she's booked)
- "David forward finance" (forward to David's finance team)
- "Mark urgent flag" (mark email as needing immediate attention)
- "Jessica remind tomorrow" (set reminder to follow up tomorrow)
- "David archive" (archive this email for David)
- "Mark schedule next week" (find time next week and propose)
- "Jessica send itinerary" (send her travel itinerary)
- "David numbers only" (summarize email with just key numbers)
- "All three exec summary" (send executive summary to all three)

### Batch Processing Commands

- "Triage Mark's inbox: urgent, important, routine, archive"
- "Accept all of Jessica's recurring meetings for next month"
- "Decline all Mark's networking requests this week unless they're investor/board level"
- "Reschedule all of David's meetings on Friday to next week (he's taking PTO)"
- "Send 'thank you for meeting' follow-ups to all of Jessica's meetings from yesterday"

### Context Loading Commands

- "Load Mark context" (load Mark's preferences, projects, priorities)
- "Switch to Jessica" (switch active executive context)
- "Show me David's week" (calendar, priorities, urgent items)
- "What's Mark's top priority right now?" (pull from context/notes)
- "Remind me about Jessica's Phoenix project details" (retrieve project context)

---

## Understanding Request Framework

### ✅ **SUPPORTED Requests** (MVP: Gmail, Google Calendar, Google Contacts)

**Core Capabilities:**
- **Email Operations**: Search, triage, draft, send, organize emails using Gmail API
- **Calendar Management**: Check availability, schedule meetings, coordinate multi-party events, handle conflicts
- **Contact Management**: Look up contacts, track relationships, segment by importance
- **Multi-Executive Context**: Switch between executives, remember preferences, adapt communication style
- **Natural Language Understanding**: Parse complex commands, understand urgency, route appropriately
- **Bulk Operations**: Handle multiple executives simultaneously, batch operations
- **Relationship Tracking**: Monitor communication frequency, surface falling-through-cracks items
- **Priority & Urgency Analysis**: Filter noise, surface what needs immediate attention

**What Makes Requests Supported:**
- **API-Feasible**: Can be accomplished using Gmail, Google Calendar, and Google Contacts APIs
- **Data Available**: Information exists in email/calendar history or EA provides context
- **No External Dependencies**: Doesn't require CRM, project management tools, or company-specific systems (MVP)
- **Executive Context**: Works with EA-provided profiles and learned preferences

**Examples of Supported Requests:**
- "Mark got 47 emails overnight. Show me the 5 that need his attention today."
- "Schedule Mark's leadership team meeting (5 people) for 90 minutes this week"
- "Jessica loves speaking opportunities - respond enthusiastically and check her June calendar"
- "David hates evening events - politely decline this dinner invitation"
- "All three executives got invited to same conference - coordinate who should go"
- "Mark hasn't talked to his top investor in 6 weeks - suggest scheduling check-in"

---

### ❌ **UNSUPPORTED Requests** (Require External Systems)

**Company-Specific Systems:**
- Slack/Teams integration (internal messaging)
- Project management tools (Asana, Monday, Jira)
- CRM systems (Salesforce, HubSpot)
- File storage access (Dropbox, Google Drive file management)
- Expense/invoice systems (Concur, Expensify)
- HR systems (BambooHR, Workday)

**Advanced Communication:**
- LinkedIn direct messages
- WhatsApp Business
- SMS/text messaging
- Social media management
- Video recording/editing

**Document Creation:**
- PowerPoint/Keynote slide creation
- Excel/Sheets data analysis
- Word/Docs document drafting (beyond email)
- PDF editing or form filling

**Examples of Unsupported Requests:**
- "Update Mark's Salesforce with meeting notes" ❌ (requires CRM integration)
- "Share this doc in the company Slack" ❌ (requires Slack integration)
- "Create presentation slides for David's board meeting" ❌ (requires PowerPoint/Slides)
- "Book Mark's flight and hotel for NYC trip" ❌ (requires travel booking integration)
- "Submit Jessica's expenses in Concur" ❌ (requires expense system)
- "Post this announcement to LinkedIn for Mark" ❌ (requires social media integration)

---

### **Making Requests Work Within Constraints**

**Instead of requesting external system access, work with communication and scheduling:**

| ❌ Won't Work | ✅ Will Work |
|---------------|-------------|
| "Update Salesforce with meeting notes" | "Email Mark's CRM manager with meeting notes to log in Salesforce" |
| "Create slides for presentation" | "Email Mark the key points for his presentation, format as bullets" |
| "Book flight for NYC trip" | "Email Mark's travel coordinator: need flights to NYC March 15-17, morning departure preferred" |
| "Submit expense report" | "Forward receipts to accounting, CC David, ask them to process expense report" |
| "Share document in Slack" | "Email document to Mark's team with note to share in their Slack channel" |
| "Update task in Asana" | "Email project manager: task X is complete, please update Asana" |
| "Post to LinkedIn" | "Draft LinkedIn post for Mark, send to him for review and posting" |

**Key Principles:**
1. **Communication-Focused**: Gmail, Google Calendar, Google Contacts only (MVP)
2. **EA-Initiated**: EA triggers actions, system doesn't run autonomously
3. **Executive Context-Aware**: Remembers preferences, adapts style, switches context
4. **No External Integrations (MVP)**: No Slack, CRM, project management, or travel systems - EA provides data/context as needed
5. **EA Provides Context**: Paste executive preferences, priorities, confidential project names in commands
6. **Learn from Patterns**: AI learns from EA's edits and adaptations over time

**Post-MVP Additions:**
- Slack/Teams integration (coordinate with teams)
- CRM integration (log meetings, update contact info)
- Travel booking tools (Concur, TripActions)
- Expense management (Expensify, Concur)
- Document collaboration (Google Docs, Notion)

---

### **Workflow Patterns That Work**

**✅ Morning Inbox Triage (All Executives):**
- "Triage overnight emails for Mark, Jessica, and David. Show urgent items for each."
- "Mark: 47 emails → 5 need attention. Jessica: 32 emails → 3 need attention. David: 18 emails → 2 need attention."
- "Auto-respond to routine requests, flag urgent items, draft responses for important emails."

**✅ Multi-Executive Coordination:**
- "All three got invited to same event - recommend who goes based on priorities and calendars"
- "This decision needs input from Mark (CEO), Jessica (CMO), and David (CFO) - coordinate quick sync meeting"
- "Board meeting next month - coordinate all 3 executives' prep, assign sections, schedule rehearsal"

**✅ Complex Calendar Coordination:**
- "Schedule Mark's leadership team meeting: 5 people, 90 minutes, this week - find time that works for all"
- "Mark needs to meet with CEO whose EA is Sarah - coordinate with Sarah to find time"
- "Jessica speaking on panel with 3 other executives - coordinate with their EAs on logistics"

**✅ Relationship Maintenance:**
- "Mark hasn't contacted his top investor in 6 weeks - suggest scheduling check-in"
- "Jessica promised intro 2 weeks ago, still pending - follow up and make it happen"
- "Important client's birthday next week - remind Jessica to send personal note"
- "Show me all commitments Mark made in last 30 days that haven't been followed up"

**✅ Crisis Response:**
- "Mark is in meeting but biggest customer just canceled - get his attention NOW"
- "Jessica's flight canceled, client meeting in 4 hours in another city - find alternatives immediately"
- "Press inquiry about sensitive topic - escalate to Mark and PR team, do not respond"

**✅ Meeting Prep & Follow-Up:**
- "Mark's board meeting tomorrow 2pm - send materials, agenda, pre-read by 6pm today"
- "Jessica's client call in 30 minutes - remind her, send Zoom link, attach brief"
- "After leadership meeting, send recap to all attendees with action items and owners"

**✅ Bulk Operations:**
- "Send weekly schedule summary to all three executives every Sunday evening - personalized for each"
- "Quarter end - remind all executives about board reporting deadlines (different dates)"
- "Holiday gifts: Mark's 10 investors, Jessica's 15 partners, David's 5 board members"

---

## Executive Assistant-Specific Intelligence

**Executive Context:**
When you mention executives, the AI understands:
- Communication style (formal vs casual, brief vs detailed)
- Meeting preferences (morning vs afternoon, phone vs video, duration)
- Priorities (what gets immediate attention vs what can wait)
- Relationships (who's important, who to prioritize, who to filter)
- Confidential projects (code names, need-to-know basis)

**Urgency Intelligence:**
The AI understands:
- True emergency vs "urgent" (interrupt vs handle quickly)
- Relationship importance (board member > vendor, top client > random inquiry)
- Time sensitivity (response deadline, meeting prep time needed)
- Executive capacity (if calendar is full, default to decline/delegate)

**Communication Style Matching:**
The AI matches tone to executive:
- Mark (CEO): Formal, brief, no small talk - "Confirmed. Thursday 2pm."
- Jessica (CMO): Warm, enthusiastic, relationship-focused - "Happy to meet! Looking forward to it!"
- David (CFO): Direct, numbers-focused, minimal words - "Thursday 2pm confirmed."

**Context Switching:**
The AI switches seamlessly:
- "For Mark..." (loads Mark's preferences, style, priorities, calendar)
- "Now switch to Jessica..." (loads Jessica's context)
- "All three executives..." (coordinates across all three)

**Learning & Adaptation:**
The AI learns from patterns:
- If EA always changes X in drafts, AI starts including X
- If EA always declines Y type of meeting, AI proactively declines
- If EA always flags Z type of email as urgent, AI learns that pattern

---

## EA Agency-Specific Features

### Multi-EA Collaboration
- "I'm covering for Sarah's executives while she's out. Load her clients: Tom, Amanda, Robert."
- "Coordinate with David's other EA on overlapping meetings this week."
- "EA team meeting prep: compile status updates for all our executives."

### Client Handoff & Onboarding
- "New executive client: Mark (CEO, Series B startup, formal, morning meetings). Set up profile."
- "Sarah's old EA handed off 20 pending items. Show me highest priority 5."
- "Offboarding executive client Jessica next month. Archive all context, prepare handoff notes."

### Agency Reporting & Metrics
- "How many hours did I save across all 3 executives this week?"
- "Which executive needs the most attention this week?"
- "Email volume trends for all my executives: increasing or decreasing?"
- "Meeting load balance: is anyone overbooked compared to others?"

---

This framework ensures the AI assistant is highly effective for Executive Assistants managing multiple executives while working within the realistic constraints of email, calendar, and contacts APIs - no Slack, CRM, or project management integrations required for MVP.

**Target:** EA/VA agencies with 10-50 clients
**Pricing:** $500/month per EA (not per executive)
**Value:** EA can handle 3-4 executives instead of 1-2, maintaining same quality
**ROI for agency:** Higher margins or serve more clients with same team size
