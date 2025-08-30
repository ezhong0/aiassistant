#!/usr/bin/env ts-node

/**
 * Test script for the new proposal card system
 * Shows exactly what users will see before confirming actions
 */

import { SlackFormatterService } from '../src/services/slack-formatter.service';

async function testProposalCards() {
  console.log('🧪 Testing Proposal Card System\n');
  
  const formatter = new SlackFormatterService();
  
  // Test 1: Email Send Proposal
  console.log('📧 Test 1: Email Send Proposal');
  const emailProposal = formatter.createDemoProposal();
  const emailCard = formatter.formatProposalCard(emailProposal);
  
  console.log('Email Proposal Card:');
  console.log('Text:', emailCard.text);
  console.log('Blocks:', JSON.stringify(emailCard.blocks, null, 2));
  console.log('\n' + '='.repeat(80) + '\n');
  
  // Test 2: Calendar Event Proposal
  console.log('📅 Test 2: Calendar Event Proposal');
  const calendarProposal = {
    type: 'calendar_create' as const,
    title: 'Create Calendar Event',
    summary: 'Schedule: Team Standup Meeting',
    details: {
      title: 'Team Standup Meeting',
      startTime: 'Tomorrow at 9:00 AM',
      endTime: 'Tomorrow at 9:30 AM',
      duration: 30,
      attendees: ['john@company.com', 'sarah@company.com', 'mike@company.com'],
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
  console.log('Calendar Proposal Card:');
  console.log('Text:', calendarCard.text);
  console.log('Blocks:', JSON.stringify(calendarCard.blocks, null, 2));
  console.log('\n' + '='.repeat(80) + '\n');
  
  // Test 3: Contact Creation Proposal
  console.log('👤 Test 3: Contact Creation Proposal');
  const contactProposal = {
    type: 'contact_create' as const,
    title: 'Create Contact',
    summary: 'Add new contact: Jane Smith',
    details: {
      name: 'Jane Smith',
      email: 'jane.smith@company.com',
      phone: '+1 (555) 123-4567',
      company: 'Tech Solutions Inc.',
      notes: 'Senior Developer, interested in AI projects'
    },
    risks: [
      'Contact will be added to your Google Contacts',
      'Information will be synced across devices'
    ],
    alternatives: [
      'Search existing contacts first',
      'Add to a specific contact group',
      'Import from another source'
    ],
    actions: [
      { actionId: 'confirm', text: 'Create Contact', style: 'primary' as const },
      { actionId: 'edit', text: 'Edit Details', style: 'default' as const },
      { actionId: 'cancel', text: 'Cancel', style: 'danger' as const }
    ]
  };
  
  const contactCard = formatter.formatProposalCard(contactProposal);
  console.log('Contact Proposal Card:');
  console.log('Text:', contactCard.text);
  console.log('Blocks:', JSON.stringify(contactCard.blocks, null, 2));
  console.log('\n' + '='.repeat(80) + '\n');
  
  // Test 4: Content Creation Proposal
  console.log('✍️ Test 4: Content Creation Proposal');
  const contentProposal = {
    type: 'content_create' as const,
    title: 'Create Content',
    summary: 'Generate blog post about: AI in Healthcare',
    details: {
      topic: 'AI in Healthcare',
      format: 'blog post',
      length: '1500 words',
      tone: 'professional',
      outline: [
        'Introduction to AI in healthcare',
        'Current applications and use cases',
        'Benefits and challenges',
        'Future outlook and trends',
        'Conclusion and recommendations'
      ]
    },
    risks: [
      'Content will be generated using AI',
      'May require human review and editing',
      'Content quality depends on input parameters'
    ],
    alternatives: [
      'Start with an outline first',
      'Use a different tone or style',
      'Generate multiple versions'
    ],
    actions: [
      { actionId: 'confirm', text: 'Generate Content', style: 'primary' as const },
      { actionId: 'outline', text: 'Create Outline First', style: 'default' as const },
      { actionId: 'edit', text: 'Edit Parameters', style: 'default' as const },
      { actionId: 'cancel', text: 'Cancel', style: 'danger' as const }
    ]
  };
  
  const contentCard = formatter.formatProposalCard(contentProposal);
  console.log('Content Proposal Card:');
  console.log('Text:', contentCard.text);
  console.log('Blocks:', JSON.stringify(contentCard.blocks, null, 2));
  
  console.log('\n✅ All proposal card tests completed!');
}

// Run the tests
testProposalCards().catch(console.error);
