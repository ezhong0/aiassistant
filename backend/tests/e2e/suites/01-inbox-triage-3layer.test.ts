/**
 * E2E Test Suite: Inbox Triage Commands (3-Layer Architecture)
 *
 * Tests the 3-layer architecture end-to-end:
 * - Layer 1: Query Decomposition
 * - Layer 2: Execution Strategies
 * - Layer 3: Synthesis
 *
 * Uses generated realistic inboxes to test against ground truth.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { generateHyperRealisticInbox, GeneratedInbox } from '../generators/hyper-realistic-inbox';
import { UnifiedMockManager } from '../mocks/unified-mock-manager';
import { createAppContainer, initializeAllServices } from '../../../src/di/container';
import { registerInfraServices } from '../../../src/di/registrations/infra-services';
import { registerDomainServices } from '../../../src/di/registrations/domain-services';
import { registerLayerServices } from '../../../src/di/registrations/layer-services';
import type { AppContainer } from '../../../src/di/container';
import type { OrchestratorService } from '../../../src/layers/orchestrator.service';

describe('3-Layer Architecture: Inbox Triage Commands', () => {
  let mockManager: UnifiedMockManager;
  let container: AppContainer;
  let orchestrator: OrchestratorService;
  let inbox: GeneratedInbox;
  const TEST_USER_ID = 'test-user-e2e';

  beforeAll(async () => {
    // Generate hyper-realistic inbox for founder persona
    inbox = await generateHyperRealisticInbox({
      persona: 'founder',
      emailCount: 50,
      includeDroppedBalls: true,
      includeOverdueCommitments: true,
      includeEscalations: true,
      includeUrgentIssues: true,
    });

    console.log(`Generated inbox with ${inbox.emails.length} emails`);
    console.log(`Ground truth labels: ${inbox.groundTruth.emailLabels.size}`);

    // Initialize DI container
    container = createAppContainer();
    registerInfraServices(container);
    registerDomainServices(container);
    registerLayerServices(container);

    // Initialize all services
    await initializeAllServices(container);

    // Get orchestrator (entry point to 3-layer system)
    orchestrator = container.resolve('orchestrator');

    // Initialize mock manager with generated inbox
    mockManager = new UnifiedMockManager();
    await mockManager.initialize();
    await mockManager.loadInbox(inbox);

    // Mock the email domain service to use our generated inbox
    mockManager.mockEmailService(container.resolve('emailDomainService'));
  });

  afterAll(async () => {
    // Cleanup
    if (mockManager) {
      await mockManager.cleanup();
    }
  });

  describe('Command 1: "What needs my attention right now?"', () => {
    it('should use 3-layer architecture to process query', async () => {
      const startTime = Date.now();

      // This goes through the full 3-layer pipeline
      const response = await orchestrator.processQuery({
        userId: TEST_USER_ID,
        query: 'What needs my attention right now?',
        conversationHistory: [],
      });

      const duration = Date.now() - startTime;

      // Validate response structure (from Synthesis layer)
      expect(response).toHaveProperty('message');
      expect(response).toHaveProperty('context');
      expect(response.message).toBeTruthy();
      expect(typeof response.message).toBe('string');

      // Validate metadata from layers
      if (response.metadata) {
        expect(response.metadata).toHaveProperty('layers');
        expect(response.metadata.layers).toContain('decomposition');
        expect(response.metadata.layers).toContain('execution');
        expect(response.metadata.layers).toContain('synthesis');
      }

      console.log(`Query processed in ${duration}ms`);
      console.log(`Response: ${response.message.substring(0, 200)}...`);

      // Expected results: emails that are urgent OR overdue OR blocking
      const expectedEmails = Array.from(inbox.groundTruth.emailLabels.values()).filter(
        label =>
          label.isUrgent ||
          label.isOverdue ||
          label.blocksOthers ||
          label.requiresImmediateAction ||
          label.isEscalated
      );

      expect(expectedEmails.length).toBeGreaterThan(0);

      // Validate response mentions urgent emails
      expect(response.message.toLowerCase()).toMatch(
        /urgent|important|immediate|attention|overdue|blocking/
      );
    });

    it('should create execution graph in Layer 1 (Decomposition)', async () => {
      // We can't directly inspect the execution graph, but we can verify the system
      // decomposes the query by checking the response mentions specific email attributes
      const response = await orchestrator.processQuery({
        userId: TEST_USER_ID,
        query: 'What needs my attention right now?',
        conversationHistory: [],
      });

      // If decomposition worked, synthesis should mention:
      // - Sender names
      // - Subjects
      // - Why they're important
      const urgentEmails = Array.from(inbox.groundTruth.emailLabels.values())
        .filter(label => label.isUrgent || label.isImportant)
        .slice(0, 3); // Check first 3

      let mentionCount = 0;
      for (const label of urgentEmails) {
        const email = inbox.emails.find(e => e.id === label.emailId);
        if (email && response.message.toLowerCase().includes(email.subject.toLowerCase().substring(0, 15))) {
          mentionCount++;
        }
      }

      // At least some urgent emails should be mentioned
      expect(mentionCount).toBeGreaterThan(0);
    });

    it('should execute strategies in Layer 2 (Execution)', async () => {
      const response = await orchestrator.processQuery({
        userId: TEST_USER_ID,
        query: 'Show me urgent emails',
        conversationHistory: [],
      });

      // Layer 2 should have executed strategies like:
      // - MetadataFilterStrategy (filter by labels)
      // - SemanticAnalysisStrategy (analyze urgency)

      const urgentEmails = Array.from(inbox.groundTruth.emailLabels.values()).filter(
        label => label.isUrgent
      );

      expect(urgentEmails.length).toBeGreaterThan(0);

      // Response should mention count of urgent emails
      expect(response.message).toMatch(new RegExp(`${urgentEmails.length}|urgent`, 'i'));
    });

    it('should synthesize natural language in Layer 3 (Synthesis)', async () => {
      const response = await orchestrator.processQuery({
        userId: TEST_USER_ID,
        query: 'What needs my attention right now?',
        conversationHistory: [],
      });

      // Synthesis layer should produce human-readable output
      expect(response.message.length).toBeGreaterThan(50); // Not just a one-word answer
      expect(response.message).toMatch(/[.!?]/); // Has punctuation (complete sentences)

      // Should not return raw JSON or technical output
      expect(response.message).not.toMatch(/\{|\[|"id":|"emailId":/);
    });
  });

  describe('Command 2: "Show me urgent emails"', () => {
    it('should filter using MetadataFilterStrategy', async () => {
      const response = await orchestrator.processQuery({
        userId: TEST_USER_ID,
        query: 'Show me urgent emails',
        conversationHistory: [],
      });

      const urgentEmails = Array.from(inbox.groundTruth.emailLabels.values()).filter(
        label => label.isUrgent
      );

      expect(urgentEmails.length).toBeGreaterThan(0);

      // Should mention count
      const countMatch = response.message.match(/\d+/);
      if (countMatch) {
        const mentionedCount = parseInt(countMatch[0]);
        expect(mentionedCount).toBeGreaterThanOrEqual(urgentEmails.length - 2); // Allow some variance
        expect(mentionedCount).toBeLessThanOrEqual(urgentEmails.length + 2);
      }
    });
  });

  describe('Command 3: "Emails with deadlines this week"', () => {
    it('should use temporal filtering strategy', async () => {
      const response = await orchestrator.processQuery({
        userId: TEST_USER_ID,
        query: 'Emails with deadlines this week',
        conversationHistory: [],
      });

      const weekDeadlines = Array.from(inbox.groundTruth.emailLabels.values()).filter(
        label =>
          label.hasDeadline &&
          label.daysUntilDeadline !== undefined &&
          label.daysUntilDeadline >= 0 &&
          label.daysUntilDeadline <= 7
      );

      if (weekDeadlines.length > 0) {
        expect(response.message.toLowerCase()).toMatch(/deadline|due|week/);

        // Should sort by proximity (soonest first in synthesis)
        const sortedDeadlines = weekDeadlines
          .sort((a, b) => (a.daysUntilDeadline || 0) - (b.daysUntilDeadline || 0));

        const firstEmail = inbox.emails.find(e => e.id === sortedDeadlines[0].emailId);
        if (firstEmail) {
          // First deadline should be mentioned
          expect(response.message.toLowerCase()).toContain(
            firstEmail.subject.toLowerCase().substring(0, 10)
          );
        }
      }
    });
  });

  describe('Command 4: "Show me dropped balls"', () => {
    it('should identify unanswered follow-ups using thread analysis', async () => {
      const response = await orchestrator.processQuery({
        userId: TEST_USER_ID,
        query: 'Show me dropped balls',
        conversationHistory: [],
      });

      const droppedBalls = Array.from(inbox.groundTruth.emailLabels.values()).filter(
        label => label.isDroppedBall
      );

      if (droppedBalls.length > 0) {
        expect(response.message.toLowerCase()).toMatch(
          /dropped|unanswered|no response|waiting|follow.*up/
        );
      }
    });
  });

  describe('Command 5: "What\'s blocking my team?"', () => {
    it('should use semantic analysis strategy', async () => {
      const response = await orchestrator.processQuery({
        userId: TEST_USER_ID,
        query: "What's blocking my team?",
        conversationHistory: [],
      });

      const blockingEmails = Array.from(inbox.groundTruth.emailLabels.values()).filter(
        label => label.blocksOthers
      );

      if (blockingEmails.length > 0) {
        expect(response.message.toLowerCase()).toMatch(/block|waiting|stuck|need/);
      }
    });
  });

  describe('Performance', () => {
    it('should complete 3-layer processing in < 10 seconds', async () => {
      const start = Date.now();

      await orchestrator.processQuery({
        userId: TEST_USER_ID,
        query: 'What needs my attention right now?',
        conversationHistory: [],
      });

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(10000); // 10 seconds max
    });

    it('should handle complex multi-step queries', async () => {
      const start = Date.now();

      const response = await orchestrator.processQuery({
        userId: TEST_USER_ID,
        query: 'Show me urgent emails from VIPs with deadlines this week that need my response',
        conversationHistory: [],
      });

      const duration = Date.now() - start;

      // Complex query should still complete reasonably fast
      expect(duration).toBeLessThan(15000); // 15 seconds for complex query
      expect(response.message).toBeTruthy();
    });
  });

  describe('Context Management (Stateless)', () => {
    it('should maintain conversation context across queries', async () => {
      // First query
      const response1 = await orchestrator.processQuery({
        userId: TEST_USER_ID,
        query: 'Show me urgent emails',
        conversationHistory: [],
      });

      // Follow-up query (should use context from first query)
      const response2 = await orchestrator.processQuery({
        userId: TEST_USER_ID,
        query: 'Which one is most important?',
        conversationHistory: response1.context.conversationHistory,
      });

      expect(response2.message).toBeTruthy();
      expect(response2.message.length).toBeGreaterThan(20);
    });
  });

  describe('Ground Truth Validation', () => {
    it('should correctly identify dropped balls', async () => {
      const response = await orchestrator.processQuery({
        userId: TEST_USER_ID,
        query: 'Show me dropped balls or unanswered emails',
        conversationHistory: [],
      });

      const droppedBallQueries = inbox.groundTruth.testQueries.droppedBalls;

      if (droppedBallQueries && droppedBallQueries.length > 0) {
        const firstQuery = droppedBallQueries[0];
        if (firstQuery.expectedResults.length > 0) {
          // At least one dropped ball should be mentioned
          const firstDroppedBall = inbox.emails.find(
            e => e.id === firstQuery.expectedResults[0]
          );

          if (firstDroppedBall) {
            expect(response.message.toLowerCase()).toContain(
              firstDroppedBall.subject.toLowerCase().substring(0, 15)
            );
          }
        }
      }
    });

    it('should correctly identify overdue commitments', async () => {
      const response = await orchestrator.processQuery({
        userId: TEST_USER_ID,
        query: 'Show me overdue commitments or broken promises',
        conversationHistory: [],
      });

      const overdueCommitments = Array.from(inbox.groundTruth.emailLabels.values()).filter(
        label => label.commitmentStatus === 'overdue'
      );

      if (overdueCommitments.length > 0) {
        expect(response.message.toLowerCase()).toMatch(/overdue|commitment|promise/);
      }
    });
  });
});
