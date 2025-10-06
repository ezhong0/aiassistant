# E2E Test Cost Optimization Guide

## Current Costs (per run)

**Full Test Run**: ~$0.015
- Query Generation: ~$0.001 (1 LLM call for 32 queries, GPT-5-mini)
- Query Execution: $0.00 (your system, no cost)
- Response Evaluation: ~$0.014 (32 LLM calls, 1 per query, GPT-5-nano minimal)

## Cost Breakdown by Component

| Component | Model | Tokens/Call | Calls | Cost/Run | Pricing |
|-----------|-------|-------------|-------|----------|---------|
| Query Generator | gpt-5-mini | ~5000 | 1 | $0.001 | $0.05/1M input, $0.40/1M output |
| Evaluator | gpt-5-nano (minimal) | ~6000 | 32 | $0.014 | $0.05/1M input, $0.40/1M output |
| **Total** | - | - | **33** | **$0.015** | - |

---

## Cost Reduction Strategies

### 1. ✅ Cache Generated Queries (Save ~7% = $0.001/run)

**Impact**: Eliminate query generation cost entirely after first run

```bash
# First run (generates & saves queries)
npm run e2e:test -- --count=1

# Subsequent runs (reuse cached queries)
npm run e2e:test -- --use-cached

# Or specify which cached file to use
npm run e2e:test -- --cached-queries=run-1759732986451.json
```

**Implementation**: Queries saved to `tests/e2e/data/generated-queries/` and reused

### 2. ✅ Use GPT-5-nano with Minimal Reasoning (Already Optimized!)

**Impact**: GPT-5-nano with minimal reasoning_effort is extremely cheap

GPT-5-nano is already the **cheapest reasoning model** ($0.05/1M input, $0.40/1M output).

| Model | Cost | Use Case |
|-------|------|----------|
| **gpt-5-nano (minimal)** | **$0.05/1M input, $0.40/1M output** | ✅ **Perfect for evaluation** |
| gpt-5-mini (low) | $0.05/1M input, $0.40/1M output | ✅ **Good for query generation** |
| gpt-4o-mini | $0.15/1M input, $0.60/1M output | ❌ More expensive than GPT-5-nano |

**90% Cache Discount**: GPT-5 models offer a 90% discount on cached tokens, which can further reduce costs when processing repeated content.

Changed in: `tests/e2e/evaluation-v2/multi-layer-evaluator.ts`

### 3. ✅ Run Fewer Queries During Development (Save ~67% = $0.010/run)

```bash
# Full test (32 queries) - $0.015
npm run e2e:test -- --count=1

# Quick test (~10 queries) - $0.005
npm run e2e:test -- --count=1 --categories=inbox_triage,dropped_balls

# Ultra-fast (5 queries) - $0.002
npm run e2e:test -- --count=1 --categories=inbox_triage
```

### 4. ✅ Use Mock Mode for Rapid Iteration (Save 100% = FREE)

```bash
# Test framework without AI costs
npm run e2e:test -- --mock
```

Uses simplified mock orchestrator, no real AI calls.

### 5. Cache Evaluation Results (Future Enhancement)

If running same queries repeatedly, cache evaluation results based on:
- Query hash
- Response hash
- Inbox hash

**Potential savings**: 80% on repeated runs

---

## Recommended Workflow

### During Active Development (Daily)
```bash
# Option 1: Use cached queries ($0.014/run)
npm run e2e:test -- --use-cached

# Option 2: Single category only ($0.002/run)
npm run e2e:test -- --use-cached --categories=inbox_triage
```

### Weekly Regression Testing
```bash
# Full test with fresh query generation ($0.015/run)
npm run e2e:test -- --count=1
```

### Before Release
```bash
# Comprehensive test with more queries (~$0.05/run)
npm run e2e:test -- --count=3
```

---

## Cost Comparison

**Note**: Costs are now extremely low with GPT-5-nano (minimal reasoning)!

| Scenario | Cost/Run | Use Case |
|----------|----------|----------|
| Full test, fresh queries | $0.015 | Weekly regression |
| Full test, cached queries | $0.014 | Daily iterations |
| Dev iteration (1 category) | $0.002 | Rapid dev |
| 10 dev iterations/day | $0.14 | Daily cost |
| **Monthly (200 runs)** | **$3** | **Monthly cost** |

**Savings vs. Initial Estimate**: ~94% (from $48/month to $3/month)

---

## Implementation Status

- ✅ GPT-5-nano (minimal) for evaluation (implemented - cheapest option!)
- ✅ GPT-5-mini (low) for query generation (implemented)
- ✅ Cached query support (implemented)
- ✅ Category filtering (implemented)
- ⏳ Evaluation result caching (planned - would save even more)
- ⏳ Prompt optimization (planned)

---

## Emergency Cost Caps

Set environment variable to abort tests if cost exceeds limit:

```bash
export E2E_MAX_COST_USD=0.10
npm run e2e:test
```

Test runner will estimate cost before running and abort if > $0.10.
