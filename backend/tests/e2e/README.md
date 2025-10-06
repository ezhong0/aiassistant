# E2E Testing System

## Overview

This is a multi-LLM automated testing system for email chatbot evaluation. It uses 4 LLMs working together to:
1. Generate realistic test inboxes
2. Generate diverse test queries
3. Run your chatbot
4. Provide deep multi-layer analysis

## Directory Structure

```
e2e/
├── evaluation-v2/          # Main testing pipeline
│   ├── ARCHITECTURE.md     # System design documentation
│   ├── README.md           # User guide
│   ├── EVALUATION.md       # System analysis and improvements
│   ├── query-generator.ts  # LLM-based query generation
│   ├── multi-layer-evaluator.ts  # 5-layer evaluation system
│   ├── test-runner.ts      # Test orchestration
│   └── example.ts          # Working examples
│
├── generators/             # Inbox generation
│   ├── hyper-realistic-inbox.ts  # Main inbox generator
│   ├── relationship-graph.ts     # Realistic sender relationships
│   ├── noise-templates.ts        # Persona-aware spam/newsletters
│   ├── realistic-email-templates.ts
│   ├── thread-templates.ts
│   ├── temporal-engine.ts
│   └── language-patterns.ts
│
├── models/                 # Data models
│   └── advanced-ground-truth.ts  # Ground truth labeling system
│
├── scripts/                # Utility scripts
│   ├── generate-inbox.ts        # CLI for inbox generation
│   └── generate-simple-inbox.ts # Simple inbox generator
│
├── reporters/              # Result reporting
│   └── html-reporter.ts    # HTML report generation
│
├── mocks/                  # Test utilities
│   └── unified-mock-manager.ts
│
└── data/                   # Generated test data
    ├── generated-inboxes/  # Saved inboxes
    └── test-results/       # Test run results

```

## Quick Start

### 1. Generate Test Inbox

```bash
# Generate inbox with specific persona
npm run e2e:generate-inbox founder
npm run e2e:generate-inbox executive
npm run e2e:generate-inbox manager
```

Output: `data/generated-inboxes/inbox-01-founder.json`

### 2. Run Automated Tests

```typescript
import { runAutomatedTests } from './evaluation-v2/test-runner';
import { yourChatbotFunction } from './your-chatbot';

const result = await runAutomatedTests({
  inboxPath: './data/generated-inboxes/inbox-01-founder.json',
  commandsDocPath: './docs/CHATBOT_COMMANDS_EXAMPLES.md',
  outputDir: './data/test-results',
  generateQueryCount: 5, // Queries per category
  chatbotFunction: yourChatbotFunction,
});
```

### 3. Analyze Results

Results are saved to `data/test-results/run-{timestamp}.json` with:
- Overall pass/fail
- Per-layer scores (Query Understanding, Retrieval, Ranking, Presentation, Overall)
- Detailed diagnostics
- Specific fix recommendations
- Performance metrics

## Features

✅ **Automated Query Generation** - LLM generates queries from command documentation
✅ **Multi-Layer Evaluation** - Analyzes 5 distinct layers of chatbot performance
✅ **Ground Truth Filtering** - Semantic label-based filtering instead of manual specification
✅ **Persona-Aware Noise** - Same email categorized differently per user role
✅ **Regression Testing** - Baseline comparison to detect performance changes
✅ **Performance Metrics** - Cost and time tracking for optimization
✅ **Retry Logic** - Automatic retry for transient API failures
✅ **Rate Limiting** - Optimized for API rate limits
✅ **Parallel Execution** - 5-10x faster testing with concurrent evaluation

## Documentation

- **System Design**: `evaluation-v2/ARCHITECTURE.md`
- **User Guide**: `evaluation-v2/README.md`
- **System Analysis**: `evaluation-v2/EVALUATION.md`

## Recent Improvements (Oct 2025)

All 10 critical issues identified in system evaluation have been fixed:

1. ✅ Token limit handling - Commands doc chunking
2. ✅ Map serialization - Proper JSON serialization
3. ✅ Query validation - Validates LLM-generated queries
4. ✅ Non-email_list queries - Supports summary, boolean, calendar queries
5. ✅ Baseline comparison - Regression detection
6. ✅ Robust filter logic - Fuzzy matching for filters
7. ✅ Retry logic - Exponential backoff for API failures
8. ✅ Rate limiting - Optimized for 50 requests/min
9. ✅ Cost/time tracking - Full performance metrics
10. ✅ Improved mock chatbot - Demonstrates best practices

**New:** ⚡ **Parallel execution** - 5-10x faster testing for large test suites

## Next Steps

See `evaluation-v2/README.md` for detailed usage instructions and examples.
