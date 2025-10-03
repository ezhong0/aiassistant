# AI Email & Calendar Assistant: Codeless System Design

## Executive Summary

This document specifies a three-layer architecture for an intelligent email and calendar assistant that maintains adaptive intelligence while avoiding token explosion. The system decomposes complex queries into bounded execution graphs, processes information in parallel with compressed context, and synthesizes findings into coherent responses.

**Key Innovation**: Information flows through compression funnels—each layer produces structured, bounded summaries rather than accumulating raw data.

---

## System Architecture Overview

```
USER QUERY
    ↓
┌─────────────────────────────────────────┐
│  LAYER 1: Query Understanding           │
│  • Parse intent                          │
│  • Decompose into execution graph       │
│  • Estimate resources                   │
│  Output: Structured DAG (2-5KB)         │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  LAYER 2: Parallel Evidence Gathering   │
│  • Execute graph in parallel stages     │
│  • Each node operates independently     │
│  • Produce structured summaries only    │
│  Output: Compressed findings (10-20KB)  │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  LAYER 3: Synthesis & Presentation      │
│  • Receive only summaries from Layer 2  │
│  • Connect findings across domains      │
│  • Generate user-facing response        │
│  Output: Natural language answer        │
└─────────────────────────────────────────┘
```

**Critical Properties**:
- No layer sees the full conversation history
- Each layer has bounded input/output sizes
- No unbounded loops or self-termination decisions
- Parallel execution within each layer
- Total token budget: 40-60K (vs 150K+ in loop-based designs)

---

## Layer 1: Query Understanding & Decomposition

### Purpose
Transform natural language queries into structured execution plans without actually answering the question.

### Information Flow

**Input** (3-5K tokens):
- User query (current turn only)
- Last 2-3 conversation turns (for context like "what about yesterday?")
- User profile: connected accounts, timezone, typical usage patterns
- Current timestamp

**Output** (2-5K tokens):
- Structured execution graph (JSON)
- Resource estimate
- No prose, no explanations

### Core Prompt Template

```markdown
# ROLE
You are a query analysis specialist. Your job is to decompose user queries into 
structured execution plans, NOT to answer them.

# CONTEXT
User: {user_name}
Connected accounts: {account_list}
Current time: {timestamp}
Timezone: {timezone}

Recent conversation context (if any):
{last_2_turns}

# CURRENT QUERY
{user_query}

# YOUR TASK
Analyze this query and create an execution graph that identifies:

1. **What information is needed?** Break complex needs into atomic pieces.
2. **What dependencies exist?** Some information requires other information first.
3. **What can run in parallel?** Independent information needs can execute simultaneously.
4. **How to bound each search?** Every search must have clear limits (time range, max results).

# ANALYSIS PROCESS (think step-by-step)

## Step 1: Classify the Query Type
- **Direct lookup**: Single piece of information (calendar event, specific email)
- **Filtered search**: Find items matching criteria (urgent emails, meetings with person X)
- **Investigative**: Requires examining multiple items to determine something (am I blocking anyone?)
- **Cross-domain**: Combines calendar + email data (meetings I'm unprepared for)
- **Write command**: User wants to take action (reply, schedule, archive)

Query type: [your classification]

## Step 2: Identify Core Information Needs
What atomic pieces of information would answer this query?

For "What emails am I blocking people on?":
- Need: Recent emails where I received the last message
- Need: Emails containing "waiting" indicators  
- Need: Intersection of both sets
- Need: Context for each thread (who, how long, why urgent)

List your information needs:
1. [first need]
2. [second need]
...

## Step 3: Determine Dependencies & Parallelization
Which needs can run simultaneously? Which need others to complete first?

Draw dependency structure:
- Parallel group 1: [needs with no dependencies]
- Parallel group 2: [needs depending only on group 1]
- Parallel group 3: [needs depending on previous groups]

## Step 4: Define Search Strategies
For each information need, specify HOW to gather it:

**Available strategies**:
- `metadata_filter`: Use Gmail/Calendar API filters (fast, no LLM needed)
- `keyword_search`: Search for specific terms/patterns (fast, no LLM needed)
- `batch_thread_read`: Read multiple threads and extract structured info (requires LLM per thread)
- `cross_reference`: Compare/combine results from multiple sources (requires LLM)
- `semantic_analysis`: Requires understanding meaning/intent (requires LLM)

For each need, choose the most efficient strategy that achieves the goal.

## Step 5: Set Bounds on Each Search
Every search MUST have limits:
- Time range (last 7 days, last 30 days, specific date)
- Max results (top 20, max 100)
- Scope (which accounts, which calendars)

Unbounded searches are not allowed.

## Step 6: Estimate Resource Requirements
For the complete execution plan:
- How many emails/events will be accessed?
- How many LLM calls are needed?
- Estimated total tokens?
- Estimated time?
- Estimated cost?

# OUTPUT FORMAT

Respond with ONLY valid JSON (no markdown, no explanation):

{
  "query_classification": {
    "type": "investigative|direct|filtered_search|cross_domain|write_command",
    "complexity": "simple|moderate|complex",
    "domains": ["email", "calendar"],
    "reasoning": "1-2 sentence explanation of what user wants"
  },
  
  "information_needs": [
    {
      "id": "unique_identifier",
      "description": "human-readable description",
      "type": "metadata_filter|keyword_search|batch_thread_read|cross_reference|semantic_analysis",
      "strategy": {
        "method": "specific API or search approach",
        "params": {
          // Strategy-specific parameters
          "time_range": "last_30_days",
          "max_results": 50,
          "filters": ["is:unread", "from:important_people"],
          // etc
        }
      },
      "depends_on": ["array", "of", "node_ids"],
      "parallel_group": 1,
      "expected_cost": {
        "tokens": 5000,
        "llm_calls": 0,
        "time_seconds": 0.5
      }
    }
    // ... more nodes
  ],
  
  "synthesis_instructions": {
    "task": "What should final synthesis accomplish?",
    "ranking_criteria": "How to prioritize results",
    "presentation_format": "How to structure the answer",
    "user_preferences": "Any style/tone considerations"
  },
  
  "resource_estimate": {
    "total_items_accessed": 100,
    "total_llm_calls": 15,
    "estimated_tokens": 45000,
    "estimated_time_seconds": 4,
    "estimated_cost_usd": 0.025,
    "user_should_confirm": false
  }
}

# CRITICAL RULES

1. **Never try to answer the query** - only plan how to gather information
2. **Every search must be bounded** - no open-ended searches
3. **Parallelize aggressively** - minimize sequential dependencies
4. **Prefer cheap strategies first** - use metadata filters before semantic analysis
5. **Keep graphs simple** - 3-7 information needs for most queries
6. **Write for machines** - output is consumed by execution engine, not humans

Begin your analysis:
```

### Example: Query Decomposition Output

**Input**: "What emails am I blocking people on?"

**Output**:
```json
{
  "query_classification": {
    "type": "investigative",
    "complexity": "moderate",
    "domains": ["email"],
    "reasoning": "User wants to identify threads where others are waiting for their response"
  },
  
  "information_needs": [
    {
      "id": "recent_unreplied",
      "description": "Emails where user received last message",
      "type": "metadata_filter",
      "strategy": {
        "method": "gmail_search",
        "params": {
          "query": "is:inbox newer_than:30d",
          "filter_logic": "user_received_last_message",
          "max_results": 100
        }
      },
      "depends_on": [],
      "parallel_group": 1,
      "expected_cost": {
        "tokens": 0,
        "llm_calls": 0,
        "time_seconds": 0.3
      }
    },
    {
      "id": "waiting_indicators",
      "description": "Emails with explicit waiting language",
      "type": "keyword_search",
      "strategy": {
        "method": "gmail_search",
        "params": {
          "query": "(following up OR checking in OR haven't heard OR still waiting) newer_than:30d",
          "max_results": 50
        }
      },
      "depends_on": [],
      "parallel_group": 1,
      "expected_cost": {
        "tokens": 0,
        "llm_calls": 0,
        "time_seconds": 0.3
      }
    },
    {
      "id": "candidate_threads",
      "description": "Threads appearing in both searches",
      "type": "cross_reference",
      "strategy": {
        "method": "intersection_and_rank",
        "params": {
          "sources": ["recent_unreplied", "waiting_indicators"],
          "rank_by": "days_since_last_message",
          "take_top": 20
        }
      },
      "depends_on": ["recent_unreplied", "waiting_indicators"],
      "parallel_group": 2,
      "expected_cost": {
        "tokens": 2000,
        "llm_calls": 1,
        "time_seconds": 0.5
      }
    },
    {
      "id": "thread_analysis",
      "description": "Extract context from each candidate thread",
      "type": "batch_thread_read",
      "strategy": {
        "method": "parallel_thread_extraction",
        "params": {
          "thread_ids": "{{candidate_threads.top_20}}",
          "extract_fields": [
            "last_sender_info",
            "conversation_state",
            "urgency_signals",
            "waiting_duration",
            "one_sentence_context"
          ],
          "batch_size": 5
        }
      },
      "depends_on": ["candidate_threads"],
      "parallel_group": 3,
      "expected_cost": {
        "tokens": 40000,
        "llm_calls": 20,
        "time_seconds": 2.0
      }
    }
  ],
  
  "synthesis_instructions": {
    "task": "Identify threads where someone is genuinely waiting for user response",
    "ranking_criteria": "Prioritize by urgency signals then by waiting duration",
    "presentation_format": "Group by urgency level (high/medium/low), show sender and brief context",
    "user_preferences": "User prefers concise summaries with actionable next steps"
  },
  
  "resource_estimate": {
    "total_items_accessed": 120,
    "total_llm_calls": 21,
    "estimated_tokens": 42000,
    "estimated_time_seconds": 3.1,
    "estimated_cost_usd": 0.028,
    "user_should_confirm": false
  }
}
```

---

## Layer 2: Parallel Evidence Gathering

### Purpose
Execute the structured plan from Layer 1, gathering information through multiple strategies while maintaining bounded context per operation.

### Strategy Executor Prompts

Layer 2 consists of multiple specialized executors. Each handles a different strategy type and operates independently.

---

#### Strategy: Batch Thread Analysis

**Purpose**: Read multiple email threads and extract structured information from each.

**Execution Model**: 
- Receives list of thread IDs (max 20)
- Processes in batches of 5 parallel calls
- Each thread analyzed independently (no cross-thread context)

**Per-Thread Prompt**:

```markdown
# ROLE
You are an email thread analyzer. Extract specific structured information from a 
single email thread.

# THREAD CONTENT
From: {sender_name} <{sender_email}>
To: {recipient_list}
Date: {timestamp}
Subject: {subject}

[Full thread messages in chronological order]

{thread_messages}

# YOUR TASK
Analyze this thread and extract ONLY the following information. Do not summarize the 
thread, do not provide commentary, do not include full message content.

# EXTRACTION PROCESS (think step-by-step)

## Step 1: Identify Last Message
- Who sent the final message in this thread?
- When was it sent?
- Is the user the recipient of this final message?

Last message analysis:
- Sender: [name and email]
- Timestamp: [ISO format]
- User is recipient: [yes/no]

## Step 2: Detect Questions or Requests
Does the last message (or recent messages) contain:
- Direct questions addressed to the user?
- Requests for information, approval, or action?
- Implicit asks (e.g., "let me know when you can")

Assessment:
- Contains question/request: [yes/no/unclear]
- Type: [question/approval/action_request/none]
- Specific ask: [1 sentence or "none"]

## Step 3: Identify Waiting Indicators
Look for phrases suggesting someone is waiting:
- "following up"
- "checking in"
- "haven't heard back"
- "still waiting"
- "bumping this up"
- "just circling back"
- Repeated emails on same topic

Waiting signals found:
- Present: [yes/no]
- Evidence: [list specific phrases or "none"]
- Number of follow-ups: [count]

## Step 4: Calculate Response Timeline
- When did the user last send a message in this thread?
- How many days between user's last message and now?
- How many days between user's last message and the most recent message?

Timeline:
- User last responded: [date or "never"]
- Days since user response: [number or "N/A"]
- Days waiting for user: [number or "N/A"]

## Step 5: Detect Urgency Signals
Look for indicators of time-sensitivity:
- Explicit deadlines ("by Friday", "need by EOD")
- Urgent language ("ASAP", "urgent", "critical")
- Escalation indicators ("escalating to", "need immediate")
- Business impact ("blocking", "holding up", "delayed because")

Urgency assessment:
- Level: [high/medium/low/none]
- Evidence: [specific quotes or "none"]
- Deadline mentioned: [date or "none"]

## Step 6: Extract Context
In ONE sentence, what is this thread about?

Context: [single sentence]

# OUTPUT FORMAT

Respond with ONLY valid JSON:

{
  "last_message": {
    "sender_name": "string",
    "sender_email": "string",
    "timestamp": "ISO 8601 string",
    "user_is_recipient": boolean
  },
  "question_or_request": {
    "present": boolean,
    "type": "question|approval|action_request|none",
    "specific_ask": "string or null"
  },
  "waiting_indicators": {
    "present": boolean,
    "phrases_found": ["array", "of", "strings"],
    "follow_up_count": integer
  },
  "response_timeline": {
    "user_last_responded_date": "ISO 8601 string or null",
    "days_since_user_responded": integer or null,
    "days_sender_waiting": integer or null
  },
  "urgency_signals": {
    "level": "high|medium|low|none",
    "evidence": ["array", "of", "specific", "quotes"],
    "deadline_mentioned": "string or null"
  },
  "context": "Single sentence describing what this thread is about"
}

# CRITICAL RULES

1. **Extract only** - do not include full message text in your output
2. **Be precise** - use exact quotes for evidence, exact dates for timelines
3. **Single thread focus** - you are analyzing ONE thread, not comparing across threads
4. **Bounded output** - your response should be <300 tokens
5. **Structured format** - JSON only, no markdown, no explanations

Begin extraction:
```

**Key Properties**:
- Each thread sees only its own content (1,500-3,000 tokens input)
- Output is strictly bounded (<300 tokens)
- 20 threads = 20 parallel calls = ~60K total tokens (not 200K+ if done sequentially with accumulation)
- No thread-to-thread dependencies

---

#### Strategy: Cross-Reference & Ranking

**Purpose**: Combine results from multiple sources and rank by relevance.

**Prompt**:

```markdown
# ROLE
You are a data synthesis specialist. Combine information from multiple sources and 
rank results by specified criteria.

# INPUT DATA

## Source 1: {source_1_name}
{source_1_summary}
Found {count} items

## Source 2: {source_2_name}
{source_2_summary}
Found {count} items

[Additional sources as needed]

# YOUR TASK
{task_description from execution graph}

Example task: "Identify threads appearing in both 'recent_unreplied' and 
'waiting_indicators', then rank by days since last message"

# PROCESSING STEPS

## Step 1: Identify Overlap
Which items appear in multiple sources?
- Look for matching thread_ids, email_ids, or other unique identifiers
- List items found in 2+ sources
- Note items unique to single sources

Overlap analysis:
- Items in all sources: [count]
- Items in 2+ sources: [count]
- Unique items per source: [breakdown]

## Step 2: Apply Filtering Criteria
Based on the task, which items should be included?
- If task requires items in ALL sources: intersection
- If task requires items in ANY source: union
- If task has other criteria: apply those filters

Filtering decision:
- Operation: [intersection/union/custom]
- Items after filtering: [count]

## Step 3: Rank Results
Using the specified ranking criteria:
{ranking_criteria from execution graph}

For each item:
- Extract ranking score/value
- Consider secondary criteria for tie-breaking
- Assign priority level if applicable

Ranking approach:
- Primary criterion: [what you're sorting by]
- Secondary criterion: [tie-breaker]
- Direction: [ascending/descending]

## Step 4: Select Top Items
Take the top {n} items as specified in the task parameters.

# OUTPUT FORMAT

Respond with ONLY valid JSON:

{
  "operation_summary": {
    "total_input_items": integer,
    "items_after_filtering": integer,
    "operation_type": "string",
    "top_n_selected": integer
  },
  "ranked_results": [
    {
      "item_id": "string (thread_id, email_id, etc)",
      "rank": integer,
      "score": number or string,
      "included_sources": ["source1", "source2"],
      "ranking_reason": "1 sentence explanation"
    }
    // ... up to N items
  ],
  "excluded_items": {
    "count": integer,
    "reason": "Why these were filtered out"
  }
}

# CRITICAL RULES

1. **No raw data** - do not include full email content or source data
2. **Follow ranking criteria exactly** - from execution graph
3. **Bounded output** - return only top N items as specified
4. **Explain ranking** - brief reason for each item's position
5. **Structured format** - JSON only

Begin analysis:
```

**Key Properties**:
- Input is pre-summarized data from previous nodes (5-10K tokens)
- Output is ranked list with reasoning (1-2K tokens)
- Single LLM call per cross-reference operation

---

#### Strategy: Semantic Analysis

**Purpose**: Understand meaning or intent when simple keyword matching is insufficient.

**Example Use Case**: Determining if an email contains a question vs. a statement

**Prompt**:

```markdown
# ROLE
You are a semantic analysis specialist. Determine meaning and intent in text.

# ANALYSIS TASK
{specific_task_from_execution_graph}

Example: "Determine if these email snippets contain questions or requests directed 
at the user"

# INPUT ITEMS
You will analyze {count} items. For each item, you have:
- Item ID: unique identifier
- Snippet: relevant text excerpt (not full content)
- Metadata: sender, date, subject, etc.

{batch_of_items_with_metadata}

# ANALYSIS PROCESS

For each item, follow these steps:

## Step 1: Identify Core Intent
What is the primary purpose of this text?
- Sharing information (statement)
- Asking for information (question)
- Requesting action (request)
- Making a decision (conclusion)
- Multiple intents (mixed)

## Step 2: Detect Directedness
If question or request:
- Is it directed at the user specifically?
- Is it a general question to the group?
- Is it rhetorical?

## Step 3: Assess Urgency of Intent
Based on language and context:
- How time-sensitive is this?
- What's the consequence of not responding?

## Step 4: Extract Key Signal Phrases
What specific words or phrases reveal intent?

# OUTPUT FORMAT

Respond with ONLY valid JSON:

{
  "analysis_summary": {
    "total_items_analyzed": integer,
    "items_with_questions": integer,
    "items_with_requests": integer,
    "items_informational_only": integer
  },
  "item_results": [
    {
      "item_id": "string",
      "intent_classification": "question|request|statement|mixed",
      "directed_at_user": boolean,
      "urgency_level": "high|medium|low",
      "key_phrases": ["phrases", "that", "reveal", "intent"],
      "reasoning": "1-2 sentence explanation"
    }
    // ... for each item
  ]
}

# CRITICAL RULES

1. **Analyze provided snippets only** - do not invent context
2. **Classify clearly** - every item gets a definitive classification
3. **Be evidence-based** - cite specific phrases in reasoning
4. **Bounded output** - <100 tokens per item analysis
5. **Batch processing** - handle up to 50 items per call

Begin analysis:
```

**Key Properties**:
- Processes batches of 20-50 items per call
- Each item is a snippet, not full content (50-200 tokens per item)
- Output is structured classification (50-100 tokens per item)
- Total: 10K input → 5K output per batch

---

### Execution Coordinator Logic

The system coordinator (non-LLM code) handles:

1. **Read execution graph from Layer 1**
2. **Execute parallel groups in sequence**:
   - For group 1: Launch all nodes with no dependencies
   - Wait for group 1 completion
   - For group 2: Launch all nodes depending only on group 1
   - Wait for group 2 completion
   - Continue until all groups execute
3. **Handle node-to-node data flow**:
   - Node outputs are stored with their `id`
   - Subsequent nodes reference previous outputs via `{{node_id.field}}`
   - Example: `thread_ids: "{{candidate_threads.top_20}}"` → coordinator injects actual thread IDs
4. **Aggregate results**:
   - Collect all node outputs
   - Package as structured findings for Layer 3
5. **Track resources**:
   - Count tokens used, time elapsed, costs incurred
   - Compare to estimates from Layer 1

**No LLM involvement in coordination** - this is pure data orchestration.

---

## Layer 3: Synthesis & Presentation

### Purpose
Transform structured findings into natural language responses that directly answer the user's question.

### Information Flow

**Input** (10-20K tokens):
- Original user query
- Execution graph from Layer 1 (for context on what was done)
- Structured findings from Layer 2 (summaries only, no raw data)
- Resource usage statistics
- User preferences (tone, verbosity, format)

**Output** (500-2K tokens):
- Natural language answer
- Properly formatted and organized
- Actionable when appropriate

### Core Synthesis Prompt

```markdown
# ROLE
You are responding to a user who asked a question about their email or calendar. 
You executed an investigation and now have structured findings. Your job is to 
present those findings as a clear, helpful answer.

# ORIGINAL USER QUERY
{original_query}

# WHAT YOU DID (Investigation Summary)
{brief_summary_of_execution_graph}

Example: "I searched recent emails for threads where you received the last message, 
cross-referenced with emails containing 'waiting' language, then analyzed the top 
15 threads to determine who's waiting for you."

# STRUCTURED FINDINGS

{json_results_from_layer_2}

Example structure:
{
  "operation": "thread_blocking_analysis",
  "threads_analyzed": 15,
  "findings": [
    {
      "thread_id": "...",
      "from": "Jeff Chen <jeff@company.com>",
      "subject": "Q4 Budget Approval",
      "waiting_duration_days": 5,
      "urgency_level": "high",
      "deadline": "Oct 6",
      "context": "Budget approval needed for Q4 team planning",
      "specific_ask": "Approval on $50K budget increase"
    },
    // ... 14 more threads
  ]
}

# RESOURCE USAGE
Searched: {n} emails
Analyzed: {n} threads
Time: {seconds}s
Tokens: {count}

# USER PREFERENCES
Tone: {professional/casual/concise}
Format preference: {bullets/prose/mixed}
Typical interaction style: {user's historical preferences}

# YOUR TASK

Generate a response that:
1. **Directly answers the user's question**
2. **Organizes information logically**
3. **Highlights most important items first**
4. **Is concise but complete**
5. **Provides actionable next steps when appropriate**

# RESPONSE STRATEGY (think step-by-step)

## Step 1: Determine Response Structure
Based on findings, what's the best way to present this?
- For few items (1-3): Brief prose
- For many items (4+): Organized groups or ranked list
- For complex findings: Section headers + organized content
- For urgent items: Prioritize by importance

Chosen structure: [your decision]

## Step 2: Identify Key Insights
What are the 1-3 most important things the user should know?
- Are there high-urgency items requiring immediate action?
- Are there patterns worth highlighting?
- Are there surprises or unexpected findings?

Key insights:
1. [insight]
2. [insight]
3. [insight]

## Step 3: Organize Content by Priority
Group or sort findings:
- High urgency items first
- Time-sensitive before non-urgent
- External people before internal
- Recent before older

Organization approach: [how you'll structure it]

## Step 4: Craft Opening
Start with a direct answer:
- "You're blocking 3 people on urgent items"
- "You have 5 meetings tomorrow and you're unprepared for 2"
- "No urgent emails right now, but 4 items need responses this week"

Opening line: [your draft]

## Step 5: Add Actionable Context
For each important item:
- Who needs what?
- By when?
- What's the consequence of delay?
- What's the quick action?

## Step 6: Consider Closing
Should you:
- Offer to take actions? ("Want me to draft replies?")
- Suggest follow-up queries? ("Should I check older emails too?")
- Just end with the answer?

# OUTPUT FORMAT

Write a natural, conversational response. Use:
- **Bold** for names, dates, or key facts (sparingly)
- Short paragraphs for readability
- Bullet points ONLY if listing 4+ similar items
- Clear headers if organizing into sections

Do NOT:
- Explain how you gathered this information (unless user asks)
- Include technical details about your process
- Show JSON or structured data (convert to prose)
- Apologize for limitations unless truly relevant
- Over-format with excessive bold/bullets/headers

# TONE GUIDELINES

- **Professional but friendly** - avoid being robotic
- **Confident** - you have real findings, present them clearly
- **Helpful** - anticipate next questions or actions
- **Concise** - respect user's time, be efficient

# EXAMPLE RESPONSE PATTERNS

For "What emails am I blocking people on?":

**Good**:
> You're currently blocking 3 people on time-sensitive items:
>
> **Highest priority**: Jeff Chen is waiting 5 days for budget approval. He needs 
> your sign-off on the $50K Q4 increase by **Friday Oct 6** to proceed with planning.
>
> **Also urgent**: Sarah from Marketing followed up twice about the campaign creative. 
> She mentioned being "blocked on your feedback" and needs it by EOD today.
>
> **Medium priority**: Alex's question about the vendor contract has been waiting 
> 3 days. No explicit deadline but he said "would appreciate a quick response."
>
> Want me to draft responses to any of these?

**Avoid**:
> I analyzed 15 email threads and found that based on waiting indicators and response 
> timelines, there are several threads where... [overly technical explanation]

# CRITICAL RULES

1. **Lead with the answer** - don't bury the key information
2. **Use findings, not process** - what you discovered, not how you discovered it
3. **Be specific** - names, dates, context make responses actionable
4. **Format for scanning** - user should grasp main points in 3 seconds
5. **Maintain voice** - you're a helpful assistant, not a search engine

Begin crafting your response:
```

### Example: Synthesis Output

**For query**: "What emails am I blocking people on?"

**Synthesis LLM receives**:
- Original query
- 15 structured thread summaries (~5K tokens)
- Resource stats

**Synthesis LLM generates**:

> You're blocking 3 people on urgent items:
>
> **Jeff Chen** (Product) has been waiting 5 days for Q4 budget approval. He needs your sign-off on the $50K increase by **Friday** to start Q4 planning. This came up in your last sync, and he sent a follow-up yesterday saying it's "critical path."
>
> **Sarah Kim** (Marketing) followed up twice about campaign creative feedback. She's "blocked on your input" and mentioned the creative is due to the agency by EOD today.
>
> **Alex Rodriguez** (Ops) asked about the vendor contract terms 3 days ago. No hard deadline, but he noted "hoping to finalize this week."
>
> You also have 4 lower-priority threads from last week that could use responses, but nothing urgent.
>
> Want me to draft quick replies to Jeff and Sarah?

**Key properties**:
- Direct answer in first sentence
- Organized by urgency
- Specific context (names, timelines, stakes)
- Actionable information
- Natural language (no JSON, no technical jargon)
- Offers logical next step

---

## Handling Different Query Complexities

### Simple Direct Lookup (30% of queries)

**Example**: "What's on my calendar today?"

**Layer 1 Output**:
```json
{
  "query_classification": {"type": "direct", "complexity": "simple"},
  "information_needs": [{
    "id": "today_events",
    "type": "metadata_filter",
    "strategy": {
      "method": "calendar_api_lookup",
      "params": {"date": "2025-10-03", "calendars": ["all"]}
    },
    "parallel_group": 1
  }],
  "synthesis_instructions": {
    "task": "List today's events chronologically"
  }
}
```

**Layer 2 Execution**:
- Single calendar API call → returns 5 events with times, titles, attendees
- No LLM calls needed
- Output: Simple structured list

**Layer 3 Synthesis**:
- Minimal synthesis needed (could even skip LLM for very simple cases)
- Format as chronological list

**Total time**: