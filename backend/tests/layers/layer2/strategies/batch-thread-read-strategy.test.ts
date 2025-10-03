/**
 * Tests for BatchThreadReadStrategy
 */

import { BatchThreadReadStrategy } from '../../../../src/layers/layer2-execution/strategies/batch-thread-read-strategy';
import { IEmailDomainService } from '../../../../src/services/domain/interfaces/email-domain.interface';
import { IAIDomainService } from '../../../../src/services/domain/interfaces/ai-domain.interface';

describe('BatchThreadReadStrategy', () => {
  let strategy: BatchThreadReadStrategy;
  let mockEmailService: jest.Mocked<IEmailDomainService>;
  let mockAiService: jest.Mocked<IAIDomainService>;

  beforeEach(() => {
    mockEmailService = {
      getEmailThread: jest.fn(),
    } as any;

    mockAiService = {
      generateStructuredData: jest.fn(),
    } as any;

    strategy = new BatchThreadReadStrategy(mockEmailService, mockAiService);
  });

  describe('Thread analysis', () => {
    it('should analyze threads with bounded context per thread', async () => {
      const mockThread = {
        id: 'thread1',
        messages: [
          {
            id: 'msg1',
            from: 'sender@example.com',
            to: ['user@example.com'],
            subject: 'Project Update',
            date: new Date('2025-01-01'),
            snippet: 'Here is the project update',
            body: { text: 'Full project update content here' },
            labels: [],
          },
        ],
      };

      mockEmailService.getEmailThread.mockResolvedValue(mockThread);

      mockAiService.generateStructuredData.mockResolvedValue({
        last_sender: {
          name: 'sender@example.com',
          email: 'sender@example.com',
          timestamp: '2025-01-01T00:00:00Z',
          user_is_recipient: true,
        },
        context: 'Project update from sender',
      });

      const params = {
        thread_ids: ['thread1'],
        extract_fields: ['last_sender', 'context'],
        batch_size: 5,
        node_id: 'batch_thread_1',
      };

      const result = await strategy.execute(params, 'user123');

      expect(result.success).toBe(true);
      expect(result.data?.count).toBe(1);
      expect(result.data?.threads).toHaveLength(1);
      expect(result.data?.threads[0].thread_id).toBe('thread1');
      expect(result.data?.threads[0].context).toBe('Project update from sender');
      expect(mockEmailService.getEmailThread).toHaveBeenCalledWith('thread1');
      expect(mockAiService.generateStructuredData).toHaveBeenCalled();
    });

    it('should analyze 20 threads with bounded context', async () => {
      const mockThreads = Array.from({ length: 20 }, (_, i) => ({
        id: `thread${i}`,
        messages: [
          {
            id: `msg${i}`,
            from: `sender${i}@example.com`,
            to: ['user@example.com'],
            subject: `Subject ${i}`,
            date: new Date(),
            snippet: `Snippet ${i}`,
            body: { text: `Body ${i}` },
            labels: [],
          },
        ],
      }));

      mockEmailService.getEmailThread.mockImplementation(async (threadId: string) => {
        const index = parseInt(threadId.replace('thread', ''));
        return mockThreads[index];
      });

      mockAiService.generateStructuredData.mockResolvedValue({
        context: 'Thread context',
      });

      const params = {
        thread_ids: Array.from({ length: 20 }, (_, i) => `thread${i}`),
        extract_fields: ['context'],
        batch_size: 5,
        node_id: 'batch_thread_2',
      };

      const result = await strategy.execute(params, 'user123');

      expect(result.success).toBe(true);
      expect(result.data?.count).toBe(20);
      expect(result.data?.threads).toHaveLength(20);
      expect(result.data?.metadata.llm_calls).toBe(20); // One per thread
      expect(result.data?.metadata.tokens_used).toBeLessThan(50000); // Bounded
    });

    it('should process threads in batches', async () => {
      const mockThread = {
        id: 'thread1',
        messages: [
          {
            id: 'msg1',
            from: 'sender@example.com',
            to: ['user@example.com'],
            subject: 'Test',
            date: new Date(),
            snippet: 'Test',
            body: { text: 'Test body' },
            labels: [],
          },
        ],
      };

      mockEmailService.getEmailThread.mockResolvedValue(mockThread);
      mockAiService.generateStructuredData.mockResolvedValue({ context: 'Test' });

      const params = {
        thread_ids: ['thread1', 'thread2', 'thread3', 'thread4', 'thread5', 'thread6'],
        extract_fields: ['context'],
        batch_size: 2, // Small batch size
        node_id: 'batch_thread_3',
      };

      const result = await strategy.execute(params, 'user123');

      expect(result.success).toBe(true);
      expect(result.data?.count).toBe(6);
      // Should process in 3 batches of 2
    });
  });

  describe('Field extraction', () => {
    it('should extract waiting indicators', async () => {
      const mockThread = {
        id: 'thread1',
        messages: [
          {
            id: 'msg1',
            from: 'sender@example.com',
            to: ['user@example.com'],
            subject: 'Following up',
            date: new Date(),
            snippet: 'Just following up on my previous email',
            body: { text: 'Just following up on my previous email. Any update?' },
            labels: [],
          },
        ],
      };

      mockEmailService.getEmailThread.mockResolvedValue(mockThread);

      mockAiService.generateStructuredData.mockResolvedValue({
        waiting_indicators: {
          present: true,
          phrases_found: ['following up', 'any update'],
          follow_up_count: 1,
        },
        context: 'Follow-up message',
      });

      const params = {
        thread_ids: ['thread1'],
        extract_fields: ['waiting_indicators', 'context'],
        batch_size: 5,
        node_id: 'batch_thread_4',
      };

      const result = await strategy.execute(params, 'user123');

      expect(result.success).toBe(true);
      expect(result.data?.threads[0].waiting_indicators?.present).toBe(true);
      expect(result.data?.threads[0].waiting_indicators?.phrases_found).toContain('following up');
    });

    it('should extract urgency signals', async () => {
      const mockThread = {
        id: 'thread1',
        messages: [
          {
            id: 'msg1',
            from: 'sender@example.com',
            to: ['user@example.com'],
            subject: 'URGENT: Need response ASAP',
            date: new Date(),
            snippet: 'This is urgent',
            body: { text: 'This is urgent. Need your response ASAP by end of day.' },
            labels: [],
          },
        ],
      };

      mockEmailService.getEmailThread.mockResolvedValue(mockThread);

      mockAiService.generateStructuredData.mockResolvedValue({
        urgency_signals: {
          level: 'high',
          evidence: ['URGENT', 'ASAP', 'end of day'],
          deadline_mentioned: 'end of day',
        },
        context: 'Urgent request',
      });

      const params = {
        thread_ids: ['thread1'],
        extract_fields: ['urgency_signals', 'context'],
        batch_size: 5,
        node_id: 'batch_thread_5',
      };

      const result = await strategy.execute(params, 'user123');

      expect(result.success).toBe(true);
      expect(result.data?.threads[0].urgency_signals?.level).toBe('high');
      expect(result.data?.threads[0].urgency_signals?.evidence).toContain('URGENT');
    });
  });

  describe('Error handling', () => {
    it('should handle thread fetch errors gracefully', async () => {
      mockEmailService.getEmailThread.mockRejectedValue(new Error('Thread not found'));

      const params = {
        thread_ids: ['thread1'],
        extract_fields: ['context'],
        batch_size: 5,
        node_id: 'batch_thread_error',
      };

      const result = await strategy.execute(params, 'user123');

      expect(result.success).toBe(true); // Still succeeds
      expect(result.data?.threads[0].context).toContain('Error analyzing thread');
    });

    it('should handle AI service errors', async () => {
      const mockThread = {
        id: 'thread1',
        messages: [
          {
            id: 'msg1',
            from: 'sender@example.com',
            to: ['user@example.com'],
            subject: 'Test',
            date: new Date(),
            snippet: 'Test',
            body: { text: 'Test' },
            labels: [],
          },
        ],
      };

      mockEmailService.getEmailThread.mockResolvedValue(mockThread);
      mockAiService.generateStructuredData.mockRejectedValue(new Error('AI service error'));

      const params = {
        thread_ids: ['thread1'],
        extract_fields: ['context'],
        batch_size: 5,
        node_id: 'batch_thread_ai_error',
      };

      const result = await strategy.execute(params, 'user123');

      expect(result.success).toBe(true);
      expect(result.data?.threads[0].context).toContain('Error analyzing thread');
    });
  });

  describe('Token usage', () => {
    it('should keep output under 500 tokens per thread', async () => {
      const mockThread = {
        id: 'thread1',
        messages: [
          {
            id: 'msg1',
            from: 'sender@example.com',
            to: ['user@example.com'],
            subject: 'Test',
            date: new Date(),
            snippet: 'Test',
            body: { text: 'Test body' },
            labels: [],
          },
        ],
      };

      mockEmailService.getEmailThread.mockResolvedValue(mockThread);
      mockAiService.generateStructuredData.mockResolvedValue({
        context: 'Short context summary',
      });

      const params = {
        thread_ids: ['thread1'],
        extract_fields: ['context'],
        batch_size: 5,
        node_id: 'batch_thread_tokens',
      };

      const result = await strategy.execute(params, 'user123');

      expect(result.success).toBe(true);
      // Each thread should use roughly input + 500 tokens output
      const avgTokensPerThread = result.data!.metadata.tokens_used / result.data!.threads.length;
      expect(avgTokensPerThread).toBeLessThan(3000); // Reasonable bound
    });
  });
});
