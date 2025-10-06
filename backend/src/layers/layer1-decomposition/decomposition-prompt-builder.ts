/**
 * Layer 1: Decomposition Prompt Builder
 *
 * Builds the prompt for query decomposition into execution graphs.
 * Based on the progressive decomposition architecture design.
 */

import { DecompositionInput, ExecutionGraph } from './execution-graph.types';
import { AIDomainService } from '../../services/domain/ai-domain.service';

export class DecompositionPromptBuilder {
  constructor(private aiService: AIDomainService) {}

  /**
   * Build and execute the decomposition prompt
   */
  async execute(input: DecompositionInput): Promise<ExecutionGraph> {
    const { systemPrompt, userPrompt } = this.buildPrompts(input);
    const schema = this.getExecutionGraphSchema();

    // Call AI service with structured output
    const response = await this.aiService.executePrompt<ExecutionGraph>(
      {
        systemPrompt,
        userPrompt,
        options: {
          temperature: 0.1, // Low temperature for consistent structured output
          maxTokens: 3000, // Bounded output
          model: 'gpt-5-nano'
        }
      },
      schema,
      'DecompositionPromptBuilder'
    );

    return response.parsed;
  }

  /**
   * Get the JSON schema for execution graph
   */
  private getExecutionGraphSchema(): any {
    return {
      type: 'object',
      description: 'Execution graph for query decomposition',
      properties: {
        query_classification: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['direct', 'filtered_search', 'investigative', 'cross_domain', 'write_command'] },
            complexity: { type: 'string', enum: ['simple', 'moderate', 'complex'] },
            domains: { type: 'array', items: { type: 'string' } },
            reasoning: { type: 'string' }
          },
          required: ['type', 'complexity', 'domains', 'reasoning']
        },
        information_needs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              description: { type: 'string' },
              type: { type: 'string', enum: ['metadata_filter', 'keyword_search', 'batch_thread_read', 'cross_reference', 'semantic_analysis'] },
              importance: { type: 'string', enum: ['critical', 'important', 'optional'] },
              strategy: {
                type: 'object',
                properties: {
                  method: { type: 'string' },
                  params: { type: 'object' }
                },
                required: ['method', 'params']
              },
              depends_on: { type: 'array', items: { type: 'string' } },
              parallel_group: { type: 'number' },
              expected_cost: {
                type: 'object',
                properties: {
                  tokens: { type: 'number' },
                  llm_calls: { type: 'number' },
                  time_seconds: { type: 'number' }
                },
                required: ['tokens', 'llm_calls', 'time_seconds']
              }
            },
            required: ['id', 'description', 'type', 'importance', 'strategy', 'depends_on', 'parallel_group', 'expected_cost']
          }
        },
        synthesis_instructions: {
          type: 'object',
          properties: {
            task: { type: 'string' },
            ranking_criteria: { type: 'string' },
            presentation_format: { type: 'string' },
            user_preferences: { type: 'string' }
          },
          required: ['task', 'ranking_criteria', 'presentation_format', 'user_preferences']
        },
        resource_estimate: {
          type: 'object',
          properties: {
            total_items_accessed: { type: 'number' },
            total_llm_calls: { type: 'number' },
            estimated_tokens: { type: 'number' },
            estimated_time_seconds: { type: 'number' },
            estimated_cost_usd: { type: 'number' },
            user_should_confirm: { type: 'boolean' }
          },
          required: ['total_items_accessed', 'total_llm_calls', 'estimated_tokens', 'estimated_time_seconds', 'estimated_cost_usd', 'user_should_confirm']
        }
      },
      required: ['query_classification', 'information_needs', 'synthesis_instructions', 'resource_estimate']
    };
  }

  /**
   * Build the decomposition prompts (system and user)
   */
  private buildPrompts(input: DecompositionInput): { systemPrompt: string; userPrompt: string } {
    const systemPrompt = `You are an AI query analyzer that decomposes user queries into structured execution graphs.

You MUST return a valid JSON object matching the schema. Do not include any explanatory text.`;

    const userPrompt = this.buildUserPrompt(input);

    return { systemPrompt, userPrompt };
  }

  /**
   * Build the user prompt with examples
   */
  private buildUserPrompt(input: DecompositionInput): string {
    const conversationContext = this.formatConversationHistory(input.conversation_history);
    const userContextStr = this.formatUserContext(input.user_context);

    return `You are analyzing a user query to determine what information is needed to answer it.

YOUR JOB IS NOT TO ANSWER THE QUERY. Your job is to:
1. Classify the query type
2. Decompose it into discrete information needs
3. Identify dependencies between information needs
4. Determine what can be gathered in parallel
5. Estimate resource requirements

## USER QUERY

"${input.user_query}"

## CONVERSATION CONTEXT

${conversationContext}

## USER CONTEXT

${userContextStr}

Current timestamp: ${input.current_timestamp}

## DECOMPOSITION PROCESS

Follow these steps:

### Step 1: Query Classification

Classify the query as one of:
- **direct**: Simple lookup (e.g., "what's on my calendar today?")
- **filtered_search**: Search with specific criteria (e.g., "show me urgent emails")
- **investigative**: Requires multi-step reasoning (e.g., "what emails am I blocking people on?")
- **cross_domain**: Involves multiple data sources (email + calendar)
- **write_command**: Action to perform (e.g., "reply to Jeff", "archive all newsletters")

Determine complexity: simple | moderate | complex
Identify domains involved: email, calendar, or both

### Step 2: Information Needs Analysis

For the query, identify what discrete pieces of information are needed.

Think step-by-step:
- What data do I need to gather?
- Can any data be gathered simultaneously (parallel)?
- What data depends on other data (sequential)?
- How can I bound each information need (max_results, time_range)?

### Step 3: Strategy Selection

For each information need, choose the most efficient strategy:

**metadata_filter** (no LLM, API only):
- Use when: Filtering by known fields (date, sender, read/unread status)
- Example: "emails from last 30 days where user received last message"
- Cost: Low (API call only)

**keyword_search** (no LLM, API only):
- Use when: Searching for specific terms or patterns
- Example: "emails containing 'following up' or 'checking in'"
- Cost: Low (API call only)

**batch_thread_read** (LLM-powered, bounded):
- Use when: Need to understand content of specific threads
- Analyze each thread independently (parallel execution)
- Extract structured information only
- Cost: High (LLM per thread, bounded by batch_size)

**cross_reference** (LLM-powered, receives summaries):
- Use when: Need to rank, filter, or combine results from previous nodes
- Operates on summaries, not raw data
- Cost: Medium (single LLM call on structured data)

**semantic_analysis** (LLM-powered, batch):
- Use when: Need to classify intent or extract meaning
- Operates on items in parallel batches
- Cost: Medium-High (depends on batch size)

### Step 3.5: Importance Classification

**CRITICAL**: For each node, classify its importance level. This controls failure handling:

**critical** - Query cannot be answered without this node:
- Use when: The node directly provides the answer to the user's query
- Example: "show me urgent emails" → filtering by urgency is CRITICAL
- Example: "what's on my calendar today" → fetching today's events is CRITICAL
- If this fails: Entire query fails immediately (no partial results)

**important** (default) - Node significantly improves the answer:
- Use when: Node enhances results but fallback is possible
- Example: "show me urgent emails" → keyword search for urgency indicators is IMPORTANT (can fall back to metadata)
- Example: Thread analysis that adds context but isn't the core answer
- If this fails: System may use fallback strategy, logs warning

**optional** - Node adds nice-to-have context:
- Use when: Node enriches results but isn't necessary
- Example: Fetching related calendar events when user asked about emails
- Example: Thread context when user asked for specific emails
- If this fails: Silent failure, results still useful without it

**Guidelines:**
- If user explicitly asks for X, nodes providing X are CRITICAL
- Enrichment/ranking nodes are usually IMPORTANT
- Cross-domain context nodes are usually OPTIONAL
- When in doubt, mark as IMPORTANT (safe default)

### Step 4: Dependency Graph

Create a directed acyclic graph (DAG):
- Assign each information need a unique ID
- Identify dependencies (depends_on: list of IDs)
- Assign parallel groups (nodes with no dependencies or same dependencies can run in parallel)
- Ensure no circular dependencies

### Step 5: Resource Estimation

Estimate:
- How many items will be accessed (emails, threads, events)
- How many LLM calls needed
- Approximate token count
- Estimated time (seconds)
- Estimated cost (USD)
- Whether user confirmation is needed (if expensive)

## OUTPUT FORMAT

Return ONLY a JSON object with this exact structure:

{
  "query_classification": {
    "type": "direct" | "filtered_search" | "investigative" | "cross_domain" | "write_command",
    "complexity": "simple" | "moderate" | "complex",
    "domains": ["email", "calendar"],
    "reasoning": "Brief explanation of classification"
  },
  "information_needs": [
    {
      "id": "unique_id",
      "description": "What this node does",
      "type": "metadata_filter" | "keyword_search" | "batch_thread_read" | "cross_reference" | "semantic_analysis",
      "importance": "critical" | "important" | "optional",
      "strategy": {
        "method": "specific method name",
        "params": {
          // Strategy-specific parameters
          // Use {{node_id.field}} syntax for dependencies
          // Always include bounds: max_results, time_range, batch_size, etc.
        }
      },
      "depends_on": ["node_id1", "node_id2"],
      "parallel_group": 1,
      "expected_cost": {
        "tokens": 0,
        "llm_calls": 0,
        "time_seconds": 0.5
      }
    }
  ],
  "synthesis_instructions": {
    "task": "What the synthesis layer should do with the findings",
    "ranking_criteria": "How to prioritize results",
    "presentation_format": "How to present to user",
    "user_preferences": "Any specific user preferences to follow"
  },
  "resource_estimate": {
    "total_items_accessed": 0,
    "total_llm_calls": 0,
    "estimated_tokens": 0,
    "estimated_time_seconds": 0,
    "estimated_cost_usd": 0.0,
    "user_should_confirm": false
  }
}

## IMPORTANT CONSTRAINTS

1. **Always bound searches**: Every search MUST have max_results, time_range limits
2. **Explicit dependencies**: Use depends_on to enforce execution order
3. **Parallel groups**: Nodes in same group execute simultaneously
4. **No raw data flow**: batch_thread_read should extract summaries, not return full threads
5. **Conservative estimates**: Better to overestimate resources than underestimate
6. **Reasonable defaults**:
   - Time range: 30 days for emails unless specified
   - Max results: 50-100 for searches, 15-20 for thread analysis
   - Batch size: 5-10 for parallel LLM calls

## EXAMPLES

### Example 1: Simple Query
Query: "What's on my calendar today?"

{
  "query_classification": {
    "type": "direct",
    "complexity": "simple",
    "domains": ["calendar"],
    "reasoning": "Simple calendar lookup for specific date"
  },
  "information_needs": [
    {
      "id": "today_events",
      "description": "Get all calendar events for today",
      "type": "metadata_filter",
      "importance": "critical",
      "strategy": {
        "method": "calendar_events_by_date",
        "params": {
          "date": "2025-10-03",
          "calendars": ["primary"],
          "include_declined": false
        }
      },
      "depends_on": [],
      "parallel_group": 1,
      "expected_cost": {
        "tokens": 0,
        "llm_calls": 0,
        "time_seconds": 0.3
      }
    }
  ],
  "synthesis_instructions": {
    "task": "List events chronologically with times and titles",
    "ranking_criteria": "by time",
    "presentation_format": "Chronological list",
    "user_preferences": "Clear and concise"
  },
  "resource_estimate": {
    "total_items_accessed": 10,
    "total_llm_calls": 0,
    "estimated_tokens": 500,
    "estimated_time_seconds": 1,
    "estimated_cost_usd": 0.001,
    "user_should_confirm": false
  }
}

### Example 2: Investigative Query
Query: "What emails am I blocking people on?"

{
  "query_classification": {
    "type": "investigative",
    "complexity": "complex",
    "domains": ["email"],
    "reasoning": "Requires multi-step analysis to identify threads where others are waiting"
  },
  "information_needs": [
    {
      "id": "recent_unreplied",
      "description": "Find emails where user received last message",
      "type": "metadata_filter",
      "importance": "critical",
      "strategy": {
        "method": "gmail_search",
        "params": {
          "filters": ["is:unread OR label:inbox", "after:30_days_ago"],
          "max_results": 100,
          "fields": ["id", "threadId", "from", "subject", "date", "snippet"]
        }
      },
      "depends_on": [],
      "parallel_group": 1,
      "expected_cost": {
        "tokens": 0,
        "llm_calls": 0,
        "time_seconds": 0.5
      }
    },
    {
      "id": "waiting_indicators",
      "description": "Find emails with language indicating someone is waiting",
      "type": "keyword_search",
      "importance": "important",
      "strategy": {
        "method": "gmail_search",
        "params": {
          "patterns": ["following up", "checking in", "haven't heard", "still waiting", "circling back"],
          "time_range": "after:30_days_ago",
          "max_results": 100,
          "fields": ["id", "threadId", "from", "subject", "date", "snippet"]
        }
      },
      "depends_on": [],
      "parallel_group": 1,
      "expected_cost": {
        "tokens": 0,
        "llm_calls": 0,
        "time_seconds": 0.5
      }
    },
    {
      "id": "candidate_threads",
      "description": "Intersect and rank candidate threads",
      "type": "cross_reference",
      "importance": "important",
      "strategy": {
        "method": "intersect_and_rank",
        "params": {
          "sources": ["recent_unreplied.thread_ids", "waiting_indicators.thread_ids"],
          "operation": "intersection",
          "rank_by": "most_recent",
          "take_top": 20
        }
      },
      "depends_on": ["recent_unreplied", "waiting_indicators"],
      "parallel_group": 2,
      "expected_cost": {
        "tokens": 2000,
        "llm_calls": 1,
        "time_seconds": 0.8
      }
    },
    {
      "id": "thread_analysis",
      "description": "Analyze each thread to determine who's waiting and context",
      "type": "batch_thread_read",
      "importance": "critical",
      "strategy": {
        "method": "analyze_threads_batch",
        "params": {
          "thread_ids": "{{candidate_threads.top_20}}",
          "extract_fields": [
            "last_sender",
            "user_is_recipient",
            "contains_question_or_request",
            "waiting_indicators",
            "days_since_user_responded",
            "urgency_signals",
            "context"
          ],
          "batch_size": 5
        }
      },
      "depends_on": ["candidate_threads"],
      "parallel_group": 3,
      "expected_cost": {
        "tokens": 40000,
        "llm_calls": 20,
        "time_seconds": 2.5
      }
    }
  ],
  "synthesis_instructions": {
    "task": "Identify which threads show someone genuinely waiting for user response",
    "ranking_criteria": "by urgency level and waiting duration",
    "presentation_format": "Grouped by priority: high urgency first, then by days waiting",
    "user_preferences": "Be specific about who's waiting and what they need"
  },
  "resource_estimate": {
    "total_items_accessed": 120,
    "total_llm_calls": 21,
    "estimated_tokens": 45000,
    "estimated_time_seconds": 4.5,
    "estimated_cost_usd": 0.028,
    "user_should_confirm": false
  }
}

Now analyze the user's query and generate the execution graph.`;
  }

  /**
   * Format conversation history for the prompt
   */
  private formatConversationHistory(history: any[]): string {
    if (!history || history.length === 0) {
      return 'No previous conversation.';
    }

    // Take last 3 turns only (bounded context)
    const recentHistory = history.slice(-3);

    return recentHistory
      .map((msg, idx) => {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        return `${role}: ${msg.content}`;
      })
      .join('\n\n');
  }

  /**
   * Format user context for the prompt
   */
  private formatUserContext(context: any): string {
    const parts: string[] = [];

    if (context.timezone) {
      parts.push(`Timezone: ${context.timezone}`);
    }

    if (context.email_accounts && context.email_accounts.length > 0) {
      const accounts = context.email_accounts
        .map((acc: any) => `${acc.email}${acc.primary ? ' (primary)' : ''}`)
        .join(', ');
      parts.push(`Email accounts: ${accounts}`);
    }

    if (context.calendars && context.calendars.length > 0) {
      const cals = context.calendars
        .map((cal: any) => `${cal.name}${cal.primary ? ' (primary)' : ''}`)
        .join(', ');
      parts.push(`Calendars: ${cals}`);
    }

    return parts.length > 0 ? parts.join('\n') : 'No additional context';
  }
}
