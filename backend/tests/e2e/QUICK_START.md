# E2E Testing Quick Start

## TL;DR

```bash
# Run e2e tests with REAL 3-layer orchestrator (default)
npm run e2e:test

# Run with simplified mock (faster, doesn't test real code)
npm run e2e:test --mock

# Generate more queries
npm run e2e:test -- --count=10
```

---

## What Gets Tested

### Default (Real Orchestrator) ✅ RECOMMENDED

When you run `npm run e2e:test`, it tests **YOUR ACTUAL CODE**:

```
User Query: "Show me urgent emails"
    ↓
1. REAL QueryDecomposerService (Layer 1)
   - Calls OpenAI GPT-4
   - Generates execution graph
   - Plans parallel execution
    ↓
2. REAL ExecutionCoordinatorService (Layer 2)
   - Executes MetadataFilterStrategy
   - Executes SemanticAnalysisStrategy
   - Runs in parallel stages
   - Uses test inbox data (not Gmail API)
    ↓
3. REAL SynthesisService (Layer 3)
   - Calls OpenAI GPT-4
   - Generates natural language response
    ↓
4. Multi-Layer Evaluator
   - Scores each layer (0-100)
   - Identifies critical errors
   - Provides recommendations
    ↓
5. Enhanced HTML Report
   - Interactive charts
   - Layer breakdown
   - Performance metrics
```

**This finds real bugs in your 3-layer implementation!**

---

## Commands

### Generate Inbox (One-Time)
```bash
npm run e2e:generate-inbox founder    # 50 emails, founder persona
npm run e2e:generate-inbox executive  # 100 emails, executive persona
npm run e2e:generate-inbox quick-test # 20 emails, fast testing
```

### Run Tests

```bash
# Default: Real orchestrator, 5 queries per category
npm run e2e:test

# More queries
npm run e2e:test -- --count=10

# Specific categories
npm run e2e:test -- --categories="INBOX TRIAGE,SEARCH"

# Use mock orchestrator (faster, doesn't test real code)
npm run e2e:test --mock

# Specific inbox file
npm run e2e:test inbox-02-executive.json
```

### View Results

```bash
# HTML reports are auto-generated
open backend/tests/e2e/data/test-results/run-*.html

# JSON results
cat backend/tests/e2e/data/test-results/run-*.json | jq .
```

---

## Understanding Results

### HTML Report Shows:

1. **Dashboard**
   - Pass rate (%)
   - Critical errors count
   - Overall score (0-100)
   - Weakest layer

2. **Layer Performance Chart**
   - Query Understanding: Did Layer 1 parse intent correctly?
   - Retrieval: Did Layer 2 get the right emails?
   - Ranking: Are important ones first?
   - Presentation: Is Layer 3 output clear?

3. **Individual Test Results**
   - Per-query scores
   - Layer-by-layer breakdown
   - Critical errors highlighted
   - Recommendations (HIGH/MEDIUM/LOW priority)

4. **Performance Metrics**
   - Average query time
   - Slowest queries
   - API calls made
   - Estimated cost

---

## Interpreting Scores

| Score | Meaning | Action |
|-------|---------|--------|
| 90-100 | Excellent | No action needed |
| 80-89 | Good | Minor improvements |
| 70-79 | Acceptable | Review recommendations |
| 60-69 | Needs work | Fix issues flagged |
| <60 | Poor | Critical fixes needed |

### Layer-Specific Diagnostics

**Query Understanding (Layer 1) Low?**
- Check: Is QueryDecomposer parsing intents correctly?
- Fix: Update decomposition prompts

**Retrieval (Layer 2) Low?**
- Check: Are filters/strategies working?
- Fix: Debug MetadataFilterStrategy, KeywordSearchStrategy

**Ranking (Layer 2) Low?**
- Check: Are most important emails ranked first?
- Fix: Adjust scoring logic

**Presentation (Layer 3) Low?**
- Check: Is synthesis output clear?
- Fix: Update synthesis prompts

---

## Architecture

```
tests/e2e/
├── generators/
│   └── hyper-realistic-inbox.ts     # Inbox generation (50 emails)
├── evaluation-v2/
│   ├── query-generator.ts           # Auto-generate queries from commands.md
│   ├── multi-layer-evaluator.ts     # 5-layer LLM evaluation
│   └── test-runner.ts               # Orchestrates everything
├── integration/
│   ├── orchestrator-adapter.ts      # Bridges inbox ↔ orchestrator
│   ├── test-container.ts            # DI container with mock services
│   └── mock-services.ts             # Mock email/calendar services
├── reporters/
│   └── enhanced-html-reporter.ts    # Interactive HTML reports
└── scripts/
    └── run-e2e-tests.ts             # CLI entry point
```

---

## FAQ

### Q: Do I need to set up environment variables?

**A:** API key is automatically loaded from `/Users/edwardzhong/Projects/assistantapp/.env`.
No action needed.

### Q: How long does it take?

**A:** With parallel execution (default):
- 10 queries: ~30 seconds
- 50 queries: ~2 minutes
- 100 queries: ~4 minutes

### Q: How much does it cost?

**A:** Approximately $0.015 per query (2 OpenAI calls).
- 10 queries: ~$0.15
- 50 queries: ~$0.75
- 100 queries: ~$1.50

### Q: Can I test specific features?

**A:** Yes! Use categories:
```bash
npm run e2e:test -- --categories="INBOX TRIAGE"
npm run e2e:test -- --categories="DROPPED BALL DETECTION,COMMITMENT TRACKING"
```

### Q: What's the difference between real and mock orchestrator?

| Aspect | Real (Default) | Mock |
|--------|---------------|------|
| Tests your code? | ✅ Yes | ❌ No |
| Speed | Slower (LLM calls) | Faster |
| Cost | ~$0.015/query | $0 |
| Finds bugs? | ✅ Yes | Limited |
| Use when | Testing real impl | Testing framework |

---

## Troubleshooting

### "OPENAI_API_KEY not found"
Check that `/Users/edwardzhong/Projects/assistantapp/.env` contains:
```
OPENAI_API_KEY=sk-proj-...
```

### Tests failing with errors
1. Check HTML report for specific layer failures
2. Look at critical errors section
3. Follow recommendations (HIGH priority first)

### Scores lower than expected
1. Review layer-by-layer breakdown
2. Check if it's Query Understanding (Layer 1) or Retrieval (Layer 2)
3. Look at specific failed queries
4. Follow actionable recommendations

---

## Next Steps

1. **Run your first test**: `npm run e2e:test -- --count=3`
2. **View HTML report**: `open backend/tests/e2e/data/test-results/run-*.html`
3. **Fix critical errors** (if any)
4. **Re-run to verify**: `npm run e2e:test`
5. **Set up CI/CD** (optional): Run on every PR

---

**Ready to start?**

```bash
npm run e2e:test
```
