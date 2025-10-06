/**
 * Orchestrator Adapter for E2E Testing
 *
 * Bridges the e2e testing system with the real 3-layer orchestrator.
 * Converts GeneratedInbox → mock services → orchestrator → ChatbotResponse
 */

import { OrchestratorService } from '../../../src/layers/orchestrator.service';
import { GeneratedInbox } from '../generators/hyper-realistic-inbox';
import { ChatbotResponse } from '../evaluation-v2/multi-layer-evaluator';
import { createTestContainer, createTestUserContext } from './test-container';

/**
 * Mock email service that provides emails from GeneratedInbox
 */
class MockEmailServiceForTest {
  constructor(private inbox: GeneratedInbox) {}

  async getEmails(userId: string, filters?: any) {
    // Return emails based on filters
    // For now, return all emails - orchestrator will filter
    return this.inbox.emails.map(email => ({
      id: email.id,
      threadId: email.threadId,
      from: email.from,
      to: email.to,
      cc: email.cc || [],
      subject: email.subject,
      body: email.body,
      sentDate: email.sentDate,
      hasAttachments: email.hasAttachments,
      // Include ground truth as metadata for evaluation
      metadata: {
        label: email.label,
      },
    }));
  }

  async getThreadEmails(threadId: string) {
    return this.inbox.emails.filter(e => e.threadId === threadId);
  }

  async searchEmails(query: string) {
    // Simple keyword search for testing
    const lowerQuery = query.toLowerCase();
    return this.inbox.emails.filter(email =>
      email.subject.toLowerCase().includes(lowerQuery) ||
      email.body.toLowerCase().includes(lowerQuery)
    );
  }
}

/**
 * Create a chatbot function that uses the REAL orchestrator with test data
 *
 * This version:
 * - Uses YOUR REAL 3-layer orchestrator code
 * - Injects mock services that return data from GeneratedInbox
 * - Tests the actual implementation (not a simulation)
 *
 * @param inbox - Generated inbox for testing
 * @returns A chatbot function that runs the real orchestrator
 */
export function createRealOrchestratorChatbotFunction(
  inbox: GeneratedInbox
): (inbox: GeneratedInbox, query: string) => Promise<ChatbotResponse> {

  return async (inboxData: GeneratedInbox, query: string): Promise<ChatbotResponse> => {
    // Create test container with mock services (includes user context/preferences mocks)
    const container = await createTestContainer(inbox);
    const userContext = createTestUserContext(inbox);

    // Resolve the REAL orchestrator from container
    const orchestrator = container.resolve('orchestrator');

    try {
      // Call REAL orchestrator with REAL Layer 1/2/3
      const result = await orchestrator.processUserInput(
        query,
        userContext.user_id,
        [], // No conversation history for e2e tests
        undefined
      );

      // Extract email IDs from response text
      const emailIds = extractEmailIdsFromResponse(result.message);

      // Convert to ChatbotResponse format
      return {
        type: 'email_list',
        emailIds,
        presentation: result.message,
        ranking: emailIds.map((id, i) => ({
          emailId: id,
          score: 100 - i * 5, // Estimated scores
        })),
        internalState: {
          processingTime: result.metadata?.processingTime,
          parsedIntent: (result.masterState as any)?.executionGraph?.query_classification,
          filtersApplied: [], // Could extract from execution graph
          resultsBeforeRanking: (result.masterState as any)?.executionResults?.nodeResults?.size,
        },
      };
    } catch (error: any) {
      console.error('Orchestrator error:', error);

      // Return error response
      return {
        type: 'email_list',
        emailIds: [],
        presentation: `Error: ${error.message}`,
        internalState: {},
      };
    }
  };
}

/**
 * Extract email IDs from orchestrator response text
 * This is a heuristic - ideally orchestrator should return structured data
 */
function extractEmailIdsFromResponse(message: string): string[] {
  const emailIdPattern = /email-\d+/g;
  const matches = message.match(emailIdPattern);
  return matches ? Array.from(new Set(matches)) : [];
}

/**
 * ALTERNATIVE APPROACH: Create a fully mocked orchestrator for testing
 *
 * This version doesn't require database setup - it uses the mock services directly
 */
export function createMockedOrchestratorChatbotFunction(
  inbox: GeneratedInbox
): (inbox: GeneratedInbox, query: string) => Promise<ChatbotResponse> {

  return async (inboxData: GeneratedInbox, query: string): Promise<ChatbotResponse> => {
    const startTime = Date.now();

    // Simple intent parsing (this should be Layer 1 in real orchestrator)
    const intent = parseIntent(query);

    // Filter emails based on intent (this should be Layer 2 in real orchestrator)
    const filteredEmails = filterEmailsByIntent(inbox, intent);

    // Rank emails (this should be Layer 2 in real orchestrator)
    const rankedEmails = rankEmails(filteredEmails);

    // Build presentation (this should be Layer 3 in real orchestrator)
    const presentation = buildPresentation(rankedEmails, intent);

    const processingTime = Date.now() - startTime;

    return {
      type: 'email_list',
      emailIds: rankedEmails.map(e => e.id),
      ranking: rankedEmails.map((e, i) => ({
        emailId: e.id,
        score: 100 - i, // Simple scoring
      })),
      presentation,
      internalState: {
        parsedIntent: intent,
        processingTime,
        filtersApplied: intent.filters,
        resultsBeforeRanking: filteredEmails.length,
      },
    };
  };
}

/**
 * Parse user query into intent (simplified Layer 1)
 */
function parseIntent(query: string): { action: string; filters: string[] } {
  const filters: string[] = [];
  const lowerQuery = query.toLowerCase();

  // Detect filters based on keywords
  if (lowerQuery.includes('urgent')) filters.push('urgent');
  if (lowerQuery.includes('important')) filters.push('important');
  if (lowerQuery.includes('dropped') || lowerQuery.includes('ball')) filters.push('dropped_ball');
  if (lowerQuery.includes('unanswered') || lowerQuery.includes("haven't responded") || lowerQuery.includes("need to respond")) {
    filters.push('unanswered');
  }
  if (lowerQuery.includes('follow') || lowerQuery.includes('reminder')) filters.push('follow_up');
  if (lowerQuery.includes('escalat')) filters.push('escalated');
  if (lowerQuery.includes('boss') || lowerQuery.includes('manager')) filters.push('boss');
  if (lowerQuery.includes('customer') || lowerQuery.includes('client')) filters.push('customer');
  if (lowerQuery.includes('overdue') && lowerQuery.includes('commitment')) filters.push('commitment_overdue');
  if (lowerQuery.includes('vip')) filters.push('vip');

  return {
    action: 'filter_emails',
    filters,
  };
}

/**
 * Filter emails by intent (simplified Layer 2)
 */
function filterEmailsByIntent(inbox: GeneratedInbox, intent: { filters: string[] }) {
  return inbox.emails.filter(email => {
    const label = email.label;

    // Apply all filters (AND logic)
    for (const filter of intent.filters) {
      if (filter === 'urgent' && !label.isUrgent) return false;
      if (filter === 'important' && !label.isImportant) return false;
      if (filter === 'dropped_ball' && !label.isDroppedBall) return false;
      if (filter === 'unanswered' && !label.userNeedsToRespond) return false;
      if (filter === 'follow_up' && !label.isFollowUp) return false;
      if (filter === 'escalated' && !label.isEscalated) return false;
      if (filter === 'boss' && label.senderType !== 'boss') return false;
      if (filter === 'customer' && label.senderType !== 'customer') return false;
      if (filter === 'commitment_overdue' && label.commitmentStatus !== 'overdue') return false;
      if (filter === 'vip' && !label.isVIP) return false;
    }

    return true;
  });
}

/**
 * Rank emails by importance (simplified Layer 2)
 */
function rankEmails(emails: any[]): any[] {
  return emails.sort((a, b) => {
    const scoreA = calculateEmailScore(a);
    const scoreB = calculateEmailScore(b);
    return scoreB - scoreA;
  });
}

/**
 * Calculate importance score for an email
 */
function calculateEmailScore(email: any): number {
  let score = 0;
  const label = email.label;

  // Critical issues
  if (label.isEscalated) score += 100;
  if (label.isDroppedBall && label.senderType === 'customer') score += 90;
  if (label.commitmentStatus === 'overdue') score += 85;

  // High priority
  if (label.isUrgent) score += 50;
  if (label.senderType === 'boss') score += 40;
  if (label.isVIP) score += 35;

  // Medium priority
  if (label.isImportant) score += 25;
  if (label.userNeedsToRespond) score += 20;
  if (label.isFollowUp) score += 15;

  // Recency bonus
  const daysAgo = (Date.now() - new Date(label.sentTimestamp).getTime()) / (1000 * 60 * 60 * 24);
  if (daysAgo < 3) score += 10;

  return score;
}

/**
 * Build presentation text (simplified Layer 3)
 */
function buildPresentation(emails: any[], intent: any): string {
  if (emails.length === 0) {
    return `No emails found matching: ${intent.filters.join(', ')}`;
  }

  const categories: Record<string, number> = {};

  emails.forEach(email => {
    const label = email.label;
    if (label.isEscalated) categories['escalated'] = (categories['escalated'] || 0) + 1;
    if (label.isDroppedBall) categories['dropped balls'] = (categories['dropped balls'] || 0) + 1;
    if (label.isUrgent) categories['urgent'] = (categories['urgent'] || 0) + 1;
    if (label.senderType === 'boss') categories['from manager'] = (categories['from manager'] || 0) + 1;
    if (label.senderType === 'customer') categories['from customers'] = (categories['from customers'] || 0) + 1;
  });

  const summary = Object.entries(categories)
    .map(([cat, count]) => `${count} ${cat}`)
    .join(', ');

  return `Found ${emails.length} emails: ${summary}`;
}
