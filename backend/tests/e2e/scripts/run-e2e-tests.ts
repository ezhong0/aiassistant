#!/usr/bin/env ts-node
/**
 * E2E Test Runner Script
 *
 * Runs automated e2e tests using the multi-layer evaluation system
 *
 * Usage:
 *   npm run e2e:test [inbox-file] [--queries=<path>] [--categories=<cat1,cat2>] [--count=<n>]
 *
 * Examples:
 *   npm run e2e:test                                    # Use default inbox
 *   npm run e2e:test inbox-01-founder.json              # Specific inbox
 *   npm run e2e:test --categories="INBOX TRIAGE,SEARCH" # Specific categories
 *   npm run e2e:test --count=10                         # Generate 10 queries per category
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

  // Parse arguments
  let inboxFile = 'inbox-01-founder.json';
  let queriesPath: string | undefined;
  let categories: string[] | undefined;
  let queryCount = 5;

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
    } else if (!arg.startsWith('--')) {
      inboxFile = arg;
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
