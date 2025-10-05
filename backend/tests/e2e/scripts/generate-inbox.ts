/**
 * Generate Inbox Script
 *
 * Generate and save a realistic inbox for testing using the 3-layer architecture
 *
 * Usage:
 *   npm run e2e:generate-inbox [persona] [outputFile]
 *
 * Examples:
 *   npm run e2e:generate-inbox founder
 *   npm run e2e:generate-inbox manager my-test-inbox.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { generateHyperRealisticInbox } from '../generators/hyper-realistic-inbox';

interface PersonaConfig {
  emailCount: number;
  includeDroppedBalls: boolean;
  includeOverdueCommitments: boolean;
  includeEscalations: boolean;
  includeUrgentIssues: boolean;
  noisePercentage: number;
  description: string;
}

const PERSONA_CONFIGS: Record<string, PersonaConfig> = {
  'quick-test': {
    emailCount: 20,
    includeDroppedBalls: true,
    includeOverdueCommitments: false,
    includeEscalations: false,
    includeUrgentIssues: true,
    noisePercentage: 20,
    description: '20 emails with dropped balls and urgent issues (fast testing)'
  },
  'founder': {
    emailCount: 50,
    includeDroppedBalls: true,
    includeOverdueCommitments: true,
    includeEscalations: true,
    includeUrgentIssues: true,
    noisePercentage: 30,
    description: '50 emails with full complexity (investor emails, escalations, commitments)'
  },
  'executive': {
    emailCount: 100,
    includeDroppedBalls: true,
    includeOverdueCommitments: true,
    includeEscalations: true,
    includeUrgentIssues: true,
    noisePercentage: 40,
    description: '100 emails with high noise (executive-level inbox)'
  },
  'manager': {
    emailCount: 60,
    includeDroppedBalls: true,
    includeOverdueCommitments: true,
    includeEscalations: false,
    includeUrgentIssues: true,
    noisePercentage: 25,
    description: '60 emails with team coordination patterns'
  },
  'individual': {
    emailCount: 40,
    includeDroppedBalls: false,
    includeOverdueCommitments: false,
    includeEscalations: false,
    includeUrgentIssues: true,
    noisePercentage: 15,
    description: '40 emails with simple patterns (individual contributor)'
  }
};

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === '--help' || args[0] === '-h') {
    console.log('Generate Inbox - Create realistic test inboxes');
    console.log('');
    console.log('Usage: npm run e2e:generate-inbox [persona] [outputFile]');
    console.log('');
    console.log('Personas:');
    Object.entries(PERSONA_CONFIGS).forEach(([persona, config]) => {
      console.log(`  ${persona.padEnd(15)} ${config.description}`);
    });
    console.log('');
    console.log('Examples:');
    console.log('  npm run e2e:generate-inbox quick-test');
    console.log('  npm run e2e:generate-inbox founder my-inbox.json');
    console.log('');
    process.exit(0);
  }

  const persona = (args[0] || 'quick-test') as keyof typeof PERSONA_CONFIGS;
  const outputFile = args[1] || `inbox-${persona}-${Date.now()}.json`;

  const config = PERSONA_CONFIGS[persona];
  if (!config) {
    console.error(`❌ Unknown persona: ${persona}`);
    console.log('Valid personas:', Object.keys(PERSONA_CONFIGS).join(', '));
    process.exit(1);
  }

  console.log('🚀 Generating realistic inbox...');
  console.log(`   Persona: ${persona}`);
  console.log(`   ${config.description}`);
  console.log(`   Output: ${outputFile}`);
  console.log('');

  try {
    const startTime = Date.now();

    console.log('📧 Generating emails...');
    const inboxData = await generateHyperRealisticInbox({
      persona: persona as any,
      emailCount: config.emailCount,
      includeDroppedBalls: config.includeDroppedBalls,
      includeOverdueCommitments: config.includeOverdueCommitments,
      includeEscalations: config.includeEscalations,
      includeUrgentIssues: config.includeUrgentIssues,
      noisePercentage: config.noisePercentage,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Save to file
    const outputDir = path.join(__dirname, '../data/generated-inboxes');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, outputFile);
    fs.writeFileSync(outputPath, JSON.stringify(inboxData, null, 2));

    // Print summary
    // Count total test queries across all categories
    const totalQueries = Object.values(inboxData.groundTruth.testQueries).reduce(
      (sum, queries) => sum + queries.length,
      0
    );

    console.log('');
    console.log('✅ Inbox generated successfully!');
    console.log('');
    console.log('📊 Summary:');
    console.log(`   Persona: ${persona}`);
    console.log(`   Total Emails: ${inboxData.emails.length}`);
    console.log(`   Ground Truth Labels: ${inboxData.groundTruth.emailLabels.size}`);
    console.log(`   Test Queries: ${totalQueries}`);
    console.log(`   Generation Time: ${duration}s`);
    console.log('');
    console.log(`📁 Saved to: ${outputPath}`);
    console.log('');

    // Print sample emails
    console.log('📬 Sample Emails (first 5):');
    inboxData.emails.slice(0, 5).forEach((email, index) => {
      const daysAgo = Math.floor((new Date().getTime() - email.sentDate.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`\n   ${index + 1}. ${email.subject}`);
      console.log(`      From: ${email.from}`);
      console.log(`      Sent: ${daysAgo} days ago`);
      console.log(`      Urgent: ${email.label.isUrgent}, Important: ${email.label.isImportant}`);
      console.log(`      Dropped Ball: ${email.label.isDroppedBall}`);
      console.log(`      Body preview: ${email.body.substring(0, 80)}...`);
    });

    console.log('');
    console.log('🧪 Test Queries Available by Category:');
    Object.entries(inboxData.groundTruth.testQueries).forEach(([category, queries]) => {
      console.log(`   ${category}: ${queries.length} queries`);
      if (queries.length > 0) {
        console.log(`      Example: "${queries[0].query}"`);
      }
    });

    console.log('');
    console.log('💡 Next steps:');
    console.log('   1. Run e2e tests: npm test tests/e2e/suites/01-inbox-triage-3layer.test.ts');
    console.log('   2. Load in test: Use UnifiedMockManager.loadInbox(inboxData)');
    console.log('');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error generating inbox:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
