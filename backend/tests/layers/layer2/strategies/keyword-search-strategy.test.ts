/**
 * Tests for KeywordSearchStrategy
 */

import { KeywordSearchStrategy } from '../../../../src/layers/layer2-execution/strategies/keyword-search-strategy';
import { IEmailDomainService } from '../../../../src/services/domain/interfaces/email-domain.interface';
import { ICalendarDomainService } from '../../../../src/services/domain/interfaces/calendar-domain.interface';

describe('KeywordSearchStrategy', () => {
  let strategy: KeywordSearchStrategy;
  let mockEmailService: jest.Mocked<IEmailDomainService>;
  let mockCalendarService: jest.Mocked<ICalendarDomainService>;

  beforeEach(() => {
    mockEmailService = {
      searchEmails: jest.fn(),
    } as any;

    mockCalendarService = {
      getEvents: jest.fn(),
    } as any;

    strategy = new KeywordSearchStrategy(mockEmailService, mockCalendarService);
  });

  describe('Email keyword search', () => {
    it('should search emails with single keyword', async () => {
      const mockEmails = [
        {
          id: 'email1',
          threadId: 'thread1',
          from: 'sender@example.com',
          subject: 'Project Update',
          to: ['user@example.com'],
          date: new Date('2025-01-01'),
          snippet: 'Here is the project update you requested',
          labels: [],
          isUnread: false,
          hasAttachments: false,
        },
      ];

      mockEmailService.searchEmails.mockResolvedValue(mockEmails);

      const params = {
        domain: 'email' as const,
        patterns: ['project update'],
        max_results: 10,
        time_range: 'this_week',
        node_id: 'search_1',
      };

      const result = await strategy.execute(params, 'user123');

      expect(result.success).toBe(true);
      expect(result.data?.count).toBe(1);
      expect(result.data?.items[0].subject).toBe('Project Update');
      expect(mockEmailService.searchEmails).toHaveBeenCalled();
    });

    it('should search with multiple keywords using OR', async () => {
      mockEmailService.searchEmails.mockResolvedValue([]);

      const params = {
        domain: 'email' as const,
        patterns: ['urgent', 'important', 'asap'],
        max_results: 20,
        time_range: 'last_7_days',
        node_id: 'search_2',
      };

      await strategy.execute(params, 'user123');

      const callArgs = mockEmailService.searchEmails.mock.calls[0][1];
      expect(callArgs.query).toContain('OR');
    });
  });

  describe('Calendar keyword search', () => {
    it('should search calendar events by keyword', async () => {
      const mockEvents = [
        {
          id: 'event1',
          summary: 'Team Standup',
          start: new Date('2025-01-05T09:00:00Z'),
          end: new Date('2025-01-05T09:30:00Z'),
          created: new Date(),
          updated: new Date(),
          status: 'confirmed' as const,
          visibility: 'default' as const,
          transparency: 'opaque' as const,
          organizer: { email: 'org@example.com' },
        },
      ];

      mockCalendarService.getEvents.mockResolvedValue(mockEvents);

      const params = {
        domain: 'calendar' as const,
        patterns: ['standup'],
        max_results: 10,
        time_range: 'today',
        node_id: 'calendar_search_1',
      };

      const result = await strategy.execute(params, 'user123');

      expect(result.success).toBe(true);
      expect(result.data?.count).toBe(1);
      expect(result.data?.items[0].subject).toBe('Team Standup');
    });

    it('should deduplicate events from multiple keyword searches', async () => {
      const mockEvent = {
        id: 'event1',
        summary: 'Important Meeting',
        start: new Date('2025-01-05T10:00:00Z'),
        end: new Date('2025-01-05T11:00:00Z'),
        created: new Date(),
        updated: new Date(),
        status: 'confirmed' as const,
        visibility: 'default' as const,
        transparency: 'opaque' as const,
        organizer: { email: 'org@example.com' },
      };

      // Return the same event for both keyword searches
      mockCalendarService.getEvents.mockResolvedValue([mockEvent]);

      const params = {
        domain: 'calendar' as const,
        patterns: ['important', 'meeting'],
        max_results: 10,
        time_range: 'next_7_days',
        node_id: 'calendar_search_2',
      };

      const result = await strategy.execute(params, 'user123');

      expect(result.success).toBe(true);
      expect(result.data?.count).toBe(1); // Should be deduplicated
    });
  });

  describe('Error handling', () => {
    it('should handle search errors', async () => {
      mockEmailService.searchEmails.mockRejectedValue(new Error('Search failed'));

      const params = {
        domain: 'email' as const,
        patterns: ['test'],
        max_results: 10,
        time_range: 'today',
        node_id: 'search_error',
      };

      const result = await strategy.execute(params, 'user123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Search failed');
    });
  });
});
