# 3-Layer Architecture Tests

This directory contains tests for the new 3-layer architecture.

## Structure

```
tests/layers/
├── layer1/                      # Layer 1: Query Decomposition
│   └── query-decomposer.test.ts
├── layer2/                      # Layer 2: Execution
│   ├── execution-coordinator.test.ts
│   └── strategies/
│       ├── batch-thread-strategy.test.ts
│       ├── cross-reference-strategy.test.ts
│       ├── keyword-search-strategy.test.ts
│       ├── metadata-filter-strategy.test.ts
│       └── semantic-analysis-strategy.test.ts
├── layer3/                      # Layer 3: Synthesis
│   └── synthesis.test.ts
└── orchestrator.test.ts         # End-to-end orchestrator tests
```

## Implementation Schedule

Tests will be implemented alongside the corresponding phases:

- **Phase 1 (Week 2-3)**: Layer 1 tests
- **Phase 2 (Week 3-4)**: Layer 2 strategy tests
- **Phase 3 (Week 4)**: Layer 2 coordinator tests
- **Phase 4 (Week 5)**: Layer 3 tests
- **Phase 5 (Week 5)**: Orchestrator E2E tests

## Running Tests

During Phase 0, all tests are stubs and will pass.

```bash
# Run all layer tests
npm test -- tests/layers

# Run specific layer
npm test -- tests/layers/layer1
npm test -- tests/layers/layer2
npm test -- tests/layers/layer3

# Run orchestrator E2E tests
npm test -- tests/layers/orchestrator.test.ts
```

## Test Philosophy

1. **Bounded Context Testing**: Each layer test verifies token limits
2. **Parallel Execution Testing**: Verify concurrency works correctly
3. **Compression Testing**: Verify data compression at layer boundaries
4. **API Compatibility**: Verify same interface as old architecture

## Phase 0 Status

✅ Test structure created
⏳ Test implementations pending (Phases 1-5)
