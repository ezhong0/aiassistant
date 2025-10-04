# Migration Plan: 3-Layer Progressive Decomposition Architecture

**Purpose**: Migrate from 4-prompt iterative architecture to 3-layer bounded-context architecture

**Philosophy**: Bounded context + parallel execution + compression funnels = predictable performance

**Status**: Phase 0-1 Complete
**Timeline**: 5 weeks
**Priority**: High - Complete architectural rewrite

---

## Executive Summary

### The Core Problem

Current architecture accumulates unbounded context through iterative loops, leading to:
- Token explosion (150K+ tokens for complex queries)
- Unpredictable costs ($0.0005+ per request)
- Sequential execution (8-15 seconds response time)
- Self-termination decisions (agent decides when to stop, usually too late)

### The Solution

3-layer architecture with progressive decomposition:
- **Layer 1**: Decompose query into execution DAG (2-5KB output)
- **Layer 2**: Execute DAG in parallel stages with bounded context (10-20KB output)
- **Layer 3**: Synthesize findings into response (1-2KB output)

**Total**: 40-60K tokens vs 150K+ tokens (60% reduction)

### Key Innovation

**Information flows through compression funnels** - each layer produces structured, bounded summaries rather than accumulating raw data. No layer sees the full conversation history or raw content.

---

## Part 1: First Principles Analysis

### What We're Actually Building

**Core capability**: Natural language → structured data access → natural language response

**Current flow**:
```
User query
  ↓
Master Prompt 1: Intent Understanding
  ↓
Master Prompt 2: Context Update (iteration 1)
  ↓ SubAgent Prompt 1 + 2
Master Prompt 2: Context Update (iteration 2)
  ↓ SubAgent Prompt 1 + 2
Master Prompt 2: Context Update (iteration N)
  ↓
Response
```

**Problem**: N iterations × 4 prompts = 4N LLM calls with accumulated context

**Proposed flow**:
```
User query
  ↓
Layer 1: Query Decomposition (1 LLM call)
  → Creates execution DAG with dependencies
  ↓
Layer 2: Parallel Evidence Gathering
  → Stage 1: parallel_group_1 nodes (M parallel LLM calls)
  → Stage 2: parallel_group_2 nodes (P parallel LLM calls)
  → Stage 3: parallel_group_3 nodes (Q parallel LLM calls)
  ↓
Layer 3: Synthesis (1 LLM call)
  → Receives only summaries from Layer 2
  ↓
Response
```

**Result**: 1 + M + P + Q + 1 LLM calls, but each has **bounded context**

### Critical Properties

1. **Bounded context at every stage**
   - Layer 1 input: User query + last 2-3 turns (3-5K tokens)
   - Layer 2 input per node: Task-specific data only (1-3K tokens each)
   - Layer 3 input: Summaries only, not raw data (10-20K tokens)

2. **No unbounded loops**
   - Execution graph is complete upfront
   - No self-termination decisions
   - Parallel groups execute independently

3. **Compression at boundaries**
   - Layer 1 → Layer 2: Execution graph (structured JSON)
   - Layer 2 → Layer 3: Structured summaries (no raw emails/events)
   - Layer 3 → User: Natural language response

4. **Parallelization by design**
   - Nodes with no dependencies execute simultaneously
   - Independent API calls run in parallel
   - Batch LLM analysis uses multiple concurrent calls

---

## Part 2: Current vs. Proposed Architecture

### Current Architecture Map

```
src/
├── agents/
│   ├── master.agent.ts          [346 lines] ❌ REPLACE
│   ├── email.agent.ts            [200 lines] ❌ REPLACE
│   └── calendar.agent.ts         [200 lines] ❌ REPLACE
├── services/
│   ├── prompt-builders/
│   │   ├── master-agent/
│   │   │   ├── intent-understanding-prompt-builder.ts  ❌ REPLACE
│   │   │   └── context-update-prompt-builder.ts        ❌ REPLACE
│   │   └── sub-agent/                                   ❌ REPLACE
│   ├── domain/
│   │   ├── email-domain.service.ts    ✅ KEEP (adapt interface)
│   │   └── calendar-domain.service.ts ✅ KEEP (adapt interface)
│   ├── generic-ai.service.ts          ✅ KEEP (add methods)
│   ├── context-manager.service.ts     ❌ DELETE (not needed)
│   └── token-manager.ts               ✅ KEEP (for now)
├── framework/
│   ├── agent-factory.ts               ❌ DELETE
│   ├── base-subagent.ts               ❌ DELETE
│   └── tool-registry.ts               ✅ KEEP (useful for mapping)
└── routes/
    └── chat.routes.ts                 ⚠️  MODIFY (same interface)
```

### Proposed Architecture Map

```
src/
├── layers/
│   ├── layer1-decomposition/
│   │   ├── query-decomposer.service.ts       [NEW] 200 lines
│   │   ├── decomposition-prompt-builder.ts   [NEW] 150 lines
│   │   └── execution-graph.types.ts          [NEW] 100 lines
│   ├── layer2-execution/
│   │   ├── execution-coordinator.service.ts  [NEW] 300 lines
│   │   ├── strategies/
│   │   │   ├── metadata-filter-strategy.ts   [NEW] 100 lines
│   │   │   ├── keyword-search-strategy.ts    [NEW] 100 lines
│   │   │   ├── batch-thread-strategy.ts      [NEW] 200 lines
│   │   │   ├── cross-reference-strategy.ts   [NEW] 150 lines
│   │   │   └── semantic-analysis-strategy.ts [NEW] 150 lines
│   │   ├── strategy-registry.ts              [NEW] 100 lines
│   │   └── execution.types.ts                [NEW] 100 lines
│   └── layer3-synthesis/
│       ├── synthesis.service.ts              [NEW] 200 lines
│       ├── synthesis-prompt-builder.ts       [NEW] 150 lines
│       └── synthesis.types.ts                [NEW] 50 lines
├── services/
│   ├── orchestrator.service.ts               [NEW] 250 lines
│   ├── domain/
│   │   ├── email-domain.service.ts           [KEEP + ADAPT]
│   │   └── calendar-domain.service.ts        [KEEP + ADAPT]
│   └── generic-ai.service.ts                 [KEEP + EXTEND]
└── routes/
    └── chat.routes.ts                        [MODIFY] Minimal changes
```

**Total new code**: ~2400 lines
**Total deleted code**: ~2000 lines
**Net change**: +400 lines (but better architecture)

---

## Part 3: Detailed Component Design

### Layer 1: Query Decomposition Service

**Responsibility**: Transform natural language into execution DAG

**Input** (3-5K tokens):
```typescript
interface DecompositionInput {
  user_query: string;
  conversation_history: ConversationMessage[]; // Last 2-3 turns only
  user_context: {
    email_accounts: Array<{id: string; email: string; primary?: boolean}>;
    calendars: Array<{id: string; name: string; primary?: boolean}>;
    timezone: string;
  };
  current_timestamp: string;
}
```

**Output** (2-5K tokens):
```typescript
interface ExecutionGraph {
  query_classification: {
    type: 'direct' | 'filtered_search' | 'investigative' | 'cross_domain' | 'write_command';
    complexity: 'simple' | 'moderate' | 'complex';
    domains: Array<'email' | 'calendar'>;
    reasoning: string;
  };
  information_needs: InformationNode[];
  synthesis_instructions: {
    task: string;
    ranking_criteria: string;
    presentation_format: string;
    user_preferences: string;
  };
  resource_estimate: {
    total_items_accessed: number;
    total_llm_calls: number;
    estimated_tokens: number;
    estimated_time_seconds: number;
    estimated_cost_usd: number;
    user_should_confirm: boolean;
  };
}

interface InformationNode {
  id: string;
  description: string;
  type: 'metadata_filter' | 'keyword_search' | 'batch_thread_read' |
        'cross_reference' | 'semantic_analysis';
  strategy: {
    method: string;
    params: Record<string, unknown>;
  };
  depends_on: string[];
  parallel_group: number;
  expected_cost: {
    tokens: number;
    llm_calls: number;
    time_seconds: number;
  };
}
```

**Key design decisions**:
1. **Single LLM call**: All decomposition happens in one prompt
2. **Explicit dependencies**: DAG structure prevents infinite loops
3. **Bounded searches**: Every node has max_results, time_range limits
4. **Cost estimation**: Transparent to user before execution
5. **Strategy selection**: LLM chooses most efficient approach

**Prompt structure** (from design doc):
- Step-by-step analysis process
- Query classification → Information needs → Dependencies → Strategies → Bounds
- Output: Pure JSON, no prose
- Emphasis on parallelization and efficiency

### Layer 2: Execution Coordinator

**Responsibility**: Execute DAG in parallel stages, maintain bounded context

**Architecture**:
```typescript
class ExecutionCoordinator {
  async execute(graph: ExecutionGraph, userId: string): Promise<ExecutionResults> {
    const nodeResults = new Map<string, NodeResult>();

    // Group nodes by parallel_group
    const stages = this.groupByStage(graph.information_needs);

    // Execute each stage sequentially, nodes within stage in parallel
    for (const [stageNum, nodes] of stages.entries()) {
      logger.info(`Executing stage ${stageNum}`, { nodeCount: nodes.length });

      // Execute all nodes in this stage concurrently
      const stageResults = await Promise.allSettled(
        nodes.map(node => this.executeNode(node, nodeResults, userId))
      );

      // Store results
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const result = stageResults[i];

        if (result.status === 'fulfilled') {
          nodeResults.set(node.id, result.value);
        } else {
          // Handle failure - store error but continue
          nodeResults.set(node.id, {
            success: false,
            error: result.reason.message,
            node_id: node.id
          });
        }
      }
    }

    return { nodeResults };
  }

  private async executeNode(
    node: InformationNode,
    previousResults: Map<string, NodeResult>,
    userId: string
  ): Promise<NodeResult> {
    // Resolve dependencies (inject results from previous nodes)
    const resolvedParams = this.resolveParams(node.strategy.params, previousResults);

    // Get appropriate strategy executor
    const strategy = this.strategyRegistry.get(node.type);

    // Execute with bounded context (only what this node needs)
    const result = await strategy.execute(resolvedParams, userId);

    return {
      success: true,
      node_id: node.id,
      data: result, // Structured summary, not raw data
      tokens_used: result.metadata?.tokens_used || 0
    };
  }
}
```

**Key design decisions**:
1. **Stage-based execution**: Sequential stages, parallel within stage
2. **Dependency resolution**: Inject results using {{node_id.field}} syntax
3. **Failure handling**: Continue execution even if node fails
4. **Bounded context**: Each node sees only its params + dependencies
5. **No cross-node context**: Nodes don't know about each other

### Layer 2: Strategy Executors

Each strategy type handles a different information gathering approach:

#### 1. Metadata Filter Strategy

**No LLM needed** - pure API filtering

```typescript
class MetadataFilterStrategy {
  async execute(params: MetadataFilterParams, userId: string): Promise<FilterResult> {
    const { filters, max_results, time_range } = params;

    // Example: Gmail API filter
    const query = this.buildGmailQuery(filters, time_range);
    const messages = await this.gmailService.search(userId, query, max_results);

    return {
      count: messages.length,
      items: messages.map(m => ({
        id: m.id,
        from: m.from,
        subject: m.subject,
        date: m.date,
        snippet: m.snippet.substring(0, 200)
      })),
      metadata: { tokens_used: 0, llm_calls: 0 }
    };
  }
}
```

#### 2. Batch Thread Read Strategy

**LLM-powered** but with bounded context per thread

```typescript
class BatchThreadReadStrategy {
  async execute(params: BatchThreadParams, userId: string): Promise<ThreadAnalysisResult> {
    const { thread_ids, extract_fields, batch_size } = params;

    // Process threads in batches to avoid overwhelming LLM
    const batches = this.chunkArray(thread_ids, batch_size);
    const allResults = [];

    for (const batch of batches) {
      // Execute batch in parallel (5-10 concurrent LLM calls)
      const batchResults = await Promise.all(
        batch.map(threadId => this.analyzeThread(threadId, extract_fields, userId))
      );

      allResults.push(...batchResults);
    }

    return {
      count: allResults.length,
      threads: allResults, // Array of structured summaries
      metadata: {
        tokens_used: allResults.reduce((sum, r) => sum + r.tokens_used, 0),
        llm_calls: allResults.length
      }
    };
  }

  private async analyzeThread(
    threadId: string,
    extractFields: string[],
    userId: string
  ): Promise<ThreadSummary> {
    // Get thread content
    const thread = await this.gmailService.getThread(userId, threadId);

    // Build prompt for single thread analysis
    const prompt = this.buildThreadAnalysisPrompt(thread, extractFields);

    // Call LLM with bounded context (just this one thread)
    const result = await this.aiService.structuredExtract(prompt, {
      schema: this.getExtractionSchema(extractFields),
      maxTokens: 500 // Bounded output
    });

    return {
      thread_id: threadId,
      extracted: result,
      tokens_used: prompt.length / 4 + 500 // Rough estimate
    };
  }
}
```

**Critical**: Each thread analyzed independently, max 500 tokens output per thread

#### 3. Cross-Reference Strategy

**LLM-powered** for ranking/filtering but receives summaries only

```typescript
class CrossReferenceStrategy {
  async execute(params: CrossRefParams, userId: string): Promise<CrossRefResult> {
    const { sources, operation, rank_by, take_top } = params;

    // Get results from previous nodes (already summarized)
    const sourceData = sources.map(sourceId => this.getNodeResult(sourceId));

    // Build prompt to rank/filter
    const prompt = this.buildCrossRefPrompt(sourceData, operation, rank_by);

    // Single LLM call to process summaries
    const result = await this.aiService.structuredExtract(prompt, {
      schema: this.getCrossRefSchema(),
      maxTokens: 2000
    });

    return {
      operation_summary: result.summary,
      ranked_results: result.items.slice(0, take_top),
      metadata: {
        tokens_used: prompt.length / 4 + 2000,
        llm_calls: 1
      }
    };
  }
}
```

**Key**: Receives summaries (10-20KB) not raw data (100KB+)

### Layer 3: Synthesis Service

**Responsibility**: Transform structured findings into natural language

```typescript
class SynthesisService {
  async synthesize(
    originalQuery: string,
    executionGraph: ExecutionGraph,
    results: ExecutionResults,
    userPreferences: UserPreferences
  ): Promise<SynthesisResult> {
    // Build synthesis prompt
    const prompt = this.buildSynthesisPrompt({
      original_query: originalQuery,
      investigation_summary: this.summarizeExecution(executionGraph),
      structured_findings: this.formatFindings(results),
      resource_usage: this.calculateResourceUsage(results),
      user_preferences: userPreferences
    });

    // Single LLM call to generate response
    const response = await this.aiService.chat({
      messages: [
        { role: 'system', content: this.getSystemPrompt() },
        { role: 'user', content: prompt }
      ],
      maxTokens: 2000, // Bounded response
      temperature: 0.7
    });

    return {
      message: response.content,
      metadata: {
        tokens_used: prompt.length / 4 + 2000,
        findings_count: results.nodeResults.size
      }
    };
  }

  private formatFindings(results: ExecutionResults): StructuredFindings {
    // Convert node results to concise summaries
    // Remove raw data, keep only structured extracts
    return {
      information_gathered: Array.from(results.nodeResults.values()).map(r => ({
        node_id: r.node_id,
        summary: r.data.summary || this.generateSummary(r.data),
        key_findings: r.data.items?.slice(0, 10) // Limit items
      }))
    };
  }
}
```

**Key**: Never sees raw email bodies or full thread content, only summaries

### Orchestrator Service

**Responsibility**: Coordinate the 3 layers, same API as current MasterAgent

```typescript
class OrchestratorService {
  async processUserInput(
    userInput: string,
    userId: string,
    conversationHistory: ConversationMessage[],
    previousState?: any
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    // LAYER 1: Decomposition
    logger.info('Layer 1: Query Decomposition');
    const decomposer = this.container.resolve<QueryDecomposer>('queryDecomposer');

    const executionGraph = await decomposer.decompose({
      user_query: userInput,
      conversation_history: conversationHistory.slice(-3), // Last 3 turns only
      user_context: await this.getUserContext(userId),
      current_timestamp: new Date().toISOString()
    });

    // Check if user confirmation needed (expensive query)
    if (executionGraph.resource_estimate.user_should_confirm) {
      return {
        message: this.buildConfirmationMessage(executionGraph),
        success: true,
        masterState: { executionGraph, awaiting_confirmation: true },
        metadata: { workflowAction: 'awaiting_confirmation' }
      };
    }

    // LAYER 2: Execution
    logger.info('Layer 2: Parallel Execution', {
      stageCount: this.countStages(executionGraph),
      nodeCount: executionGraph.information_needs.length
    });

    const coordinator = this.container.resolve<ExecutionCoordinator>('executionCoordinator');
    const executionResults = await coordinator.execute(executionGraph, userId);

    // LAYER 3: Synthesis
    logger.info('Layer 3: Synthesis');
    const synthesizer = this.container.resolve<SynthesisService>('synthesisService');

    const synthesis = await synthesizer.synthesize(
      userInput,
      executionGraph,
      executionResults,
      await this.getUserPreferences(userId)
    );

    return {
      message: synthesis.message,
      success: true,
      masterState: { executionGraph, executionResults },
      metadata: {
        processingTime: Date.now() - startTime,
        totalSteps: executionGraph.information_needs.length,
        tokensUsed: this.calculateTotalTokens(executionResults, synthesis)
      }
    };
  }
}
```

**Key**: Same interface as current MasterAgent (drop-in replacement)

---

## Part 4: Migration Strategy

### Phase 0: Preparation ✅ COMPLETE

**Goal**: Set up infrastructure

**Completed**:
- ✅ Created `/src/layers` directory structure
- ✅ Defined all TypeScript interfaces and types
- ✅ Set up strategy registry framework
- ✅ Added feature flag `ENABLE_3_LAYER_ARCH` (default: false)
- ✅ Updated DI container to support both architectures
- ✅ Created new test suite structure

**Status**: Complete (see PHASE_0_COMPLETE.md)

### Phase 1: Layer 1 Implementation ✅ COMPLETE

**Goal**: Build query decomposition with high-quality prompts

**Completed**:
- ✅ Implemented `QueryDecomposer` service (140 lines)
- ✅ Created decomposition prompt builder (640 lines)
- ✅ Added execution graph validation (350 lines)
- ✅ Implemented cost estimation logic
- ✅ Wrote comprehensive unit tests (820+ lines, 21 tests)
- ✅ Created test cases for each query type
- ✅ Verified token usage stays within bounds (5-10K per decomposition)

**Status**: Complete (see PHASE_1_COMPLETE.md)

### Phase 2: Strategy Executors (Week 3-4)

**Goal**: Implement all 5 strategy types

**Tasks**:
- [ ] Implement `MetadataFilterStrategy` (no LLM)
  - Gmail search filters
  - Calendar event filters
  - Time range handling
- [ ] Implement `KeywordSearchStrategy` (no LLM)
  - Gmail search operators
  - Pattern matching
- [ ] Implement `BatchThreadReadStrategy` (LLM)
  - Thread analysis prompt
  - Parallel batch processing
  - Structured extraction
- [ ] Implement `CrossReferenceStrategy` (LLM)
  - Ranking logic
  - Intersection/union operations
- [ ] Implement `SemanticAnalysisStrategy` (LLM)
  - Intent classification
  - Batch item analysis
- [ ] Create `StrategyRegistry`
- [ ] Write unit tests for each strategy
- [ ] Integration tests with real Gmail/Calendar APIs

**Deliverables**:
- All 5 strategies working
- Each strategy has bounded token usage
- Parallel execution verified

**Testing approach**:
```typescript
describe('BatchThreadReadStrategy', () => {
  it('should analyze 20 threads with bounded context', async () => {
    const result = await strategy.execute({
      thread_ids: mockThreadIds, // 20 threads
      extract_fields: ['last_sender', 'waiting_indicators', 'urgency_signals'],
      batch_size: 5
    }, userId);

    expect(result.threads).toHaveLength(20);
    expect(result.metadata.llm_calls).toBe(20); // One per thread
    expect(result.metadata.tokens_used).toBeLessThan(45000); // 20 * ~2K

    // Verify each summary is bounded
    result.threads.forEach(t => {
      expect(JSON.stringify(t.extracted).length).toBeLessThan(1000);
    });
  });
});
```

**Risk**: Medium (complex parallel execution)

### Phase 3: Execution Coordinator (Week 4)

**Goal**: Orchestrate DAG execution in parallel stages

**Tasks**:
- [ ] Implement `ExecutionCoordinator`
- [ ] Add dependency resolution ({{node_id.field}} syntax)
- [ ] Implement parallel stage execution
- [ ] Add error handling for failed nodes
- [ ] Progress tracking for long operations
- [ ] Write integration tests

**Deliverables**:
- Coordinator executes DAGs correctly
- Parallel execution working
- Dependency injection working

**Testing approach**:
```typescript
describe('ExecutionCoordinator', () => {
  it('should execute graph with 3 parallel groups', async () => {
    const mockGraph: ExecutionGraph = {
      information_needs: [
        { id: 'node1', parallel_group: 1, depends_on: [], ... },
        { id: 'node2', parallel_group: 1, depends_on: [], ... },
        { id: 'node3', parallel_group: 2, depends_on: ['node1', 'node2'], ... },
        { id: 'node4', parallel_group: 3, depends_on: ['node3'], ... },
      ],
      ...
    };

    const startTime = Date.now();
    const results = await coordinator.execute(mockGraph, userId);
    const duration = Date.now() - startTime;

    // Parallel execution should be faster than sequential
    expect(duration).toBeLessThan(5000); // Should finish in < 5s
    expect(results.nodeResults.size).toBe(4);
    expect(results.nodeResults.get('node3').data).toContain('node1'); // Has dependency data
  });
});
```

**Risk**: Medium (complex orchestration logic)

### Phase 4: Layer 3 Synthesis (Week 5)

**Goal**: Generate natural language from structured findings

**Tasks**:
- [ ] Implement `SynthesisService`
- [ ] Create synthesis prompt builder (based on design doc)
- [ ] Implement findings formatting (remove raw data)
- [ ] Add user preference handling (tone, format)
- [ ] Test response quality
- [ ] Verify token bounds (10-20K input, 1-2K output)

**Deliverables**:
- Layer 3 produces quality responses
- Token usage bounded
- No raw data leakage

**Testing approach**:
```typescript
describe('Layer 3: Synthesis', () => {
  it('should generate response from structured findings', async () => {
    const mockResults: ExecutionResults = {
      nodeResults: new Map([
        ['thread_analysis', {
          success: true,
          data: {
            threads: [
              { thread_id: '1', from: 'john@example.com', urgency: 'high', ... },
              // ... 14 more
            ]
          }
        }]
      ])
    };

    const synthesis = await synthesizer.synthesize(
      'what emails am I blocking people on?',
      mockGraph,
      mockResults,
      mockUserPrefs
    );

    expect(synthesis.message).toContain('blocking 3 people');
    expect(synthesis.message).toContain('Jeff'); // Specific names
    expect(synthesis.message).not.toContain('{'); // No JSON in response
    expect(synthesis.metadata.tokens_used).toBeLessThan(25000);
  });
});
```

**Risk**: Low (straightforward LLM call)

### Phase 5: Orchestrator Integration (Week 5)

**Goal**: Wire all 3 layers together

**Tasks**:
- [ ] Implement `OrchestratorService`
- [ ] Add confirmation flow for expensive queries
- [ ] Implement error handling across layers
- [ ] Add resource usage tracking
- [ ] Integration with DI container
- [ ] End-to-end testing

**Deliverables**:
- Full 3-layer flow working
- Same API as current MasterAgent
- Comprehensive E2E tests

**Testing approach**:
```typescript
describe('E2E: 3-Layer Architecture', () => {
  it('should handle complex investigative query', async () => {
    const result = await orchestrator.processUserInput(
      'what emails am I blocking people on?',
      userId,
      [],
      undefined
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain('blocking');
    expect(result.metadata.tokensUsed).toBeLessThan(60000); // Design goal
    expect(result.metadata.processingTime).toBeLessThan(5000); // < 5 seconds
  });

  it('should handle simple direct query', async () => {
    const result = await orchestrator.processUserInput(
      "what's on my calendar today?",
      userId,
      [],
      undefined
    );

    expect(result.success).toBe(true);
    expect(result.metadata.tokensUsed).toBeLessThan(10000); // Simple query
    expect(result.metadata.processingTime).toBeLessThan(2000); // < 2 seconds
  });
});
```

**Risk**: Low (integration work)

### Phase 6: Direct Replacement (Week 5)

**Goal**: Replace old architecture completely

**Tasks**:
- [ ] Update chat.routes.ts to use orchestrator instead of masterAgent
- [ ] Set feature flag to true (enable 3-layer)
- [ ] Deploy to staging for basic testing
- [ ] Delete old code:
  - `src/agents/master.agent.ts`
  - `src/agents/email.agent.ts`
  - `src/agents/calendar.agent.ts`
  - `src/services/prompt-builders/master-agent/`
  - `src/services/prompt-builders/sub-agent/`
  - `src/framework/agent-factory.ts`
  - `src/framework/base-subagent.ts`
  - `src/services/context-manager.service.ts`
- [ ] Update DI registrations (remove old agents)
- [ ] Remove feature flag code (not needed)
- [ ] Update documentation
- [ ] Deploy to production

**Deliverables**:
- Old code deleted (~2000 lines)
- Single clean architecture
- Production deployment

**Risk**: Low (old system doesn't work anyway, no users to impact)

---

## Part 5: Key Design Decisions & Rationale

### Decision 1: Keep It Stateless (Client-Side Context)

**Rationale**: Current architecture is stateless (client sends context). This is actually good:
- ✅ No server-side session storage needed
- ✅ Easier to scale horizontally
- ✅ Frontend controls conversation history
- ✅ Simpler backend

**Action**: Keep stateless approach, client sends conversationHistory like current

### Decision 2: Bounded Context at Every Layer

**Rationale**: Token explosion is the core problem. Every layer must have strict bounds:
- Layer 1 input: Last 2-3 turns only (not full conversation)
- Layer 2 per-node: Only task-specific data
- Layer 3 input: Summaries only, never raw data

**Action**: Enforce token limits in code:
```typescript
// Layer 1
conversationHistory.slice(-3); // Last 3 turns

// Layer 2
maxTokens: 500 per thread analysis

// Layer 3
findings.items.slice(0, 10); // Limit items in synthesis
```

### Decision 3: Parallel Execution Within Stages

**Rationale**: Sequential execution is slow. Parallel execution within stages gives 2-3x speedup:
- Stage 1: Run all parallel_group=1 nodes concurrently
- Stage 2: Run all parallel_group=2 nodes concurrently
- etc.

**Action**: Use `Promise.all()` for nodes in same stage:
```typescript
const stageResults = await Promise.all(
  nodesInStage.map(node => this.executeNode(node, ...))
);
```

### Decision 4: Strategy Pattern for Executors

**Rationale**: Different information needs require different approaches:
- Metadata filter: No LLM, just API calls
- Keyword search: No LLM, search operators
- Thread analysis: LLM per thread
- Cross-reference: LLM on summaries
- Semantic analysis: LLM batch processing

**Action**: Strategy registry maps node type → executor implementation

### Decision 5: Compression at Layer Boundaries

**Rationale**: Raw data accumulation kills performance. Each layer must compress:
- Layer 1 → 2: Execution graph (JSON schema)
- Layer 2 → 3: Structured summaries (no email bodies)
- Layer 3 → User: Natural language

**Action**: Explicit compression in code:
```typescript
// Layer 2 output
return {
  threads: threads.map(t => ({
    thread_id: t.id,
    from: t.from,
    subject: t.subject,
    urgency_level: t.urgency,
    context: t.context.substring(0, 200) // Limit to 200 chars
  }))
}; // NOT: return threads (full bodies would be 100KB+)
```

### Decision 6: No Self-Termination

**Rationale**: Current architecture has LLM decide when to stop (usually too late). New architecture:
- Execution graph is complete upfront
- No "should I continue?" decisions
- Deterministic execution

**Action**: Execute entire graph, no early termination logic

### Decision 7: Keep Domain Services Unchanged

**Rationale**: `EmailDomainService` and `CalendarDomainService` are well-designed:
- Clean interfaces
- Good error handling
- Proper OAuth integration

**Action**: Keep them, just change how they're called (via strategies instead of SubAgents)

### Decision 8: Drop-In Replacement API

**Rationale**: Frontend shouldn't need to change. Same API as current `MasterAgent`:

```typescript
// Current
masterAgent.processUserInput(message, userId, conversationHistory, masterState, subAgentStates)

// New
orchestrator.processUserInput(message, userId, conversationHistory, previousState)
```

**Action**: Same interface, internal implementation completely different

---

## Part 6: Performance & Cost Analysis

### Token Usage Comparison

**Example Query**: "What emails am I blocking people on?"

#### Current Architecture (4-Prompt)

```
Master Prompt 1 (Intent Understanding):
  System: 500 tokens
  User query + history: 200 tokens
  Response: 150 tokens
  = 850 tokens

Master Prompt 2 (Context Update) × 15 iterations:
  System: 400 tokens
  Context: 300 tokens
  SubAgent response: 200 tokens
  Response: 200 tokens
  = 1100 tokens × 15 = 16,500 tokens

SubAgent Prompts × 15 iterations:
  System: 600 tokens
  Command: 100 tokens
  Response: 200 tokens
  = 900 tokens × 15 = 13,500 tokens

SubAgent Execution × 15 iterations:
  System: 500 tokens
  Plan: 200 tokens
  Response: 100 tokens
  = 800 tokens × 15 = 12,000 tokens

Total: 850 + 16,500 + 13,500 + 12,000 = 42,850 tokens

But accumulated_knowledge grows each iteration:
Iteration 1: 1K context
Iteration 5: 5K context
Iteration 15: 15K context
Average context overhead: +60K tokens

ACTUAL TOTAL: ~100,000+ tokens per complex query
```

#### New Architecture (3-Layer)

```
Layer 1 (Decomposition):
  System: 500 tokens
  User query + context: 300 tokens
  User profile: 200 tokens
  Response (execution graph): 2000 tokens
  = 3000 tokens

Layer 2 (Execution):
  Stage 1 - Metadata filter (2 nodes in parallel):
    No LLM = 0 tokens

  Stage 2 - Cross-reference (1 node):
    System: 300 tokens
    Summaries from stage 1: 2000 tokens
    Response: 1000 tokens
    = 3300 tokens

  Stage 3 - Thread analysis (20 threads in parallel):
    Per thread: 2000 tokens input + 500 tokens output
    × 20 threads = 50,000 tokens
    But executed in parallel (batches of 5)

  Total Layer 2: 53,300 tokens

Layer 3 (Synthesis):
  System: 300 tokens
  Original query: 100 tokens
  Execution summary: 1000 tokens
  Structured findings (20 summaries): 8000 tokens
  Response: 1500 tokens
  = 10,900 tokens

TOTAL: 3,000 + 53,300 + 10,900 = 67,200 tokens
```

**Savings**: 100K → 67K = **33% reduction**

(And can be optimized further by limiting thread analysis to top 15 instead of 20)

### Time Comparison

**Current Architecture** (Sequential):
- Master Prompt 1: 0.8s
- Loop iteration 1: 1.2s (Master Prompt 2 + SubAgent)
- Loop iteration 2: 1.2s
- ...
- Loop iteration 15: 1.2s
- **Total**: 0.8 + (1.2 × 15) = **18.8 seconds**

**New Architecture** (Parallel):
- Layer 1: 0.8s
- Layer 2:
  - Stage 1 (parallel): 0.3s (no LLM)
  - Stage 2: 0.5s
  - Stage 3 (20 parallel in batches of 5): 2.0s (4 batches × 0.5s)
- Layer 3: 0.9s
- **Total**: 0.8 + 0.3 + 0.5 + 2.0 + 0.9 = **4.5 seconds**

**Improvement**: 18.8s → 4.5s = **76% faster**

### Cost Comparison

At OpenAI GPT-5 Nano pricing: $0.15/1M input, $0.60/1M output

**Current**:
- 100K tokens × $0.15/1M = $0.015 per query

**New**:
- 67K tokens × $0.15/1M = $0.010 per query

**Savings**: **$0.005 per query** (33% reduction)

At 10K queries/month: **$50/month savings**

---

## Part 7: Risk Assessment & Mitigation

### High Risks

#### Risk 1: Decomposition Prompt Quality

**Problem**: Layer 1 must correctly decompose all query types

**Impact**: Bad decomposition = bad results for entire flow

**Mitigation**:
- Use exact prompt from design doc as starting point (✅ Done in Phase 1)
- Test on diverse queries before deployment
- Implement fallback to simple execution for edge cases
- Log all decompositions for review and tuning

**Confidence**: Medium → High (after testing)

#### Risk 2: Parallel Execution Reliability

**Problem**: Multiple concurrent LLM calls might fail or timeout

**Impact**: Partial results or complete failure

**Mitigation**:
- Use `Promise.allSettled()` not `Promise.all()` (continue on failure)
- Implement retry logic per node (3 attempts)
- Add circuit breakers for API rate limits
- Graceful degradation (synthesize with partial results)
- Monitor failure rates in production

**Confidence**: High (proven pattern)

#### Risk 3: Token Estimation Accuracy

**Problem**: Layer 1 estimates might be wrong

**Impact**: Unexpected costs or slow queries

**Mitigation**:
- Conservative estimates (over-estimate by 20%)
- Track actual vs estimated in production
- Tune estimation formulas based on real data
- Add hard caps (max 100K tokens per query)

**Confidence**: Medium → High (after tuning)

### Medium Risks

#### Risk 4: Frontend Breaking Changes

**Problem**: API changes might break frontend

**Impact**: Application can't send messages

**Mitigation**:
- Keep exact same API interface as current
- Test frontend with new backend before deployment
- Quick rollback if issues found (just flip feature flag)

**Confidence**: Very High (minimal API changes)

#### Risk 5: Performance Regression on Simple Queries

**Problem**: New architecture might be slower for simple queries

**Impact**: Slower response times

**Mitigation**:
- Optimize Layer 1 for simple query detection
- Fast-path for direct lookups (skip decomposition if needed)
- Monitor P50, P95, P99 latencies
- Quick rollback if severe regression

**Confidence**: High (can optimize)

### Low Risks

#### Risk 6: DI Container Complexity

**Problem**: More services to register

**Impact**: Initialization errors

**Mitigation**:
- Use existing DI patterns
- Validate container on startup
- Unit test registration

**Confidence**: Very High (existing pattern)

---

## Part 8: Success Metrics

### Technical Metrics

Track these in production:

```typescript
interface QueryMetrics {
  // Performance
  total_time_ms: number;
  layer1_time_ms: number;
  layer2_time_ms: number;
  layer3_time_ms: number;

  // Token usage
  total_tokens: number;
  layer1_tokens: number;
  layer2_tokens: number;
  layer3_tokens: number;

  // Execution
  graph_node_count: number;
  graph_stage_count: number;
  llm_calls: number;
  failed_nodes: number;

  // Cost
  estimated_cost_usd: number;
  actual_cost_usd: number;

}
```

### Target Metrics

| Metric | Old System | Target | Notes |
|--------|-----------|--------|-------|
| **Avg tokens/query** | ~100K | 50-70K | 33-50% reduction |
| **P95 latency** | N/A (broken) | <5s | New baseline |
| **Cost per 1K queries** | N/A | <$15 | ~$0.015/query |
| **Parallel efficiency** | 0% | 60-80% | 2-3x speedup |
| **Failed queries** | High | <1% | With graceful degradation |

---

## Part 9: Implementation Checklist

### ✅ Week 1: Preparation (Phase 0)
- [x] Create `/src/layers` directory structure
- [x] Define all TypeScript interfaces
- [x] Set up feature flag infrastructure
- [x] Update DI container config
- [x] Create test fixtures for each query type

### ✅ Week 2: Layer 1 (Phase 1)
- [x] Implement `QueryDecomposer` service
- [x] Create decomposition prompt builder
- [x] Add execution graph validation
- [x] Implement cost estimation
- [x] Write 20+ test cases
- [x] Token usage profiling

### Week 3: Layer 2 Strategies (Phase 2)
- [ ] Implement `MetadataFilterStrategy`
- [ ] Implement `KeywordSearchStrategy`
- [ ] Implement `BatchThreadReadStrategy`
- [ ] Implement `CrossReferenceStrategy`
- [ ] Implement `SemanticAnalysisStrategy`
- [ ] Create `StrategyRegistry`
- [ ] Unit tests for each strategy
- [ ] Integration tests with real APIs

### Week 4: Execution Coordinator (Phase 3)
- [ ] Implement `ExecutionCoordinator`
- [ ] Add dependency resolution
- [ ] Implement parallel stage execution
- [ ] Add error handling
- [ ] Progress tracking
- [ ] Integration tests

### Week 5: Layer 3, Orchestrator & Deployment (Phase 4-6)
- [ ] Implement `SynthesisService`
- [ ] Create synthesis prompt builder
- [ ] Implement `OrchestratorService`
- [ ] Wire all layers together
- [ ] End-to-end tests
- [ ] Performance testing
- [ ] Update chat.routes.ts to use orchestrator
- [ ] Deploy to staging for testing
- [ ] Delete old code (~2000 lines)
- [ ] Update DI registrations (remove old agents)
- [ ] Update documentation
- [ ] Deploy to production

---

## Part 10: Post-Migration Optimization

### Short-term Optimizations (After Launch)

1. **Prompt Tuning**
   - Test different decomposition prompts
   - Optimize system prompts for token efficiency
   - Add few-shot examples for edge cases

2. **Caching Layer**
   - Cache execution graphs for similar queries
   - Cache strategy results (emails don't change often)
   - Implement smart invalidation

3. **Strategy Optimization**
   - Tune batch sizes for thread analysis
   - Optimize cross-reference ranking algorithms
   - Add more efficient metadata filters

### Long-term Optimizations (Future)

1. **Adaptive Execution**
   - Learn optimal parallelization from production data
   - Predict resource needs based on query patterns
   - Auto-tune batch sizes

2. **Progressive Enhancement**
   - Start with fast metadata filters
   - Stream results to frontend as they arrive
   - Upgrade to LLM analysis only if needed

3. **Cost Optimization**
   - Use cheaper models for simple nodes
   - Implement request batching
   - Smart token budget allocation

---

## Part 11: Rollback Plan

If new architecture has critical issues:

### Quick Rollback

1. Set feature flag `ENABLE_3_LAYER_ARCH=false`
2. Redeploy (30 seconds via Railway)
3. Fix issues offline
4. Re-enable when fixed

**Triggers**:
- Error rate > 5%
- Critical failures
- System completely broken

### Notes

- Old architecture didn't work anyway, so rollback is mainly for catastrophic failures
- Since architecture is stateless: no data migration, no rollback scripts needed
- Switch is instant (just feature flag)

---

## Part 12: Open Questions & Decisions Needed

### Question 1: How to handle streaming responses?

**Context**: Current architecture returns complete response. New architecture could stream results as stages complete.

**Options**:
A. Keep synchronous (wait for synthesis)
B. Stream stage completion to frontend
C. Hybrid (simple queries sync, complex async)

**Recommendation**: Start with A (sync), add B later

### Question 2: Should we add async job queue now or later?

**Context**: Architectural roadmap proposes async jobs. Compatible with 3-layer design.

**Options**:
A. Add now (more complexity, enables premium features)
B. Add later (simpler migration, delay revenue)

**Recommendation**: Add in Month 2 (after 3-layer stable)

### Question 3: What to do about current prompt builders?

**Context**: Current codebase has elaborate prompt builder infrastructure.

**Options**:
A. Adapt for new architecture
B. Delete and rebuild simpler versions
C. Keep for backward compatibility

**Recommendation**: B (delete and rebuild) - old builders are tied to 4-prompt flow

### Question 4: Should Layer 2 strategies use function calling?

**Context**: Architectural roadmap proposes native function calling. Layer 2 uses custom prompts.

**Options**:
A. Use function calling for Layer 2 strategies
B. Use custom prompts (as designed)
C. Hybrid approach

**Recommendation**: B for now (follow design doc), consider A for future optimization

---

## Part 13: Next Steps

### Immediate Actions (This Week)

1. **Get approval on migration plan**
   - Review with team
   - Adjust timeline if needed
   - Confirm resource allocation

2. **Set up tracking**
   - Create project board
   - Define success metrics
   - Set up monitoring dashboards

3. **Prepare codebase**
   - Create feature branch
   - Set up CI/CD for new architecture
   - Configure feature flags

### Starting Implementation (Next Week)

1. **Week 1 tasks** (from checklist above)
2. **Daily standups** to track progress
3. **Document learnings** for future reference

---

## Conclusion

This migration transforms the architecture from an iterative, unbounded-context approach to a deterministic, bounded-context approach. The key innovation is **progressive decomposition with compression funnels** - each layer produces structured, bounded output for the next layer.

**Expected outcomes**:
- ✅ 33-66% token reduction (67K vs 100K tokens)
- ✅ 76% faster responses (4.5s vs 18.8s)
- ✅ Predictable costs and performance
- ✅ Better parallelization (3x speedup on complex queries)
- ✅ Cleaner, more maintainable code

**Risk level**: Medium (requires careful prompt engineering and testing)

**Timeline**: 6-8 weeks to full production deployment

**Recommendation**: Proceed with migration. The architectural benefits are substantial and the rollback risk is low due to stateless design and feature flag approach.

---

*Document Version: 1.0*
*Created: January 2025*
*Author: Claude Code*
*Status: Ready for Review*
