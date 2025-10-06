/**
 * Complete Example: Multi-LLM Automated Testing
 *
 * This demonstrates the full workflow:
 * 1. Generate inbox (one-time)
 * 2. Run automated test suite
 * 3. Get comprehensive diagnostic report
 */

import * as path from 'path';
import { runAutomatedTests } from './test-runner';
import { GeneratedInbox } from '../generators/hyper-realistic-inbox';
import { ChatbotResponse } from './multi-layer-evaluator';

/**
 * EXAMPLE: Improved chatbot function demonstrating best practices
 *
 * Replace this with your actual chatbot implementation
 */
async function yourChatbotFunction(
  inbox: GeneratedInbox,
  query: string
): Promise<ChatbotResponse> {
  console.log(`      [Mock Chatbot] Processing: "${query}"`);

  const queryLower = query.toLowerCase();

  // Parse intent with multi-criteria support
  const intent = parseIntent(queryLower);

  // Filter emails based on parsed intent
  let filteredEmails = inbox.emails.filter(email => {
    const label = email.label;

    // Apply all filters
    for (const filter of intent.filters) {
      if (filter === 'urgent' && !label.isUrgent) return false;
      if (filter === 'important' && !label.isImportant) return false;
      if (filter === 'dropped_ball' && !label.isDroppedBall) return false;
      if (filter === 'unanswered' && !label.userNeedsToRespond) return false;
      if (filter === 'follow_up' && !label.isFollowUp) return false;
      if (filter === 'escalated' && !label.isEscalated) return false;
      if (filter === 'boss' && label.senderType !== 'boss') return false;
      if (filter === 'customer' && label.senderType !== 'customer') return false;
      if (filter === 'commitment_overdue' && label.commitmentStatus !== 'overdue') return false;
    }

    return true;
  });

  // Rank by importance
  const rankedEmails = rankEmails(filteredEmails);

  // Build presentation
  const presentation = buildPresentation(rankedEmails, intent);

  return {
    type: 'email_list',
    emailIds: rankedEmails.map(e => e.id),
    ranking: rankedEmails.map((e, i) => ({
      emailId: e.id,
      score: calculateEmailScore(e),
    })),
    presentation,

    // Expose internal state for evaluation
    internalState: {
      parsedIntent: intent,
      filtersApplied: intent.filters,
      resultsBeforeRanking: filteredEmails.length,
      processingTime: 150,
    },
  };
}

/**
 * Parse query intent (demonstrates multi-criteria detection)
 */
function parseIntent(query: string): { action: string; filters: string[] } {
  const filters: string[] = [];

  // Detect filters
  if (query.includes('urgent')) filters.push('urgent');
  if (query.includes('important')) filters.push('important');
  if (query.includes('dropped') || query.includes('ball')) filters.push('dropped_ball');
  if (query.includes('unanswered') || query.includes("haven't responded") || query.includes("need to respond")) {
    filters.push('unanswered');
  }
  if (query.includes('follow') || query.includes('reminder')) filters.push('follow_up');
  if (query.includes('escalat')) filters.push('escalated');
  if (query.includes('boss') || query.includes('manager')) filters.push('boss');
  if (query.includes('customer') || query.includes('client')) filters.push('customer');
  if (query.includes('overdue') && query.includes('commitment')) filters.push('commitment_overdue');

  return {
    action: 'filter_emails',
    filters,
  };
}

/**
 * Rank emails by importance (demonstrates scoring logic)
 */
function rankEmails(emails: any[]): any[] {
  return emails.sort((a, b) => {
    const scoreA = calculateEmailScore(a);
    const scoreB = calculateEmailScore(b);
    return scoreB - scoreA;
  });
}

/**
 * Calculate importance score for an email
 */
function calculateEmailScore(email: any): number {
  let score = 0;
  const label = email.label;

  // Critical issues
  if (label.isEscalated) score += 100;
  if (label.isDroppedBall && label.senderType === 'customer') score += 90;
  if (label.commitmentStatus === 'overdue') score += 85;

  // High priority
  if (label.isUrgent) score += 50;
  if (label.senderType === 'boss') score += 40;
  if (label.isVIP) score += 35;

  // Medium priority
  if (label.isImportant) score += 25;
  if (label.userNeedsToRespond) score += 20;
  if (label.isFollowUp) score += 15;

  // Recency bonus (emails from last 3 days)
  const daysAgo = (Date.now() - new Date(label.sentTimestamp).getTime()) / (1000 * 60 * 60 * 24);
  if (daysAgo < 3) score += 10;

  return score;
}

/**
 * Build helpful presentation text
 */
function buildPresentation(emails: any[], intent: any): string {
  if (emails.length === 0) {
    return `No emails found matching: ${intent.filters.join(', ')}`;
  }

  const categories: Record<string, number> = {};

  emails.forEach(email => {
    const label = email.label;
    if (label.isEscalated) categories['escalated'] = (categories['escalated'] || 0) + 1;
    if (label.isDroppedBall) categories['dropped balls'] = (categories['dropped balls'] || 0) + 1;
    if (label.isUrgent) categories['urgent'] = (categories['urgent'] || 0) + 1;
    if (label.senderType === 'boss') categories['from manager'] = (categories['from manager'] || 0) + 1;
    if (label.senderType === 'customer') categories['from customers'] = (categories['from customers'] || 0) + 1;
  });

  const summary = Object.entries(categories)
    .map(([cat, count]) => `${count} ${cat}`)
    .join(', ');

  return `Found ${emails.length} emails: ${summary}`;
}

/**
 * Example 1: Run test on single inbox
 */
async function runSingleInboxTest() {
  console.log('\n📧 Example 1: Testing Single Inbox\n');

  const result = await runAutomatedTests({
    // Path to saved inbox (generate first with: npm run e2e:generate-inbox founder)
    inboxPath: path.join(__dirname, '../data/generated-inboxes/inbox-01-founder.json'),

    // Path to CHATBOT_COMMANDS_EXAMPLES.md
    commandsDocPath: path.join(__dirname, '../../../docs/CHATBOT_COMMANDS_EXAMPLES.md'),

    // Output directory for results
    outputDir: path.join(__dirname, '../data/test-results'),

    // Query generation config
    generateQueryCount: 5, // Generate 5 queries per category
    queryCategories: [
      'INBOX TRIAGE',
      'DROPPED BALL DETECTION',
      'COMMITMENT TRACKING',
      'SEARCH & RETRIEVAL',
    ],

    // Parallel execution (optional - speeds up tests 5-10x)
    parallelExecution: false, // Set to true for parallel mode
    batchSize: 5, // Number of queries to evaluate in parallel

    // Your chatbot function
    chatbotFunction: yourChatbotFunction,
  });

  console.log(`\n✅ Test complete! Results saved to ${result.runId}.json`);
  console.log(`\nKey findings:`);
  console.log(`- Pass rate: ${result.aggregate.summary.passRate}`);
  console.log(`- Weakest layer: ${result.aggregate.weakestLayer}`);
  console.log(`- Critical errors: ${result.aggregate.criticalErrors.count}`);

  return result;
}

/**
 * Example 2: Run tests on multiple inboxes
 */
async function runMultipleInboxTests() {
  console.log('\n📧 Example 2: Testing Multiple Inboxes\n');

  const inboxes = [
    'inbox-01-founder.json',
    'inbox-02-executive.json',
    'inbox-03-manager.json',
  ];

  const results = [];

  for (const inboxFile of inboxes) {
    console.log(`\n\nTesting ${inboxFile}...`);

    const result = await runAutomatedTests({
      inboxPath: path.join(__dirname, '../data/generated-inboxes', inboxFile),
      commandsDocPath: path.join(__dirname, '../../../docs/CHATBOT_COMMANDS_EXAMPLES.md'),
      outputDir: path.join(__dirname, '../data/test-results'),
      generateQueryCount: 3,
      chatbotFunction: yourChatbotFunction,
    });

    results.push(result);
  }

  // Compare results across inboxes
  console.log('\n📊 Comparison Across Inboxes:\n');
  results.forEach(r => {
    console.log(`${r.inbox.persona}:`);
    console.log(`  Pass rate: ${r.aggregate.summary.passRate}`);
    console.log(`  Avg score: ${r.aggregate.avgScores.overall.toFixed(1)}/100`);
    console.log(`  Critical errors: ${r.aggregate.criticalErrors.count}`);
  });

  return results;
}

/**
 * Example 3: Use saved queries (for regression testing)
 */
async function runRegressionTest() {
  console.log('\n📧 Example 3: Regression Testing with Saved Queries\n');

  const result = await runAutomatedTests({
    inboxPath: path.join(__dirname, '../data/generated-inboxes/inbox-01-founder.json'),
    queriesPath: path.join(__dirname, '../data/test-results/generated-queries.json'), // Reuse queries
    commandsDocPath: path.join(__dirname, '../../../docs/CHATBOT_COMMANDS_EXAMPLES.md'),
    outputDir: path.join(__dirname, '../data/test-results'),
    chatbotFunction: yourChatbotFunction,
  });

  console.log('\n✅ Regression test complete!');
  console.log(`Compare this to your baseline to detect regressions.`);

  return result;
}

/**
 * Example 4: Fast parallel execution (for large test suites)
 */
async function runParallelTest() {
  console.log('\n📧 Example 4: Parallel Execution (Fast Mode)\n');

  const result = await runAutomatedTests({
    inboxPath: path.join(__dirname, '../data/generated-inboxes/inbox-01-founder.json'),
    commandsDocPath: path.join(__dirname, '../../../docs/CHATBOT_COMMANDS_EXAMPLES.md'),
    outputDir: path.join(__dirname, '../data/test-results'),
    generateQueryCount: 10, // Generate more queries for this example

    // Enable parallel execution for speed
    parallelExecution: true,
    batchSize: 5, // Process 5 evaluations simultaneously

    chatbotFunction: yourChatbotFunction,
  });

  console.log('\n✅ Parallel test complete!');
  console.log(`\nPerformance:`);
  console.log(`- Total time: ${(result.metrics.totalTime / 1000).toFixed(1)}s`);
  console.log(`- Queries tested: ${result.queries.count}`);
  console.log(`- Speed: ${(result.queries.count / (result.metrics.totalTime / 1000)).toFixed(1)} queries/sec`);

  return result;
}

/**
 * Example 5: Analyze a specific failure
 */
function analyzeSingleFailure(result: any, queryId: string) {
  const evaluation = result.evaluations.find((e: any) => e.testId === queryId);

  if (!evaluation) {
    console.log(`Query ${queryId} not found`);
    return;
  }

  console.log(`\n🔍 Deep Dive: ${evaluation.query}\n`);
  console.log(`Overall Score: ${evaluation.overallScore}/100 (${evaluation.passed ? 'PASS' : 'FAIL'})`);

  console.log('\n📊 Layer Breakdown:');
  Object.entries(evaluation.layers).forEach(([layer, score]: [string, any]) => {
    console.log(`\n${layer}: ${score.score}/100`);
    console.log(`  ${score.details}`);

    if (score.issues.length > 0) {
      console.log(`  Issues:`);
      score.issues.forEach((issue: string) => console.log(`    - ${issue}`));
    }

    if (score.strengths.length > 0) {
      console.log(`  Strengths:`);
      score.strengths.forEach((strength: string) => console.log(`    - ${strength}`));
    }
  });

  console.log('\n🔧 Recommendations:');
  evaluation.recommendations.forEach((rec: any) => {
    console.log(`  [${rec.priority.toUpperCase()}] ${rec.recommendation}`);
  });

  console.log('\n❌ What Failed:');
  evaluation.diagnosis.whatFailed.forEach((failure: any) => {
    console.log(`\n  ${failure.layer} - ${failure.severity.toUpperCase()}`);
    console.log(`  Issue: ${failure.issue}`);
    console.log(`  Impact: ${failure.impact}`);
    console.log(`  Fix: ${failure.suggestedFix}`);
  });
}

// Run examples
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args[0] === 'single') {
    runSingleInboxTest().catch(console.error);
  } else if (args[0] === 'multiple') {
    runMultipleInboxTests().catch(console.error);
  } else if (args[0] === 'regression') {
    runRegressionTest().catch(console.error);
  } else if (args[0] === 'parallel') {
    runParallelTest().catch(console.error);
  } else {
    console.log(`
Usage:
  ts-node example.ts single      - Test single inbox (sequential)
  ts-node example.ts multiple    - Test multiple inboxes
  ts-node example.ts regression  - Run regression test with saved queries
  ts-node example.ts parallel    - Test with parallel execution (5-10x faster)

First, generate test inboxes:
  npm run e2e:generate-inbox founder
  npm run e2e:generate-inbox executive
  npm run e2e:generate-inbox manager
    `);
  }
}

export {
  runSingleInboxTest,
  runMultipleInboxTests,
  runRegressionTest,
  runParallelTest,
  analyzeSingleFailure,
};
