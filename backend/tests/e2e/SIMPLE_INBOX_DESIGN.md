# Simple Realistic Inbox Generator - 80/20 Design

**Philosophy**: Generate realistic, tested inboxes with 20% of the complexity
**Model**: GPT-5 Nano for everything (~$0.03 per inbox)
**Time**: ~10-15 minutes per inbox
**Output**: 150-250 emails with full bodies, basic ground truth

---

## Core Idea

Instead of simulating 3 months with complex relationships, we generate **one realistic week** with simple context, then **repeat with variations** to create volume.

**3 Simple Steps**:
1. **Setup Context** (1 AI call) - Define persona + 20 key people
2. **Generate Week** (1 AI call per week) - Create 20-30 emails for that week
3. **Add Ground Truth** (1 AI call) - Label emails for testing

That's it. Repeat Step 2 for 5-8 weeks to get 100-200+ emails.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  STEP 1: Context Setup (1 call)             │
│  ┌─────────────┐  ┌──────────────┐         │
│  │   Persona   │  │  20 People   │         │
│  │   (Simple)  │  │  (Key Contacts)       │
│  └─────────────┘  └──────────────┘         │
└─────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│  STEP 2: Weekly Generation (N calls)        │
│  ┌─────────────────────────────────┐        │
│  │  Week 1: 25 emails              │        │
│  │  - 5-8 important threads        │        │
│  │  - 10-15 noise emails           │        │
│  │  - Calendar events              │        │
│  └─────────────────────────────────┘        │
│  ┌─────────────────────────────────┐        │
│  │  Week 2: 25 emails              │        │
│  │  - Continue some Week 1 threads │        │
│  │  - New threads                  │        │
│  └─────────────────────────────────┘        │
│  ... repeat for 5-8 weeks                   │
└─────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│  STEP 3: Ground Truth (1 call)              │
│  ┌─────────────────────────────────┐        │
│  │  Label all emails:              │        │
│  │  - Urgency (yes/no)             │        │
│  │  - Requires response (yes/no)   │        │
│  │  - Category (customer/internal) │        │
│  │  - Key people/topics            │        │
│  └─────────────────────────────────┘        │
└─────────────────────────────────────────────┘
```

Total AI calls: 1 context + 5-8 weeks + 1 labeling = **7-10 calls**

---

## Data Models (Simplified)

### 1. Context (Simple Persona + People)

```typescript
interface SimpleContext {
  persona: {
    role: 'founder' | 'vp_sales' | 'eng_manager' | 'busy_exec';
    name: string;
    email: string;
    company: string;
    style: 'overwhelmed' | 'organized' | 'responsive' | 'drowning';
  };

  keyPeople: SimplePerson[]; // Just 20 people
}

interface SimplePerson {
  name: string;
  email: string;
  role: string;
  type: 'boss' | 'report' | 'customer' | 'vendor' | 'investor' | 'spam';
  emailFrequency: 'daily' | 'weekly' | 'rarely';
  importance: 'high' | 'medium' | 'low';
}
```

### 2. Week of Emails

```typescript
interface WeekData {
  weekNumber: number;
  startDate: Date;
  emails: SimpleEmail[];
  continuedThreads?: string[]; // Thread IDs from previous week
}

interface SimpleEmail {
  id: string;
  threadId: string;
  from: string; // Email address
  to: string[];
  subject: string;
  body: string; // 200-500 words
  timestamp: Date;

  // Simple metadata
  isImportant: boolean;
  isUrgent: boolean;
  requiresResponse: boolean;
  category: 'signal' | 'noise';

  // Gmail format
  gmailFormat: GmailMessage; // Standard Gmail API format
}
```

### 3. Ground Truth (Simple Labels)

```typescript
interface SimpleGroundTruth {
  emailLabels: {
    [emailId: string]: {
      isUrgent: boolean;
      isImportant: boolean;
      requiresResponse: boolean;
      fromVIP: boolean;
      category: string;
      topics: string[];
    };
  };

  testQueries: SimpleTestQuery[];
}

interface SimpleTestQuery {
  query: string; // "Show urgent emails from customers"
  expectedEmailIds: string[];
  reasoning: string;
}
```

---

## Implementation

### File Structure (Minimal)

```
backend/tests/e2e/
├── generators/
│   └── simple-realistic-inbox.ts       # NEW: ~300 lines total
├── templates/
│   ├── founder-overwhelmed.json        # 4 simple templates
│   ├── vp-sales-busy.json
│   ├── eng-manager-organized.json
│   └── exec-drowning.json
├── scripts/
│   └── generate-simple-inbox.ts        # NEW: CLI wrapper
└── data/
    └── simple-inboxes/                 # Generated outputs
```

### Core Generator (~300 lines)

```typescript
// simple-realistic-inbox.ts

export class SimpleRealisticInboxGenerator {
  constructor(private aiService: GenericAIService) {}

  /**
   * Generate complete inbox in 3 steps
   */
  async generate(template: string, weeks: number = 6): Promise<SimpleInbox> {
    // STEP 1: Setup context (1 call)
    console.log('Step 1/3: Generating context...');
    const context = await this.generateContext(template);

    // STEP 2: Generate weeks (N calls)
    console.log(`Step 2/3: Generating ${weeks} weeks of emails...`);
    const allWeeks: WeekData[] = [];
    let continuedThreads: string[] = [];

    for (let i = 0; i < weeks; i++) {
      console.log(`  Week ${i + 1}/${weeks}...`);
      const week = await this.generateWeek(context, i, continuedThreads);
      allWeeks.push(week);

      // Randomly continue some threads to next week
      continuedThreads = this.selectThreadsToContinue(week);

      await sleep(500); // Avoid rate limits
    }

    // STEP 3: Generate ground truth (1 call)
    console.log('Step 3/3: Generating test labels...');
    const groundTruth = await this.generateGroundTruth(context, allWeeks);

    return {
      context,
      weeks: allWeeks,
      groundTruth,
      totalEmails: allWeeks.reduce((sum, w) => sum + w.emails.length, 0)
    };
  }

  /**
   * STEP 1: Generate context with GPT-5 Nano
   */
  private async generateContext(template: string): Promise<SimpleContext> {
    const prompt = `Generate realistic email inbox context.

TEMPLATE: ${template}

Create:
1. A persona (name, role, company, work style)
2. 20 key people they email with

PEOPLE BREAKDOWN:
- 3 bosses/investors (high importance, email weekly)
- 5 direct reports/team (medium importance, email daily)
- 5 customers (high importance, email varies)
- 4 vendors/partners (medium importance, email weekly)
- 3 noise sources (low importance, email daily - recruiters, sales)

Each person needs:
- Name, email, role, type
- Email frequency
- Importance level

Return ONLY valid JSON matching this schema:
{
  "persona": {
    "role": "founder",
    "name": "...",
    "email": "...",
    "company": "...",
    "style": "overwhelmed"
  },
  "keyPeople": [
    {
      "name": "...",
      "email": "...",
      "role": "...",
      "type": "boss",
      "emailFrequency": "weekly",
      "importance": "high"
    }
  ]
}`;

    const response = await this.aiService.generateResponse(prompt);
    return JSON.parse(this.cleanJSON(response));
  }

  /**
   * STEP 2: Generate one week of emails
   */
  private async generateWeek(
    context: SimpleContext,
    weekNumber: number,
    continuedThreads: string[]
  ): Promise<WeekData> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (6 - weekNumber) * 7);

    const prompt = `Generate realistic emails for Week ${weekNumber + 1}.

PERSONA: ${JSON.stringify(context.persona, null, 2)}

KEY PEOPLE: ${JSON.stringify(context.keyPeople, null, 2)}

${continuedThreads.length > 0 ? `CONTINUED THREADS FROM LAST WEEK: ${continuedThreads.join(', ')}` : ''}

Generate 25 emails for this week:

SIGNAL EMAILS (15 emails):
- 5-6 from high importance people (bosses, customers, investors)
- 4-5 from team/reports
- 3-4 from partners/vendors
- Include replies, follow-ups, new threads
${continuedThreads.length > 0 ? '- Continue 2-3 threads from last week with realistic follow-ups' : ''}
- Mix urgent (30%) and normal (70%)

NOISE EMAILS (10 emails):
- 4 newsletters (tech news, industry updates)
- 3 cold sales outreach
- 2 recruiter spam
- 1 automated notification

EMAIL REQUIREMENTS:
- Full bodies (200-500 words for signal, 50-150 for noise)
- Realistic subjects
- Business hours timestamps (Mon-Fri, 8am-6pm)
- Some threads (2-4 emails back-and-forth)
- Specific details (names, numbers, dates, projects)

Return ONLY valid JSON array:
[
  {
    "from": "person@company.com",
    "to": ["${context.persona.email}"],
    "subject": "...",
    "body": "Full email body with greeting, 3-5 paragraphs, signature...",
    "timestamp": "2024-10-01T09:30:00Z",
    "threadId": "thread-1",
    "isImportant": true,
    "isUrgent": false,
    "requiresResponse": true,
    "category": "signal"
  }
]`;

    const response = await this.aiService.generateResponse(prompt);
    const emails = JSON.parse(this.cleanJSON(response));

    return {
      weekNumber,
      startDate,
      emails: emails.map(this.convertToGmailFormat),
      continuedThreads
    };
  }

  /**
   * STEP 3: Generate ground truth labels
   */
  private async generateGroundTruth(
    context: SimpleContext,
    weeks: WeekData[]
  ): Promise<SimpleGroundTruth> {
    const allEmails = weeks.flatMap(w => w.emails);

    const prompt = `Label these emails for testing an AI assistant.

PERSONA: ${context.persona.role} at ${context.persona.company}

EMAILS (${allEmails.length} total):
${allEmails.map(e => `
ID: ${e.id}
From: ${e.from}
Subject: ${e.subject}
Body: ${e.body.substring(0, 200)}...
`).join('\n---\n')}

For each email, provide accurate labels:
- isUrgent: Is this time-sensitive?
- isImportant: Does this matter to persona's goals?
- requiresResponse: Does this need a reply?
- fromVIP: Is sender high-priority?
- category: customer/internal/vendor/noise
- topics: Key topics mentioned

ALSO create 15 test queries with expected results:
- "Show urgent emails from customers" → [email IDs]
- "What needs my response?" → [email IDs]
- "Find emails about X project" → [email IDs]

Return JSON:
{
  "emailLabels": {
    "email-id-1": {
      "isUrgent": true,
      "isImportant": true,
      "requiresResponse": true,
      "fromVIP": true,
      "category": "customer",
      "topics": ["product issue", "deadline"]
    }
  },
  "testQueries": [
    {
      "query": "Show urgent customer emails",
      "expectedEmailIds": ["email-1", "email-5"],
      "reasoning": "These are from customers with urgent issues"
    }
  ]
}`;

    const response = await this.aiService.generateResponse(prompt);
    return JSON.parse(this.cleanJSON(response));
  }

  /**
   * Helper: Clean JSON from AI response
   */
  private cleanJSON(response: string): string {
    return response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
  }

  /**
   * Helper: Convert to Gmail format
   */
  private convertToGmailFormat(email: any): SimpleEmail {
    const id = generateId();

    return {
      ...email,
      id,
      gmailFormat: {
        id,
        threadId: email.threadId || id,
        labelIds: email.category === 'signal' ? ['INBOX', 'IMPORTANT'] : ['INBOX'],
        snippet: email.body.substring(0, 100),
        payload: {
          headers: [
            { name: 'From', value: email.from },
            { name: 'To', value: email.to.join(', ') },
            { name: 'Subject', value: email.subject },
            { name: 'Date', value: email.timestamp }
          ],
          body: { data: btoa(email.body) }
        },
        internalDate: new Date(email.timestamp).getTime().toString()
      }
    };
  }

  /**
   * Helper: Select threads to continue
   */
  private selectThreadsToContinue(week: WeekData): string[] {
    const threads = [...new Set(week.emails.map(e => e.threadId))];
    const signalThreads = threads.filter(tid =>
      week.emails.find(e => e.threadId === tid && e.category === 'signal')
    );

    // Continue 30% of signal threads randomly
    const count = Math.floor(signalThreads.length * 0.3);
    return signalThreads.sort(() => Math.random() - 0.5).slice(0, count);
  }
}
```

---

## Simple Templates

### Template: Overwhelmed Founder

```json
{
  "name": "Overwhelmed Founder",
  "description": "Series A founder, everything is urgent, drops balls",
  "config": {
    "weeks": 6,
    "emailsPerWeek": 25,
    "urgentRate": 0.35,
    "responseRate": 0.60,
    "industries": ["SaaS", "B2B", "Tech"],
    "painPoints": [
      "Too many commitments",
      "Customer escalations",
      "Investor updates overdue",
      "Hiring urgency"
    ]
  }
}
```

### Template: Busy VP Sales

```json
{
  "name": "Busy VP Sales",
  "description": "VP Sales, pipeline management, lots of prospects",
  "config": {
    "weeks": 6,
    "emailsPerWeek": 30,
    "urgentRate": 0.25,
    "responseRate": 0.75,
    "industries": ["SaaS", "Enterprise Software"],
    "painPoints": [
      "Deal slippage",
      "Quota pressure",
      "Team coordination",
      "Prospect follow-ups"
    ]
  }
}
```

---

## CLI Usage

```bash
# Generate simple realistic inbox
npm run e2e:generate-simple founder-overwhelmed

# Custom weeks
npm run e2e:generate-simple vp-sales-busy 8

# Output
🚀 Generating simple realistic inbox...
   Template: founder-overwhelmed
   Weeks: 6
   Model: GPT-5 Nano

Step 1/3: Generating context... ✓ (3s)
Step 2/3: Generating 6 weeks of emails...
  Week 1/6... ✓ (8s)
  Week 2/6... ✓ (8s)
  Week 3/6... ✓ (8s)
  Week 4/6... ✓ (8s)
  Week 5/6... ✓ (8s)
  Week 6/6... ✓ (8s)
Step 3/3: Generating test labels... ✓ (12s)

✅ Generated inbox!
   Total emails: 152
   Signal: 91 (60%)
   Noise: 61 (40%)
   Urgent: 32 (21%)
   Test queries: 15

   Cost: ~$0.28
   Time: 65 seconds

📁 Saved to: tests/e2e/data/simple-inboxes/inbox-founder-1696358400000.json
```

---

## Quality Checks (Simple)

Just 3 basic checks:

```typescript
function validateSimpleInbox(inbox: SimpleInbox): ValidationResult {
  const issues: string[] = [];

  // Check 1: Email body length
  const tooShort = inbox.weeks
    .flatMap(w => w.emails)
    .filter(e => e.category === 'signal' && e.body.split(' ').length < 100);

  if (tooShort.length > 0) {
    issues.push(`${tooShort.length} signal emails are too short`);
  }

  // Check 2: Timestamp realism
  const weirdTimes = inbox.weeks
    .flatMap(w => w.emails)
    .filter(e => {
      const hour = new Date(e.timestamp).getHours();
      return hour < 6 || hour > 20;
    });

  if (weirdTimes.length > inbox.weeks.length * 2) {
    issues.push(`${weirdTimes.length} emails sent at odd hours`);
  }

  // Check 3: Ground truth coverage
  const totalEmails = inbox.weeks.flatMap(w => w.emails).length;
  const labeledEmails = Object.keys(inbox.groundTruth.emailLabels).length;

  if (labeledEmails < totalEmails * 0.95) {
    issues.push(`Only ${labeledEmails}/${totalEmails} emails labeled`);
  }

  return {
    passed: issues.length === 0,
    issues
  };
}
```

---

## Cost & Performance

### Per Inbox (6 weeks, ~150 emails)

| Metric | Value |
|--------|-------|
| AI calls | 8 (1 context + 6 weeks + 1 labels) |
| Total tokens in | ~20K |
| Total tokens out | ~60K |
| **Cost** | **~$0.03** (GPT-5 Nano) |
| **Time** | **~60-90 seconds** |

### Scaling

| Weeks | Emails | AI Calls | Cost | Time |
|-------|--------|----------|------|------|
| 3 | ~75 | 5 | ~$0.18 | ~40s |
| 6 | ~150 | 8 | ~$0.30 | ~70s |
| 10 | ~250 | 12 | ~$0.48 | ~110s |

---

## What You Get

### Output Files

```
inbox-founder-1696358400000/
├── context.json          # Persona + 20 people
├── week-1.json          # 25 emails
├── week-2.json          # 25 emails
├── week-3.json          # 25 emails
├── week-4.json          # 25 emails
├── week-5.json          # 25 emails
├── week-6.json          # 25 emails
├── ground_truth.json    # All labels + test queries
└── summary.json         # Stats
```

### Using with Tests

```typescript
// Load simple inbox
const inbox = await loadSimpleInbox('inbox-founder-1696358400000');

// Setup mock manager
await mockManager.setupSimpleInbox(inbox);

// Test with ground truth
const query = inbox.groundTruth.testQueries[0];
const result = await orchestrator.processUserInput(query.query, userId, [], undefined);

// Validate
expect(result.emails).toContainAll(query.expectedEmailIds);
```

---

## Migration from Current System

### Adapter

```typescript
// Adapter to convert simple inbox to old format
function convertSimpleToOld(simple: SimpleInbox): InboxData {
  const allEmails = simple.weeks.flatMap(w => w.emails);

  return {
    emails: allEmails.map(e => e.gmailFormat),
    calendar: [], // Can add if needed
    relationships: simple.context.keyPeople.map(convertPerson),
    metadata: {
      userProfile: convertPersona(simple.context.persona),
      generatedAt: new Date().toISOString()
    }
  };
}

// Works with existing tests
const simple = await simpleGenerator.generate('founder-overwhelmed');
const old = convertSimpleToOld(simple);
await mockManager.setupMockContext(old, old.metadata.userProfile);
```

---

## Implementation Plan (2 Weeks)

### Week 1: Core Generator
- [ ] Create `SimpleRealisticInboxGenerator` class (~300 lines)
- [ ] Implement 3-step generation (context, weeks, labels)
- [ ] Add JSON validation and cleanup
- [ ] Test with 4 templates

**Deliverable**: Working generator producing 150-email inboxes in ~60s

### Week 2: Integration & Polish
- [ ] Create CLI script
- [ ] Add 4 templates (founder, vp-sales, eng-manager, exec)
- [ ] Add simple validation (3 checks)
- [ ] Create adapter for existing tests
- [ ] Write documentation

**Deliverable**: Production-ready simple inbox system

---

## Comparison: Simple vs Comprehensive

| Feature | Simple (This Doc) | Comprehensive (Previous Doc) |
|---------|-------------------|------------------------------|
| **Lines of code** | ~500 | ~3000+ |
| **AI calls** | 8 per inbox | 40+ per inbox |
| **Generation time** | 60-90s | 4-5 min |
| **Cost** | ~$0.30 | ~$0.75 |
| **Emails generated** | 150-250 | 500-800 |
| **People in network** | 20 | 60+ |
| **Temporal coherence** | Week-to-week | 3-month narrative |
| **Complexity** | Low | High |
| **Setup time** | 2 weeks | 6 weeks |
| **Maintenance** | Easy | Complex |
| **Quality** | Good (85%+) | Excellent (90%+) |

**Recommendation**: Start with Simple, upgrade to Comprehensive later if needed.

---

## Next Steps

1. **Approve simplified approach** (vs comprehensive)
2. **Implement Week 1** (core generator)
3. **Test with 1 template** (validate approach)
4. **Implement Week 2** (CLI + templates)
5. **Generate reference inboxes** (4 templates × 2 variations = 8 inboxes)

**Total effort**: 2 weeks vs 6 weeks for comprehensive
**Total value**: 80% of the benefit with 20% of the work

Ready to start simple? 🚀
