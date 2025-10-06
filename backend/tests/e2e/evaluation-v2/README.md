## Multi-LLM Automated Testing System

**Fully automated chatbot testing with deep diagnostic analysis**

## Overview

This system uses **4 LLMs** to automatically test your email chatbot:

1. **Inbox Generator** → Creates realistic test inboxes with ground truth
2. **Query Generator** → Generates diverse queries from your command doc
3. **Your Chatbot** → Being evaluated
4. **Multi-Layer Evaluator** → Analyzes where it succeeded/failed

## Quick Start

### Step 1: Generate Test Inboxes (One-Time)

```bash
# Generate 3 different personas
npm run e2e:generate-inbox founder
npm run e2e:generate-inbox executive
npm run e2e:generate-inbox manager

# Result: inbox-01-founder.json, inbox-02-executive.json, inbox-03-manager.json
```

Each inbox contains:
- 20-100 realistic emails
- Complete ground truth labels
- Dropped balls, escalations, commitments, etc.

### Step 2: Run Automated Tests

```typescript
import { runAutomatedTests } from './test-runner';
import { yourChatbotFunction } from './your-chatbot';

const result = await runAutomatedTests({
  inboxPath: './data/generated-inboxes/inbox-01-founder.json',
  commandsDocPath: './docs/CHATBOT_COMMANDS_EXAMPLES.md',
  outputDir: './data/test-results',
  generateQueryCount: 5, // 5 queries per category
  chatbotFunction: yourChatbotFunction,
});

// Output:
// 🚀 Starting Automated Test Run
// 📧 Step 1: Loading inbox...
//    ✅ Loaded 50 emails (founder persona)
// 🔍 Step 2: Preparing queries...
//    ✅ Generated 25 queries
// 🤖 Step 3: Running chatbot...
//    [1/25] "What needs my attention right now?"
//       ✅ Returned 5 emails
//    [2/25] "Show me urgent emails"
//       ✅ Returned 4 emails
//    ...
// ⚖️  Step 4: Evaluating responses...
//    [1/25] Evaluating "What needs my attention right now?"
//       ❌ Score: 72/100
//       ⚠️  Critical: Missed escalated customer issue
//    [2/25] Evaluating "Show me urgent emails"
//       ✅ Score: 95/100
//    ...
// 📊 Step 5: Aggregating results...
//    ✅ Saved results to run-1759683020550.json
//
// 📈 Test Run Summary
//    Total Tests: 25
//    Passed: 18 (72.0%)
//    Failed: 7
//
// 📊 Average Scores by Layer:
//    Overall: 78.3/100
//    Query Understanding: 85.2/100
//    Retrieval: 72.1/100  ← Weakest
//    Ranking: 80.5/100
//    Presentation: 88.0/100
//
// ⚠️  Weakest Layer: retrieval
//
// 🚨 Critical Errors: 3
//    - Missed escalated customer issue email-42
//    - Missed overdue commitment to board email-18
//    - Missed 3rd reminder from investor email-31
```

### Step 3: Analyze Results

The system generates a comprehensive JSON report:

```json
{
  "runId": "run-1759683020550",
  "aggregate": {
    "summary": {
      "totalTests": 25,
      "passed": 18,
      "passRate": "72.0%"
    },
    "avgScores": {
      "overall": 78.3,
      "queryUnderstanding": 85.2,
      "retrieval": 72.1,  // ← Fix this!
      "ranking": 80.5,
      "presentation": 88.0
    },
    "weakestLayer": "retrieval",
    "criticalErrors": {
      "count": 3,
      "list": [
        "Missed escalated customer issue email-42",
        ...
      ]
    },
    "failures": {
      "byLayer": [
        { "layer": "retrieval", "count": 12 },
        { "layer": "ranking", "count": 3 },
        ...
      ],
      "bySeverity": [
        { "severity": "critical", "count": 3 },
        { "severity": "high", "count": 5 },
        ...
      ]
    }
  },
  "evaluations": [
    {
      "testId": "query-001",
      "query": "What needs my attention right now?",
      "overallScore": 72,
      "passed": false,
      "userSatisfaction": "somewhat",

      "layers": {
        "queryUnderstanding": {
          "score": 90,
          "details": "Correctly understood urgency intent...",
          "issues": [],
          "strengths": ["Good intent classification"]
        },
        "retrieval": {
          "score": 65,
          "details": "Precision 80%, Recall 70%...",
          "issues": ["Missed escalated customer issue"],
          "strengths": ["Good spam filtering"]
        },
        "ranking": {
          "score": 75,
          "details": "Top results mostly appropriate...",
          "issues": ["Newsletter ranked too high"],
          "strengths": ["VIP emails ranked first"]
        },
        ...
      },

      "diagnosis": {
        "whatWorkedWell": [
          "Correctly understood urgency intent",
          "Good spam filtering"
        ],
        "whatFailed": [
          {
            "layer": "retrieval",
            "issue": "Missed escalated customer issue email-42",
            "severity": "critical",
            "impact": "User won't see P0 customer emergency",
            "suggestedFix": "Add isEscalated check to urgency filter"
          }
        ],
        "criticalErrors": [
          "Missed escalated customer issue"
        ]
      },

      "metrics": {
        "precision": 80.0,
        "recall": 70.0,
        "f1": 74.7,
        "criticalMissCount": 1
      },

      "recommendations": [
        {
          "priority": "high",
          "recommendation": "Fix escalation detection in retrieval layer"
        },
        {
          "priority": "medium",
          "recommendation": "Add spam pre-filter before urgency check"
        }
      ]
    },
    ...
  ]
}
```

## How It Works

### Architecture

```
PRE-STEP: Inbox Generation (Separate, One-Time)
├─ npm run e2e:generate-inbox founder
├─ Generates realistic inbox with ground truth
└─ Saves to inbox-01-founder.json

MAIN PIPELINE: Automated Testing
├─ 1. Load saved inbox
├─ 2. Query Generator LLM
│     ├─ Reads CHATBOT_COMMANDS_EXAMPLES.md
│     ├─ Analyzes inbox content
│     └─ Generates 10-20 relevant queries
├─ 3. Your Chatbot (being tested)
│     └─ Processes each query
├─ 4. Multi-Layer Evaluator LLM
│     ├─ Analyzes query understanding
│     ├─ Checks retrieval quality
│     ├─ Validates ranking
│     ├─ Evaluates presentation
│     └─ Assigns overall success score
└─ 5. Aggregate results
      └─ Comprehensive diagnostic report
```

### Multi-Layer Evaluation

The evaluator analyzes **5 layers** of your chatbot:

#### Layer 1: Query Understanding (NLU)
**Did it understand what the user wanted?**

```
Query: "Show me frustrated follow-ups"

✅ Good: Understands need to filter isFollowUp=true AND sentiment=frustrated
❌ Bad: Only searches for keyword "frustrated"

Score: 90/100
```

#### Layer 2: Retrieval Quality
**Did it retrieve the right emails?**

```
Expected: 5 urgent emails
Retrieved: 7 emails
  ✅ 4 correct urgent emails
  ❌ Missed 1 escalated issue (critical!)
  ❌ Included 2 spam marked "urgent"

Precision: 57% (4 correct / 7 returned)
Recall: 80% (4 found / 5 expected)
Score: 65/100 (low due to critical miss)
```

#### Layer 3: Ranking Quality
**Are important results shown first?**

```
Ranking:
  1. ✅ Escalated customer issue
  2. ✅ 3rd reminder from investor
  3. ❌ Newsletter (should be #10)
  4. ✅ Overdue board commitment

Score: 75/100
```

#### Layer 4: Presentation Quality
**Is the response clear and actionable?**

```
✅ Good: "3 urgent emails: 2 customer issues, 1 investor follow-up"
❌ Bad: "email-1, email-5, email-12" (not helpful)

Score: 85/100
```

#### Layer 5: Overall Success
**Would a real user be satisfied?**

```
Satisfaction: "somewhat"
- Task completion: Partial (missed critical email)
- Effort: Would need follow-up query
- Trust: No hallucinations

Score: 72/100
```

### Query Generation

The Query Generator LLM creates **diverse, realistic queries** based on:

1. **Command categories** from your doc
2. **Inbox content** (only generates queries that make sense for this inbox)
3. **Complexity distribution** (30% easy, 50% medium, 20% hard)
4. **Persona awareness** (founder queries differ from IC queries)

Example generated queries:

```json
[
  {
    "category": "inbox_triage",
    "query": "What needs my attention right now?",
    "complexity": "easy",
    "expectedIntent": {
      "action": "filter_emails",
      "filters": ["urgent", "important"]
    }
  },
  {
    "category": "dropped_balls",
    "query": "Show me escalated threads from customers",
    "complexity": "medium",
    "expectedIntent": {
      "action": "filter_emails",
      "filters": ["escalated", "sender_type_customer"]
    }
  },
  {
    "category": "context_recovery",
    "query": "Catch me up on the hiring project - who are the candidates and what's the status?",
    "complexity": "hard",
    "expectedIntent": {
      "action": "summarize_thread",
      "filters": ["topic_hiring"],
      "entities": {
        "project": "hiring",
        "info_needed": ["candidates", "status"]
      }
    }
  }
]
```

## Integration with Your Chatbot

Replace the mock `yourChatbotFunction` with your actual implementation:

```typescript
// example.ts
async function yourChatbotFunction(
  inbox: GeneratedInbox,
  query: string
): Promise<ChatbotResponse> {
  // Call your actual chatbot API
  const response = await yourChatbotAPI.processQuery({
    query,
    emails: inbox.emails,
    userId: 'test-user',
  });

  return {
    type: 'email_list',
    emailIds: response.relevantEmailIds,
    ranking: response.rankedResults,
    presentation: response.formattedOutput,

    // Optional: expose internal state for deeper evaluation
    internalState: {
      parsedIntent: response.intent,
      retrievalQuery: response.retrievalParams,
      rankingScores: response.scores,
      processingTime: response.timeMs,
    },
  };
}
```

## Use Cases

### 1. Development Testing
Test as you build new features:

```bash
# Generate inbox once
npm run e2e:generate-inbox founder

# Run tests after each change
ts-node example.ts single
```

### 2. Regression Testing
Detect when changes break existing functionality:

```bash
# First run: save queries
ts-node example.ts single
# Queries saved to generated-queries.json

# After code changes: run with same queries
ts-node example.ts regression
# Compare results to baseline
```

### 3. Cross-Persona Testing
Ensure chatbot works for all user types:

```bash
# Generate inboxes for each persona
npm run e2e:generate-inbox founder
npm run e2e:generate-inbox executive
npm run e2e:generate-inbox manager

# Test all
ts-node example.ts multiple
```

### 4. Performance Tuning
Identify and fix weak layers:

```
Results show:
  ⚠️  Weakest Layer: retrieval (65/100 avg)

Action:
1. Review failed retrieval cases
2. Fix retrieval logic
3. Re-run tests
4. Confirm improvement
```

## Files

```
evaluation-v2/
├── ARCHITECTURE.md              ← Design doc
├── README.md                    ← This file
├── query-generator.ts           ← LLM query generator
├── multi-layer-evaluator.ts     ← LLM evaluator with deep analysis
├── test-runner.ts               ← Orchestrates everything
└── example.ts                   ← Working examples
```

## Configuration

### Query Generation

```typescript
{
  generateQueryCount: 5,           // Queries per category
  queryCategories: [               // Filter categories
    'INBOX TRIAGE',
    'DROPPED BALL DETECTION',
  ],
  complexityDistribution: {
    easy: 30,   // %
    medium: 50,
    hard: 20,
  },
}
```

### Evaluation Thresholds

Edit `multi-layer-evaluator.ts` to adjust:
- Pass/fail thresholds
- Critical error definitions
- Severity levels

## Advanced Features

### Parallel Execution (5-10x Faster)

For large test suites, enable parallel execution to dramatically speed up testing:

```typescript
const result = await runAutomatedTests({
  inboxPath: './data/generated-inboxes/inbox-01-founder.json',
  commandsDocPath: './docs/CHATBOT_COMMANDS_EXAMPLES.md',
  outputDir: './data/test-results',
  generateQueryCount: 10,

  // Enable parallel execution
  parallelExecution: true,
  batchSize: 5, // Evaluate 5 queries simultaneously

  chatbotFunction: yourChatbotFunction,
});
```

**Performance comparison:**
```
Sequential (default):
  50 queries × 1.2s = ~60 seconds

Parallel (batchSize: 5):
  50 queries ÷ 5 batches × ~2s = ~10-15 seconds
  ⚡ 4-6x faster!
```

**When to use:**
- ✅ Large test suites (50+ queries)
- ✅ Stable chatbot implementation
- ✅ CI/CD environments

**When not to use:**
- ⚠️ Small test suites (< 20 queries) - overhead not worth it
- ⚠️ Debugging specific failures - sequential easier to trace
- ⚠️ API rate limits are very strict

**Configuration:**
- `parallelExecution`: Enable/disable (default: false)
- `batchSize`: Queries per batch (default: 5, recommended: 3-10)
- Automatic rate limiting (200ms stagger between parallel requests)

### Expose Internal State
If your chatbot exposes internal state, the evaluator can provide deeper insights:

```typescript
internalState: {
  parsedIntent: {
    action: 'filter',
    filters: ['urgent'],
    confidence: 0.95,
  },
  retrievalQuery: {
    // What query was actually run
  },
  rankingScores: {
    // How emails were scored
  },
}

// Evaluator can now say:
// "Intent was correctly parsed (confidence 0.95) but
//  retrieval query missed isEscalated=true filter"
```

### Custom Evaluation Criteria
Extend the evaluator prompt to add domain-specific checks:

```typescript
// In multi-layer-evaluator.ts
const customChecks = `
## Custom Check: Email Privacy
Ensure chatbot never returns emails from other users

## Custom Check: Calendar Integration
If query mentions meetings, check calendar was queried
`;
```

## Success Metrics

### Target Scores
- **Query Understanding**: 95%+
- **Retrieval**: 90%+ recall, 85%+ precision
- **Ranking**: Top-3 accuracy 90%+
- **Presentation**: 85%+ clarity
- **Overall**: 85%+ user satisfaction

### Critical Errors = Auto-Fail
- Missed P0 emails (escalations, VIP dropped balls)
- Hallucinations (inventing facts)
- Privacy violations (wrong user's data)

## Next Steps

1. ✅ Generate test inboxes
2. ✅ Run example test
3. ✅ Integrate your chatbot
4. ✅ Analyze results
5. ✅ Fix weakest layer
6. ✅ Re-run tests
7. ✅ Repeat until target scores achieved

## Troubleshooting

**"Failed to parse evaluation response"**
- LLM didn't return valid JSON
- Try adjusting temperature (default: 0.3)
- Check API rate limits

**"Queries don't match inbox content"**
- Query generator didn't understand inbox
- Regenerate with more context
- Or manually curate queries

**"All tests failing"**
- Check chatbot function is working
- Verify it returns correct format
- Start with simple queries

## Questions?

See `ARCHITECTURE.md` for full design details.
