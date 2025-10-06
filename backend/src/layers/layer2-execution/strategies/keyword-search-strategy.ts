/**
 * Keyword Search Strategy
 *
 * Searches emails or calendar events using keyword patterns.
 * No LLM needed - uses Gmail/Calendar search operators.
 *
 * Use cases:
 * - Find emails containing specific keywords
 * - Search for calendar events by title/description
 * - Pattern matching across content
 */

import { BaseStrategy } from './base-strategy';
import { NodeResult, KeywordSearchParams, MetadataFilterResult } from '../execution.types';
import { IEmailDomainService } from '../../../services/domain/interfaces/email-domain.interface';
import { ICalendarDomainService } from '../../../services/domain/interfaces/calendar-domain.interface';
import { Strategy, StrategyType } from '../strategy-metadata';

@Strategy({
  type: StrategyType.KEYWORD_SEARCH,
  name: 'Keyword Search',
  description: 'Searches emails/documents using keyword matching and Gmail search syntax',
})
export class KeywordSearchStrategy extends BaseStrategy {
  readonly type = 'keyword_search';

  constructor(
    private emailService: IEmailDomainService,
    private calendarService: ICalendarDomainService
  ) {
    super();
  }

  async execute(params: Record<string, unknown>, userId: string): Promise<NodeResult> {
    const searchParams = params as unknown as KeywordSearchParams;
    const nodeId = (params as any).node_id || 'keyword_search';

    try {
      this.log('Executing keyword search', {
        domain: searchParams.domain,
        patterns: searchParams.patterns,
        maxResults: searchParams.max_results
      });

      let result: MetadataFilterResult;

      if (searchParams.domain === 'email') {
        result = await this.searchEmails(userId, searchParams);
      } else if (searchParams.domain === 'calendar') {
        result = await this.searchCalendar(userId, searchParams);
      } else {
        throw new Error(`Unsupported domain: ${searchParams.domain}`);
      }

      return this.createSuccessResult(nodeId, result, 0);
    } catch (error: any) {
      this.log('Error executing keyword search', { error: error.message });
      return this.createErrorResult(nodeId, error.message);
    }
  }

  /**
   * Search emails using keyword patterns
   */
  private async searchEmails(
    userId: string,
    params: KeywordSearchParams
  ): Promise<MetadataFilterResult> {
    // Build search query from patterns
    const query = this.buildEmailSearchQuery(params.patterns, params.time_range);

    // Search emails
    const emails = await this.emailService.searchEmails(userId, {
      query,
      maxResults: params.max_results,
      includeSpamTrash: false
    });

    // Format results
    return {
      count: emails.length,
      items: emails.map(email => ({
        id: email.id,
        from: email.from,
        subject: email.subject,
        date: email.date.toISOString(),
        snippet: email.snippet.substring(0, 200)
      })),
      metadata: {
        tokens_used: 0,
        llm_calls: 0
      }
    };
  }

  /**
   * Search calendar events using keyword patterns
   */
  private async searchCalendar(
    userId: string,
    params: KeywordSearchParams
  ): Promise<MetadataFilterResult> {
    // Parse time range
    const { timeMin, timeMax } = this.parseTimeRange(params.time_range);

    // For calendar, we search with each pattern and combine results
    const allEvents: any[] = [];
    const seenIds = new Set<string>();

    for (const pattern of params.patterns) {
      const events = await this.calendarService.getEvents(userId, {
        timeMin,
        timeMax,
        maxResults: params.max_results,
        query: pattern,
        singleEvents: true,
        orderBy: 'startTime' as const
      });

      // Deduplicate events
      for (const event of events) {
        if (!seenIds.has(event.id)) {
          seenIds.add(event.id);
          allEvents.push(event);
        }
      }
    }

    // Sort by start time and limit
    allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
    const limitedEvents = allEvents.slice(0, params.max_results);

    // Format results
    return {
      count: limitedEvents.length,
      items: limitedEvents.map(event => ({
        id: event.id,
        subject: event.summary,
        date: event.start.toISOString(),
        snippet: `${event.summary}${event.location ? ` @ ${event.location}` : ''}`
      })),
      metadata: {
        tokens_used: 0,
        llm_calls: 0
      }
    };
  }

  /**
   * Build Gmail search query from keyword patterns
   */
  private buildEmailSearchQuery(patterns: string[], timeRange: string): string {
    const parts: string[] = [];

    // Combine patterns with OR if multiple
    if (patterns.length > 0) {
      if (patterns.length === 1 && patterns[0]) {
        parts.push(patterns[0]);
      } else {
        // Group patterns with OR
        const patternQuery = patterns.map(p => {
          // If pattern contains spaces, wrap in quotes
          if (p.includes(' ') && !p.startsWith('"')) {
            return `"${p}"`;
          }
          return p;
        }).join(' OR ');
        parts.push(`(${patternQuery})`);
      }
    }

    // Add time range if specified
    if (timeRange) {
      const timeQuery = this.buildTimeRangeQuery(timeRange);
      if (timeQuery) {
        parts.push(timeQuery);
      }
    }

    return parts.join(' ');
  }

  /**
   * Build time range query for Gmail
   */
  private buildTimeRangeQuery(timeRange: string): string {
    const now = new Date();

    if (timeRange === 'today') {
      const date = now.toISOString().split('T')[0];
      return `after:${date}`;
    } else if (timeRange === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const date = yesterday.toISOString().split('T')[0];
      return `after:${date} before:${now.toISOString().split('T')[0]}`;
    } else if (timeRange === 'this_week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const date = weekAgo.toISOString().split('T')[0];
      return `after:${date}`;
    } else if (timeRange === 'this_month') {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      const date = monthAgo.toISOString().split('T')[0];
      return `after:${date}`;
    } else if (timeRange.startsWith('last_')) {
      const match = timeRange.match(/last_(\d+)_days?/);
      if (match && match[1]) {
        const days = parseInt(match[1]);
        const pastDate = new Date(now);
        pastDate.setDate(pastDate.getDate() - days);
        const date = pastDate.toISOString().split('T')[0];
        return `after:${date}`;
      }
    }

    // If it's an ISO date string, use it directly
    if (timeRange.match(/^\d{4}-\d{2}-\d{2}/)) {
      return `after:${timeRange.split('T')[0]}`;
    }

    return '';
  }

  /**
   * Parse time range into Date objects for calendar API
   */
  private parseTimeRange(timeRange: string): { timeMin: Date; timeMax: Date } {
    const now = new Date();
    let timeMin: Date;
    let timeMax = new Date(now);

    if (timeRange === 'today') {
      timeMin = new Date(now.setHours(0, 0, 0, 0));
      timeMax = new Date(now.setHours(23, 59, 59, 999));
    } else if (timeRange === 'tomorrow') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      timeMin = new Date(tomorrow.setHours(0, 0, 0, 0));
      timeMax = new Date(tomorrow.setHours(23, 59, 59, 999));
    } else if (timeRange === 'this_week') {
      timeMin = new Date(now.setDate(now.getDate() - now.getDay()));
      timeMin.setHours(0, 0, 0, 0);
      timeMax = new Date(timeMin);
      timeMax.setDate(timeMin.getDate() + 7);
    } else if (timeRange === 'next_week') {
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + (7 - nextWeek.getDay()));
      timeMin = new Date(nextWeek.setHours(0, 0, 0, 0));
      timeMax = new Date(timeMin);
      timeMax.setDate(timeMin.getDate() + 7);
    } else if (timeRange.startsWith('last_')) {
      const match = timeRange.match(/last_(\d+)_days?/);
      if (match && match[1]) {
        const days = parseInt(match[1]);
        timeMin = new Date(now);
        timeMin.setDate(timeMin.getDate() - days);
        timeMax = now;
      } else {
        timeMin = new Date(now);
        timeMin.setDate(timeMin.getDate() - 7);
        timeMax = now;
      }
    } else if (timeRange.startsWith('next_')) {
      const match = timeRange.match(/next_(\d+)_days?/);
      if (match && match[1]) {
        const days = parseInt(match[1]);
        timeMin = now;
        timeMax = new Date(now);
        timeMax.setDate(timeMax.getDate() + days);
      } else {
        timeMin = now;
        timeMax = new Date(now);
        timeMax.setDate(timeMax.getDate() + 7);
      }
    } else {
      // Default to last 30 days for search
      timeMin = new Date(now);
      timeMin.setDate(timeMin.getDate() - 30);
      timeMax = now;
    }

    return { timeMin, timeMax };
  }
}
