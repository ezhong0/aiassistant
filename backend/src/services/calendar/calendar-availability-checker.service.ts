import { BaseService } from '../base-service';
import { ServiceManager } from '../service-manager';
import { CalendarService, CalendarQueryOptions } from './calendar.service';
import { CALENDAR_SERVICE_CONSTANTS } from '../../config/calendar-service-constants';
import logger from '../../utils/logger';

/**
 * Availability check result
 */
export interface AvailabilityCheckResult {
  success: boolean;
  isAvailable?: boolean;
  conflictingEvents?: any[];
  availableSlots?: TimeSlot[];
  error?: string;
}

/**
 * Time slot for availability
 */
export interface TimeSlot {
  start: string;
  end: string;
  duration: number; // in minutes
}

/**
 * CalendarAvailabilityChecker - Focused service for calendar availability operations
 * Handles availability checking and time slot finding
 */
export class CalendarAvailabilityChecker extends BaseService {
  private calendarService: CalendarService | null = null;

  constructor() {
    super(CALENDAR_SERVICE_CONSTANTS.SERVICE_NAMES.CALENDAR_AVAILABILITY_CHECKER);
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing CalendarAvailabilityChecker...');
      const serviceManager = ServiceManager.getInstance();
      this.calendarService = serviceManager.getService(CALENDAR_SERVICE_CONSTANTS.SERVICE_NAMES.CALENDAR_SERVICE) as CalendarService;
      if (!this.calendarService) {
        throw new Error(CALENDAR_SERVICE_CONSTANTS.ERRORS.CALENDAR_SERVICE_NOT_AVAILABLE);
      }
      this.logInfo('CalendarAvailabilityChecker initialized successfully');
    } catch (error) {
      this.handleError(error, 'onInitialize');
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.logInfo('Destroying CalendarAvailabilityChecker...');
      this.calendarService = null;
      this.logInfo('CalendarAvailabilityChecker destroyed successfully');
    } catch (error) {
      this.logError('Error during CalendarAvailabilityChecker destruction', error);
    }
  }

  /**
   * Check if a specific time slot is available
   */
  async checkAvailability(
    startTime: string,
    endTime: string,
    accessToken: string,
    calendarId: string = 'primary'
  ): Promise<AvailabilityCheckResult> {
    try {
      if (!this.calendarService) {
        throw new Error(CALENDAR_SERVICE_CONSTANTS.ERRORS.CALENDAR_SERVICE_NOT_AVAILABLE);
      }

      this.logInfo('Checking calendar availability', {
        startTime,
        endTime,
        calendarId
      });

      // Get events in the time range
      const options: CalendarQueryOptions = {
        timeMin: startTime,
        timeMax: endTime,
        maxResults: 100
      };

      const events = await this.calendarService.getEvents(accessToken, options, calendarId);
      
      // Filter out events that actually conflict
      const conflictingEvents = events.filter(event => {
        const eventStart = new Date(event.start?.dateTime || event.start?.date || '');
        const eventEnd = new Date(event.end?.dateTime || event.end?.date || '');
        const checkStart = new Date(startTime);
        const checkEnd = new Date(endTime);

        // Check for overlap
        return (eventStart < checkEnd && eventEnd > checkStart);
      });

      const isAvailable = conflictingEvents.length === 0;

      this.logInfo('Availability check completed', {
        isAvailable,
        conflictingEventsCount: conflictingEvents.length
      });

      return {
        success: true,
        isAvailable,
        conflictingEvents
      };
    } catch (error) {
      this.logError('Error checking availability', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : CALENDAR_SERVICE_CONSTANTS.ERRORS.AVAILABILITY_CHECK_FAILED
      };
    }
  }

  /**
   * Find available time slots within a date range
   */
  async findAvailableSlots(
    startDate: string,
    endDate: string,
    durationMinutes: number,
    accessToken: string,
    calendarId: string = 'primary',
    workingHours: { start: string; end: string } = { start: '09:00', end: '17:00' }
  ): Promise<AvailabilityCheckResult> {
    try {
      if (!this.calendarService) {
        throw new Error(CALENDAR_SERVICE_CONSTANTS.ERRORS.CALENDAR_SERVICE_NOT_AVAILABLE);
      }

      this.logInfo('Finding available time slots', {
        startDate,
        endDate,
        durationMinutes,
        workingHours
      });

      // Get all events in the date range
      const options: CalendarQueryOptions = {
        timeMin: startDate,
        timeMax: endDate,
        maxResults: 1000
      };

      const events = await this.calendarService.getEvents(accessToken, options, calendarId);
      
      // Convert events to time ranges
      const busySlots = events.map(event => ({
        start: new Date(event.start?.dateTime || event.start?.date || ''),
        end: new Date(event.end?.dateTime || event.end?.date || '')
      })).sort((a, b) => a.start.getTime() - b.start.getTime());

      // Generate available slots
      const availableSlots = this.generateAvailableSlots(
        new Date(startDate),
        new Date(endDate),
        durationMinutes || 30,
        busySlots,
        workingHours
      );

      this.logInfo('Available slots found', {
        slotsCount: availableSlots.length,
        durationMinutes
      });

      return {
        success: true,
        availableSlots
      };
    } catch (error) {
      this.logError('Error finding available slots', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : CALENDAR_SERVICE_CONSTANTS.ERRORS.TIME_SLOT_SEARCH_FAILED
      };
    }
  }

  /**
   * Generate available time slots based on busy periods and working hours
   */
  private generateAvailableSlots(
    startDate: Date,
    endDate: Date,
    durationMinutes: number,
    busySlots: { start: Date; end: Date }[],
    workingHours: { start: string; end: string }
  ): TimeSlot[] {
    const availableSlots: TimeSlot[] = [];
    const currentDate = new Date(startDate);

    while (currentDate < endDate) {
      const dayStart = new Date(currentDate);
      const dayEnd = new Date(currentDate);
      
      // Set working hours for the day
      const [startHour, startMinute] = workingHours.start.split(':').map(Number);
      const [endHour, endMinute] = workingHours.end.split(':').map(Number);
      
      dayStart.setHours(startHour || 9, startMinute || 0, 0, 0);
      dayEnd.setHours(endHour || 17, endMinute || 0, 0, 0);

      // Get busy slots for this day
      const dayBusySlots = busySlots.filter(slot => 
        slot.start.toDateString() === currentDate.toDateString()
      );

      // Find gaps between busy slots
      let currentTime = new Date(dayStart);
      
      for (const busySlot of dayBusySlots) {
        // Check if there's a gap before this busy slot
        if (currentTime < busySlot.start) {
          const gapDuration = (busySlot.start.getTime() - currentTime.getTime()) / (1000 * 60);
          if (gapDuration >= durationMinutes) {
            const slotEnd = new Date(currentTime.getTime() + durationMinutes * 60 * 1000);
            availableSlots.push({
              start: currentTime.toISOString(),
              end: slotEnd.toISOString(),
              duration: durationMinutes
            });
          }
        }
        currentTime = new Date(Math.max(currentTime.getTime(), busySlot.end.getTime()));
      }

      // Check if there's time after the last busy slot
      if (currentTime < dayEnd) {
        const remainingDuration = (dayEnd.getTime() - currentTime.getTime()) / (1000 * 60);
        if (remainingDuration >= durationMinutes) {
          const slotEnd = new Date(currentTime.getTime() + durationMinutes * 60 * 1000);
          availableSlots.push({
            start: currentTime.toISOString(),
            end: slotEnd.toISOString(),
            duration: durationMinutes
          });
        }
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return availableSlots;
  }

  /**
   * Get service statistics
   */
  getCheckerStats(): {
    serviceName: string;
    supportedOperations: string[];
  } {
    return {
      serviceName: CALENDAR_SERVICE_CONSTANTS.SERVICE_NAMES.CALENDAR_AVAILABILITY_CHECKER,
      supportedOperations: ['check_availability', 'find_slots']
    };
  }
}
