/**
 * Test Command Script
 *
 * Test a specific command on a saved inbox
 *
 * Usage:
 *   npx ts-node tests/e2e/scripts/test-command.ts [inboxFile] [command]
 *
 * Examples:
 *   npx ts-node tests/e2e/scripts/test-command.ts tests/e2e/data/generated-inboxes/inbox-executive-123.json "Show me urgent emails"
 *   npx ts-node tests/e2e/scripts/test-command.ts inbox-executive-123.json "Find emails about Q4 planning"
 */

import * as fs from 'fs';
import * as path from 'path';
import { GenericAIService } from '../../../src/services/generic-ai.service';
import { AIDomainService } from '../../../src/services/domain/ai-domain.service';
import { InboxData } from '../generators/whole-inbox-generator';
import { UnifiedMockManager } from '../mocks/unified-mock-manager';
import { OrchestratorService } from '../../../src/layers/orchestrator.service';
import { QueryDecomposerService } from '../../../src/layers/layer1-decomposition/query-decomposer.service';
import { ExecutionCoordinatorService } from '../../../src/layers/layer2-execution/execution-coordinator.service';
import { SynthesisService } from '../../../src/layers/layer3-synthesis/synthesis.service';
import { getAPIClient } from '../../../src/services/api';
import { GoogleAPIClient } from '../../../src/services/api/clients/google-api-client';
import { E2EHTMLReporter } from '../reporters/html-reporter';

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: npx ts-node tests/e2e/scripts/test-command.ts [inboxFile] [command]');
    console.error('');
    console.error('Examples:');
    console.error('  npx ts-node tests/e2e/scripts/test-command.ts inbox-executive-123.json "Show me urgent emails"');
    console.error('  npx ts-node tests/e2e/scripts/test-command.ts tests/e2e/data/generated-inboxes/inbox.json "Find meetings"');
    process.exit(1);
  }

  let inboxFilePath = args[0];
  const command = args[1];

  // Resolve inbox file path
  if (!path.isAbsolute(inboxFilePath)) {
    // Try relative to current directory
    if (fs.existsSync(inboxFilePath)) {
      inboxFilePath = path.resolve(inboxFilePath);
    } else {
      // Try in generated-inboxes directory
      const generatedPath = path.join(__dirname, '../data/generated-inboxes', inboxFilePath);
      if (fs.existsSync(generatedPath)) {
        inboxFilePath = generatedPath;
      } else {
        console.error(`❌ Inbox file not found: ${inboxFilePath}`);
        console.error('');
        console.error('Available inboxes:');
        const inboxDir = path.join(__dirname, '../data/generated-inboxes');
        if (fs.existsSync(inboxDir)) {
          const files = fs.readdirSync(inboxDir).filter(f => f.endsWith('.json'));
          files.forEach(f => console.error(`  - ${f}`));
        }
        process.exit(1);
      }
    }
  }

  console.log('🧪 Testing Command on Inbox');
  console.log('');
  console.log(`📁 Inbox: ${path.basename(inboxFilePath)}`);
  console.log(`💬 Command: "${command}"`);
  console.log('');

  try {
    // Load inbox data
    console.log('📂 Loading inbox...');
    const inboxDataRaw = fs.readFileSync(inboxFilePath, 'utf-8');
    const inboxData: InboxData = JSON.parse(inboxDataRaw);

    console.log(`   ✓ Loaded ${inboxData.emails.length} emails`);
    console.log(`   ✓ Role: ${inboxData.metadata.userProfile.role}`);
    console.log('');

    // Initialize services
    console.log('⚙️  Initializing services...');
    const aiDomainService = new AIDomainService();
    await aiDomainService.initialize();

    const aiService = new GenericAIService(aiDomainService);
    await aiService.initialize();

    const mockManager = UnifiedMockManager.getInstance();
    await mockManager.initialize();

    const googleClient = await getAPIClient<GoogleAPIClient>('google');
    googleClient.setMockManager(mockManager);

    const queryDecomposer = new QueryDecomposerService(aiDomainService);
    await queryDecomposer.initialize();

    const executionCoordinator = new ExecutionCoordinatorService(aiDomainService);
    await executionCoordinator.initialize();

    const synthesisService = new SynthesisService(aiDomainService);
    await synthesisService.initialize();

    const orchestrator = new OrchestratorService(
      queryDecomposer,
      executionCoordinator,
      synthesisService
    );
    await orchestrator.initialize();

    console.log('   ✓ Services initialized');
    console.log('');

    // Setup mock context
    console.log('🔧 Setting up mock context...');
    await mockManager.setupMockContext(inboxData, inboxData.metadata.userProfile);
    mockManager.clearApiCallRecords();
    console.log('   ✓ Mock context ready');
    console.log('');

    // Execute command
    console.log('🚀 Executing command...');
    const startTime = Date.now();

    const result = await orchestrator.processUserInput(
      command,
      'test-user-id',
      [],
      undefined
    );

    const executionTime = Date.now() - startTime;
    const apiCalls = mockManager.getApiCallRecords();

    console.log('   ✓ Command executed');
    console.log('');

    // Print results
    console.log('📊 Results:');
    console.log('');
    console.log('┌─────────────────────────────────────────────────────────────────');
    console.log('│ RESPONSE');
    console.log('├─────────────────────────────────────────────────────────────────');
    console.log(result.message.split('\n').map(line => `│ ${line}`).join('\n'));
    console.log('└─────────────────────────────────────────────────────────────────');
    console.log('');

    // Print metrics
    console.log('📈 Metrics:');
    console.log(`   Execution Time: ${executionTime}ms`);
    console.log(`   Success: ${result.success ? '✅' : '❌'}`);
    console.log(`   Tokens Used: ${result.metadata?.tokensUsed || 0}`);
    console.log(`   API Calls: ${apiCalls.length}`);
    console.log('');

    // Print API calls
    if (apiCalls.length > 0) {
      console.log('🔗 API Calls Made:');
      apiCalls.forEach((call, index) => {
        console.log(`   ${index + 1}. ${call.clientName}: ${call.request.method} ${call.request.endpoint}`);
        console.log(`      Duration: ${call.duration}ms`);
        console.log(`      Mock Source: ${call.response.metadata?.mockSource || 'unknown'}`);
      });
      console.log('');
    }

    // Print layer breakdown
    if (result.metadata?.layers) {
      console.log('🏗️  Layer Breakdown:');
      console.log(`   Layer 1 (Decomposition): ${result.metadata.layers.layer1_time_ms}ms, ${result.metadata.layers.layer1_tokens} tokens`);
      console.log(`   Layer 2 (Execution): ${result.metadata.layers.layer2_time_ms}ms, ${result.metadata.layers.layer2_tokens} tokens, ${result.metadata.layers.layer2_stages} stages`);
      console.log(`   Layer 3 (Synthesis): ${result.metadata.layers.layer3_time_ms}ms, ${result.metadata.layers.layer3_tokens} tokens`);
      console.log('');
    }

    // Generate HTML report
    console.log('📄 Generating HTML report...');
    const reporter = new E2EHTMLReporter();
    const reportPath = reporter.generateAndSave({
      title: `Test Command: ${command}`,
      inboxData,
      testResults: [{
        name: 'Single Command Test',
        passed: result.success,
        userQuery: command,
        response: result.message,
        executionTime,
        tokensUsed: result.metadata?.tokensUsed || 0,
        apiCalls
      }],
      timestamp: new Date(),
      totalDuration: executionTime
    }, `test-command-${Date.now()}`);

    console.log(`   ✓ Report saved: ${reportPath}`);
    console.log('');
    console.log('💡 Open report in browser:');
    console.log(`   open ${reportPath}`);
    console.log('');

    // Cleanup
    googleClient.clearMockManager();

    process.exit(result.success ? 0 : 1);
  } catch (error: any) {
    console.error('❌ Error executing command:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
