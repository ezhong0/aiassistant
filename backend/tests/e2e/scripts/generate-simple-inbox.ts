/**
 * Generate Simple Realistic Inbox
 *
 * CLI script to generate realistic inboxes using the simple generator
 *
 * Usage:
 *   npx ts-node tests/e2e/scripts/generate-simple-inbox.ts [template] [weeks]
 *
 * Examples:
 *   npx ts-node tests/e2e/scripts/generate-simple-inbox.ts founder-overwhelmed
 *   npx ts-node tests/e2e/scripts/generate-simple-inbox.ts vp-sales-busy 8
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { AIDomainService } from '../../../src/services/domain/ai-domain.service';
import { SimpleRealisticInboxGenerator, SimpleInbox } from '../generators/simple-realistic-inbox';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

// Wrapper to adapt AIDomainService to the simple interface we need
class SimpleAIService {
  constructor(private aiDomain: AIDomainService) {}

  async generateResponse(prompt: string): Promise<string> {
    const response = await this.aiDomain.generateChatCompletion({
      messages: [
        { role: 'user', content: prompt }
      ],
      model: 'gpt-5-nano',
      temperature: 0.7
    });
    return response.message.content;
  }
}

async function main() {
  const args = process.argv.slice(2);

  // Show help
  if (args[0] === '--help' || args[0] === '-h' || args.length === 0) {
    console.log('Generate Simple Realistic Inbox');
    console.log('');
    console.log('Usage: npm run e2e:generate-simple [template] [weeks]');
    console.log('');
    console.log('Available Templates:');
    console.log('  founder-overwhelmed       Series A founder, drowning in email');
    console.log('  vp-sales-busy            VP Sales, pipeline management focus');
    console.log('  eng-manager-organized     Engineering manager, good discipline');
    console.log('  exec-drowning            C-level exec, completely overwhelmed');
    console.log('');
    console.log('Examples:');
    console.log('  npm run e2e:generate-simple founder-overwhelmed');
    console.log('  npm run e2e:generate-simple vp-sales-busy 8');
    console.log('');
    console.log('Options:');
    console.log('  [weeks]  Number of weeks to generate (default: 6)');
    console.log('');
    console.log('Output: tests/e2e/data/simple-inboxes/');
    console.log('Cost: ~$0.03-0.05 per inbox (GPT-5 Nano)');
    console.log('Time: ~60-120 seconds');
    process.exit(0);
  }

  const template = args[0];
  const weeks = parseInt(args[1]) || 6;

  console.log('🚀 Generating Simple Realistic Inbox');
  console.log('');
  console.log(`   Template: ${template}`);
  console.log(`   Weeks: ${weeks}`);
  console.log(`   Model: GPT-5 Nano`);
  console.log('');

  try {
    // Initialize services
    console.log('⚙️  Initializing AI services...');
    const aiDomainService = new AIDomainService();
    await aiDomainService.initialize();

    const aiService = new SimpleAIService(aiDomainService);

    const generator = new SimpleRealisticInboxGenerator(aiService as any);
    await generator.initialize();

    console.log('   ✓ Services initialized');
    console.log('');

    // Generate inbox
    const startTime = Date.now();
    const inbox = await generator.generate(template, weeks);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    // Save to file
    const outputDir = path.join(__dirname, '../data/simple-inboxes');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `inbox-${template}-${Date.now()}.json`;
    const outputPath = path.join(outputDir, filename);
    fs.writeFileSync(outputPath, JSON.stringify(inbox, null, 2));

    // Calculate statistics
    const stats = calculateStats(inbox);

    // Print results
    console.log('');
    console.log('✅ Inbox Generated Successfully!');
    console.log('');
    console.log('📊 Statistics:');
    console.log(`   Total Emails: ${inbox.totalEmails}`);
    console.log(`   Signal: ${stats.signal} (${stats.signalPercent}%)`);
    console.log(`   Noise: ${stats.noise} (${stats.noisePercent}%)`);
    console.log(`   Urgent: ${stats.urgent} (${stats.urgentPercent}%)`);
    console.log(`   Requires Response: ${stats.requiresResponse}`);
    console.log(`   Test Queries: ${inbox.groundTruth.testQueries.length}`);
    console.log('');
    console.log('⏱️  Performance:');
    console.log(`   Generation Time: ${duration}s`);
    console.log(`   Cost (estimated): $${stats.estimatedCost}`);
    console.log('');
    console.log(`📁 Saved to: ${outputPath}`);
    console.log('');
    console.log('💡 Next Steps:');
    console.log(`   Test a command: npm run e2e:test-command ${filename} "Show urgent emails"`);
    console.log(`   List inboxes: npm run e2e:list-inboxes`);
    console.log('');

    // Print sample emails
    console.log('📧 Sample Emails (first 3):');
    inbox.weeks[0].emails.slice(0, 3).forEach((email, index) => {
      console.log(`\n   ${index + 1}. ${email.subject}`);
      console.log(`      From: ${email.from}`);
      console.log(`      Category: ${email.category}${email.isUrgent ? ' [URGENT]' : ''}`);
      console.log(`      Preview: ${email.body.substring(0, 100)}...`);
    });
    console.log('');

    // Print sample test queries
    console.log('🧪 Sample Test Queries:');
    inbox.groundTruth.testQueries.slice(0, 5).forEach((query, index) => {
      console.log(`\n   ${index + 1}. "${query.query}"`);
      console.log(`      Expected: ${query.expectedEmailIds.length} email(s)`);
      console.log(`      Reason: ${query.reasoning}`);
    });
    console.log('');

    process.exit(0);
  } catch (error: any) {
    console.error('');
    console.error('❌ Error generating inbox:', error.message);
    if (error.stack) {
      console.error('');
      console.error('Stack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

function calculateStats(inbox: SimpleInbox) {
  const allEmails = inbox.weeks.flatMap(w => w.emails);

  const signal = allEmails.filter(e => e.category === 'signal').length;
  const noise = allEmails.filter(e => e.category === 'noise').length;
  const urgent = allEmails.filter(e => e.isUrgent).length;
  const requiresResponse = allEmails.filter(e => e.requiresResponse).length;

  // Estimate cost (GPT-5 Nano: $0.15 per 1M input, $0.60 per 1M output)
  const aiCalls = 1 + inbox.weeks.length + 1; // context + weeks + labels
  const avgTokensIn = 2000;
  const avgTokensOut = 5000;
  const totalTokensIn = aiCalls * avgTokensIn;
  const totalTokensOut = aiCalls * avgTokensOut;
  const costIn = (totalTokensIn / 1000000) * 0.15;
  const costOut = (totalTokensOut / 1000000) * 0.60;
  const estimatedCost = (costIn + costOut).toFixed(2);

  return {
    signal,
    noise,
    urgent,
    requiresResponse,
    signalPercent: Math.round((signal / allEmails.length) * 100),
    noisePercent: Math.round((noise / allEmails.length) * 100),
    urgentPercent: Math.round((urgent / allEmails.length) * 100),
    estimatedCost
  };
}

main();
