/**
 * List Inboxes Script
 *
 * List all generated inboxes with their details
 *
 * Usage:
 *   npx ts-node tests/e2e/scripts/list-inboxes.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { InboxData } from '../generators/whole-inbox-generator';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatDate(date: Date): string {
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

async function main() {
  const inboxDir = path.join(__dirname, '../data/generated-inboxes');

  console.log('📬 Generated Inboxes');
  console.log('');

  if (!fs.existsSync(inboxDir)) {
    console.log('No inboxes found. Generate one with:');
    console.log('  npx ts-node tests/e2e/scripts/generate-inbox.ts executive');
    console.log('');
    process.exit(0);
  }

  const files = fs.readdirSync(inboxDir).filter(f => f.endsWith('.json'));

  if (files.length === 0) {
    console.log('No inboxes found. Generate one with:');
    console.log('  npx ts-node tests/e2e/scripts/generate-inbox.ts executive');
    console.log('');
    process.exit(0);
  }

  console.log(`Found ${files.length} inbox(es):`);
  console.log('');

  const inboxes = files.map(filename => {
    const filepath = path.join(inboxDir, filename);
    const stats = fs.statSync(filepath);

    try {
      const data: InboxData = JSON.parse(fs.readFileSync(filepath, 'utf-8'));

      return {
        filename,
        filepath,
        role: data.metadata.userProfile.role,
        industry: data.metadata.userProfile.industry,
        emailCount: data.emails.length,
        calendarCount: data.calendar.length,
        generatedAt: new Date(data.metadata.generatedAt),
        fileSize: stats.size,
        valid: true
      };
    } catch (error) {
      return {
        filename,
        filepath,
        fileSize: stats.size,
        valid: false,
        error: 'Invalid JSON'
      };
    }
  });

  // Print table
  inboxes.forEach((inbox, index) => {
    if (!inbox.valid) {
      console.log(`${index + 1}. ${inbox.filename} ❌`);
      console.log(`   Error: ${inbox.error}`);
      console.log(`   Size: ${formatBytes(inbox.fileSize)}`);
      console.log('');
      return;
    }

    console.log(`${index + 1}. ${inbox.filename}`);
    console.log(`   Role: ${inbox.role}`);
    console.log(`   Industry: ${inbox.industry}`);
    console.log(`   Emails: ${inbox.emailCount}`);
    console.log(`   Calendar: ${inbox.calendarCount}`);
    console.log(`   Generated: ${formatDate(inbox.generatedAt)}`);
    console.log(`   Size: ${formatBytes(inbox.fileSize)}`);
    console.log(`   Path: ${inbox.filepath}`);
    console.log('');
  });

  console.log('💡 Usage:');
  console.log('   Test a command on an inbox:');
  console.log(`   npx ts-node tests/e2e/scripts/test-command.ts ${inboxes[0]?.filename} "Show urgent emails"`);
  console.log('');
  console.log('   Generate a new inbox:');
  console.log('   npx ts-node tests/e2e/scripts/generate-inbox.ts executive');
  console.log('');
}

main();
