/**
 * Automated Test Runner
 *
 * Orchestrates the full testing pipeline:
 * 1. Load saved inbox
 * 2. Generate queries (or load saved)
 * 3. Run chatbot on each query
 * 4. Evaluate each response
 * 5. Generate comprehensive report
 */

import * as fs from 'fs';
import * as path from 'path';
// NOTE: Install openai to use this: npm install openai
// import OpenAI from 'openai';
import { GeneratedInbox } from '../generators/hyper-realistic-inbox';
import { generateQueries, saveQueries, loadQueries, GeneratedQuery } from './query-generator';
import { evaluateChatbotResponse, aggregateEvaluations, ChatbotResponse, EvaluationReport } from './multi-layer-evaluator';

export interface TestRunConfig {
  inboxPath: string;
  queriesPath?: string; // If not provided, will generate
  commandsDocPath: string;
  outputDir: string;

  // Query generation (if not loading saved queries)
  generateQueryCount?: number;
  queryCategories?: string[];

  // Parallel execution settings
  parallelExecution?: boolean; // Enable parallel evaluation (default: false)
  batchSize?: number; // Number of queries to evaluate in parallel (default: 5)
  maxConcurrentRequests?: number; // Max API calls in flight (default: 10)

  // Your chatbot function
  chatbotFunction: (inbox: GeneratedInbox, query: string) => Promise<ChatbotResponse>;
}

export interface TestMetrics {
  totalTime: number; // milliseconds
  totalApiCalls: number;
  estimatedCost: number; // USD
  avgQueryTime: number;
  avgEvaluationTime: number;
  slowestQueries: Array<{ query: string; timeMs: number }>;
}

export interface TestRunResult {
  runId: string;
  timestamp: string;
  config: TestRunConfig;
  inbox: {
    path: string;
    persona: string;
    emailCount: number;
  };
  queries: {
    count: number;
    path: string;
  };
  evaluations: EvaluationReport[];
  aggregate: any;
  metrics: TestMetrics;
}

/**
 * Run full automated test suite
 */
export async function runAutomatedTests(config: TestRunConfig): Promise<TestRunResult> {
  const startTime = Date.now();
  console.log('\n🚀 Starting Automated Test Run\n');
  console.log('='.repeat(60));

  // Create OpenAI client (requires openai package)
  const OpenAI = require('openai').default;
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Metrics tracking
  let apiCalls = 0;
  const queryTimes: Array<{ query: string; timeMs: number }> = [];
  const evaluationTimes: number[] = [];

  // 1. Load inbox
  console.log('\n📧 Step 1: Loading inbox...');
  const inbox = loadInbox(config.inboxPath);
  console.log(`   ✅ Loaded ${inbox.emails.length} emails (${inbox.persona} persona)`);
  console.log(`   Stats: ${inbox.groundTruth.stats.urgentCount} urgent, ${inbox.groundTruth.stats.droppedBallCount} dropped balls`);

  // 2. Load or generate queries
  console.log('\n🔍 Step 2: Preparing queries...');
  let queries: GeneratedQuery[];

  if (config.queriesPath && fs.existsSync(config.queriesPath)) {
    console.log(`   Loading saved queries from ${config.queriesPath}`);
    queries = loadQueries(config.queriesPath);
    console.log(`   ✅ Loaded ${queries.length} queries`);
  } else {
    console.log('   Generating new queries with LLM...');
    queries = await generateQueries({
      commandsDocPath: config.commandsDocPath,
      inbox,
      queryCount: config.generateQueryCount || 3,
      includedCategories: config.queryCategories,
    }, openai);
    apiCalls++; // Query generation API call

    // Save generated queries
    const queriesPath = path.join(config.outputDir, 'generated-queries.json');
    saveQueries(queries, queriesPath);
    console.log(`   ✅ Generated ${queries.length} queries`);
  }

  // 3. Run chatbot on each query
  console.log('\n🤖 Step 3: Running chatbot...');
  const chatbotResponses: Array<{ query: GeneratedQuery; response: ChatbotResponse }> = [];

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    console.log(`   [${i + 1}/${queries.length}] "${query.query}"`);

    try {
      const queryStart = Date.now();
      const response = await config.chatbotFunction(inbox, query.query);
      const queryTime = Date.now() - queryStart;
      queryTimes.push({ query: query.query, timeMs: queryTime });

      chatbotResponses.push({ query, response });
      console.log(`      ✅ Returned ${response.emailIds?.length || 0} emails (${queryTime}ms)`);
    } catch (error) {
      console.log(`      ❌ Error: ${error}`);
      // Create error response
      chatbotResponses.push({
        query,
        response: {
          type: 'email_list',
          emailIds: [],
        },
      });
    }
  }

  // 4. Evaluate each response
  console.log('\n⚖️  Step 4: Evaluating responses...');
  const evaluations: EvaluationReport[] = [];

  // Determine execution mode
  const useParallel = config.parallelExecution ?? false;
  const batchSize = config.batchSize ?? 5;

  if (useParallel) {
    console.log(`   Running in PARALLEL mode (batch size: ${batchSize})`);

    // Create batches
    const batches = chunk(chatbotResponses, batchSize);
    let processedCount = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const batchNum = batchIndex + 1;
      const totalBatches = batches.length;

      console.log(`\n   Batch ${batchNum}/${totalBatches} (${batch.length} queries):`);

      // Process batch in parallel with rate limiting
      const batchResults = await Promise.all(
        batch.map(async ({ query, response }, index) => {
          const overallIndex = processedCount + index;

          try {
            const evalStart = Date.now();

            // Stagger requests within batch to respect rate limits
            await sleep(index * 200); // 200ms stagger between parallel requests

            const evaluation = await evaluateChatbotResponse(query, inbox, response, openai);
            const evalTime = Date.now() - evalStart;

            const status = evaluation.passed ? '✅' : '❌';
            console.log(`      [${overallIndex + 1}/${chatbotResponses.length}] ${status} "${query.query.substring(0, 50)}..." - ${evaluation.overallScore}/100 (${evalTime}ms)`);

            return {
              evaluation,
              evalTime,
              success: true,
            };
          } catch (error) {
            console.log(`      [${overallIndex + 1}/${chatbotResponses.length}] ❌ "${query.query.substring(0, 50)}..." - Error: ${error}`);
            return {
              evaluation: null,
              evalTime: 0,
              success: false,
            };
          }
        })
      );

      // Collect results
      for (const result of batchResults) {
        if (result.success && result.evaluation) {
          evaluations.push(result.evaluation);
          evaluationTimes.push(result.evalTime);
          apiCalls++;
        }
      }

      processedCount += batch.length;

      // Brief pause between batches to respect rate limits
      if (batchIndex < batches.length - 1) {
        await sleep(1000);
      }
    }
  } else {
    // Sequential execution (original behavior)
    console.log(`   Running in SEQUENTIAL mode`);
    const rateLimiter = new RateLimiter(1200); // 50 requests/min = 1.2s interval

    for (let i = 0; i < chatbotResponses.length; i++) {
      const { query, response } = chatbotResponses[i];
      console.log(`   [${i + 1}/${chatbotResponses.length}] Evaluating "${query.query}"`);

      try {
        await rateLimiter.throttle();
        const evalStart = Date.now();
        const evaluation = await evaluateChatbotResponse(query, inbox, response, openai);
        const evalTime = Date.now() - evalStart;
        evaluationTimes.push(evalTime);
        apiCalls++; // Evaluation API call

        evaluations.push(evaluation);

        const status = evaluation.passed ? '✅' : '❌';
        console.log(`      ${status} Score: ${evaluation.overallScore}/100 (${evalTime}ms)`);

        if (evaluation.diagnosis.criticalErrors.length > 0) {
          console.log(`      ⚠️  Critical: ${evaluation.diagnosis.criticalErrors[0]}`);
        }
      } catch (error) {
        console.log(`      ❌ Evaluation error: ${error}`);
      }
    }
  }

  // 5. Aggregate results
  console.log('\n📊 Step 5: Aggregating results...');
  const aggregate = aggregateEvaluations(evaluations);

  // 6. Calculate metrics
  const totalTime = Date.now() - startTime;
  const avgQueryTime = queryTimes.length > 0
    ? queryTimes.reduce((sum, q) => sum + q.timeMs, 0) / queryTimes.length
    : 0;
  const avgEvaluationTime = evaluationTimes.length > 0
    ? evaluationTimes.reduce((sum, t) => sum + t, 0) / evaluationTimes.length
    : 0;

  // Estimate cost: ~$2 per million input tokens, ~$8 per million output tokens (GPT-5 pricing)
  // Average request: ~2000 input tokens, ~500 output tokens
  const estimatedCost = apiCalls * ((2000 * 2 / 1000000) + (500 * 8 / 1000000));

  const slowestQueries = queryTimes
    .sort((a, b) => b.timeMs - a.timeMs)
    .slice(0, 5);

  const metrics: TestMetrics = {
    totalTime,
    totalApiCalls: apiCalls,
    estimatedCost,
    avgQueryTime,
    avgEvaluationTime,
    slowestQueries,
  };

  // 7. Save results
  const runId = `run-${Date.now()}`;
  const result: TestRunResult = {
    runId,
    timestamp: new Date().toISOString(),
    config,
    inbox: {
      path: config.inboxPath,
      persona: inbox.persona,
      emailCount: inbox.emails.length,
    },
    queries: {
      count: queries.length,
      path: config.queriesPath || path.join(config.outputDir, 'generated-queries.json'),
    },
    evaluations,
    aggregate,
    metrics,
  };

  const resultPath = path.join(config.outputDir, `${runId}.json`);
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
  console.log(`   ✅ Saved results to ${resultPath}`);

  // 7. Print summary
  printSummary(result);

  return result;
}

/**
 * Load inbox from saved file
 */
function loadInbox(inboxPath: string): GeneratedInbox {
  const data = JSON.parse(fs.readFileSync(inboxPath, 'utf-8'));

  // Reconstruct Map objects from JSON
  const emailLabels = new Map(Object.entries(data.groundTruth.emailLabels));
  const threadMetadata = new Map(Object.entries(data.groundTruth.threadMetadata || {}));
  const senderProfiles = new Map(Object.entries(data.groundTruth.senderProfiles));

  return {
    ...data,
    groundTruth: {
      ...data.groundTruth,
      emailLabels,
      threadMetadata,
      senderProfiles,
    },
    // Reconstruct dates
    emails: data.emails.map((e: any) => ({
      ...e,
      sentDate: new Date(e.sentDate),
      label: {
        ...e.label,
        sentTimestamp: new Date(e.label.sentTimestamp),
        deadlineDate: e.label.deadlineDate ? new Date(e.label.deadlineDate) : undefined,
        commitmentDeadline: e.label.commitmentDeadline ? new Date(e.label.commitmentDeadline) : undefined,
      },
    })),
    currentDate: new Date(data.currentDate),
  };
}

/**
 * Print test summary
 */
function printSummary(result: TestRunResult): void {
  console.log('\n' + '='.repeat(60));
  console.log('\n📈 Test Run Summary\n');

  const { aggregate } = result;

  console.log(`Total Tests: ${aggregate.summary.totalTests}`);
  console.log(`Passed: ${aggregate.summary.passed} (${aggregate.summary.passRate})`);
  console.log(`Failed: ${aggregate.summary.failed}`);

  console.log('\n📊 Average Scores by Layer:');
  console.log(`   Overall: ${aggregate.avgScores.overall.toFixed(1)}/100`);
  console.log(`   Query Understanding: ${aggregate.avgScores.queryUnderstanding.toFixed(1)}/100`);
  console.log(`   Retrieval: ${aggregate.avgScores.retrieval.toFixed(1)}/100`);
  console.log(`   Ranking: ${aggregate.avgScores.ranking.toFixed(1)}/100`);
  console.log(`   Presentation: ${aggregate.avgScores.presentation.toFixed(1)}/100`);

  console.log(`\n⚠️  Weakest Layer: ${aggregate.weakestLayer}`);

  if (aggregate.criticalErrors.count > 0) {
    console.log(`\n🚨 Critical Errors: ${aggregate.criticalErrors.count}`);
    aggregate.criticalErrors.list.slice(0, 3).forEach((err: string) => {
      console.log(`   - ${err}`);
    });
  }

  if (aggregate.failures.byLayer.length > 0) {
    console.log('\n❌ Failures by Layer:');
    aggregate.failures.byLayer.forEach((f: any) => {
      console.log(`   ${f.layer}: ${f.count} issues`);
    });
  }

  // Print metrics
  console.log('\n⏱️  Performance Metrics:');
  console.log(`   Total Time: ${(result.metrics.totalTime / 1000).toFixed(1)}s`);
  console.log(`   Total API Calls: ${result.metrics.totalApiCalls}`);
  console.log(`   Estimated Cost: $${result.metrics.estimatedCost.toFixed(4)}`);
  console.log(`   Avg Query Time: ${result.metrics.avgQueryTime.toFixed(0)}ms`);
  console.log(`   Avg Evaluation Time: ${result.metrics.avgEvaluationTime.toFixed(0)}ms`);

  if (result.metrics.slowestQueries.length > 0) {
    console.log('\n🐌 Slowest Queries:');
    result.metrics.slowestQueries.forEach((q, i) => {
      console.log(`   ${i + 1}. ${q.timeMs}ms - "${q.query.substring(0, 60)}${q.query.length > 60 ? '...' : ''}"`);
    });
  }

  console.log('\n' + '='.repeat(60));
}

/**
 * Helper: sleep for ms
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Helper: chunk array into batches
 */
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Rate Limiter class for API throttling
 */
class RateLimiter {
  private lastCall: number = 0;
  private minInterval: number;

  constructor(minIntervalMs: number) {
    this.minInterval = minIntervalMs;
  }

  async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCall;

    if (elapsed < this.minInterval) {
      const waitTime = this.minInterval - elapsed;
      await sleep(waitTime);
    }

    this.lastCall = Date.now();
  }
}

/**
 * Regression Report Interface
 */
export interface RegressionReport {
  improved: Array<{ query: string; scoreDelta: number }>;
  regressed: Array<{ query: string; scoreDelta: number }>;
  newFailures: string[];
  fixedFailures: string[];
  avgScoreDelta: number;
}

/**
 * Compare current test run to baseline for regression detection
 */
export function compareToBaseline(
  current: TestRunResult,
  baseline: TestRunResult
): RegressionReport {
  const report: RegressionReport = {
    improved: [],
    regressed: [],
    newFailures: [],
    fixedFailures: [],
    avgScoreDelta: 0,
  };

  let totalScoreDelta = 0;
  let comparedCount = 0;

  for (const currentEval of current.evaluations) {
    const baselineEval = baseline.evaluations.find(
      e => e.query === currentEval.query
    );

    if (!baselineEval) continue;

    const scoreDelta = currentEval.overallScore - baselineEval.overallScore;
    totalScoreDelta += scoreDelta;
    comparedCount++;

    // Track improvements and regressions
    if (scoreDelta > 5) {
      report.improved.push({ query: currentEval.query, scoreDelta });
    } else if (scoreDelta < -5) {
      report.regressed.push({ query: currentEval.query, scoreDelta });
    }

    // Track new failures and fixes
    if (!baselineEval.passed && currentEval.passed) {
      report.fixedFailures.push(currentEval.query);
    } else if (baselineEval.passed && !currentEval.passed) {
      report.newFailures.push(currentEval.query);
    }
  }

  report.avgScoreDelta = comparedCount > 0 ? totalScoreDelta / comparedCount : 0;

  return report;
}

/**
 * Load baseline test result from file
 */
export function loadBaseline(baselinePath: string): TestRunResult | null {
  if (!fs.existsSync(baselinePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
}

/**
 * Print regression report
 */
export function printRegressionReport(report: RegressionReport): void {
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Regression Analysis\n');

  console.log(`Average Score Delta: ${report.avgScoreDelta >= 0 ? '+' : ''}${report.avgScoreDelta.toFixed(1)}`);

  if (report.improved.length > 0) {
    console.log(`\n✅ Improvements: ${report.improved.length}`);
    report.improved.slice(0, 5).forEach(({ query, scoreDelta }) => {
      console.log(`   +${scoreDelta.toFixed(1)}: ${query}`);
    });
  }

  if (report.regressed.length > 0) {
    console.log(`\n❌ Regressions: ${report.regressed.length}`);
    report.regressed.slice(0, 5).forEach(({ query, scoreDelta }) => {
      console.log(`   ${scoreDelta.toFixed(1)}: ${query}`);
    });
  }

  if (report.fixedFailures.length > 0) {
    console.log(`\n🎉 Fixed Failures: ${report.fixedFailures.length}`);
    report.fixedFailures.slice(0, 3).forEach(query => {
      console.log(`   - ${query}`);
    });
  }

  if (report.newFailures.length > 0) {
    console.log(`\n🚨 New Failures: ${report.newFailures.length}`);
    report.newFailures.slice(0, 3).forEach(query => {
      console.log(`   - ${query}`);
    });
  }

  console.log('\n' + '='.repeat(60));
}
