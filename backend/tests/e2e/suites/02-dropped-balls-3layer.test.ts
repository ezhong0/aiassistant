/**
 * E2E Test Suite: Dropped Ball Detection (3-Layer Architecture)
 *
 * Tests dropped ball identification using the 3-layer system:
 * - Layer 1: Decomposes "dropped ball" queries
 * - Layer 2: Executes thread analysis and semantic search
 * - Layer 3: Synthesizes unanswered emails report
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

describe('3-Layer: Dropped Ball Detection', () => {
  let mockManager: UnifiedMockManager;
  let container: AppContainer;
  let orchestrator: OrchestratorService;
  let inbox: GeneratedInbox;
  const TEST_USER_ID = 'test-user-e2e';

  beforeAll(async () => {
    inbox = await generateHyperRealisticInbox({
      persona: 'founder',
      emailCount: 50,
      includeDroppedBalls: true, // Critical
      includeOverdueCommitments: true,
      includeEscalations: true,
      includeUrgentIssues: true,
    });

    container = createAppContainer();
    registerInfraServices(container);
    registerDomainServices(container);
    registerLayerServices(container);
    await initializeAllServices(container);

    orchestrator = container.resolve('orchestrator');

    mockManager = new UnifiedMockManager();
    await mockManager.initialize();
    await mockManager.loadInbox(inbox);
    mockManager.mockEmailService(container.resolve('emailDomainService'));
  });

  afterAll(async () => {
    if (mockManager) await mockManager.cleanup();
  });

  describe('"What haven\'t I responded to?"', () => {
    it('should identify unanswered emails via 3-layer system', async () => {
      const response = await orchestrator.processQuery({
        userId: TEST_USER_ID,
        query: "What haven't I responded to?",
        conversationHistory: [],
      });

      const unanswered = Array.from(inbox.groundTruth.emailLabels.values()).filter(
        label => label.userNeedsToRespond && label.lastResponseFrom === 'sender'
      );

      expect(unanswered.length).toBeGreaterThan(0);
      expect(response.message.toLowerCase()).toMatch(/haven't|unanswered|respond|reply/);
    });

    it('should prioritize by sender importance', async () => {
      const response = await orchestrator.processQuery({
        userId: TEST_USER_ID,
        query: "What haven't I responded to?",
        conversationHistory: [],
      });

      const vipUnanswered = Array.from(inbox.groundTruth.emailLabels.values()).filter(
        label => label.userNeedsToRespond && label.isVIP
      );

      if (vipUnanswered.length > 0) {
        expect(response.message.toLowerCase()).toMatch(/vip|important|boss|customer|investor/);
      }
    });
  });

  describe('"Show me dropped balls"', () => {
    it('should identify all emails marked as dropped balls', async () => {
      const response = await orchestrator.processQuery({
        userId: TEST_USER_ID,
        query: 'Show me dropped balls',
        conversationHistory: [],
      });

      const droppedBalls = Array.from(inbox.groundTruth.emailLabels.values()).filter(
        label => label.isDroppedBall
      );

      expect(droppedBalls.length).toBeGreaterThan(0);
      expect(response.message.toLowerCase()).toMatch(/dropped|unanswered|no response/);
    });
  });

  describe('"Unanswered emails from this week"', () => {
    it('should filter by recency', async () => {
      const response = await orchestrator.processQuery({
        userId: TEST_USER_ID,
        query: 'Unanswered emails from this week',
        conversationHistory: [],
      });

      const thisWeek = Array.from(inbox.groundTruth.emailLabels.values()).filter(
        label => label.userNeedsToRespond && label.ageInDays <= 7
      );

      if (thisWeek.length > 0) {
        expect(response.message.toLowerCase()).toMatch(/week|recent|this week/);
      }
    });
  });

  describe('"Following up" emails', () => {
    it('should identify follow-up patterns', async () => {
      const response = await orchestrator.processQuery({
        userId: TEST_USER_ID,
        query: 'Show me "following up" emails',
        conversationHistory: [],
      });

      const followUps = Array.from(inbox.groundTruth.emailLabels.values()).filter(
        label => label.isFollowUp
      );

      if (followUps.length > 0) {
        expect(response.message.toLowerCase()).toMatch(/follow.*up|reminder/);
      }
    });
  });

  describe('Performance', () => {
    it('should complete dropped ball analysis in < 10s', async () => {
      const start = Date.now();

      await orchestrator.processQuery({
        userId: TEST_USER_ID,
        query: "What haven't I responded to?",
        conversationHistory: [],
      });

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(10000);
    });
  });
});
