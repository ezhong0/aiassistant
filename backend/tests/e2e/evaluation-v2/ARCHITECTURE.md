# Multi-LLM Automated Testing Pipeline

## Architecture Overview

### Pre-Step: Inbox Generation (One-Time Setup)
```
┌─────────────────────────────────────────────────────────────────┐
│              INBOX GENERATION (Separate Step)                    │
└─────────────────────────────────────────────────────────────────┘

npm run e2e:generate-inbox founder   → inbox-01-founder.json
npm run e2e:generate-inbox executive → inbox-02-executive.json
npm run e2e:generate-inbox manager   → inbox-03-manager.json

Each inbox saved with:
- Generated emails (20-100)
- Complete ground truth labels
- Sender profiles
- Thread metadata
```

### Main Pipeline: Automated Testing
```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTOMATED TEST PIPELINE                       │
└─────────────────────────────────────────────────────────────────┘

1️⃣  LOAD SAVED INBOX
    ↓
    Reads: inbox-01-founder.json
    Output: Inbox with ground truth

2️⃣  QUERY GENERATOR LLM
    ↓
    Reads: CHATBOT_COMMANDS_EXAMPLES.md + Inbox context
    Generates: 10-20 queries relevant to THIS specific inbox
    Output: Query variations matching inbox content

3️⃣  CHATBOT SYSTEM (being evaluated)
    ↓
    Receives: Query + Inbox
    Processes: Through its pipeline
    Output: Response + Internal state (if available)

4️⃣  EVALUATOR LLM (multi-layer analysis)
    ↓
    Analyzes: Query understanding → Retrieval → Ranking → Presentation
    Output: Comprehensive diagnostic report per query

5️⃣  AGGREGATE RESULTS
    ↓
    Combines: All query results for this inbox
    Output: Full test suite report with trends
```

## Multi-Layer Evaluation

The evaluator analyzes each stage of the chatbot pipeline:

### Layer 1: Query Understanding (NLU)
**Question**: Did the chatbot correctly understand what the user wanted?

**Checks**:
- Intent classification correct?
- Key entities extracted? (person names, time ranges, etc.)
- Ambiguity handled appropriately?

**Example**:
```
Query: "Show me frustrated follow-ups"
✅ Good NLU: Understands need to find (isFollowUp=true AND sentiment=frustrated)
❌ Bad NLU: Only searches for keyword "frustrated", misses follow-up aspect
```

### Layer 2: Retrieval Quality
**Question**: Did it retrieve the right emails from the inbox?

**Checks**:
- Precision: % of retrieved emails that are correct
- Recall: % of correct emails that were retrieved
- Critical misses: Any P0 emails missed?

**Example**:
```
Query: "What needs my attention right now?"
Ground Truth: 5 urgent emails
Retrieved: 7 emails
✅ Included: 4/5 urgent (80% recall)
❌ Missed: 1 escalated customer issue
❌ Extra: 2 spam emails marked urgent (71% precision)
```

### Layer 3: Ranking Quality
**Question**: Are the most important results shown first?

**Checks**:
- Top 3 results appropriate?
- Critical items ranked high?
- nDCG score (normalized discounted cumulative gain)

**Example**:
```
Query: "Show me urgent emails"
Ranking:
1. ✅ Escalated customer issue (perfect)
2. ✅ 3rd reminder from investor (perfect)
3. ❌ Newsletter with "urgent" in subject (should be #10)
4. ✅ Overdue commitment to board (should be #3)

Score: Ranking partially correct, deceptive noise ranked too high
```

### Layer 4: Presentation Quality
**Question**: Is the response clear, actionable, and helpful?

**Checks**:
- Format appropriate? (list, summary, etc.)
- Key information highlighted?
- Actionable next steps provided?
- Tone appropriate?

**Example**:
```
Query: "Catch me up on the hiring project"
✅ Good: "3 candidates scheduled, 2 need follow-up. Sarah prefers Michael Chen."
❌ Bad: "Here are 15 emails about hiring..." (raw dump, no synthesis)
```

### Layer 5: Overall Success
**Question**: Would a real user be satisfied with this response?

**Checks**:
- Task completion: Did it solve the user's problem?
- Effort required: How many follow-up queries needed?
- Trust: Any hallucinations or errors?
- User satisfaction proxy: 0-10 rating

## Evaluation Report Format

```json
{
  "testId": "test-001",
  "query": "What needs my attention right now?",
  "timestamp": "2025-10-05T10:30:00Z",

  "overallScore": 72,
  "passed": false,
  "wouldUserBeSatisfied": "somewhat",

  "layerScores": {
    "queryUnderstanding": 85,
    "retrieval": 68,
    "ranking": 70,
    "presentation": 80,
    "overall": 72
  },

  "diagnosis": {
    "whatWorkedWell": [
      "Correctly identified 'attention' maps to urgent + important",
      "Good presentation format with clear priority ordering",
      "Fast response time"
    ],

    "whatFailed": [
      {
        "layer": "retrieval",
        "issue": "Missed escalated customer issue from Shopify",
        "severity": "critical",
        "impact": "Customer emergency not flagged to user",
        "suggestedFix": "Improve isEscalated detection in retrieval logic"
      },
      {
        "layer": "retrieval",
        "issue": "Included 2 spam emails marked 'urgent' in subject",
        "severity": "medium",
        "impact": "User wastes time on noise",
        "suggestedFix": "Add spam filter before urgency check"
      },
      {
        "layer": "ranking",
        "issue": "Deceptive newsletter ranked #3, should be filtered",
        "severity": "medium",
        "impact": "Important emails pushed down",
        "suggestedFix": "Penalize isDeceptiveNoise in ranking score"
      }
    ],

    "criticalErrors": [
      "Missed escalated customer issue - P0 email not surfaced"
    ],

    "missedOpportunities": [
      "Could have highlighted 'blocks others' emails",
      "Could have grouped related threads"
    ]
  },

  "metrics": {
    "precision": 71.4,
    "recall": 80.0,
    "f1": 75.5,
    "ndcg": 0.78,
    "criticalMissCount": 1
  },

  "recommendations": [
    "HIGH: Fix escalation detection - this is a showstopper bug",
    "MEDIUM: Add pre-filter for spam before urgency analysis",
    "LOW: Consider grouping related threads in presentation"
  ]
}
```

## Query Generation Strategy

The Query Generator LLM should create diverse, realistic queries:

### Input
- CHATBOT_COMMANDS_EXAMPLES.md categories
- Persona type (founder, exec, manager, IC)
- Complexity level (easy, medium, hard)

### Output
```json
{
  "category": "inbox_triage",
  "subcategory": "urgency_detection",
  "query": "What's time-sensitive today?",
  "expectedIntent": {
    "action": "filter_emails",
    "filters": ["urgent", "deadline_today", "time_sensitive"],
    "outputFormat": "ranked_list"
  },
  "variations": [
    "Show me anything urgent",
    "What can't wait?",
    "Time-sensitive items for today",
    "What needs a response ASAP?"
  ],
  "complexity": "easy",
  "reasoning": "Simple urgency detection, single criterion"
}
```

### Generation Strategy

1. **Sample across categories** (uniform distribution)
2. **Vary complexity** (30% easy, 50% medium, 20% hard)
3. **Include edge cases** (ambiguous queries, typos, multi-intent)
4. **Persona-specific** (founder cares about investors, IC doesn't)

## Implementation Plan

### Phase 1: Query Generator
```typescript
// Reads command doc, generates queries
generateTestQueries(commandsDoc, count=50) → Query[]
```

### Phase 2: Multi-Layer Evaluator
```typescript
// Analyzes each layer of chatbot
evaluateChatbotResponse(query, inbox, response, internalState) → Report
```

### Phase 3: Automated Pipeline
```typescript
// Runs full test suite automatically
runAutomatedTests(queryCount=50) → TestSuiteReport
```

### Phase 4: Regression Detection
```typescript
// Compares to baseline, flags regressions
detectRegressions(currentResults, baseline) → RegressionReport
```

## Success Criteria

### Per-Layer Targets
- **Query Understanding**: 95%+ intent classification accuracy
- **Retrieval**: 90%+ recall, 85%+ precision
- **Ranking**: Top-3 accuracy 90%+
- **Presentation**: 80%+ clarity score
- **Overall**: 85%+ user satisfaction proxy

### Critical Errors = Auto-Fail
- Missed P0 emails (escalations, overdue commitments from VIPs)
- Hallucinations (inventing facts)
- Security issues (exposing wrong user's data)

## Benefits of This Approach

1. **Fully Automated** - No manual test case writing
2. **Comprehensive Coverage** - Tests all command categories
3. **Deep Diagnostics** - Pinpoints exact failure layer
4. **Actionable** - Specific fix recommendations
5. **Scalable** - Can generate 100s of test queries
6. **Realistic** - Queries generated from real use cases
