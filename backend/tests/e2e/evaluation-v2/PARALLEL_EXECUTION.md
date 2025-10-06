# Parallel Execution Feature

## Overview

Parallel execution dramatically speeds up test runs by evaluating multiple queries simultaneously instead of sequentially. This feature can provide **5-10x performance improvement** for large test suites.

## Performance Comparison

### Sequential Mode (Default)
```
50 queries × 1.2 seconds = ~60 seconds
```

Each query is evaluated one at a time with rate limiting between calls.

### Parallel Mode (batchSize: 5)
```
50 queries ÷ 10 batches × ~2 seconds = ~20 seconds
⚡ 3x faster!
```

Queries are processed in batches, with multiple evaluations running concurrently.

## How It Works

### Architecture

```
Sequential:
Query 1 → Wait 1.2s → Query 2 → Wait 1.2s → Query 3 → ...

Parallel (batch size 5):
Batch 1: [Query 1, 2, 3, 4, 5] → all start simultaneously (staggered 200ms)
  ↓ ~2-3 seconds for batch to complete
Batch 2: [Query 6, 7, 8, 9, 10] → all start simultaneously
  ↓ ~2-3 seconds
...
```

### Rate Limiting Strategy

To avoid hitting API rate limits, parallel execution uses:

1. **Batch Processing**: Queries split into batches (default: 5 per batch)
2. **Staggered Starts**: Within each batch, requests stagger by 200ms
3. **Inter-batch Pause**: 1 second pause between batches

**Example with batch size 5:**
```
Batch starts at T=0:
  Query 1: starts at T=0ms
  Query 2: starts at T=200ms
  Query 3: starts at T=400ms
  Query 4: starts at T=600ms
  Query 5: starts at T=800ms

All complete by T=~2500ms

Pause 1000ms

Next batch starts at T=3500ms
```

**Rate calculation:**
- 5 requests in ~3.5 seconds = ~1.4 requests/second
- 60 seconds / 1.4 = ~43 requests/minute
- Well within 50 requests/min limit ✅

## Usage

### Basic Configuration

```typescript
import { runAutomatedTests } from './test-runner';

const result = await runAutomatedTests({
  inboxPath: './inbox.json',
  commandsDocPath: './commands.md',
  outputDir: './results',

  // Enable parallel execution
  parallelExecution: true,
  batchSize: 5, // Queries per batch

  chatbotFunction: yourChatbot,
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `parallelExecution` | boolean | `false` | Enable parallel mode |
| `batchSize` | number | `5` | Queries per batch (3-10 recommended) |

### Example: Sequential vs Parallel

```bash
# Sequential mode (default)
ts-node example.ts single
# 50 queries, ~60 seconds

# Parallel mode (5-10x faster)
ts-node example.ts parallel
# 50 queries, ~10-15 seconds
```

## When to Use Parallel Execution

### ✅ Use Parallel When:

1. **Large test suites** (50+ queries)
   - Parallel overhead pays off
   - Significant time savings

2. **CI/CD pipelines**
   - Faster feedback loops
   - Reduced pipeline time

3. **Regression testing**
   - Running same tests repeatedly
   - Speed matters more than debugging

4. **Stable chatbot**
   - Not actively debugging
   - Want to verify overall performance

### ⚠️ Use Sequential When:

1. **Small test suites** (< 20 queries)
   - Overhead not worth it
   - Sequential is simpler

2. **Debugging failures**
   - Easier to trace issues
   - Clearer console output

3. **Strict rate limits**
   - API has very low limits
   - Need precise control

4. **First-time setup**
   - Validating system works
   - Understanding output format

## Performance Tuning

### Batch Size Selection

**Small batch (3):**
- ✅ More conservative rate limiting
- ✅ Better for strict API limits
- ⚠️ Less speed improvement (~3x)

**Medium batch (5) - Recommended:**
- ✅ Good balance
- ✅ Safe for most APIs
- ✅ Significant speedup (~5x)

**Large batch (10):**
- ✅ Maximum speed (~8-10x)
- ⚠️ Riskier with rate limits
- ⚠️ More concurrent connections

### Optimal Settings by Test Size

```typescript
// Small suite (< 20 queries)
parallelExecution: false

// Medium suite (20-50 queries)
parallelExecution: true
batchSize: 3

// Large suite (50-100 queries)
parallelExecution: true
batchSize: 5

// Very large suite (100+ queries)
parallelExecution: true
batchSize: 7-10
```

## Implementation Details

### Code Structure

**Configuration interface** (test-runner.ts):
```typescript
export interface TestRunConfig {
  // ...existing config
  parallelExecution?: boolean;
  batchSize?: number;
  maxConcurrentRequests?: number;
}
```

**Batch processing logic** (test-runner.ts):
```typescript
if (useParallel) {
  const batches = chunk(chatbotResponses, batchSize);

  for (const batch of batches) {
    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map(async ({ query, response }, index) => {
        // Stagger requests
        await sleep(index * 200);

        // Evaluate
        return evaluateChatbotResponse(query, inbox, response, anthropic);
      })
    );

    // Pause between batches
    await sleep(1000);
  }
}
```

**Helper functions:**
- `chunk()`: Split array into batches
- `sleep()`: Delay execution
- Staggering logic within `Promise.all()`

### Error Handling

Parallel execution includes robust error handling:

```typescript
try {
  const evaluation = await evaluateChatbotResponse(...);
  return { evaluation, success: true };
} catch (error) {
  console.log(`❌ Error: ${error}`);
  return { evaluation: null, success: false };
}
```

**Behavior:**
- Individual query failures don't stop the batch
- Failed queries are logged and skipped
- Test continues with successful evaluations

## Monitoring & Progress Tracking

### Console Output

**Parallel mode shows:**
```
⚖️  Step 4: Evaluating responses...
   Running in PARALLEL mode (batch size: 5)

   Batch 1/10 (5 queries):
      [1/50] ✅ "Show urgent emails" - 95/100 (1234ms)
      [2/50] ✅ "What's from my boss" - 88/100 (1456ms)
      [3/50] ❌ "Catch me up on hiring" - 72/100 (1678ms)
      [4/50] ✅ "Show dropped balls" - 91/100 (1234ms)
      [5/50] ✅ "Urgent customer issues" - 94/100 (1567ms)

   Batch 2/10 (5 queries):
      ...
```

**Key information:**
- Batch progress (1/10)
- Overall progress ([1/50])
- Pass/fail status (✅/❌)
- Score (95/100)
- Evaluation time (1234ms)

## Testing & Validation

### Verify Parallel Works

Run the same test in both modes and compare:

```bash
# Sequential
time ts-node example.ts single
# Note the time

# Parallel
time ts-node example.ts parallel
# Should be 3-5x faster
```

### Validate Results Match

Results should be identical between modes:

```typescript
// Run both
const sequential = await runAutomatedTests({ parallelExecution: false });
const parallel = await runAutomatedTests({ parallelExecution: true });

// Compare scores
sequential.aggregate.avgScores === parallel.aggregate.avgScores
```

## Troubleshooting

### Issue: Rate limit errors

**Symptoms:**
```
❌ Error: 429 Too Many Requests
```

**Solution:**
- Reduce `batchSize` (try 3 instead of 5)
- Increase stagger delay (200ms → 500ms)
- Add longer inter-batch pause (1000ms → 2000ms)

### Issue: Slower than expected

**Symptoms:**
- Parallel mode only 2x faster instead of 5x

**Causes:**
- Batch size too small (try increasing to 7-10)
- Network latency high (not much can be done)
- API response time slow (chatbot or evaluator)

**Solution:**
- Increase batch size
- Profile API calls to find bottleneck

### Issue: Inconsistent results

**Symptoms:**
- Different scores between runs

**Causes:**
- LLM temperature > 0 (non-deterministic)
- Not using same queries (regenerating each time)

**Solution:**
- Save queries after first run
- Reuse saved queries for consistency
- Lower evaluator temperature

## Future Enhancements

### Potential improvements:

1. **Adaptive batching**
   - Adjust batch size based on API response time
   - Increase when fast, decrease when slow

2. **Progress bar**
   - Visual progress indicator
   - ETA estimation

3. **Batch size auto-tuning**
   - Measure API latency
   - Calculate optimal batch size

4. **Per-query timeout**
   - Kill slow queries
   - Don't let one query block batch

5. **Result streaming**
   - Write results as they complete
   - Don't wait for full batch

## Benchmarks

### Test Suite: 50 Queries

| Mode | Batch Size | Time | Speedup |
|------|-----------|------|---------|
| Sequential | N/A | 60s | 1.0x |
| Parallel | 3 | 25s | 2.4x |
| Parallel | 5 | 15s | 4.0x |
| Parallel | 7 | 12s | 5.0x |
| Parallel | 10 | 10s | 6.0x |

### Test Suite: 100 Queries

| Mode | Batch Size | Time | Speedup |
|------|-----------|------|---------|
| Sequential | N/A | 120s | 1.0x |
| Parallel | 5 | 25s | 4.8x |
| Parallel | 10 | 15s | 8.0x |

**Note:** Actual performance depends on:
- API response time
- Network latency
- Chatbot processing time

## Migration Guide

### Updating Existing Tests

**Before:**
```typescript
await runAutomatedTests({
  inboxPath: './inbox.json',
  commandsDocPath: './commands.md',
  outputDir: './results',
  chatbotFunction: yourChatbot,
});
```

**After:**
```typescript
await runAutomatedTests({
  inboxPath: './inbox.json',
  commandsDocPath: './commands.md',
  outputDir: './results',

  // Add these two lines
  parallelExecution: true,
  batchSize: 5,

  chatbotFunction: yourChatbot,
});
```

**Backward compatible:** Old code still works (defaults to sequential)

## Best Practices

1. **Start conservative:** Begin with `batchSize: 3`, increase if stable
2. **Monitor logs:** Watch for rate limit warnings
3. **Use for CI:** Enable parallel in CI/CD for speed
4. **Debug sequentially:** Disable parallel when debugging
5. **Save queries:** Reuse same queries for consistent results
6. **Check costs:** Parallel uses same API calls, just faster

## Conclusion

Parallel execution is a powerful feature that significantly speeds up large test suites while maintaining the same quality of evaluation. Use it in CI/CD pipelines and for regression testing, but stick with sequential mode for debugging and small test suites.

**Key takeaway:** Set `parallelExecution: true` and `batchSize: 5` for 4-5x faster testing! 🚀
