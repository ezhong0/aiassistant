/**
 * E2E Test Suite: Commitment Tracking (3-Layer Architecture)
 *
 * Tests commitment detection and tracking using the 3-layer system:
 * - Layer 1: Decomposes commitment-related queries
 * - Layer 2: Executes semantic analysis to find promises/commitments
 * - Layer 3: Synthesizes commitment status report
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

describe('3-Layer: Commitment Tracking', () => {
  let mockManager: UnifiedMockManager;
  let container: AppContainer;
  let orchestrator: OrchestratorService;
  let inbox: GeneratedInbox;
  const TEST_USER_ID = 'test-user-e2e';

  beforeAll(async () => {
    inbox = await generateHyperRealisticInbox({
      persona: 'founder',
      emailCount: 50,
      includeDroppedBalls: true,
      includeOverdueCommitments: true, // Critical
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

  describe('"What did I promise to do?"', () => {
    it('should identify user commitments via semantic analysis', async () => {
      const response = await orchestrator.processQuery({
        userId: TEST_USER_ID,
        query: 'What did I promise to do?',
        conversationHistory: [],
      });

      const commitments = Array.from(inbox.groundTruth.emailLabels.values()).filter(
        label => label.containsCommitment && label.commitmentMadeBy === 'user'
      );

      if (commitments.length > 0) {
        expect(response.message.toLowerCase()).toMatch(/promise|commit|will|agreed to/);
      }
    });
  });

  describe('"Show me overdue commitments"', () => {
    it('should identify overdue promises', async () => {
      const response = await orchestrator.processQuery({
        userId: TEST_USER_ID,
        query: 'Show me overdue commitments',
        conversationHistory: [],
      });

      const overdue = Array.from(inbox.groundTruth.emailLabels.values()).filter(
        label => label.commitmentStatus === 'overdue'
      );

      if (overdue.length > 0) {
        expect(response.message.toLowerCase()).toMatch(/overdue|late|past|missed/);
      }
    });
  });

  describe('"What am I waiting on from others?"', () => {
    it('should identify commitments made BY others', async () => {
      const response = await orchestrator.processQuery({
        userId: TEST_USER_ID,
        query: 'What am I waiting on from others?',
        conversationHistory: [],
      });

      const othersCommitments = Array.from(inbox.groundTruth.emailLabels.values()).filter(
        label => label.containsCommitment && label.commitmentMadeBy === 'sender'
      );

      if (othersCommitments.length > 0) {
        expect(response.message.toLowerCase()).toMatch(/waiting|others|they said|promised/);
      }
    });
  });

  describe('Performance', () => {
    it('should complete commitment analysis in < 10s', async () => {
      const start = Date.now();

      await orchestrator.processQuery({
        userId: TEST_USER_ID,
        query: 'What did I promise to do?',
        conversationHistory: [],
      });

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(10000);
    });
  });
});
