# AI System Improvement Plan
**Generated**: 2025-10-06
**Updated**: 2025-10-06
**Current Overall Score**: 54.7/100
**Pass Rate**: 16.1% (5/31 tests)

## Executive Summary

E2E testing reveals your AI orchestrator has strong query understanding (68.7/100) but **critical failures in retrieval (28.5/100) and ranking (25.8/100)**.

### Root Causes

1. **Filter Vocabulary Mismatch**: Layer 1 (QueryDecomposer) generates filters like `requires_response`, `due_today` that Layer 2 (ExecutionCoordinator) doesn't understand → returns empty results
2. **System Prompts Too Permissive**: Layer 1 allows freeform filter generation without validation
3. **Missing Metadata Pipeline**: No enrichment layer to detect urgency, sender importance, etc. from raw Gmail data

### What Data Is Available?

**Gmail API Provides** ✅:
- Email text (subject, body, snippet)
- Sender/recipient addresses
- Date/time
- Gmail labels (IMPORTANT, STARRED, UNREAD, INBOX, etc.)
- Thread structure
- Attachment info

**NOT Available from API** ❌ (must detect ourselves):
- `isUrgent`, `priority` scores
- `senderType` (investor, boss, report)
- `requiresResponse`, `needsReply`
- `containsCommitment`, commitment status
- `isDroppedBall`
- Calculated importance scores

**Test Inbox Contains Eval-Only Metadata**: The generated inbox includes pre-labeled fields like `isUrgent`, `senderType` for evaluation purposes ONLY. Our production system must detect these from raw email content.

---

## Critical Issues Identified

### 1. **Filter Vocabulary Mismatch** (Critical - P0)
**Problem**: QueryDecomposer generates filters like `requires_response`, `due_today`, `isUnread`, `sender_name_X` that ExecutionCoordinator ignores.

**Evidence**:
```
⚠️  Unknown filter: "requires_response"
⚠️  Unknown filter: "due_today"
⚠️  Unknown filter: "isUnread"
⚠️  Unknown filter: "sender_name_David Park"
```

**Impact**:
- Retrieval returns empty results (0% recall)
- Users cannot perform basic inbox triage
- 33 critical errors across test suite

**Root Cause**:
- Layer 1 uses LLM to generate freeform filters
- Layer 2 only supports Gmail query operators
- No validation/translation layer between them

---

### 2. **Missing Email Metadata Enrichment** (Critical - P0)
**Problem**: System lacks metadata to support common user queries.

**Missing Capabilities**:
- ❌ Urgency detection (`isUrgent`, `priority`)
- ❌ Action required (`requires_response`, `needs_reply`)
- ❌ Deadlines (`due_today`, `overdue`)
- ❌ Sender classification (`investor`, `vip`, `report`)
- ❌ Commitment tracking (`commitments_made`, `promises`)
- ❌ Unread status tracking (`isUnread`)

**Impact**: Cannot answer 80% of tested queries

---

### 3. **Weak Ranking Algorithm** (High - P1)
**Problem**: Results aren't prioritized meaningfully.

**Current State**:
- Basic time-based sorting
- No multi-factor scoring
- Rank score: 25.8/100

**Missing**:
- Urgency weighting
- Sender importance
- Recency decay
- Semantic relevance
- User interaction history

---

### 4. **Limited Strategy Coverage** (Medium - P2)
**Problem**: Only 5 strategy types for all use cases.

**Current Strategies**:
1. `metadata_filter` - Gmail query operators
2. `keyword_search` - Text matching
3. `batch_thread_read` - Thread loading
4. `cross_reference` - Multi-source linking
5. `semantic_analysis` - LLM-based analysis

**Missing Strategies**:
- Urgency detection
- Commitment extraction
- Relationship scoring
- Follow-up detection
- Time-sensitive filtering

---

## Improvement Roadmap

### Phase 1: Fix Critical Retrieval (Week 1-2) 🔥

#### 1.1 Create Filter Translation Layer
**File**: `src/layers/filter-translator.ts`

```typescript
/**
 * Translates high-level filters from Layer 1 to Gmail/API queries for Layer 2
 */
export class FilterTranslator {
  translateFilter(filter: string): GmailQuery {
    // Map: requires_response -> is:unread newer_than:3d
    // Map: due_today -> has:attachment subject:(deadline|due)
    // Map: isUrgent -> is:important OR subject:(urgent|asap)
  }
}
```

**Impact**: Immediately fixes retrieval failures

#### 1.2 Implement Urgency Detection
**File**: `src/layers/layer2-execution/strategies/urgency-detector-strategy.ts`

```typescript
@Strategy({ type: StrategyType.URGENCY_DETECTION })
export class UrgencyDetectorStrategy extends BaseStrategy {
  async execute(params, userId): Promise<NodeResult> {
    // 1. Check Gmail importance markers
    // 2. Scan for urgency keywords (URGENT, ASAP, EOD)
    // 3. Analyze sender (boss/investor = higher urgency)
    // 4. Check deadlines in subject/body
    // 5. Return urgency score 0-100 per email
  }
}
```

**Adds Filter Support**: `isUrgent`, `priority:high`

#### 1.3 Implement Read/Unread Tracking
**File**: `src/services/domain/email-domain.service.ts`

```typescript
async getEmailMetadata(userId: string, emailId: string) {
  // Use Gmail API labels
  // UNREAD = is:unread
  // IMPORTANT = is:important
  // STARRED = is:starred
}
```

**Adds Filter Support**: `isUnread`, `isStarred`, `isImportant`

---

### Phase 2: Metadata Enrichment (Week 3-4)

#### 2.1 Sender Classification Service
**File**: `src/services/sender-classifier.service.ts`

```typescript
export class SenderClassifierService {
  /**
   * Classifies senders based on:
   * - User preferences (VIP list)
   * - Email frequency/volume
   * - Domain analysis (@company.com = colleague)
   * - Calendar integration (frequent meeting attendees)
   */
  async classifySender(email: string): Promise<SenderType> {
    // Returns: investor, boss, report, peer, customer, vendor
  }
}
```

**Adds Filter Support**: `sender_type:investor`, `from:vip`

#### 2.2 Action Required Detector
**File**: `src/layers/layer2-execution/strategies/action-detector-strategy.ts`

```typescript
@Strategy({ type: StrategyType.ACTION_DETECTION })
export class ActionDetectorStrategy extends BaseStrategy {
  /**
   * Detects if email requires response using:
   * - Question marks ("?")
   * - Request phrases ("can you", "could you", "please")
   * - Last message in thread is from sender
   * - Explicit CTAs ("let me know", "waiting for")
   */
}
```

**Adds Filter Support**: `requires_response`, `needs_reply`, `action_required`

#### 2.3 Deadline Extraction
**File**: `src/services/deadline-extractor.service.ts`

```typescript
export class DeadlineExtractorService {
  /**
   * Extracts deadlines from:
   * - Explicit dates ("by Friday", "before 5pm")
   * - Relative times ("EOD", "by end of week")
   * - Calendar event references
   * Uses: chrono-node for date parsing
   */
  async extractDeadlines(email: Email): Promise<Deadline[]>
}
```

**Adds Filter Support**: `due_today`, `due_this_week`, `overdue`

---

### Phase 3: Intelligent Ranking (Week 5)

#### 3.1 Multi-Factor Ranking Algorithm
**File**: `src/layers/layer2-execution/ranker.service.ts`

```typescript
export class EmailRankerService {
  /**
   * Scores emails using weighted factors:
   */
  rankEmails(emails: Email[], context: UserContext): RankedEmail[] {
    return emails.map(email => {
      const score =
        0.30 * urgencyScore(email) +        // Urgency/importance
        0.25 * senderScore(email) +         // Sender VIP status
        0.20 * recencyScore(email) +        // Time decay
        0.15 * actionRequiredScore(email) + // Needs response
        0.10 * semanticScore(email);        // Query relevance

      return { email, score };
    }).sort((a, b) => b.score - a.score);
  }
}
```

**Impact**: Rank score: 25.8 → 70+

---

### Phase 4: System Prompt Revamp (Week 6) 🎯

**CRITICAL**: This phase addresses the core issue - Layer 1 generates filters Layer 2 can't execute.

#### 4.1 Constrain Layer 1 Filter Vocabulary
**File**: `src/layers/layer1-decomposition/decomposition-prompt-builder.ts`

**Goal**: Lock down Layer 1 to only generate filters that Layer 2 can execute.

```typescript
const FILTER_VOCABULARY = `
# STRICT FILTER VOCABULARY

You MUST only use these exact filters. Using any other filter will cause execution failure.

## Gmail API Filters (Direct Mapping)
These map directly to Gmail search operators:

- from:<email|name> - Find emails from sender
- to:<email|name> - Find emails to recipient
- subject:<keyword> - Search in subject line
- has:attachment - Has attachments
- is:unread - Unread emails
- is:read - Read emails
- is:important - Marked important by Gmail
- is:starred - Starred emails
- label:<name> - Has specific label
- newer_than:Xd - Last X days (e.g., newer_than:7d)
- older_than:Xd - Older than X days

## Semantic Filters (Requires Analysis Strategy)
These require LLM/analysis and use specific strategy types:

- analyze_urgency - Detect urgent emails (→ urgency_detector strategy)
  Returns: urgency_score (0-100), is_urgent (true/false)

- analyze_sender - Classify sender importance (→ sender_classifier strategy)
  Returns: sender_type (investor|boss|report|peer|customer|vendor), vip_score (0-100)

- detect_action_required - Find emails needing response (→ action_detector strategy)
  Returns: requires_response (true/false), action_type (reply|review|decide)

- extract_deadlines - Find time-sensitive items (→ deadline_extractor strategy)
  Returns: deadline (ISO date), is_overdue (true/false)

## DO NOT USE
❌ requires_response (use detect_action_required strategy instead)
❌ due_today (use extract_deadlines strategy instead)
❌ isUrgent (use analyze_urgency strategy instead)
❌ sender_type:X (use analyze_sender strategy instead)

## Strategy-Based Execution Plan
For semantic filters, you must specify which STRATEGY to use:

Example GOOD execution graph:
{
  "nodes": [
    {
      "id": "node_1",
      "type": "metadata_filter",
      "params": {
        "domain": "email",
        "filters": ["is:unread", "newer_than:7d"],
        "max_results": 50
      }
    },
    {
      "id": "node_2",
      "type": "urgency_detector",  // Use strategy for semantic analysis
      "params": {
        "input_email_ids": ["node_1.items"],
        "threshold": "medium"
      }
    }
  ]
}

Example BAD execution graph (WILL FAIL):
{
  "nodes": [
    {
      "id": "node_1",
      "type": "metadata_filter",
      "params": {
        "filters": ["isUrgent"]  // ❌ Not a valid Gmail operator
      }
    }
  ]
}
`;

// Update system prompt
const systemPrompt = `
You are a query decomposition AI. Your job is to convert user queries into executable graphs.

${FILTER_VOCABULARY}

**CRITICAL RULES**:
1. Only use filters from the allowed list above
2. For semantic filters (urgency, sender type, etc.), use the corresponding STRATEGY node
3. Validate each filter before including it
4. If unsure about a filter, DON'T USE IT - ask the user or use a broader filter

**Multi-Step Execution**:
- Step 1: Use metadata_filter to get candidate emails with Gmail operators
- Step 2: Use analysis strategies to refine results (urgency, sender type, etc.)
- Step 3: Cross-reference or batch-read if needed
- Step 4: Return final results

${rest of prompt...}
`;
```

**Impact**:
- Reduces unknown filters from 50+ to 0
- Forces Layer 1 to think in terms of available strategies
- Makes execution plan feasible

#### 4.2 Add Runtime Filter Validation
**File**: `src/layers/layer1-decomposition/execution-graph-validator.ts`

```typescript
const ALLOWED_GMAIL_FILTERS = new Set([
  'from:', 'to:', 'subject:', 'has:attachment',
  'is:unread', 'is:read', 'is:important', 'is:starred',
  'label:', 'newer_than:', 'older_than:'
]);

const ALLOWED_STRATEGY_TYPES = new Set([
  'metadata_filter',
  'urgency_detector',
  'sender_classifier',
  'action_detector',
  'deadline_extractor',
  'keyword_search',
  'semantic_analysis',
  'batch_thread_read',
  'cross_reference'
]);

export class ExecutionGraphValidator {
  validate(graph: ExecutionGraph): ValidationResult {
    // Validate each node
    for (const node of graph.nodes) {
      // Check strategy type exists
      if (!ALLOWED_STRATEGY_TYPES.has(node.type)) {
        return {
          valid: false,
          error: `Unknown strategy type: ${node.type}. Allowed: ${Array.from(ALLOWED_STRATEGY_TYPES).join(', ')}`
        };
      }

      // Validate filters for metadata_filter nodes
      if (node.type === 'metadata_filter') {
        const filters = node.params.filters || [];
        for (const filter of filters) {
          const isValid = Array.from(ALLOWED_GMAIL_FILTERS).some(
            allowed => filter.startsWith(allowed) || filter === allowed
          );

          if (!isValid) {
            return {
              valid: false,
              error: `Invalid Gmail filter: "${filter}". Use a strategy node instead (urgency_detector, sender_classifier, etc.)`
            };
          }
        }
      }
    }

    return { valid: true };
  }
}
```

**Impact**: Fail-fast on invalid queries, provide helpful error messages

#### 4.3 Add Examples to System Prompt
**File**: `src/layers/layer1-decomposition/decomposition-prompt-builder.ts`

```typescript
const EXECUTION_EXAMPLES = `
# Example 1: "Show me urgent emails"
{
  "nodes": [
    {
      "id": "get_recent",
      "type": "metadata_filter",
      "params": {
        "domain": "email",
        "filters": ["newer_than:7d", "is:unread"],
        "max_results": 100
      }
    },
    {
      "id": "detect_urgency",
      "type": "urgency_detector",
      "params": {
        "input_email_ids": ["get_recent.items"],
        "threshold": "high"
      }
    }
  ]
}

# Example 2: "Emails from investors"
{
  "nodes": [
    {
      "id": "all_emails",
      "type": "metadata_filter",
      "params": {
        "domain": "email",
        "filters": ["newer_than:30d"],
        "max_results": 100
      }
    },
    {
      "id": "classify_senders",
      "type": "sender_classifier",
      "params": {
        "input_email_ids": ["all_emails.items"],
        "filter_type": "investor"
      }
    }
  ]
}

# Example 3: "What needs a response?"
{
  "nodes": [
    {
      "id": "recent_unread",
      "type": "metadata_filter",
      "params": {
        "domain": "email",
        "filters": ["is:unread", "newer_than:14d"],
        "max_results": 50
      }
    },
    {
      "id": "action_required",
      "type": "action_detector",
      "params": {
        "input_email_ids": ["recent_unread.items"]
      }
    }
  ]
}
`;
```

**Impact**: Layer 1 learns correct patterns through examples

---

### Phase 5: Commitment Tracking (Week 7-8)

#### 5.1 Commitment Extraction Strategy
**File**: `src/layers/layer2-execution/strategies/commitment-tracker-strategy.ts`

```typescript
@Strategy({ type: StrategyType.COMMITMENT_TRACKING })
export class CommitmentTrackerStrategy extends BaseStrategy {
  /**
   * Extracts commitments user made in sent emails:
   * - "I'll do X"
   * - "I will handle Y"
   * - "I'll get back to you"
   * - "Let me check and follow up"
   *
   * Tracks fulfillment status and overdue commitments
   */
}
```

**Adds Queries**: "What did I promise to do?", "Show overdue commitments"

---

## Implementation Priority

### Sprint 1 (Week 1-2): Emergency Fixes + System Prompts 🔥
**Critical Path**: Fix what's broken NOW

- [ ] **System Prompt Revamp (4.1, 4.2, 4.3)** - Lock down filter vocabulary
- [ ] Filter Translation Layer (1.1) - Temporary bridge while we build strategies
- [ ] Urgency Detection Strategy (1.2) - Replace `isUrgent` filters
- [ ] Read/Unread Tracking (1.3) - Map Gmail labels
- [ ] Add testData to evaluation reports - Debug actual input/output
- **Goal**: Pass rate 16% → 50%
- **Deliverable**: System generates valid execution graphs only

### Sprint 2 (Week 3-4): Metadata Detection Pipeline
**Build what Gmail API doesn't provide**

- [ ] Sender Classification (2.1) - Detect investor/boss/peer from email domain, frequency
- [ ] Action Required Detector (2.2) - Detect questions, requests from text
- [ ] Deadline Extraction (2.3) - Parse "by Friday", "EOD" from email body
- [ ] Remove Filter Translation Layer - No longer needed, strategies handle it
- **Goal**: Pass rate 50% → 70%
- **Deliverable**: All semantic filters work via detection strategies

### Sprint 3 (Week 5-6): Ranking & Polish
**Make results useful**

- [ ] Multi-Factor Ranking (3.1) - Smart sorting by urgency + importance + recency
- [ ] Fine-tune System Prompts - Based on Week 1-4 learnings
- [ ] Unit Tests for Strategies - Test each detector in isolation
- **Goal**: Pass rate 70% → 85%, Ranking 25 → 70
- **Deliverable**: Users see most important emails first

### Sprint 4 (Week 7-8): Advanced Features
**Nice-to-haves**

- [ ] Commitment Tracking (5.1) - "I'll do X" detection
- [ ] Follow-up Detection - "checking in", "following up"
- [ ] Relationship Scoring - Historical interaction analysis
- **Goal**: Pass rate 85% → 95%
- **Deliverable**: Full-featured inbox AI

---

## Key Architectural Changes

### Before (Broken)
```
User Query: "Show urgent emails"
    ↓
Layer 1: Generate filters ["isUrgent"]
    ↓
Layer 2: ❌ Unknown filter → returns []
```

### After (Fixed)
```
User Query: "Show urgent emails"
    ↓
Layer 1 (with constrained prompts):
  - Generate execution graph with ALLOWED filters only
  - Use strategies for semantic detection
  Graph: [
    metadata_filter: ["is:unread", "newer_than:7d"],
    urgency_detector: analyze emails for urgency signals
  ]
    ↓
Layer 2:
  - Execute metadata_filter → get 50 unread emails
  - Execute urgency_detector → score each for urgency
  - Return top 18 urgent ones
    ↓
✅ User gets 18 urgent emails
```

---

## Success Metrics

### Current State
| Layer | Score | Status |
|-------|-------|--------|
| Query Understanding | 68.7 | 🟡 Good |
| Retrieval | 28.5 | 🔴 Critical |
| Ranking | 25.8 | 🔴 Critical |
| Presentation | 62.6 | 🟡 Okay |
| **Overall** | **54.7** | 🔴 **Failing** |

### Target State (8 weeks)
| Layer | Target | Change |
|-------|--------|--------|
| Query Understanding | 85+ | +16.3 |
| Retrieval | 80+ | +51.5 |
| Ranking | 75+ | +49.2 |
| Presentation | 80+ | +17.4 |
| **Overall** | **80+** | **+25.3** |

---

## Quick Wins (This Week)

1. **Fix Urgency Filtering** (4 hours)
   - Map `isUrgent` → `is:important OR subject:(urgent|asap|critical)`
   - Fixes 6 failing tests immediately

2. **Fix Unread Filtering** (2 hours)
   - Map `isUnread` → `is:unread`
   - Fixes 8 failing tests

3. **Add Filter Translation** (6 hours)
   - Create mapping layer
   - Fixes 20+ failing tests

**Impact**: Pass rate 16% → 40% in 1 day

---

## Technical Debt to Address

1. **No integration tests** for filter translation
2. **No unit tests** for strategy executors
3. **No schema validation** between layers
4. **Hardcoded prompts** in decomposition builder
5. **No caching** for sender classification
6. **No monitoring** of filter usage patterns

---

## Resources Needed

### Libraries
- `chrono-node` - Natural language date parsing
- `compromise` - NLP for commitment extraction
- `email-addresses` - Email parsing/validation

### Data
- VIP sender list (user preferences)
- Historical urgency patterns
- Response time benchmarks

### Infrastructure
- Redis cache for sender classifications
- PostgreSQL for commitment tracking
- Monitoring dashboard for filter usage

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLM costs increase | High | Cache metadata, use cheaper models for classification |
| Gmail API rate limits | Medium | Implement request batching, caching |
| False urgency detection | Medium | User feedback loop, confidence scores |
| Overfitting to test data | Low | Generate diverse test inboxes |

---

## Next Steps

1. **Review this plan** with team
2. **Run baseline e2e tests** to track progress
3. **Start Sprint 1** - Filter translation layer
4. **Set up monitoring** - Track filter usage, errors
5. **Weekly e2e runs** - Measure improvement

---

## Related Files

- E2E Test Results: `backend/tests/e2e/data/test-results/run-*.json`
- Current Strategies: `backend/src/layers/layer2-execution/strategies/`
- Query Decomposer: `backend/src/layers/layer1-decomposition/`
- Filter Metadata: `backend/src/layers/layer2-execution/execution.types.ts`

---

## Testing & Validation Strategy

### What We're Testing

The e2e tests evaluate **detection accuracy**, NOT whether we use eval-only metadata.

**How It Works**:
1. **Test inbox** contains pre-labeled ground truth (e.g., `isUrgent: true` on email-11)
2. **Our system** must detect urgency from raw email text/metadata
3. **Evaluation** compares our detection to ground truth

**Example Flow**:
```
Email-11 (Ground Truth - eval only):
  subject: "URGENT: Production issue affecting 500+ users"
  isUrgent: true ← We don't have access to this in production

Our Detection Pipeline:
  1. Read subject/body from Gmail API
  2. Detect urgency signals:
     - Keyword "URGENT" in subject
     - Phrase "affecting 500+ users" (high impact)
     - Sender marked as "important" by Gmail
     - Has question marks (needs response)
  3. Calculate urgency score: 95/100
  4. Return as urgent email

Evaluation:
  ✅ Ground truth says isUrgent=true
  ✅ We detected it as urgent
  ✅ Test passes
```

### We Build Detection For

1. **Urgency** - Keyword scanning + Gmail importance markers
2. **Sender Type** - Domain analysis + email frequency + org chart integration
3. **Action Required** - Question detection + request phrase matching
4. **Deadlines** - Date parsing from email body
5. **Commitments** - "I'll do X" phrase extraction

### We DON'T Use (Eval-Only)

- Pre-labeled `isUrgent`, `senderType`, `requiresResponse` fields
- Pre-calculated `calculatedPriority` scores
- Pre-extracted `actionItems`, `questions` arrays

**All detection must work from Gmail API data alone.**

---

**Goal**: Transform from 54.7/100 → 80+/100 in 8 weeks
**Priority**: System prompt revamp + detection strategies (biggest impact)
**Success**: 85%+ pass rate on e2e tests with real-world detection
