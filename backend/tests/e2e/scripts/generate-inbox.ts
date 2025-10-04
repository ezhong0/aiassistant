/**
 * Generate Inbox Script
 *
 * Generate and save a realistic inbox for testing
 *
 * Usage:
 *   npx ts-node tests/e2e/scripts/generate-inbox.ts [role] [outputFile]
 *
 * Examples:
 *   npx ts-node tests/e2e/scripts/generate-inbox.ts executive
 *   npx ts-node tests/e2e/scripts/generate-inbox.ts manager my-test-inbox.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { GenericAIService } from '../../../src/services/generic-ai.service';
import { AIDomainService } from '../../../src/services/domain/ai-domain.service';
import { WholeInboxGenerator, InboxData } from '../generators/whole-inbox-generator';

async function main() {
  const args = process.argv.slice(2);
  const role = (args[0] || 'executive') as 'executive' | 'manager' | 'individual' | 'mixed';
  const outputFile = args[1] || `inbox-${role}-${Date.now()}.json`;

  console.log('🚀 Generating inbox...');
  console.log(`   Role: ${role}`);
  console.log(`   Output: ${outputFile}`);
  console.log('');

  try {
    // Initialize services
    console.log('⚙️  Initializing AI services...');
    const aiDomainService = new AIDomainService();
    await aiDomainService.initialize();

    const aiService = new GenericAIService(aiDomainService);
    await aiService.initialize();

    const inboxGenerator = new WholeInboxGenerator(aiService);
    await inboxGenerator.initialize();

    // Get template for role
    console.log(`📋 Loading ${role} template...`);
    const template = inboxGenerator.getTemplate(role);
    if (!template) {
      throw new Error(`Unknown role: ${role}. Valid roles: executive, manager, individual, mixed`);
    }

    // Generate inbox
    console.log(`📧 Generating ${template.emailCount} emails...`);
    console.log('   This may take 1-2 minutes...');
    console.log('');

    const startTime = Date.now();
    const inboxData = await inboxGenerator.generateCompleteInbox(template);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Save to file
    const outputDir = path.join(__dirname, '../data/generated-inboxes');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, outputFile);
    fs.writeFileSync(outputPath, JSON.stringify(inboxData, null, 2));

    // Print summary
    console.log('✅ Inbox generated successfully!');
    console.log('');
    console.log('📊 Summary:');
    console.log(`   Role: ${inboxData.metadata.userProfile.role}`);
    console.log(`   Industry: ${inboxData.metadata.userProfile.industry}`);
    console.log(`   Total Emails: ${inboxData.emails.length}`);
    console.log(`   Calendar Events: ${inboxData.calendar.length}`);
    console.log(`   Relationships: ${inboxData.relationships.length}`);
    console.log(`   Generation Time: ${duration}s`);
    console.log('');
    console.log(`📁 Saved to: ${outputPath}`);
    console.log('');
    console.log('💡 Usage:');
    console.log(`   npx ts-node tests/e2e/scripts/test-command.ts "${outputPath}" "Show me urgent emails"`);
    console.log('');

    // Print sample emails
    console.log('📬 Sample Emails (first 5):');
    inboxData.emails.slice(0, 5).forEach((email, index) => {
      const subject = email.payload.headers.find(h => h.name === 'Subject')?.value || 'No subject';
      const from = email.payload.headers.find(h => h.name === 'From')?.value || 'Unknown';
      const labels = email.labelIds.join(', ');

      console.log(`\n   ${index + 1}. ${subject}`);
      console.log(`      From: ${from}`);
      console.log(`      Labels: ${labels}`);
      console.log(`      Snippet: ${email.snippet.substring(0, 80)}...`);
    });

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error generating inbox:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
