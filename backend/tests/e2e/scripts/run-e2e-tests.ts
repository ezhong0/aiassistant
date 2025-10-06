#!/usr/bin/env ts-node
/**
 * E2E Test Runner Script
 *
 * Runs automated e2e tests using the multi-layer evaluation system
 *
 * Usage:
 *   npm run e2e:test [options]
 *
 * Options:
 *   --count=N           Generate N queries per category (default: 5)
 *   --categories=A,B    Only test specific categories
 *   --use-cached        Reuse queries from last run (saves $0.01)
 *   --mock              Use mock orchestrator (FREE, but doesn't test real code)
 *   --help              Show this help
 *
 * Cost Optimization Examples:
 *   npm run e2e:test --use-cached                       # ~$0.02/run (reuse queries)
 *   npm run e2e:test --count=1 --use-cached            # ~$0.02/run (minimal testing)
 *   npm run e2e:test --categories=inbox_triage         # ~$0.01/run (single category)
 *   npm run e2e:test --mock                            # FREE (mock mode)
 *
 * Full Quality Examples:
 *   npm run e2e:test                                    # ~$0.03/run (fresh queries, all categories)
 *   npm run e2e:test --count=3                         # ~$0.10/run (more queries per category)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { runAutomatedTests } from '../evaluation-v2/test-runner';
import { createMockedOrchestratorChatbotFunction, createRealOrchestratorChatbotFunction } from '../integration/orchestrator-adapter';
import { GeneratedInbox } from '../generators/hyper-realistic-inbox';

// Load environment variables from project root
const envPath = '/Users/edwardzhong/Projects/assistantapp/.env';
dotenv.config({ path: envPath });

// IMPORTANT: Force strict execution mode for E2E tests
// This ensures E2E tests fail-fast and validate perfect execution
// rather than masking issues with fallback strategies
process.env.EXECUTION_MODE = 'strict';

// Verify API key is loaded
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not found in environment');
  console.error(`   Checked: ${envPath}`);
  process.exit(1);
}

// Determine which orchestrator to use (REAL by default, --mock to use mocked)
const USE_REAL_ORCHESTRATOR = !process.argv.includes('--mock');

async function main() {
  const args = process.argv.slice(2);

  // Show help
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
E2E Test Runner - Ultra Low Cost with GPT-5-nano

Usage: npm run e2e:test [options]

Options:
  --count=N           Generate N queries per category (default: 5)
  --categories=A,B    Only test specific categories (comma-separated)
  --use-cached        Reuse queries from last run (saves $0.001)
  --mock              Use mock orchestrator (FREE, doesn't test real code)
  --help, -h          Show this help

Cost Breakdown (GPT-5-nano @ $0.05/1M input, $0.40/1M output):
  Query Generation:  ~$0.001 (1 LLM call, GPT-5-mini low)
  Evaluation:        ~$0.014 (32 queries × GPT-5-nano minimal)
  Total per run:     ~$0.015

Cost Optimization:
  1. Reuse cached queries:        --use-cached           (~$0.014/run, 7% savings)
  2. Test one category:           --categories=inbox_triage (~$0.002/run, 87% savings)
  3. Mock mode (dev only):        --mock                 (FREE, 100% savings)

Examples:
  npm run e2e:test                              # Full test (~$0.015)
  npm run e2e:test --use-cached                 # Reuse queries (~$0.014)
  npm run e2e:test --categories=inbox_triage    # Single category (~$0.002)
  npm run e2e:test --mock                       # Mock mode (FREE)
  npm run e2e:test --count=3                    # More queries (~$0.05)

Daily Development Workflow:
  1. Morning: npm run e2e:test                  # Fresh baseline ($0.015)
  2. Iterations: npm run e2e:test --use-cached  # Fast feedback ($0.014 × 10 = $0.14)
  3. Total daily cost: ~$0.15 (extremely cheap!)
    `);
    process.exit(0);
  }

  // Parse arguments
  let inboxFile = 'inbox-01-founder.json';
  let queriesPath: string | undefined;
  let categories: string[] | undefined;
  let queryCount = 5;
  let useCachedQueries = false;

  for (const arg of args) {
    if (arg.startsWith('--queries=')) {
      queriesPath = arg.split('=')[1];
    } else if (arg.startsWith('--categories=')) {
      const value = arg.split('=')[1];
      if (value) {
        categories = value.split(',');
      }
    } else if (arg.startsWith('--count=')) {
      const value = arg.split('=')[1];
      if (value) {
        queryCount = parseInt(value);
      }
    } else if (arg === '--use-cached' || arg === '--cached') {
      useCachedQueries = true;
    } else if (!arg.startsWith('--')) {
      inboxFile = arg;
    }
  }

  // If using cached queries, find the most recent query file
  if (useCachedQueries && !queriesPath) {
    const fs = require('fs');
    const outputDir = path.join(__dirname, '../data/test-results');

    // Find most recent test result file (contains generated queries)
    const files = fs.readdirSync(outputDir)
      .filter((f: string) => f.startsWith('run-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length > 0) {
      const latestFile = path.join(outputDir, files[0]);
      const testData = JSON.parse(fs.readFileSync(latestFile, 'utf-8'));

      // Extract queries from previous run
      if (testData.queries && testData.queries.path) {
        queriesPath = testData.queries.path;
        console.log(`📦 Using cached queries from: ${files[0]}`);
        console.log(`   (Saves ~$0.01 on query generation)`);
      }
    }

    if (!queriesPath) {
      console.log('⚠️  No cached queries found, will generate fresh ones');
      useCachedQueries = false;
    }
  }

  const inboxPath = path.join(__dirname, '../data/generated-inboxes', inboxFile);
  const commandsDocPath = path.join(__dirname, '../../../docs/api/commands.md');
  const outputDir = path.join(__dirname, '../data/test-results');

  console.log('🚀 Starting E2E Test Run');
  console.log('');
  console.log('Configuration:');
  console.log(`  Inbox: ${inboxFile}`);
  console.log(`  Commands Doc: docs/api/commands.md`);
  console.log(`  Queries: ${queriesPath || 'Will generate ' + queryCount + ' per category'}`);
  if (categories) {
    console.log(`  Categories: ${categories.join(', ')}`);
  }
  console.log('');
  console.log('💰 Cost Optimization:');
  console.log(`  Model: GPT-5-nano (minimal reasoning - extremely cheap!)`);
  console.log(`  Estimated cost: ~$${useCachedQueries ? '0.014' : '0.015'}/run`);
  console.log(`  Pricing: $0.05/1M input, $0.40/1M output tokens`);
  console.log(`  Tip: Use --use-cached to reuse queries and save even more!`);
  console.log('');

  try {
    // Load inbox to create chatbot function
    const fs = require('fs');
    const inboxData: GeneratedInbox = JSON.parse(fs.readFileSync(inboxPath, 'utf-8'));

    // Reconstruct Map objects
    inboxData.groundTruth.emailLabels = new Map(Object.entries(inboxData.groundTruth.emailLabels));
    inboxData.groundTruth.threadMetadata = new Map(Object.entries(inboxData.groundTruth.threadMetadata || {}));
    inboxData.groundTruth.senderProfiles = new Map(Object.entries(inboxData.groundTruth.senderProfiles));

    // Create chatbot function - use REAL orchestrator if flag is set
    const chatbotFunction = USE_REAL_ORCHESTRATOR
      ? createRealOrchestratorChatbotFunction(inboxData)
      : createMockedOrchestratorChatbotFunction(inboxData);

    console.log(`🤖 Using ${USE_REAL_ORCHESTRATOR ? 'REAL 3-layer' : 'MOCKED'} orchestrator`);
    if (USE_REAL_ORCHESTRATOR) {
      console.log('   ✅ Testing your actual QueryDecomposer → ExecutionCoordinator → Synthesis');
      console.log('   💡 Use --mock flag to test with simplified mock instead');
    } else {
      console.log('   ⚠️  Using simplified mock (not testing real code)');
    }
    console.log('');

    // Run automated tests
    const result = await runAutomatedTests({
      inboxPath,
      queriesPath,
      commandsDocPath,
      outputDir,
      generateQueryCount: queryCount,
      queryCategories: categories,
      parallelExecution: true, // Use parallel execution for speed
      batchSize: 5,
      chatbotFunction,
    });

    // Print summary
    console.log('');
    console.log('✅ Test run complete!');
    console.log('');
    console.log(`📊 Results saved to:`);
    console.log(`   JSON: ${outputDir}/${result.runId}.json`);
    console.log(`   HTML: ${outputDir}/${result.runId}.html`);
    console.log('');
    console.log(`📈 Summary:`);
    console.log(`   Pass Rate: ${result.aggregate.summary.passRate}`);
    console.log(`   Overall Score: ${result.aggregate.avgScores.overall.toFixed(1)}/100`);
    console.log(`   Weakest Layer: ${result.aggregate.weakestLayer} (${result.aggregate.avgScores[result.aggregate.weakestLayer].toFixed(1)}/100)`);
    console.log(`   Critical Errors: ${result.aggregate.criticalErrors.count}`);
    console.log('');

    if (result.aggregate.criticalErrors.count > 0) {
      console.log('🚨 Critical errors found:');
      result.aggregate.criticalErrors.list.slice(0, 3).forEach((err: string, i: number) => {
        console.log(`   ${i + 1}. ${err}`);
      });
      console.log('');
    }

    console.log(`💡 Open HTML report to see detailed analysis:`);
    console.log(`   open ${outputDir}/${result.runId}.html`);
    console.log('');

    process.exit(result.aggregate.criticalErrors.count > 0 ? 1 : 0);

  } catch (error: any) {
    console.error('❌ Error running e2e tests:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
