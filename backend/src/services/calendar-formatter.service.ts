import { BaseService } from './base-service';
import { CALENDAR_SERVICE_CONSTANTS } from '../config/calendar-service-constants';
import logger from '../utils/logger';

/**
 * Calendar formatting result
 */
export interface CalendarFormattingResult {
  success: boolean;
  formattedMessage?: any;
  formattedText?: string;
  error?: string;
}

/**
 * Calendar result interface - Intent-agnostic
 * No hardcoded action strings - result content determines formatting
 */
export interface CalendarResult {
  event?: any;
  events?: any[];
  count?: number;
  summary?: string;
  start?: string;
  end?: string;
  location?: string;
  attendees?: string[];
  isAvailable?: boolean;
  conflictingEvents?: any[];
  availableSlots?: any[];
}

/**
 * CalendarFormatter - Focused service for calendar response formatting
 * Handles formatting of calendar results for user display
 */
export class CalendarFormatter extends BaseService {
  constructor() {
    super(CALENDAR_SERVICE_CONSTANTS.SERVICE_NAMES.CALENDAR_FORMATTER);
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing CalendarFormatter...');
      this.logInfo('CalendarFormatter initialized successfully');
    } catch (error) {
      this.handleError(error, 'onInitialize');
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.logInfo('Destroying CalendarFormatter...');
      this.logInfo('CalendarFormatter destroyed successfully');
    } catch (error) {
      this.logError('Error during CalendarFormatter destruction', error);
    }
  }

  /**
   * Format calendar result for Slack - Intent-agnostic formatting
   * No hardcoded action cases - formats based on result content
   */
  formatCalendarResult(result: CalendarResult): CalendarFormattingResult {
    try {
      let formattedText = '';

      // Format based on result content, not hardcoded action strings
      if (result.event && result.event.id) {
        // Single event result - format as event details
        formattedText = this.formatEventDetailsResult(result);
      } else if (result.events && result.events.length > 0) {
        // Multiple events result - format as event list
        formattedText = this.formatEventListResult(result);
      } else if (result.isAvailable !== undefined) {
        // Availability check result - format as availability status
        formattedText = this.formatAvailabilityResult(result);
      } else if (result.availableSlots && result.availableSlots.length > 0) {
        // Time slots result - format as available slots
        formattedText = this.formatTimeSlotsResult(result);
      } else if (result.count !== undefined) {
        // Operation completed with count - format as summary
        formattedText = this.formatCalendarSummaryResult(result);
      } else {
        // Generic success message
        formattedText = CALENDAR_SERVICE_CONSTANTS.SUCCESS.CALENDAR_OPERATION_COMPLETED;
      }

      const slackMessage = {
        text: formattedText,
        blocks: undefined
      };

      this.logInfo('Calendar result formatted successfully', {
        hasEvent: !!result.event,
        hasEvents: !!(result.events?.length),
        hasAvailability: result.isAvailable !== undefined,
        hasSlots: !!(result.availableSlots?.length),
        messageLength: formattedText.length
      });

      return {
        success: true,
        formattedMessage: slackMessage,
        formattedText
      };
    } catch (error) {
      this.logError('Error formatting calendar result', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : CALENDAR_SERVICE_CONSTANTS.ERRORS.UNKNOWN_ERROR
      };
    }
  }

  /**
   * Format event details result (create/update/get operations)
   */
  private formatEventDetailsResult(result: CalendarResult): string {
    const parts: string[] = [CALENDAR_SERVICE_CONSTANTS.FORMATTING.EVENT_CREATED_SUCCESS];
    
    if (result.event?.summary) {
      parts.push(`${CALENDAR_SERVICE_CONSTANTS.FORMATTING.EVENT_SUMMARY_LABEL} ${result.event.summary}`);
    }
    
    if (result.event?.start) {
      const startTime = this.formatEventTime(result.event.start);
      parts.push(`${CALENDAR_SERVICE_CONSTANTS.FORMATTING.EVENT_START_LABEL} ${startTime}`);
    }
    
    if (result.event?.end) {
      const endTime = this.formatEventTime(result.event.end);
      parts.push(`${CALENDAR_SERVICE_CONSTANTS.FORMATTING.EVENT_END_LABEL} ${endTime}`);
    }
    
    if (result.event?.location) {
      parts.push(`${CALENDAR_SERVICE_CONSTANTS.FORMATTING.EVENT_LOCATION_LABEL} ${result.event.location}`);
    }
    
    if (result.event?.attendees && result.event.attendees.length > 0) {
      const attendeeEmails = result.event.attendees.map((att: any) => att.email || att.displayName || 'Unknown').join(', ');
      parts.push(`${CALENDAR_SERVICE_CONSTANTS.FORMATTING.EVENT_ATTENDEES_LABEL} ${attendeeEmails}`);
    }
    
    if (result.event?.description) {
      parts.push(`${CALENDAR_SERVICE_CONSTANTS.FORMATTING.EVENT_DESCRIPTION_LABEL} ${result.event.description}`);
    }
    
    if (result.event?.id) {
      parts.push(`${CALENDAR_SERVICE_CONSTANTS.FORMATTING.EVENT_ID_LABEL} ${result.event.id}`);
    }

    return parts.join('\n');
  }

  /**
   * Format event list result (list operations)
   */
  private formatEventListResult(result: CalendarResult): string {
    const count = result.count || 0;
    const events = result.events || [];

    if (count === 0) {
      return CALENDAR_SERVICE_CONSTANTS.FORMATTING.NO_EVENTS_FOUND;
    }

    const parts = [`📅 **Found ${count} event${count === 1 ? '' : 's'}**`];
    
    if (events.length > 0) {
      // Show up to 5 most recent events
      const recentEvents = events.slice(0, CALENDAR_SERVICE_CONSTANTS.LIMITS.MAX_DISPLAY_EVENTS);
      recentEvents.forEach((event, index) => {
        if (event) {
          const summary = event.summary || CALENDAR_SERVICE_CONSTANTS.DEFAULTS.UNKNOWN_EVENT;
          const startTime = this.formatEventTime(event.start);
          
          parts.push(`${index + 1}. **${summary}**`);
          parts.push(`   📅 ${startTime}`);
          if (event.location) {
            parts.push(`   📍 ${event.location}`);
          }
          parts.push('');
        }
      });

      if (count > CALENDAR_SERVICE_CONSTANTS.LIMITS.MAX_DISPLAY_EVENTS) {
        parts.push(`... and ${count - CALENDAR_SERVICE_CONSTANTS.LIMITS.MAX_DISPLAY_EVENTS} more events`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Format availability check result
   */
  private formatAvailabilityResult(result: CalendarResult): string {
    const parts: string[] = [CALENDAR_SERVICE_CONSTANTS.FORMATTING.AVAILABILITY_HEADER];
    
    if (result.isAvailable) {
      parts.push('✅ **Time slot is available**');
    } else {
      parts.push('❌ **Time slot is not available**');
      
      if (result.conflictingEvents && result.conflictingEvents.length > 0) {
        parts.push(`\n**Conflicting events (${result.conflictingEvents.length}):**`);
        result.conflictingEvents.forEach((event, index) => {
          const summary = event.summary || CALENDAR_SERVICE_CONSTANTS.DEFAULTS.UNKNOWN_EVENT;
          const startTime = this.formatEventTime(event.start);
          parts.push(`${index + 1}. ${summary} - ${startTime}`);
        });
      }
    }

    return parts.join('\n');
  }

  /**
   * Format time slots result
   */
  private formatTimeSlotsResult(result: CalendarResult): string {
    const slots = result.availableSlots || [];
    
    if (slots.length === 0) {
      return CALENDAR_SERVICE_CONSTANTS.FORMATTING.NO_TIME_SLOTS;
    }

    const parts: string[] = [CALENDAR_SERVICE_CONSTANTS.FORMATTING.TIME_SLOTS_HEADER];
    parts.push(`\n**Found ${slots.length} available time slot${slots.length === 1 ? '' : 's'}:**`);
    
    slots.slice(0, 10).forEach((slot, index) => {
      const startTime = this.formatEventTime(slot.start);
      const endTime = this.formatEventTime(slot.end);
      parts.push(`${index + 1}. ${startTime} - ${endTime}`);
    });

    if (slots.length > 10) {
      parts.push(`\n... and ${slots.length - 10} more slots`);
    }

    return parts.join('\n');
  }

  /**
   * Format calendar summary result (operations with counts)
   */
  private formatCalendarSummaryResult(result: CalendarResult): string {
    const count = result.count || 0;
    return `✅ **Operation completed successfully** - ${count} event${count === 1 ? '' : 's'} processed.`;
  }

  /**
   * Format event time for display
   */
  private formatEventTime(timeData: any): string {
    try {
      if (timeData.dateTime) {
        // Full datetime
        const date = new Date(timeData.dateTime);
        return date.toLocaleString();
      } else if (timeData.date) {
        // Date only (all-day event)
        const date = new Date(timeData.date);
        return date.toLocaleDateString() + ' (All day)';
      } else if (typeof timeData === 'string') {
        // String timestamp
        const date = new Date(timeData);
        return date.toLocaleString();
      }
      return CALENDAR_SERVICE_CONSTANTS.DEFAULTS.UNKNOWN_EVENT;
    } catch (error) {
      return CALENDAR_SERVICE_CONSTANTS.DEFAULTS.UNKNOWN_EVENT;
    }
  }

  /**
   * Format error message
   */
  formatErrorMessage(error: Error, operation: string): CalendarFormattingResult {
    try {
      const errorMessage = `❌ **Calendar ${operation} failed**\n\n${error.message}`;
      
      return {
        success: true,
        formattedText: errorMessage
      };
    } catch (formatError) {
      return {
        success: false,
        error: 'Failed to format error message'
      };
    }
  }

  /**
   * Get formatter statistics
   */
  getFormatterStats(): {
    serviceName: string;
    supportedOperations: string[];
  } {
    return {
      serviceName: CALENDAR_SERVICE_CONSTANTS.SERVICE_NAMES.CALENDAR_FORMATTER,
      supportedOperations: Object.values(CALENDAR_SERVICE_CONSTANTS.CALENDAR_OPERATIONS)
    };
  }
}
