#!/usr/bin/env ts-node

/**
 * Test script to show exactly how proposal cards look in Slack
 * This demonstrates the rich formatting and interactive elements
 */

import { SlackFormatterService } from '../src/services/slack-formatter.service';

async function testSlackFormatting() {
  console.log('🧪 Testing Slack Proposal Card Formatting\n');
  
  const formatter = new SlackFormatterService();
  
  // Test 1: Email Proposal Card
  console.log('📧 Email Proposal Card in Slack:');
  console.log('='.repeat(60));
  
  const emailProposal = formatter.createDemoProposal();
  const emailCard = formatter.formatProposalCard(emailProposal);
  
  // Show how it appears in Slack
  console.log('📱 SLACK MESSAGE PREVIEW:');
  console.log('─'.repeat(40));
  console.log(emailCard.text);
  console.log('─'.repeat(40));
  
  // Show the block structure
  console.log('\n🔧 SLACK BLOCKS STRUCTURE:');
  emailCard.blocks?.forEach((block, index) => {
    console.log(`\nBlock ${index + 1} (${block.type}):`);
    if (block.type === 'header') {
      console.log(`  📝 ${block.text?.text}`);
    } else if (block.type === 'section') {
      console.log(`  📄 ${block.text?.text?.substring(0, 100)}...`);
    } else if (block.type === 'divider') {
      console.log(`  ➖ Divider line`);
    } else if (block.type === 'actions') {
      console.log(`  🔘 Action buttons: ${block.elements?.map((btn: any) => btn.text.text).join(', ')}`);
    }
  });
  
  console.log('\n' + '='.repeat(80) + '\n');
  
  // Test 2: Calendar Proposal Card
  console.log('📅 Calendar Proposal Card in Slack:');
  console.log('='.repeat(60));
  
  const calendarProposal = {
    type: 'calendar_create' as const,
    title: 'Create Calendar Event',
    summary: 'Schedule: Team Standup Meeting',
    details: {
      title: 'Team Standup Meeting',
      startTime: 'Tomorrow at 9:00 AM',
      endTime: 'Tomorrow at 9:30 AM',
      duration: 30,
      attendees: ['john@company.com', 'sarah@company.com'],
      location: 'Conference Room A',
      description: 'Daily team standup to discuss progress and blockers',
      reminders: ['15 minutes before', '1 hour before']
    },
    risks: [
      'Event will be created immediately',
      'Attendees will receive invitations',
      'Event will be visible on your calendar'
    ],
    alternatives: [
      'Create as tentative event',
      'Schedule for a different time',
      'Create recurring event'
    ],
    actions: [
      { actionId: 'confirm', text: 'Create Event', style: 'primary' as const },
      { actionId: 'edit', text: 'Edit Details', style: 'default' as const },
      { actionId: 'tentative', text: 'Mark as Tentative', style: 'default' as const },
      { actionId: 'cancel', text: 'Cancel', style: 'danger' as const }
    ]
  };
  
  const calendarCard = formatter.formatProposalCard(calendarProposal);
  
  console.log('📱 SLACK MESSAGE PREVIEW:');
  console.log('─'.repeat(40));
  console.log(calendarCard.text);
  console.log('─'.repeat(40));
  
  console.log('\n🔧 SLACK BLOCKS STRUCTURE:');
  calendarCard.blocks?.forEach((block, index) => {
    console.log(`\nBlock ${index + 1} (${block.type}):`);
    if (block.type === 'header') {
      console.log(`  📝 ${block.text?.text}`);
    } else if (block.type === 'section') {
      console.log(`  📄 ${block.text?.text?.substring(0, 100)}...`);
    } else if (block.type === 'divider') {
      console.log(`  ➖ Divider line`);
    } else if (block.type === 'actions') {
      console.log(`  🔘 Action buttons: ${block.elements?.map((btn: any) => btn.text.text).join(', ')}`);
    }
  });
  
  console.log('\n' + '='.repeat(80) + '\n');
  
  // Test 3: Show the actual JSON that gets sent to Slack
  console.log('📤 ACTUAL SLACK API PAYLOAD:');
  console.log('='.repeat(60));
  
  console.log('Email Card JSON:');
  console.log(JSON.stringify(emailCard, null, 2));
  
  console.log('\n✅ Slack formatting tests completed!');
  console.log('\n💡 These cards will look professional and interactive in Slack!');
}

// Run the tests
testSlackFormatting().catch(console.error);
