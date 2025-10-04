You're right that hardcoded handlers aren't elegant. Let me design something better that maintains intelligence while avoiding the token explosion problem.

## Core Design Philosophy

The issue with your original design isn't the investigative loop concept—it's that **the loop accumulates unbounded context**. The solution isn't to abandon intelligence; it's to architect information flow so the system can be adaptive without drowning in its own history.

## Revised System Architecture: Progressive Decomposition with Bounded Context

### Three-Layer Information Flow

**Layer 1: Query Understanding & Decomposition** (happens once, upfront)
- Analyzes user intent
- Decomposes complex queries into discrete information needs
- Creates an execution graph (not a linear plan)
- Estimates resource requirements

**Layer 2: Parallel Evidence Gathering** (the key insight)
- Execute multiple search strategies simultaneously
- Each strategy operates independently with bounded context
- Strategies don't know about each other during execution
- Results are structured, summarized findings—not raw data

**Layer 3: Synthesis & Presentation** (happens once, at the end)
- Receives only summarized findings from Layer 2
- Makes connections across evidence
- Generates final response
- Never sees raw email content from Layer 2

### Why This Works

The critical insight: **Each layer operates with bounded context and produces compressed output for the next layer**. You never accumulate the full conversation history of the investigation.

---

## Layer 1: Query Understanding & Decomposition

### Information Flow

**Input:**
- User query
- Last 3 conversation turns (not entire history)
- User context (accounts, timezone, recent activity)

**Processing:**
The LLM receives a prompt that asks it to decompose the query into a dependency graph of information needs:

**Prompt Structure:**
```
You are analyzing a user query to determine what information is needed to answer it.

Your job is NOT to answer the query. Your job is to identify:
1. What pieces of information are needed?
2. How do these pieces relate to each other?
3. What can be gathered in parallel vs. sequentially?

For: "What emails am I blocking people on?"

Break this down:
- Need: Recent emails where others are waiting for user response
- This decomposes into:
  a) Find emails where user received last message (parallel to b)
  b) Find emails with semantic indicators of waiting (parallel to a)
  c) Intersect results from a and b
  d) For each candidate, determine context: who's waiting, how long, urgency
  
- Can execute a and b in parallel
- Must wait for a+b before executing c
- Can execute d in parallel for all candidates from c
```

**Output: Execution Graph**
```
{
  "query_type": "investigative",
  "information_needs": [
    {
      "id": "recent_unreplied",
      "type": "email_search",
      "strategy": "metadata_filter",
      "params": {
        "conditions": ["is:unread OR user_last_received:true", "after:30_days_ago"],
        "max_results": 100
      },
      "depends_on": [],
      "parallel_group": 1,
      "expected_cost": "low"
    },
    {
      "id": "waiting_indicators",
      "type": "email_search", 
      "strategy": "keyword_patterns",
      "params": {
        "patterns": ["following up", "checking in", "haven't heard", "still waiting"],
        "after:30_days_ago"
      },
      "depends_on": [],
      "parallel_group": 1,
      "expected_cost": "low"
    },
    {
      "id": "candidate_threads",
      "type": "intersection_and_rank",
      "params": {
        "sources": ["recent_unreplied", "waiting_indicators"],
        "ranking": "by_time_since_last_message"
      },
      "depends_on": ["recent_unreplied", "waiting_indicators"],
      "parallel_group": 2,
      "expected_cost": "trivial"
    },
    {
      "id": "thread_analysis",
      "type": "email_thread_batch_read",
      "params": {
        "thread_ids": "{{candidate_threads.top_20}}",
        "extract": ["last_sender", "conversation_state", "urgency_signals", "waiting_duration"]
      },
      "depends_on": ["candidate_threads"],
      "parallel_group": 3,
      "expected_cost": "high",
      "batch_size": 10
    }
  ],
  "synthesis_instructions": {
    "task": "Identify which threads show someone genuinely waiting for user",
    "ranking": "by urgency and waiting duration",
    "presentation": "group by priority level"
  },
  "resource_estimate": {
    "max_emails_to_read": 20,
    "estimated_tokens": 45000,
    "estimated_time_seconds": 4,
    "estimated_cost": 0.025
  }
}
```

**Key Properties:**
- Decomposition happens once, with one LLM call
- Output is structured data, not prose
- Creates explicit dependencies (a DAG, not a loop)
- Each information need is bounded (max_results, top_20, etc.)
- No self-termination decisions needed—graph is complete upfront

---

## Layer 2: Parallel Evidence Gathering

### Information Flow

The execution engine takes the graph from Layer 1 and executes it as a series of parallel stages.

### Stage Execution Model

**For each parallel group (1, 2, 3...):**

1. **Execute all nodes in that group simultaneously**
2. **Each node operates independently** with its own bounded context
3. **Each node produces a structured summary**, not raw data
4. **Move to next parallel group** when current group completes

### Evidence Gathering Strategies

The system has multiple **strategy executors**, each handling a different type of information need:

**Strategy: Metadata Filter** (no LLM needed)
- Input: Search conditions
- Action: Call Gmail API with filters
- Output: List of email IDs + basic metadata (from, subject, date)
- Bounded: Max results parameter

**Strategy: Keyword Patterns** (no LLM needed)
- Input: Keyword list or regex patterns
- Action: Gmail search with query operators
- Output: List of matching email IDs + snippets
- Bounded: Max results parameter

**Strategy: Thread Analysis** (LLM-powered, but bounded)
- Input: List of thread IDs (max 20)
- Action: For each thread, read full conversation
- LLM Task: Extract structured information from thread
- Output: Array of thread summaries, not full content

**Critical: Thread Analysis Prompt Structure**

Each thread analysis is an independent LLM call with bounded context:

```
You are analyzing a single email thread to extract specific information.

THREAD CONTENT:
[Full thread messages]

YOUR TASK:
Extract these specific fields:
1. Who sent the last message? (name, email)
2. When was the last message? (timestamp)
3. Is the user the recipient of the last message? (yes/no)
4. Does the last message contain a question or request? (yes/no/unclear)
5. Are there indicators someone is waiting? (yes/no + evidence)
6. How long since user last responded? (days)
7. Urgency signals present? (deadline mentioned, time-sensitive language, etc.)
8. Brief context (1 sentence): What is this thread about?

OUTPUT FORMAT: JSON only
{
  "last_sender": {...},
  "user_is_recipient": true,
  "contains_question": true,
  "waiting_indicators": ["checking in again", "following up from last week"],
  "days_since_user_responded": 5,
  "urgency_signals": ["mentioned Friday deadline"],
  "context": "Budget approval request for Q4 planning"
}

Do not include full thread content in your response. Only the structured extraction.
```

**Key insight**: Each thread analysis sees only ONE thread. The LLM doesn't see 20 threads and try to compare them. That would create massive context bloat.

Instead: **20 parallel LLM calls, each analyzing 1 thread, each returning structured 200-token summary**.

Result: 20 threads → 20 × 200 tokens = 4,000 tokens of structured summaries, not 60,000 tokens of raw content.

### Handling Complex Nodes

For nodes that require LLM reasoning (like "intersection_and_rank"), the LLM call is still bounded:

```
You are ranking email threads to identify which are most likely to show someone waiting.

INPUT DATA (structured summaries):
[Array of 50 thread summaries, each with the fields from previous step]

YOUR TASK:
1. Identify threads where user is definitely blocking someone
2. Rank by: urgency_signals (high priority) > waiting_duration (tie-breaker)
3. Return top 20 threads with reasoning

OUTPUT: Array of {thread_id, score, reasoning}
```

This LLM call sees only the summaries, not the full threads. Token count: ~10K input, 2K output.

---

## Layer 3: Synthesis & Presentation

### Information Flow

**Input:**
- Original query
- Execution graph from Layer 1
- Structured findings from Layer 2 (only the summaries)
- Resource usage stats

**Synthesis Prompt:**
```
You executed an investigation to answer: "{original_query}"

INVESTIGATION RESULTS:
{
  "information_gathered": {
    "recent_unreplied": "Found 47 emails",
    "waiting_indicators": "Found 23 emails with waiting language",
    "candidates_identified": "15 threads after intersection",
    "threads_analyzed": [
      {
        "thread_id": "...",
        "from": "Jeff Chen <jeff@company.com>",
        "subject": "Q4 Budget Approval",
        "user_is_blocking": true,
        "waiting_duration": "5 days",
        "urgency": "high",
        "context": "Budget approval needed for Q4 team planning"
      },
      ... (14 more summaries)
    ]
  },
  "resource_usage": {
    "emails_searched": 100,
    "threads_analyzed": 15,
    "tokens_used": 38000,
    "time_seconds": 3.8
  }
}

YOUR TASK:
Generate a user-facing response that:
1. Directly answers their question
2. Groups/organizes findings logically
3. Highlights most important items first
4. Is concise but complete

Do not explain how you gathered this information unless user asks.
Focus on the answer, not the process.
```

**Output: User Response**

The synthesis LLM has access to all findings but they're compressed summaries, not raw content. Token count: ~15K input, 1K output.

---

## Why This Architecture Solves Your Original Problems

### Problem 1: Token Explosion
**Original design**: After 5 iterations, you're passing 60K+ tokens of accumulated history
**This design**: Maximum context in any single LLM call is ~20K tokens. Total tokens across all calls is ~40K

### Problem 2: Self-Termination
**Original design**: "Should I continue investigating?" → LLM usually says yes
**This design**: No self-termination needed. Graph is complete from the start. Execute it and stop.

### Problem 3: Intelligence vs. Hardcoding
**Original design**: Very intelligent but inefficient
**This design**: Intelligence where it matters (decomposition, synthesis) but structured execution in between

### Problem 4: Performance
**Original design**: 8-15 seconds due to sequential operations
**This design**: 3-5 seconds due to parallel execution at each stage

---

## Handling Different Query Types

### Simple Queries (30% of cases)

"What's on my calendar today?"

**Layer 1 Decomposition:**
```
{
  "query_type": "direct",
  "information_needs": [
    {
      "id": "today_events",
      "type": "calendar_lookup",
      "params": {"date": "2025-10-03", "calendars": ["work", "personal"]},
      "parallel_group": 1
    }
  ],
  "synthesis_instructions": {
    "task": "List events chronologically with times"
  }
}
```

Execution: Single API call → Simple synthesis → Done in <1 second

### Complex Single-Domain (50% of cases)

"What emails am I blocking people on?" → Already detailed above

### Multi-Domain (20% of cases)

"What meetings am I not prepared for tomorrow?"

**Layer 1 Decomposition:**
```
{
  "query_type": "multi_domain",
  "information_needs": [
    {
      "id": "tomorrow_meetings",
      "type": "calendar_lookup",
      "params": {"date": "2025-10-04"},
      "parallel_group": 1
    },
    {
      "id": "meeting_contexts",
      "type": "email_search_batch",
      "params": {
        "strategy": "find_emails_about_meetings",
        "meeting_refs": "{{tomorrow_meetings.all}}",
        "lookback_days": 14
      },
      "depends_on": ["tomorrow_meetings"],
      "parallel_group": 2
    },
    {
      "id": "preparation_assessment",
      "type": "cross_reference",
      "params": {
        "compare": ["tomorrow_meetings", "meeting_contexts"],
        "identify": "meetings_without_context"
      },
      "depends_on": ["tomorrow_meetings", "meeting_contexts"],
      "parallel_group": 3
    }
  ]
}
```

**Layer 2 Execution:**
- Parallel Group 1: Get tomorrow's 5 meetings (calendar API)
- Parallel Group 2: For each meeting, search emails mentioning meeting title, attendees, or sent by meeting organizer in last 14 days (5 parallel email searches)
- Parallel Group 3: Cross-reference which meetings have no email context

**Layer 3 Synthesis:**
Receives: 5 meeting summaries + 5 "email context found" summaries → identifies 2 meetings with no prep

---

## Advanced Features: Adaptive Replanning

For the 10% of queries that truly are exploratory and need adaptation:

### When Initial Plan Yields Insufficient Results

If Layer 2 execution completes but findings are sparse:

**Example**: "What did I commit to?" returns only 2 commitments but user asked for "all commitments"

**Adaptive Replanning Flow:**

1. **Synthesis layer detects insufficient results** based on decomposition expectations
2. **Generate refinement plan**: "Initial search found 2 commitments. Should we expand search criteria?"
3. **Present to user**: "Found 2 commitments in last 30 days. Want me to search further back?"
4. **If yes**: Create NEW execution graph (Layer 1) with expanded scope → execute → synthesize
5. **If no**: Return what was found

**Critical**: This is NOT a loop with accumulated context. It's a discrete replan with fresh context.

The synthesis layer from attempt 1 produces: "Found 2 commitments, but seems incomplete"
The decomposition layer for attempt 2 receives only: Original query + "expand search timeframe to 90 days"
Attempt 2 executes independently. No accumulated history.

---

## Progressive Disclosure to User

Unlike your original design where the user waits in silence, this architecture enables streaming updates:

**During Layer 1 (Decomposition):**
User sees: "Understanding your question..."

**During Layer 2 (Evidence Gathering):**
Stream progress updates as each parallel group completes:
- "Searching recent emails... found 47 candidates"
- "Analyzing conversation patterns... found 23 with waiting indicators"
- "Reading 15 threads to determine context..."

**During Layer 3 (Synthesis):**
"Organizing findings..."

**Final Response:**
Complete answer

**User Can Interrupt:**
At any point, user can say "stop" or "that's enough" → immediately jump to synthesis with partial results

---

## Resource Management & Cost Control

### Upfront Estimation

Layer 1 produces resource estimate. Before executing Layer 2:

If estimate exceeds thresholds, ask user:
```
This query will analyze approximately 50 emails and take ~8 seconds. 
Continue? [Yes] [Show me a sample first]
```

### Dynamic Budget Allocation

Each information need in the graph has expected_cost (low/medium/high).

Before Layer 2 execution, calculate total cost:
- 2 low-cost searches: 2K tokens
- 1 batch thread read (20 threads): 35K tokens
- 1 synthesis: 10K tokens
- Total: 47K tokens = $0.03

If total exceeds budget (say, 100K tokens), automatically reduce scope:
- Reduce max_results from 100 to 50
- Reduce threads analyzed from 20 to 15
- System handles this gracefully without bothering user

### Parallel Execution Limits

Batch reads of 20 threads → execute as 4 parallel batches of 5 threads each
- Prevents rate limiting
- Keeps total tokens per batch manageable
- Still much faster than sequential

---

## Handling Write Commands

Write commands always go through a different flow:

### Write Command Flow

**Layer 1: Intent Verification**
- Parse what user wants to do
- Identify all affected items
- Estimate impact

**Layer 2: Preview Generation**
- For "reply to Jeff saying yes": Generate draft email
- For "archive all newsletters": Show count and sample
- For "cancel my 2pm": Show meeting details

**Layer 3: User Confirmation**
- Present preview
- Wait for explicit approval
- Never execute writes without confirmation

**Layer 4: Execution & Verification**
- Execute the write operation
- Verify it succeeded
- Report outcome

Write commands are linear, not parallel. Each step requires user confirmation.

---

## Concrete Example: Full System Trace

Query: "What emails am I blocking people on?"

### Layer 1: Decomposition (1 LLM call, 2K tokens, 0.8 seconds)

Produces execution graph with 4 information needs across 3 parallel groups.

### Layer 2: Execution

**Parallel Group 1** (execute simultaneously):
- Gmail API: search is:unread OR user_last_received:true → 47 results (0.3s)
- Gmail API: search for "following up" OR "checking in" → 23 results (0.3s)

**Parallel Group 2**:
- Intersect: 15 threads appear in both → sort by time → top 15 (0.1s)

**Parallel Group 3** (execute simultaneously):
- Read thread 1 → LLM extract summary (0.8s)
- Read thread 2 → LLM extract summary (0.8s)
- Read thread 3 → LLM extract summary (0.8s)
- ... (15 parallel calls via batch API or concurrent requests)
- Batch completion: 1.2 seconds (parallel overhead)

Total Layer 2 time: 0.3 + 0.1 + 1.2 = 1.6 seconds

**Tokens used in Layer 2**:
- 15 thread reads: 15 × 2K input + 15 × 0.2K output = 33K tokens

### Layer 3: Synthesis (1 LLM call, 15K input + 1K output, 0.9 seconds)

Receives 15 thread summaries → generates response grouping by urgency.

**Total System Performance:**
- Time: 0.8 + 1.6 + 0.9 = 3.3 seconds
- Tokens: 2K + 33K + 16K = 51K tokens
- Cost: $0.032
- LLM calls: 1 decomposition + 15 thread analyses + 1 synthesis = 17 calls

---

## Why This Design Is Better

**Versus hardcoded handlers:**
- Still intelligent and adaptive
- Handles novel queries gracefully
- LLM determines strategy, not developer

**Versus unbounded agent loop:**
- Bounded context at every stage
- Predictable token consumption
- Parallelization built-in
- No self-termination problems

**Key innovation:**
Information flows through compression funnels. Each layer outputs structured, bounded summaries that become input for next layer. Never accumulate full history.

This is how you build an AI system that's both intelligent and efficient.