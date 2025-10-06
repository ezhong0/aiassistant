/**
 * Multi-Layer Evaluator
 *
 * Provides deep diagnostic analysis of chatbot performance across layers:
 * 1. Query Understanding (NLU)
 * 2. Retrieval Quality
 * 3. Ranking Quality
 * 4. Presentation Quality
 * 5. Overall Success
 */

import { GeneratedInbox } from '../generators/hyper-realistic-inbox';
import { GeneratedQuery } from './query-generator';

export interface ChatbotResponse {
  // What the chatbot returned
  type: 'email_list' | 'summary' | 'calendar_info' | 'boolean_answer';
  emailIds?: string[];
  summary?: string;
  ranking?: Array<{ emailId: string; score: number }>;
  presentation?: string; // How it was formatted/presented

  // Optional: Internal state (if your chatbot exposes this)
  internalState?: {
    parsedIntent?: any;
    retrievalQuery?: any;
    rankingScores?: any;
    processingTime?: number;
    filtersApplied?: string[];
    resultsBeforeRanking?: number;
  };
}

export interface LayerScore {
  score: number; // 0-100
  details: string;
  issues: string[];
  strengths: string[];
}

export interface EvaluationReport {
  testId: string;
  query: string;
  timestamp: string;

  // Overall
  overallScore: number; // 0-100
  passed: boolean;
  userSatisfaction: 'very_satisfied' | 'satisfied' | 'somewhat' | 'unsatisfied';

  // Layer scores
  layers: {
    queryUnderstanding: LayerScore;
    retrieval: LayerScore;
    ranking: LayerScore;
    presentation: LayerScore;
    overall: LayerScore;
  };

  // Diagnosis
  diagnosis: {
    whatWorkedWell: string[];
    whatFailed: Array<{
      layer: string;
      issue: string;
      severity: 'critical' | 'high' | 'medium' | 'low';
      impact: string;
      suggestedFix: string;
    }>;
    criticalErrors: string[];
    missedOpportunities: string[];
  };

  // Metrics
  metrics: {
    precision?: number;
    recall?: number;
    f1?: number;
    ndcg?: number;
    criticalMissCount: number;
    falsePositiveCount: number;
  };

  // Recommendations
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    recommendation: string;
  }>;
}

/**
 * Evaluate chatbot response with multi-layer analysis
 */
export async function evaluateChatbotResponse(
  query: GeneratedQuery,
  inbox: GeneratedInbox,
  chatbotResponse: ChatbotResponse,
  llmClient: any
): Promise<EvaluationReport> {

  // Build ground truth context
  const groundTruthContext = buildGroundTruthContext(query, inbox);

  // Build evaluation prompt
  const prompt = buildMultiLayerEvaluationPrompt(
    query,
    groundTruthContext,
    chatbotResponse
  );

  // Call evaluator LLM with retry logic
  const response = await callLLMWithRetry(() =>
    llmClient.chat.completions.create({
      model: 'gpt-5-nano', // Using gpt-5-nano for evaluation (reasoning model)
      max_completion_tokens: 6000, // Higher limit for reasoning + output
      reasoning_effort: 'minimal', // Use minimal effort for evaluation to save tokens
      messages: [{
        role: 'user',
        content: prompt,
      }],
    })
  );

  // Parse evaluation
  const responseContent = (response as any).choices[0].message.content;
  const evaluation = parseEvaluationResponse(responseContent, query.id);

  return evaluation;
}

/**
 * Build ground truth context for evaluation
 */
function buildGroundTruthContext(query: GeneratedQuery, inbox: GeneratedInbox) {
  // Get relevant ground truth based on query
  const allEmails = inbox.emails.map(email => ({
    id: email.id,
    from: email.from,
    subject: email.subject,
    sentDate: email.sentDate,
    label: email.label,
  }));

  const action = query.expectedIntent.action;

  // Handle different query types
  if (action === 'filter_emails') {
    // Calculate what emails SHOULD be returned
    const expectedEmailIds = calculateExpectedEmails(query, inbox);

    return {
      type: 'email_list',
      totalEmails: inbox.emails.length,
      allEmails,
      expectedEmailIds,
      expectedCount: expectedEmailIds.length,
      inboxStats: inbox.groundTruth.stats,
    };
  } else if (action === 'summarize_thread' || action === 'summarize_and_extract') {
    // For summary queries, identify key facts that should be mentioned
    const relevantEmails = calculateExpectedEmails(query, inbox);
    const keyFacts = extractKeyFacts(query, inbox, relevantEmails);

    return {
      type: 'summary',
      totalEmails: inbox.emails.length,
      allEmails,
      relevantEmailIds: relevantEmails,
      keyFacts,
      forbiddenFacts: [], // Things that shouldn't be mentioned
      inboxStats: inbox.groundTruth.stats,
    };
  } else if (action === 'boolean_answer') {
    // For boolean queries, determine the expected answer
    const expectedAnswer = determineBooleanAnswer(query, inbox);

    return {
      type: 'boolean',
      totalEmails: inbox.emails.length,
      allEmails,
      expectedAnswer,
      reasoning: expectedAnswer.reasoning,
      inboxStats: inbox.groundTruth.stats,
    };
  } else {
    // Default: treat as email list
    const expectedEmailIds = calculateExpectedEmails(query, inbox);

    return {
      type: 'email_list',
      totalEmails: inbox.emails.length,
      allEmails,
      expectedEmailIds,
      expectedCount: expectedEmailIds.length,
      inboxStats: inbox.groundTruth.stats,
    };
  }
}

/**
 * Filter resolvers: map filter names to label predicates
 */
const FILTER_RESOLVERS: Record<string, (label: any) => boolean> = {
  urgent: (l) => l.isUrgent,
  important: (l) => l.isImportant,
  dropped_ball: (l) => l.isDroppedBall,
  unanswered: (l) => l.userNeedsToRespond,
  follow_up: (l) => l.isFollowUp,
  escalated: (l) => l.isEscalated,
  sender_type_boss: (l) => l.senderType === 'boss',
  sender_type_manager: (l) => l.senderType === 'boss',
  sender_type_customer: (l) => l.senderType === 'customer',
  sender_type_vendor: (l) => l.senderType === 'vendor',
  sender_type_investor: (l) => l.senderType === 'investor',
  sender_type_peer: (l) => l.senderType === 'peer',
  sender_type_report: (l) => l.senderType === 'report',
  commitment_overdue: (l) => l.commitmentStatus === 'overdue',
  commitment_pending: (l) => l.commitmentStatus === 'pending',
  vip: (l) => l.isVIP,
};

/**
 * Resolve filter name to predicate function with fuzzy matching
 */
function resolveFilter(filterName: string): ((label: any) => boolean) | null {
  // Normalize filter name
  const normalized = filterName.toLowerCase().trim();

  // Exact match
  if (FILTER_RESOLVERS[normalized]) {
    return FILTER_RESOLVERS[normalized];
  }

  // Fuzzy match
  if (normalized.includes('urgent')) return FILTER_RESOLVERS.urgent ?? null;
  if (normalized.includes('important')) return FILTER_RESOLVERS.important ?? null;
  if (normalized.includes('dropped') || normalized.includes('ball')) return FILTER_RESOLVERS.dropped_ball ?? null;
  if (normalized.includes('unanswered') || normalized.includes('respond')) return FILTER_RESOLVERS.unanswered ?? null;
  if (normalized.includes('follow')) return FILTER_RESOLVERS.follow_up ?? null;
  if (normalized.includes('escalat')) return FILTER_RESOLVERS.escalated ?? null;
  if (normalized.includes('boss') || normalized.includes('manager')) return FILTER_RESOLVERS.sender_type_boss ?? null;
  if (normalized.includes('customer') || normalized.includes('client')) return FILTER_RESOLVERS.sender_type_customer ?? null;
  if (normalized.includes('vendor') || normalized.includes('supplier')) return FILTER_RESOLVERS.sender_type_vendor ?? null;
  if (normalized.includes('investor')) return FILTER_RESOLVERS.sender_type_investor ?? null;
  if (normalized.includes('peer') || normalized.includes('colleague')) return FILTER_RESOLVERS.sender_type_peer ?? null;
  if (normalized.includes('report') || normalized.includes('direct')) return FILTER_RESOLVERS.sender_type_report ?? null;
  if (normalized.includes('commitment') && normalized.includes('overdue')) return FILTER_RESOLVERS.commitment_overdue ?? null;
  if (normalized.includes('vip')) return FILTER_RESOLVERS.vip ?? null;

  console.warn(`⚠️  Unknown filter: "${filterName}"`);
  return null;
}

/**
 * Calculate which emails should be returned based on query intent
 */
function calculateExpectedEmails(query: GeneratedQuery, inbox: GeneratedInbox): string[] {
  const { expectedIntent } = query;
  const filters = expectedIntent.filters || [];

  return inbox.emails.filter(email => {
    const label = email.label;

    // Apply filters based on intent
    for (const filterName of filters) {
      const filterFn = resolveFilter(filterName);

      if (!filterFn) {
        // Unknown filter - skip it
        continue;
      }

      if (!filterFn(label)) {
        return false;
      }
    }

    return true;
  }).map(e => e.id);
}

/**
 * Extract key facts for summary evaluation
 */
function extractKeyFacts(query: GeneratedQuery, inbox: GeneratedInbox, relevantEmailIds: string[]): string[] {
  const facts: string[] = [];
  const relevantEmails = inbox.emails.filter(e => relevantEmailIds.includes(e.id));

  // Extract entities from query
  const entities = query.expectedIntent.entities || {};

  // Add facts based on email content
  relevantEmails.forEach(email => {
    const label = email.label;

    // Key information from labels
    if (label.isDroppedBall) {
      facts.push(`Email from ${email.from} is a dropped ball (no response sent)`);
    }

    if (label.isEscalated) {
      facts.push(`Email from ${email.from} has been escalated (follow-up required)`);
    }

    if (label.commitmentStatus === 'overdue') {
      facts.push(`Overdue commitment to ${email.from}`);
    }

    if (label.isUrgent) {
      facts.push(`Urgent email: ${email.subject}`);
    }

    // Add project/topic facts if specified
    if (entities.project) {
      facts.push(`Email related to ${entities.project} project from ${email.from}`);
    }
  });

  return facts;
}

/**
 * Determine expected boolean answer for yes/no queries
 */
function determineBooleanAnswer(query: GeneratedQuery, inbox: GeneratedInbox): { answer: boolean; reasoning: string } {
  const filters = query.expectedIntent.filters || [];
  const matchingEmails = inbox.emails.filter(email => {
    const label = email.label;

    for (const filter of filters) {
      if (filter === 'urgent' && !label.isUrgent) return false;
      if (filter === 'important' && !label.isImportant) return false;
      if (filter === 'dropped_ball' && !label.isDroppedBall) return false;
      if (filter === 'unanswered' && !label.userNeedsToRespond) return false;
    }

    return true;
  });

  const answer = matchingEmails.length > 0;
  const reasoning = answer
    ? `Yes, found ${matchingEmails.length} email(s) matching criteria`
    : `No, no emails match the criteria`;

  return { answer, reasoning };
}

/**
 * Build multi-layer evaluation prompt
 */
function buildMultiLayerEvaluationPrompt(
  query: GeneratedQuery,
  groundTruth: any,
  chatbotResponse: ChatbotResponse
): string {
  // Build ground truth section based on type
  let groundTruthSection = '';
  if (groundTruth.type === 'email_list') {
    groundTruthSection = `
# Ground Truth
Based on email labels, the correct answer is:

\`\`\`json
{
  "type": "email_list",
  "expectedEmailIds": ${JSON.stringify(groundTruth.expectedEmailIds)},
  "expectedCount": ${groundTruth.expectedCount},
  "totalEmailsInInbox": ${groundTruth.totalEmails},
  "inboxStats": ${JSON.stringify(groundTruth.inboxStats)}
}
\`\`\`
`;
  } else if (groundTruth.type === 'summary') {
    groundTruthSection = `
# Ground Truth
This is a summary query. The response should mention these key facts:

\`\`\`json
{
  "type": "summary",
  "relevantEmailIds": ${JSON.stringify(groundTruth.relevantEmailIds)},
  "keyFacts": ${JSON.stringify(groundTruth.keyFacts, null, 2)},
  "forbiddenFacts": ${JSON.stringify(groundTruth.forbiddenFacts)},
  "totalEmailsInInbox": ${groundTruth.totalEmails}
}
\`\`\`

**Evaluation criteria**:
- Did the summary mention the key facts?
- Is the summary accurate (no hallucinations)?
- Is it concise and actionable?
`;
  } else if (groundTruth.type === 'boolean') {
    groundTruthSection = `
# Ground Truth
This is a yes/no query. The correct answer is:

\`\`\`json
{
  "type": "boolean",
  "expectedAnswer": ${groundTruth.expectedAnswer.answer},
  "reasoning": "${groundTruth.expectedAnswer.reasoning}",
  "totalEmailsInInbox": ${groundTruth.totalEmails}
}
\`\`\`
`;
  }

  return `You are evaluating an email chatbot's performance across multiple layers.

# Test Query
**Query**: "${query.query}"
**Category**: ${query.category} / ${query.subcategory || 'general'}
**Complexity**: ${query.complexity}
**Expected Intent**: ${JSON.stringify(query.expectedIntent, null, 2)}

${groundTruthSection}

# Chatbot Response
The chatbot returned:

\`\`\`json
${JSON.stringify(chatbotResponse, null, 2)}
\`\`\`

# Your Evaluation Task

Analyze the chatbot's performance across **5 layers**:

## Layer 1: Query Understanding (NLU)
**Question**: Did the chatbot correctly understand what the user wanted?

**Check**:
- Did it parse the intent correctly? (e.g., "urgent" → filter by isUrgent)
- Did it extract entities? (e.g., person names, time ranges)
- Any misinterpretations?

**Score 0-100**: How well did it understand the query?

## Layer 2: Retrieval Quality
**Question**: Did it retrieve the right emails?

**Metrics**:
- **Precision**: (correct emails returned) / (total returned) × 100
- **Recall**: (correct emails returned) / (total that should be returned) × 100
- **Critical Misses**: Any P0 emails missed? (escalations, VIP dropped balls, etc.)
- **False Positives**: Wrong emails included?

**Score 0-100**: Based on F1 score, with heavy penalty for critical misses

## Layer 3: Ranking Quality
**Question**: Are the most important results shown first? (if applicable)

**Check**:
- Top 3 results appropriate?
- Critical items ranked high?
- Less important items ranked low?

**Score 0-100**: Quality of ranking order

## Layer 4: Presentation Quality
**Question**: Is the response clear, actionable, and helpful?

**Check**:
- Format appropriate for query type?
- Key information highlighted?
- Actionable next steps provided?
- Any information overload or missing context?

**Score 0-100**: Clarity and usefulness of presentation

## Layer 5: Overall Success
**Question**: Would a real user be satisfied with this response?

**Consider**:
- Task completion: Did it solve the user's problem?
- Effort required: How many follow-up queries needed?
- Trust: Any hallucinations or errors?
- User satisfaction: 1-10 rating

**Score 0-100**: Overall user satisfaction proxy

# Output Format

Provide your evaluation in this exact JSON format:

\`\`\`json
{
  "overallScore": 75,
  "passed": true,
  "userSatisfaction": "satisfied",

  "layers": {
    "queryUnderstanding": {
      "score": 90,
      "details": "Correctly parsed 'urgent' intent...",
      "issues": ["Missed time constraint 'today'"],
      "strengths": ["Good entity extraction"]
    },
    "retrieval": {
      "score": 70,
      "details": "Precision 85%, Recall 70%...",
      "issues": ["Missed 1 escalated customer issue"],
      "strengths": ["Good spam filtering"]
    },
    "ranking": {
      "score": 80,
      "details": "Top results appropriate...",
      "issues": ["Newsletter ranked too high"],
      "strengths": ["Escalations ranked first"]
    },
    "presentation": {
      "score": 85,
      "details": "Clear list format...",
      "issues": [],
      "strengths": ["Good priority indicators"]
    },
    "overall": {
      "score": 75,
      "details": "Mostly successful but missed critical email...",
      "issues": ["Would need follow-up query"],
      "strengths": ["Fast, mostly accurate"]
    }
  },

  "diagnosis": {
    "whatWorkedWell": [
      "Correctly understood urgency intent",
      "Good spam filtering",
      "Clear presentation"
    ],
    "whatFailed": [
      {
        "layer": "retrieval",
        "issue": "Missed escalated customer issue email-42",
        "severity": "critical",
        "impact": "User won't see P0 customer emergency",
        "suggestedFix": "Add isEscalated check to urgency filter"
      },
      {
        "layer": "ranking",
        "issue": "Newsletter ranked #3 despite being noise",
        "severity": "medium",
        "impact": "Pushes real urgent items down",
        "suggestedFix": "Filter spam before ranking"
      }
    ],
    "criticalErrors": [
      "Missed escalated customer issue"
    ],
    "missedOpportunities": [
      "Could highlight emails that block others"
    ]
  },

  "metrics": {
    "precision": 85.7,
    "recall": 70.0,
    "f1": 77.1,
    "criticalMissCount": 1,
    "falsePositiveCount": 1
  },

  "recommendations": [
    {
      "priority": "high",
      "recommendation": "Fix escalation detection in retrieval layer"
    },
    {
      "priority": "medium",
      "recommendation": "Add spam pre-filter before urgency check"
    }
  ]
}
\`\`\`

**Important**:
- Be specific about which emails were missed/wrong (use email IDs)
- Focus on actionable insights and fix suggestions
- Mark critical errors that would cause user harm
- Consider the user persona when evaluating success
`;
}

/**
 * Parse evaluation response
 */
function parseEvaluationResponse(responseText: string, queryId: string): EvaluationReport {
  // Extract JSON
  const jsonMatch = responseText.match(/```json\n([\s\S]+?)\n```/) || responseText.match(/({[\s\S]+})/);

  if (!jsonMatch || !jsonMatch[1]) {
    throw new Error('Failed to parse evaluation response as JSON');
  }

  const evaluation = JSON.parse(jsonMatch[1]);

  // Add metadata
  evaluation.testId = queryId;
  evaluation.timestamp = new Date().toISOString();

  return evaluation as EvaluationReport;
}

/**
 * Calculate aggregate statistics across multiple evaluations
 */
export function aggregateEvaluations(evaluations: EvaluationReport[]): any {
  const totalTests = evaluations.length;
  const passed = evaluations.filter(e => e.passed).length;

  const avgScores = {
    overall: average(evaluations.map(e => e.overallScore)),
    queryUnderstanding: average(evaluations.map(e => e.layers.queryUnderstanding.score)),
    retrieval: average(evaluations.map(e => e.layers.retrieval.score)),
    ranking: average(evaluations.map(e => e.layers.ranking.score)),
    presentation: average(evaluations.map(e => e.layers.presentation.score)),
  };

  const allCriticalErrors = evaluations.flatMap(e => e.diagnosis.criticalErrors);
  const allFailures = evaluations.flatMap(e => e.diagnosis.whatFailed);

  const failuresByLayer = groupBy(allFailures, f => f.layer);
  const failuresBySeverity = groupBy(allFailures, f => f.severity);

  return {
    summary: {
      totalTests,
      passed,
      failed: totalTests - passed,
      passRate: (passed / totalTests * 100).toFixed(1) + '%',
    },

    avgScores,

    weakestLayer: Object.entries(avgScores)
      .filter(([k]) => k !== 'overall')
      .sort((a, b) => a[1] - b[1])[0]?.[0] ?? 'unknown',

    criticalErrors: {
      count: allCriticalErrors.length,
      list: allCriticalErrors,
    },

    failures: {
      byLayer: Object.entries(failuresByLayer).map(([layer, failures]) => ({
        layer,
        count: failures.length,
      })),
      bySeverity: Object.entries(failuresBySeverity).map(([severity, failures]) => ({
        severity,
        count: failures.length,
      })),
    },
  };
}

// Helper functions
function average(arr: number[]): number {
  return arr.reduce((sum, n) => sum + n, 0) / arr.length;
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, T[]>);
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
