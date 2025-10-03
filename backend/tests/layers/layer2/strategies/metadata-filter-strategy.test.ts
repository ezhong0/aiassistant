/**
 * Tests for MetadataFilterStrategy
 */

import { MetadataFilterStrategy } from '../../../../src/layers/layer2-execution/strategies/metadata-filter-strategy';
import { IEmailDomainService } from '../../../../src/services/domain/interfaces/email-domain.interface';
import { ICalendarDomainService } from '../../../../src/services/domain/interfaces/calendar-domain.interface';

describe('MetadataFilterStrategy', () => {
  let strategy: MetadataFilterStrategy;
  let mockEmailService: jest.Mocked<IEmailDomainService>;
  let mockCalendarService: jest.Mocked<ICalendarDomainService>;

  beforeEach(() => {
    // Create mock email service
    mockEmailService = {
      searchEmails: jest.fn(),
    } as any;

    // Create mock calendar service
    mockCalendarService = {
      getEvents: jest.fn(),
    } as any;

    strategy = new MetadataFilterStrategy(mockEmailService, mockCalendarService);
  });

  describe('Email filtering', () => {
    it('should filter emails using Gmail search operators', async () => {
      const mockEmails = [
        {
          id: 'email1',
          threadId: 'thread1',
          from: 'sender@example.com',
          subject: 'Test Email',
          to: ['user@example.com'],
          date: new Date('2025-01-01'),
          snippet: 'This is a test email',
          labels: [],
          isUnread: true,
          hasAttachments: false,
        },
      ];

      mockEmailService.searchEmails.mockResolvedValue(mockEmails);

      const params = {
        domain: 'email' as const,
        filters: ['is:unread', 'from:sender@example.com'],
        max_results: 10,
        time_range: 'last_7_days',
        node_id: 'filter_node_1',
      };

      const result = await strategy.execute(params, 'user123');

      expect(result.success).toBe(true);
      expect(result.data?.count).toBe(1);
      expect(result.data?.items).toHaveLength(1);
      expect(result.data?.items[0].id).toBe('email1');
      expect(result.data?.metadata.tokens_used).toBe(0); // No LLM
      expect(result.data?.metadata.llm_calls).toBe(0);

      expect(mockEmailService.searchEmails).toHaveBeenCalledWith('user123', {
        query: expect.stringContaining('is:unread'),
        maxResults: 10,
        includeSpamTrash: false,
      });
    });

    it('should handle time range filters correctly', async () => {
      mockEmailService.searchEmails.mockResolvedValue([]);

      const params = {
        domain: 'email' as const,
        filters: [],
        max_results: 10,
        time_range: 'today',
        node_id: 'filter_node_2',
      };

      await strategy.execute(params, 'user123');

      expect(mockEmailService.searchEmails).toHaveBeenCalledWith('user123', {
        query: expect.stringContaining('after:'),
        maxResults: 10,
        includeSpamTrash: false,
      });
    });

    it('should handle empty results', async () => {
      mockEmailService.searchEmails.mockResolvedValue([]);

      const params = {
        domain: 'email' as const,
        filters: ['is:unread'],
        max_results: 10,
        time_range: 'this_week',
        node_id: 'filter_node_3',
      };

      const result = await strategy.execute(params, 'user123');

      expect(result.success).toBe(true);
      expect(result.data?.count).toBe(0);
      expect(result.data?.items).toHaveLength(0);
    });
  });

  describe('Calendar filtering', () => {
    it('should filter calendar events by time range', async () => {
      const mockEvents = [
        {
          id: 'event1',
          summary: 'Team Meeting',
          description: 'Weekly sync',
          start: new Date('2025-01-05T10:00:00Z'),
          end: new Date('2025-01-05T11:00:00Z'),
          location: 'Conference Room A',
          attendees: [],
          organizer: { email: 'organizer@example.com' },
          created: new Date(),
          updated: new Date(),
          status: 'confirmed' as const,
          visibility: 'default' as const,
          transparency: 'opaque' as const,
        },
      ];

      mockCalendarService.getEvents.mockResolvedValue(mockEvents);

      const params = {
        domain: 'calendar' as const,
        filters: [],
        max_results: 10,
        time_range: 'today',
        node_id: 'calendar_filter_1',
      };

      const result = await strategy.execute(params, 'user123');

      expect(result.success).toBe(true);
      expect(result.data?.count).toBe(1);
      expect(result.data?.items).toHaveLength(1);
      expect(result.data?.items[0].id).toBe('event1');
      expect(result.data?.items[0].subject).toBe('Team Meeting');
      expect(result.data?.metadata.tokens_used).toBe(0);
      expect(result.data?.metadata.llm_calls).toBe(0);
    });

    it('should apply calendar-specific filters', async () => {
      const mockEvents = [
        {
          id: 'event1',
          summary: 'Team Meeting',
          start: new Date('2025-01-05T10:00:00Z'),
          end: new Date('2025-01-05T11:00:00Z'),
          location: 'Conference Room A',
          attendees: [{ email: 'attendee@example.com', displayName: 'Attendee' }],
          organizer: { email: 'organizer@example.com' },
          created: new Date(),
          updated: new Date(),
          status: 'confirmed' as const,
          visibility: 'default' as const,
          transparency: 'opaque' as const,
        },
      ];

      mockCalendarService.getEvents.mockResolvedValue(mockEvents);

      const params = {
        domain: 'calendar' as const,
        filters: ['has:attendees'],
        max_results: 10,
        time_range: 'next_7_days',
        node_id: 'calendar_filter_2',
      };

      const result = await strategy.execute(params, 'user123');

      expect(result.success).toBe(true);
      expect(result.data?.count).toBe(1);
    });
  });

  describe('Error handling', () => {
    it('should handle email service errors gracefully', async () => {
      mockEmailService.searchEmails.mockRejectedValue(new Error('Gmail API error'));

      const params = {
        domain: 'email' as const,
        filters: ['is:unread'],
        max_results: 10,
        time_range: 'today',
        node_id: 'filter_error',
      };

      const result = await strategy.execute(params, 'user123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Gmail API error');
    });

    it('should handle invalid domain', async () => {
      const params = {
        domain: 'invalid' as any,
        filters: [],
        max_results: 10,
        time_range: 'today',
        node_id: 'invalid_domain',
      };

      const result = await strategy.execute(params, 'user123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported domain');
    });
  });
});
