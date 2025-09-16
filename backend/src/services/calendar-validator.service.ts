import { BaseService } from './base-service';
import { CALENDAR_SERVICE_CONSTANTS } from '../config/calendar-service-constants';
import logger from '../utils/logger';

/**
 * Calendar validation result
 */
export interface CalendarValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Calendar event validation request
 */
export interface CalendarValidationRequest {
  summary?: string;
  description?: string;
  start?: string;
  end?: string;
  attendees?: string[];
  location?: string;
  duration?: number;
}

/**
 * CalendarValidator - Focused service for calendar event validation
 * Handles validation of calendar event data and permissions
 */
export class CalendarValidator extends BaseService {
  constructor() {
    super(CALENDAR_SERVICE_CONSTANTS.SERVICE_NAMES.CALENDAR_VALIDATOR);
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing CalendarValidator...');
      this.logInfo('CalendarValidator initialized successfully');
    } catch (error) {
      this.handleError(error, 'onInitialize');
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.logInfo('Destroying CalendarValidator...');
      this.logInfo('CalendarValidator destroyed successfully');
    } catch (error) {
      this.logError('Error during CalendarValidator destruction', error);
    }
  }

  /**
   * Validate calendar event data
   */
  validateEventData(request: CalendarValidationRequest): CalendarValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      this.logInfo('Validating calendar event data', {
        hasSummary: !!request.summary,
        hasStart: !!request.start,
        hasEnd: !!request.end,
        hasAttendees: !!(request.attendees?.length),
        hasLocation: !!request.location
      });

      // Validate required fields
      if (!request.summary || request.summary.trim().length === 0) {
        errors.push(CALENDAR_SERVICE_CONSTANTS.ERRORS.EVENT_SUMMARY_REQUIRED);
      }

      if (!request.start) {
        errors.push(CALENDAR_SERVICE_CONSTANTS.ERRORS.EVENT_START_TIME_REQUIRED);
      }

      if (!request.end) {
        errors.push(CALENDAR_SERVICE_CONSTANTS.ERRORS.EVENT_END_TIME_REQUIRED);
      }

      // Validate date formats and ranges
      if (request.start && request.end) {
        const startDate = new Date(request.start);
        const endDate = new Date(request.end);

        if (isNaN(startDate.getTime())) {
          errors.push(CALENDAR_SERVICE_CONSTANTS.ERRORS.INVALID_DATE_FORMAT);
        }

        if (isNaN(endDate.getTime())) {
          errors.push(CALENDAR_SERVICE_CONSTANTS.ERRORS.INVALID_DATE_FORMAT);
        }

        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          if (startDate >= endDate) {
            errors.push(CALENDAR_SERVICE_CONSTANTS.ERRORS.START_TIME_AFTER_END_TIME);
          }

          // Check duration limits
          const durationMs = endDate.getTime() - startDate.getTime();
          const durationMinutes = durationMs / (1000 * 60);
          const durationHours = durationMinutes / 60;

          if (durationHours > CALENDAR_SERVICE_CONSTANTS.DEFAULTS.MAX_EVENT_DURATION_HOURS) {
            errors.push(CALENDAR_SERVICE_CONSTANTS.ERRORS.EVENT_TOO_LONG);
          }

          if (durationMinutes < CALENDAR_SERVICE_CONSTANTS.DEFAULTS.MIN_EVENT_DURATION_MINUTES) {
            errors.push(CALENDAR_SERVICE_CONSTANTS.ERRORS.EVENT_TOO_SHORT);
          }
        }
      }

      // Validate attendees
      if (request.attendees && request.attendees.length > 0) {
        if (request.attendees.length > CALENDAR_SERVICE_CONSTANTS.DEFAULTS.MAX_ATTENDEES) {
          errors.push(CALENDAR_SERVICE_CONSTANTS.ERRORS.MAX_ATTENDEES_EXCEEDED);
        }

        // Validate email formats
        const invalidEmails = request.attendees.filter(email => !this.isValidEmailFormat(email));
        if (invalidEmails.length > 0) {
          errors.push(CALENDAR_SERVICE_CONSTANTS.ERRORS.INVALID_ATTENDEE_EMAIL);
        }
      }

      // Validate location
      if (request.location && request.location.length > CALENDAR_SERVICE_CONSTANTS.LIMITS.MAX_LOCATION_LENGTH) {
        warnings.push(`Location is very long (${request.location.length} characters). Consider shortening.`);
      }

      // Validate summary length
      if (request.summary && request.summary.length > CALENDAR_SERVICE_CONSTANTS.LIMITS.MAX_SUMMARY_LENGTH) {
        warnings.push(`Event summary is very long (${request.summary.length} characters). Consider shortening.`);
      }

      // Validate description length
      if (request.description && request.description.length > CALENDAR_SERVICE_CONSTANTS.LIMITS.MAX_DESCRIPTION_LENGTH) {
        warnings.push(`Event description is very long (${request.description.length} characters). Consider shortening.`);
      }

      const isValid = errors.length === 0;

      this.logInfo('Calendar event validation completed', {
        isValid,
        errorsCount: errors.length,
        warningsCount: warnings.length
      });

      return {
        isValid,
        errors,
        warnings
      };
    } catch (error) {
      this.logError('Error validating calendar event data', error);
      return {
        isValid: false,
        errors: [CALENDAR_SERVICE_CONSTANTS.ERRORS.VALIDATION_FAILED],
        warnings: []
      };
    }
  }

  /**
   * Validate event ID
   */
  validateEventId(eventId: string): CalendarValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (!eventId || eventId.trim().length === 0) {
        errors.push(CALENDAR_SERVICE_CONSTANTS.ERRORS.EVENT_ID_REQUIRED);
      }

      // Basic format validation for Google Calendar event IDs
      if (eventId && !/^[a-zA-Z0-9_-]+$/.test(eventId)) {
        warnings.push('Event ID format may be invalid');
      }

      const isValid = errors.length === 0;

      this.logInfo('Event ID validation completed', {
        isValid,
        eventId: eventId?.substring(0, 10) + '...'
      });

      return {
        isValid,
        errors,
        warnings
      };
    } catch (error) {
      this.logError('Error validating event ID', error);
      return {
        isValid: false,
        errors: [CALENDAR_SERVICE_CONSTANTS.ERRORS.VALIDATION_FAILED],
        warnings: []
      };
    }
  }

  /**
   * Validate access token
   */
  validateAccessToken(accessToken: string): CalendarValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (!accessToken || accessToken.trim().length === 0) {
        errors.push(CALENDAR_SERVICE_CONSTANTS.ERRORS.NO_ACCESS_TOKEN);
      }

      // Basic token format validation
      if (accessToken && accessToken.length < 10) {
        warnings.push('Access token appears to be too short');
      }

      const isValid = errors.length === 0;

      this.logInfo('Access token validation completed', {
        isValid,
        hasToken: !!accessToken
      });

      return {
        isValid,
        errors,
        warnings
      };
    } catch (error) {
      this.logError('Error validating access token', error);
      return {
        isValid: false,
        errors: [CALENDAR_SERVICE_CONSTANTS.ERRORS.VALIDATION_FAILED],
        warnings: []
      };
    }
  }

  /**
   * Validate calendar query options
   */
  validateQueryOptions(options: {
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
  }): CalendarValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate timeMin
      if (options.timeMin) {
        const timeMin = new Date(options.timeMin);
        if (isNaN(timeMin.getTime())) {
          errors.push('Invalid timeMin format');
        }
      }

      // Validate timeMax
      if (options.timeMax) {
        const timeMax = new Date(options.timeMax);
        if (isNaN(timeMax.getTime())) {
          errors.push('Invalid timeMax format');
        }
      }

      // Validate time range
      if (options.timeMin && options.timeMax) {
        const timeMin = new Date(options.timeMin);
        const timeMax = new Date(options.timeMax);
        
        if (!isNaN(timeMin.getTime()) && !isNaN(timeMax.getTime())) {
          if (timeMin >= timeMax) {
            errors.push('timeMin must be before timeMax');
          }
        }
      }

      // Validate maxResults
      if (options.maxResults !== undefined) {
        if (options.maxResults < 1) {
          errors.push('maxResults must be at least 1');
        }
        if (options.maxResults > 1000) {
          warnings.push('maxResults is very large, may impact performance');
        }
      }

      const isValid = errors.length === 0;

      this.logInfo('Query options validation completed', {
        isValid,
        errorsCount: errors.length,
        warningsCount: warnings.length
      });

      return {
        isValid,
        errors,
        warnings
      };
    } catch (error) {
      this.logError('Error validating query options', error);
      return {
        isValid: false,
        errors: [CALENDAR_SERVICE_CONSTANTS.ERRORS.VALIDATION_FAILED],
        warnings: []
      };
    }
  }

  /**
   * Check if email format is valid
   */
  private isValidEmailFormat(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get validator statistics
   */
  getValidatorStats(): {
    serviceName: string;
    supportedOperations: string[];
  } {
    return {
      serviceName: CALENDAR_SERVICE_CONSTANTS.SERVICE_NAMES.CALENDAR_VALIDATOR,
      supportedOperations: Object.values(CALENDAR_SERVICE_CONSTANTS.VALIDATION_TYPES)
    };
  }
}
