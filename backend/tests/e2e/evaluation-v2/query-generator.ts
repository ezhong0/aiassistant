/**
 * Query Generator
 *
 * Uses LLM to generate diverse, realistic queries based on:
 * - CHATBOT_COMMANDS_EXAMPLES.md categories
 * - Specific inbox content
 * - User persona
 */

import * as fs from 'fs';
import * as path from 'path';
import { GeneratedInbox } from '../generators/hyper-realistic-inbox';

export interface GeneratedQuery {
  id: string;
  category: string;
  subcategory: string;
  query: string;
  complexity: 'easy' | 'medium' | 'hard';
  expectedIntent: {
    action: string;
    filters?: string[];
    entities?: Record<string, string>;
  };
  variations?: string[];
  reasoning: string;
}

export interface QueryGenerationConfig {
  commandsDocPath: string;
  inbox: GeneratedInbox;
  queryCount?: number; // Per category
  includedCategories?: string[];
  complexityDistribution?: {
    easy: number; // percentage
    medium: number;
    hard: number;
  };
}

/**
 * Generate queries using LLM
 */
export async function generateQueries(
  config: QueryGenerationConfig,
  llmClient: any
): Promise<GeneratedQuery[]> {
  const {
    commandsDocPath,
    inbox,
    queryCount = 3,
    includedCategories,
    complexityDistribution = { easy: 30, medium: 50, hard: 20 },
  } = config;

  // Read commands document
  const commandsDocRaw = fs.readFileSync(commandsDocPath, 'utf-8');

  // Extract only relevant categories to avoid token limits
  const commandsDoc = includedCategories
    ? extractRelevantCategories(commandsDocRaw, includedCategories)
    : commandsDocRaw;

  // Build inbox summary for context
  const inboxSummary = buildInboxSummary(inbox);

  // Generate queries
  const prompt = buildQueryGenerationPrompt(
    commandsDoc,
    inboxSummary,
    inbox.persona,
    queryCount,
    includedCategories,
    complexityDistribution
  );

  // Use GPT-5-mini for query generation with low reasoning effort
  // GPT-5-mini provides good quality queries with creative diversity
  const response = await callLLMWithRetry(() =>
    llmClient.chat.completions.create({
      model: 'gpt-5-mini',
      max_completion_tokens: 8000,
      reasoning_effort: 'low', // Some reasoning for diverse, realistic queries
      messages: [{
        role: 'user',
        content: prompt,
      }],
    })
  );

  // Parse response
  const responseContent = (response as any).choices?.[0]?.message?.content;

  if (!responseContent) {
    console.error('❌ No content in LLM response:', JSON.stringify(response, null, 2));
    throw new Error('LLM response is empty or malformed');
  }

  console.log('🤖 LLM returned response, length:', responseContent.length);

  const queries = parseQueryGeneratorResponse(responseContent);

  return queries;
}

/**
 * Build inbox summary for query generation context
 */
function buildInboxSummary(inbox: GeneratedInbox): string {
  const stats = inbox.groundTruth.stats;

  const summary = {
    persona: inbox.persona,
    totalEmails: stats.totalEmails,
    urgentCount: stats.urgentCount,
    droppedBallCount: stats.droppedBallCount,
    overdueCommitmentCount: stats.overdueCommitmentCount,
    escalatedCount: stats.escalatedCount,
    vipCount: stats.vipCount,

    sampleSenders: Array.from(inbox.groundTruth.senderProfiles.values())
      .slice(0, 5)
      .map(s => ({ name: s.name, type: s.type, emailCount: s.totalEmailsSent })),

    sampleSubjects: inbox.emails
      .slice(0, 10)
      .map(e => e.subject),

    hasDroppedBalls: stats.droppedBallCount > 0,
    hasEscalations: stats.escalatedCount > 0,
    hasOverdueCommitments: stats.overdueCommitmentCount > 0,
  };

  return JSON.stringify(summary, null, 2);
}

/**
 * Extract only relevant categories from commands doc to reduce token usage
 */
function extractRelevantCategories(commandsDoc: string, categories: string[]): string {
  // Split by markdown headers
  const sections = commandsDoc.split(/^## /m);

  // Keep the introduction (first section)
  let result = sections[0] || '';

  // Add requested categories
  for (const section of sections.slice(1)) {
    const sectionTitle = section.split('\n')[0];
    if (!sectionTitle) continue;

    // Check if this section matches any requested category (case-insensitive, partial match)
    const matches = categories.some(cat =>
      sectionTitle.toLowerCase().includes(cat.toLowerCase()) ||
      cat.toLowerCase().includes(sectionTitle.toLowerCase())
    );

    if (matches) {
      result += '\n## ' + section;
    }
  }

  return result;
}

/**
 * Build prompt for query generation
 */
function buildQueryGenerationPrompt(
  commandsDoc: string,
  inboxSummary: string,
  persona: string,
  queryCount: number,
  includedCategories?: string[],
  complexityDistribution?: { easy: number; medium: number; hard: number }
): string {
  const categoriesInstruction = includedCategories
    ? `Focus on these categories: ${includedCategories.join(', ')}`
    : 'Sample uniformly across all categories';

  return `You are generating realistic test queries for an email/calendar chatbot.

# Command Categories
${commandsDoc}

# Test Inbox Summary
This inbox has the following characteristics:
${inboxSummary}

# Your Task
Generate ${queryCount} diverse, realistic queries per category that would make sense for this specific inbox.

**Important constraints**:
1. **Queries must be relevant to inbox content**: Don't ask about "emails from Sarah" if there's no Sarah in the inbox
2. **Match persona**: ${persona} queries should reflect their role
3. **Complexity distribution**:
   - ${complexityDistribution?.easy || 30}% easy (single criterion)
   - ${complexityDistribution?.medium || 50}% medium (multiple criteria)
   - ${complexityDistribution?.hard || 20}% hard (complex reasoning, ambiguous)
4. ${categoriesInstruction}

# Examples

**Easy query** (single criterion):
{
  "category": "inbox_triage",
  "subcategory": "urgency_detection",
  "query": "Show me urgent emails",
  "complexity": "easy",
  "expectedIntent": {
    "action": "filter_emails",
    "filters": ["urgent"]
  },
  "variations": [
    "What's urgent?",
    "Urgent items today"
  ],
  "reasoning": "Simple urgency filter, directly maps to isUrgent=true"
}

**Medium query** (multiple criteria):
{
  "category": "dropped_balls",
  "subcategory": "unanswered_emails",
  "query": "What haven't I responded to from clients?",
  "complexity": "medium",
  "expectedIntent": {
    "action": "filter_emails",
    "filters": ["unanswered", "sender_type_customer"]
  },
  "variations": [
    "Unanswered customer emails",
    "Client emails waiting on me"
  ],
  "reasoning": "Combines userNeedsToRespond=true AND senderType=customer"
}

**Hard query** (complex reasoning):
{
  "category": "context_recovery",
  "subcategory": "decision_history",
  "query": "What was decided about the pricing project and who needs to know?",
  "complexity": "hard",
  "expectedIntent": {
    "action": "summarize_and_extract",
    "filters": ["topic_pricing", "contains_decision"],
    "entities": {
      "project": "pricing",
      "info_needed": "decision + stakeholders"
    }
  },
  "reasoning": "Requires reading thread, identifying decision, extracting stakeholders"
}

# Output Format
Return a JSON array of query objects:

\`\`\`json
[
  {
    "id": "query-001",
    "category": "inbox_triage",
    "subcategory": "urgency_detection",
    "query": "...",
    "complexity": "easy",
    "expectedIntent": {...},
    "variations": [...],
    "reasoning": "..."
  },
  ...
]
\`\`\`

**Critical**: Make sure queries are actually answerable given the inbox summary above. For example:
- Don't ask about "emails from my boss" if persona is "founder" (founders don't have bosses)
- Don't ask about specific people not in the sampleSenders list
- Don't ask about topics not mentioned in sample subjects
- DO leverage the inbox's actual characteristics (dropped balls, escalations, etc.)

Generate queries now:`;
}

/**
 * Validate that a generated query has all required fields
 */
function validateGeneratedQuery(query: any): query is GeneratedQuery {
  if (!query.query || typeof query.query !== 'string') {
    console.warn(`⚠️  Invalid query: missing or invalid 'query' field`);
    return false;
  }

  if (!query.category || typeof query.category !== 'string') {
    console.warn(`⚠️  Invalid query "${query.query}": missing or invalid 'category' field`);
    return false;
  }

  if (!query.expectedIntent || typeof query.expectedIntent !== 'object') {
    console.warn(`⚠️  Invalid query "${query.query}": missing or invalid 'expectedIntent' field`);
    return false;
  }

  if (!query.expectedIntent.action || typeof query.expectedIntent.action !== 'string') {
    console.warn(`⚠️  Invalid query "${query.query}": expectedIntent missing 'action' field`);
    return false;
  }

  if (!query.complexity || !['easy', 'medium', 'hard'].includes(query.complexity)) {
    console.warn(`⚠️  Invalid query "${query.query}": complexity must be 'easy', 'medium', or 'hard'`);
    return false;
  }

  return true;
}

/**
 * Parse LLM response into structured queries
 */
function parseQueryGeneratorResponse(responseText: string): GeneratedQuery[] {
  // Log raw response for debugging
  console.log('📝 Raw LLM Response (first 500 chars):', responseText.substring(0, 500));

  // Extract JSON array from response - try multiple patterns
  let jsonMatch = responseText.match(/```json\n([\s\S]+?)\n```/);

  if (!jsonMatch) {
    // Try without the json specifier
    jsonMatch = responseText.match(/```\n([\s\S]+?)\n```/);
  }

  if (!jsonMatch) {
    // Try to find JSON array directly
    jsonMatch = responseText.match(/(\[[\s\S]+\])/);
  }

  if (!jsonMatch || !jsonMatch[1]) {
    console.error('❌ Failed to extract JSON from response');
    console.error('Full response:', responseText);
    throw new Error('Failed to parse query generator response as JSON');
  }

  console.log('✅ Extracted JSON (first 300 chars):', jsonMatch[1].substring(0, 300));

  let queries;
  try {
    queries = JSON.parse(jsonMatch[1]);
  } catch (parseError) {
    console.error('❌ JSON.parse failed:', parseError);
    console.error('Attempted to parse:', jsonMatch[1]);
    throw new Error(`Failed to parse JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
  }

  // Validate structure
  if (!Array.isArray(queries)) {
    throw new Error('Expected array of queries');
  }

  // Filter out invalid queries and add IDs
  const validQueries = queries.filter(q => {
    const isValid = validateGeneratedQuery(q);
    if (!isValid) {
      console.warn(`⚠️  Skipping invalid query: ${JSON.stringify(q).substring(0, 100)}...`);
    }
    return isValid;
  });

  // Add IDs if missing
  validQueries.forEach((q, i) => {
    if (!q.id) {
      q.id = `query-${String(i + 1).padStart(3, '0')}`;
    }
  });

  if (validQueries.length === 0) {
    throw new Error('No valid queries generated by LLM');
  }

  console.log(`✅ Validated ${validQueries.length} out of ${queries.length} queries`);

  return validQueries as GeneratedQuery[];
}

/**
 * Save generated queries to file
 */
export function saveQueries(queries: GeneratedQuery[], filepath: string): void {
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filepath, JSON.stringify({ queries, generatedAt: new Date().toISOString() }, null, 2));
  console.log(`✅ Saved ${queries.length} queries to ${filepath}`);
}

/**
 * Load queries from file
 */
export function loadQueries(filepath: string): GeneratedQuery[] {
  const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  return data.queries;
}

/**
 * Call LLM API with retry logic for transient errors
 */
async function callLLMWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries - 1;

      // Check if error is retryable
      const isRetryable = error.status === 429 || error.status >= 500;

      if (!isRetryable || isLastAttempt) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const waitTime = Math.pow(2, attempt) * 1000;
      console.warn(`⚠️  API call failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${waitTime}ms...`);
      console.warn(`   Error: ${error.message}`);

      await sleep(waitTime);
    }
  }

  throw new Error('Max retries exceeded');
}

/**
 * Helper: sleep for ms
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
