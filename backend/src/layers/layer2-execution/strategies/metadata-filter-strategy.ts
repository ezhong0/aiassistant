/**
 * Metadata Filter Strategy
 *
 * Filters emails or calendar events using metadata/API filters only.
 * No LLM needed - pure API filtering.
 *
 * Use cases:
 * - Find unread emails
 * - Get emails from specific sender
 * - Find calendar events in time range
 * - Filter by labels, participants, etc.
 */

import { BaseStrategy } from './base-strategy';
import { NodeResult, MetadataFilterParams, MetadataFilterResult } from '../execution.types';
import { IEmailDomainService } from '../../../services/domain/interfaces/email-domain.interface';
import { ICalendarDomainService } from '../../../services/domain/interfaces/calendar-domain.interface';
import { Strategy, StrategyType } from '../strategy-metadata';

@Strategy({
  type: StrategyType.METADATA_FILTER,
  name: 'Metadata Filter',
  description: 'Filters emails/calendar events by metadata like date, sender, labels (no LLM needed)',
})
export class MetadataFilterStrategy extends BaseStrategy {
  readonly type = 'metadata_filter';

  constructor(
    private emailService: IEmailDomainService,
    private calendarService: ICalendarDomainService
  ) {
    super();
  }

  async execute(params: Record<string, unknown>, userId: string): Promise<NodeResult> {
    const filterParams = params as unknown as MetadataFilterParams;
    const nodeId = (params as any).node_id || 'metadata_filter';

    try {
      this.log('Executing metadata filter', {
        domain: filterParams.domain,
        maxResults: filterParams.max_results,
        timeRange: filterParams.time_range
      });

      let result: MetadataFilterResult;

      if (filterParams.domain === 'email') {
        result = await this.filterEmails(userId, filterParams);
      } else if (filterParams.domain === 'calendar') {
        result = await this.filterCalendar(userId, filterParams);
      } else {
        throw new Error(`Unsupported domain: ${filterParams.domain}`);
      }

      return this.createSuccessResult(nodeId, result, 0);
    } catch (error: any) {
      this.log('Error executing metadata filter', { error: error.message });
      return this.createErrorResult(nodeId, error.message);
    }
  }

  /**
   * Filter emails using Gmail search operators
   */
  private async filterEmails(
    userId: string,
    params: MetadataFilterParams
  ): Promise<MetadataFilterResult> {
    // Build Gmail query from filters
    const query = this.buildGmailQuery(params.filters, params.time_range);

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
   * Filter calendar events
   */
  private async filterCalendar(
    userId: string,
    params: MetadataFilterParams
  ): Promise<MetadataFilterResult> {
    // Parse time range
    const { timeMin, timeMax } = this.parseTimeRange(params.time_range);

    // Build query params
    const queryParams = {
      timeMin,
      timeMax,
      maxResults: params.max_results,
      singleEvents: true,
      orderBy: 'startTime' as const
    };

    // Get events
    const events = await this.calendarService.getEvents(userId, queryParams);

    // Apply additional filters if needed
    let filteredEvents = events;
    if (params.filters && params.filters.length > 0) {
      filteredEvents = this.applyCalendarFilters(events, params.filters);
    }

    // Format results
    return {
      count: filteredEvents.length,
      items: filteredEvents.map(event => ({
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
   * Build Gmail query string from filters and time range
   */
  /**
   * Normalize filters to fix common LLM mistakes
   */
  private normalizeFilter(filter: string): string | null {
    const trimmed = filter.trim();

    // Map of common LLM mistakes -> correct Gmail syntax
    const corrections: [RegExp, string][] = [
      // isRead=false -> is:unread
      [/^isRead\s*=\s*false$/i, 'is:unread'],
      [/^isRead\s*=\s*true$/i, 'is:read'],

      // sender: -> from:
      [/^sender:(.+)$/i, 'from:$1'],

      // date_range:7d -> newer_than:7d
      [/^date_range:(\d+)d$/i, 'newer_than:$1d'],

      // sent_by_me -> in:sent
      [/^sent_by_me$/i, 'in:sent'],
      [/^from_me$/i, 'in:sent'],

      // topic: or about: -> subject:
      [/^topic:(.+)$/i, 'subject:$1'],
      [/^about:(.+)$/i, 'subject:$1'],

      // Remove invalid filters that should be in synthesis
      [/^(sort_by|order_by|group_by):.*/i, ''], // Sorting/grouping goes to synthesis

      // Remove semantic filters that need strategies
      [/^(isUrgent|priority|urgency|requiresResponse|needsReply|senderType|sender_type).*/i, ''],
      [/^text_contains:.*/i, ''], // Should use keyword_search strategy
    ];

    // Apply corrections
    for (const [pattern, replacement] of corrections) {
      if (pattern.test(trimmed)) {
        const corrected = trimmed.replace(pattern, replacement);
        if (corrected && corrected !== trimmed) {
          this.log(`Normalized filter: "${trimmed}" -> "${corrected}"`);
        }
        return corrected || null;
      }
    }

    return trimmed;
  }

  private buildGmailQuery(filters: string[], timeRange: string): string {
    // Normalize and filter out invalid filters
    const normalizedFilters = filters
      .map(f => this.normalizeFilter(f))
      .filter((f): f is string => f !== null && f !== '');

    const parts: string[] = [...normalizedFilters];

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
    // Handle relative time ranges
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
      // Handle "last_7_days", "last_30_days", etc.
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
    let timeMax = now;

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
    } else if (timeRange.startsWith('next_')) {
      // Handle "next_7_days", "next_30_days", etc.
      const match = timeRange.match(/next_(\d+)_days?/);
      if (match && match[1]) {
        const days = parseInt(match[1]);
        timeMin = now;
        timeMax = new Date(now);
        timeMax.setDate(timeMax.getDate() + days);
      } else {
        timeMin = now;
        timeMax = new Date(now);
        timeMax.setDate(timeMax.getDate() + 7); // Default to 7 days
      }
    } else {
      // Default to next 7 days
      timeMin = now;
      timeMax = new Date(now);
      timeMax.setDate(timeMax.getDate() + 7);
    }

    return { timeMin, timeMax };
  }

  /**
   * Apply additional filters to calendar events
   */
  private applyCalendarFilters(events: any[], filters: string[]): any[] {
    let filtered = events;

    for (const filter of filters) {
      // Handle common calendar filters
      if (filter.includes('organizer:')) {
        const email = filter.replace('organizer:', '').trim();
        filtered = filtered.filter(e => e.organizer?.email === email);
      } else if (filter.includes('attendee:')) {
        const email = filter.replace('attendee:', '').trim();
        filtered = filtered.filter(e =>
          e.attendees?.some((a: any) => a.email === email)
        );
      } else if (filter.includes('location:')) {
        const location = filter.replace('location:', '').trim().toLowerCase();
        filtered = filtered.filter(e =>
          e.location?.toLowerCase().includes(location)
        );
      } else if (filter === 'has:attendees') {
        filtered = filtered.filter(e => e.attendees && e.attendees.length > 0);
      } else if (filter === 'has:location') {
        filtered = filtered.filter(e => e.location);
      }
    }

    return filtered;
  }
}
