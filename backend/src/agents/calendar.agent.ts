import { ToolExecutionContext } from '../types/tools';
import { AIAgent } from '../framework/ai-agent';
import { ActionPreview, PreviewGenerationResult, CalendarPreviewData, ActionRiskAssessment } from '../types/api.types';
import { CalendarService, CalendarEvent } from '../services/calendar.service';
import { getService } from '../services/service-manager';

export interface CalendarAgentRequest {
  action: 'create' | 'list' | 'update' | 'delete' | 'check_availability' | 'find_slots';
  summary?: string;
  description?: string;
  start?: string;
  end?: string;
  attendees?: string[];
  location?: string;
  eventId?: string;
  timeMin?: string;
  timeMax?: string;
  duration?: number;
  query?: string;
  accessToken: string;
  calendarId?: string;
}

export interface CalendarAgentResponse {
  success: boolean;
  message: string;
  data?: {
    events?: any[];
    event?: any;
    availability?: {
      busy: boolean;
      conflicts: any[];
    };
    slots?: Array<{ start: string; end: string }>;
  };
  error?: string;
}

/**
 * Calendar Agent - Manages calendar events and scheduling
 * Integrates with Google Calendar API for comprehensive calendar management with AI planning
 */
export class CalendarAgent extends AIAgent<CalendarAgentRequest, CalendarAgentResponse> {
  
  constructor() {
    super({
      name: 'calendarAgent',
      description: 'Create, update, and manage calendar events and scheduling',
      enabled: true,
      timeout: 30000,
      retryCount: 2,
      aiPlanning: {
        enableAIPlanning: true, // Enable AI planning for complex calendar operations
        maxPlanningSteps: 8,
        planningTimeout: 25000,
        cachePlans: true,
        planningTemperature: 0.1,
        planningMaxTokens: 2000
      }
    });
  }

  private readonly systemPrompt = `# Calendar Agent
You are a specialized calendar agent that handles all calendar and scheduling operations.

## Capabilities
- Create calendar events and meetings with attendees
- Schedule appointments and check availability
- Update and delete existing calendar events
- Search for available time slots
- List upcoming calendar events
- Manage meeting locations and descriptions

## Input Processing
You receive structured requests for calendar operations and execute them using Google Calendar API.

## Response Format
Always return structured execution status with event details and confirmation.`;

  /**
   * Core calendar processing logic with AI planning support
   */
  protected async processQuery(parameters: CalendarAgentRequest, context: ToolExecutionContext): Promise<CalendarAgentResponse> {
    // Try AI planning first if enabled and suitable
    if (this.aiConfig.enableAIPlanning && this.canUseAIPlanning(parameters)) {
      try {
        this.logger.info('Attempting AI-driven calendar execution', {
          agent: this.config.name,
          sessionId: context.sessionId
        });

        const aiResult = await this.executeWithAIPlanning(parameters, context);
        
        this.logger.info('AI-driven calendar execution completed', {
          agent: this.config.name,
          sessionId: context.sessionId
        });
        
        return aiResult;

      } catch (error) {
        this.logAIPlanningFallback(error as Error, 'planning_failed', context);

        // Fall back to manual implementation
        return this.executeManually(parameters, context);
      }
    }

    // Use manual implementation
    const reason = this.aiConfig.enableAIPlanning ? 'AI planning not suitable for this query' : 'AI planning disabled';
    this.logAIPlanningFallback(
      new Error(reason), 
      this.aiConfig.enableAIPlanning ? 'unsuitable_query' : 'service_unavailable', 
      context
    );

    return this.executeManually(parameters, context);
  }

  /**
   * Manual execution fallback - traditional calendar logic
   */
  protected async executeManually(parameters: CalendarAgentRequest, context: ToolExecutionContext): Promise<CalendarAgentResponse> {
    try {
      this.logger.info('Calendar agent execution', { 
        action: parameters.action,
        sessionId: context.sessionId
      });

      // Get calendar service from service registry
      const calendarService = getService<CalendarService>('calendarService');
      if (!calendarService) {
        throw this.createError('Calendar service not available', 'SERVICE_UNAVAILABLE');
      }

      // Route to appropriate action
      switch (parameters.action) {
        case 'create':
          return await this.createEvent(parameters, calendarService);
        case 'list':
          return await this.listEvents(parameters, calendarService);
        case 'update':
          return await this.updateEvent(parameters, calendarService);
        case 'delete':
          return await this.deleteEvent(parameters, calendarService);
        case 'check_availability':
          return await this.checkAvailability(parameters, calendarService);
        case 'find_slots':
          return await this.findAvailableSlots(parameters, calendarService);
        default:
          throw this.createError(`Unknown calendar action: ${parameters.action}`, 'INVALID_ACTION');
      }

    } catch (error) {
      this.logger.error('Calendar agent execution failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Calendar operation failed',
        error: error instanceof Error ? error.message : 'CALENDAR_ERROR'
      };
    }
  }

  /**
   * Build final result from AI planning execution
   */
  protected buildFinalResult(
    summary: any,
    successfulResults: any[],
    failedResults: any[],
    params: CalendarAgentRequest,
    _context: ToolExecutionContext
  ): CalendarAgentResponse {
    // For calendar operations, we typically want the first successful result
    if (successfulResults.length > 0) {
      return successfulResults[0] as CalendarAgentResponse;
    }

    // If no successful results, create a summary result
    return {
      success: failedResults.length === 0,
      message: failedResults.length > 0 ? 'Some calendar operations failed' : 'Calendar operations completed',
      data: { events: [] }
    };
  }

  /**
   * Enhanced operation detection for calendar agent
   */
  protected detectOperation(params: CalendarAgentRequest): string {
    const { query, action } = params;
    
    // If action is explicitly provided, use it
    if (action) {
      return action;
    }
    
    // Otherwise, detect from query
    if (query) {
      const lowerQuery = query.toLowerCase();
      
      // Check for specific calendar operations
      if (lowerQuery.includes('create') || lowerQuery.includes('schedule') || lowerQuery.includes('book')) {
        return 'create';
      }
      
      if (lowerQuery.includes('update') || lowerQuery.includes('modify') || lowerQuery.includes('change')) {
        return 'update';
      }
      
      if (lowerQuery.includes('delete') || lowerQuery.includes('cancel') || lowerQuery.includes('remove')) {
        return 'delete';
      }
      
      if (lowerQuery.includes('list') || lowerQuery.includes('show') || lowerQuery.includes('display')) {
        return 'list';
      }
      
      if (lowerQuery.includes('check') || lowerQuery.includes('availability')) {
        return 'check';
      }
      
      if (lowerQuery.includes('find') || lowerQuery.includes('slot')) {
        return 'find';
      }
    }
    
    // Default to list for read operations
    return 'list';
  }

  /**
   * Generate detailed calendar action preview with conflict detection
   */
  protected async generatePreview(params: CalendarAgentRequest, context: ToolExecutionContext): Promise<PreviewGenerationResult> {
    try {
      const { query } = params;
      
      // Use enhanced operation detection
      const operation = this.detectOperation(params);
      
      // Check if this operation actually needs confirmation
      const needsConfirmation = this.operationRequiresConfirmation(operation);
      
      if (!needsConfirmation) {
        this.logger.info('Calendar operation does not require confirmation', {
          operation,
          reason: this.getOperationConfirmationReason(operation)
        });
        return {
          success: true,
          fallbackMessage: `${operation} operation does not require confirmation`
        };
      }
      
      // Generate action ID
      const actionId = `calendar-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      let previewData: CalendarPreviewData;
      let riskAssessment: ActionRiskAssessment;
      let title: string;
      let description: string;
      
      switch (operation) {
        case 'create':
          previewData = await this.generateCreateEventPreview(params);
          riskAssessment = this.assessCalendarRisk(params, previewData);
          title = `Create Event: ${params.summary || 'New Meeting'}`;
          description = `Create calendar event "${params.summary}" on ${this.formatDate(params.start)}`;
          break;
          
        case 'update':
          previewData = await this.generateUpdateEventPreview(params);
          riskAssessment = this.assessCalendarRisk(params, previewData);
          title = `Update Event: ${params.summary || 'Meeting'}`;
          description = `Update calendar event "${params.summary}"`;
          break;
          
        case 'delete':
          previewData = await this.generateDeleteEventPreview(params);
          riskAssessment = { level: 'high', factors: ['Event deletion is irreversible'] };
          title = `Delete Event`;
          description = `Delete calendar event`;
          break;
          
        default:
          // This should not happen since we check needsConfirmation above
          return {
            success: true,
            fallbackMessage: `${operation} operation does not require confirmation`
          };
      }
      
      const preview: ActionPreview = {
        actionId,
        actionType: 'calendar',
        title,
        description,
        riskAssessment,
        estimatedExecutionTime: this.estimateExecutionTime(operation),
        reversible: operation === 'create', // Only creation is somewhat reversible (can be deleted)
        requiresConfirmation: true,
        awaitingConfirmation: true,
        previewData,
        originalQuery: query || `${operation} calendar event`,
        parameters: params as unknown as Record<string, unknown>
      };
      
      this.logger.info('Calendar preview generated', {
        actionId,
        operation,
        eventTitle: params.summary,
        attendeeCount: previewData.attendeeCount || 0,
        riskLevel: riskAssessment.level,
        conflicts: previewData.conflicts?.length || 0
      });
      
      return {
        success: true,
        preview
      };
      
    } catch (error) {
      this.logger.error('Failed to generate calendar preview', {
        error: error instanceof Error ? error.message : error,
        action: params.action,
        sessionId: context.sessionId
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate calendar preview',
        fallbackMessage: `Calendar operation requires confirmation: ${params.action}`
      };
    }
  }

  /**
   * Generate preview data for event creation
   */
  private async generateCreateEventPreview(params: CalendarAgentRequest): Promise<CalendarPreviewData> {
    const startTime = params.start || new Date().toISOString();
    const endTime = params.end || new Date(Date.now() + 3600000).toISOString(); // Default 1 hour
    
    const conflicts = await this.detectSchedulingConflicts(params);
    const duration = this.calculateDuration(startTime, endTime);
    
    return {
      title: params.summary || 'New Meeting',
      startTime,
      endTime,
      duration,
      attendees: params.attendees,
      location: params.location,
      timeZone: 'America/Los_Angeles', // TODO: Make configurable
      attendeeCount: params.attendees?.length || 0,
      conflicts: conflicts.length > 0 ? conflicts : undefined
    };
  }

  /**
   * Generate preview data for event update
   */
  private async generateUpdateEventPreview(params: CalendarAgentRequest): Promise<CalendarPreviewData> {
    // For updates, we use the provided data or existing event data
    const startTime = params.start || new Date().toISOString();
    const endTime = params.end || new Date(Date.now() + 3600000).toISOString();
    
    const conflicts = await this.detectSchedulingConflicts(params);
    const duration = this.calculateDuration(startTime, endTime);
    
    return {
      title: params.summary || 'Updated Meeting',
      startTime,
      endTime,
      duration,
      attendees: params.attendees,
      location: params.location,
      timeZone: 'America/Los_Angeles',
      attendeeCount: params.attendees?.length || 0,
      conflicts: conflicts.length > 0 ? conflicts : undefined
    };
  }

  /**
   * Generate preview data for event deletion
   */
  private async generateDeleteEventPreview(params: CalendarAgentRequest): Promise<CalendarPreviewData> {
    return {
      title: 'Event to be deleted',
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      duration: '0 minutes',
      attendeeCount: 0,
      conflicts: [{
        conflictType: 'time_overlap',
        details: 'This action will permanently delete the event',
        severity: 'high'
      }]
    };
  }

  /**
   * Detect potential scheduling conflicts
   */
  private async detectSchedulingConflicts(params: CalendarAgentRequest): Promise<Array<{
    conflictType: 'time_overlap' | 'busy_attendee' | 'resource_conflict';
    details: string;
    severity: 'low' | 'medium' | 'high';
  }>> {
    const conflicts: Array<{
      conflictType: 'time_overlap' | 'busy_attendee' | 'resource_conflict';
      details: string;
      severity: 'low' | 'medium' | 'high';
    }> = [];
    
    // Check for weekend scheduling
    if (params.start) {
      const startDate = new Date(params.start);
      const dayOfWeek = startDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        conflicts.push({
          conflictType: 'time_overlap',
          details: 'Event is scheduled for weekend',
          severity: 'low'
        });
      }
    }
    
    // Check for late hours
    if (params.start) {
      const startDate = new Date(params.start);
      const hour = startDate.getHours();
      if (hour < 8 || hour > 18) {
        conflicts.push({
          conflictType: 'time_overlap',
          details: 'Event is scheduled outside business hours',
          severity: 'medium'
        });
      }
    }
    
    // Check for large attendee list
    if (params.attendees && params.attendees.length > 10) {
      conflicts.push({
        conflictType: 'busy_attendee',
        details: `Large number of attendees (${params.attendees.length})`,
        severity: 'medium'
      });
    }
    
    // Check for missing location for in-person meetings
    if (params.attendees && params.attendees.length > 1 && !params.location) {
      conflicts.push({
        conflictType: 'resource_conflict',
        details: 'No location specified for multi-attendee meeting',
        severity: 'low'
      });
    }
    
    return conflicts;
  }

  /**
   * Assess risk level for calendar operation
   */
  private assessCalendarRisk(params: CalendarAgentRequest, previewData: CalendarPreviewData): ActionRiskAssessment {
    const factors: string[] = [];
    const warnings: string[] = [];
    let level: 'low' | 'medium' | 'high' = 'low';
    
    // Check for conflicts
    if (previewData.conflicts && previewData.conflicts.length > 0) {
      factors.push('Scheduling conflicts detected');
      const highSeverityConflicts = previewData.conflicts.filter(c => c.severity === 'high');
      const mediumSeverityConflicts = previewData.conflicts.filter(c => c.severity === 'medium');
      
      if (highSeverityConflicts.length > 0) {
        level = 'high';
        warnings.push(...highSeverityConflicts.map(c => c.details));
      } else if (mediumSeverityConflicts.length > 0) {
        level = 'medium';
        warnings.push(...mediumSeverityConflicts.map(c => c.details));
      }
    }
    
    // Check attendee count
    if (previewData.attendeeCount && previewData.attendeeCount > 20) {
      factors.push('Large attendee count');
      level = 'high';
      warnings.push(`Event has ${previewData.attendeeCount} attendees`);
    } else if (previewData.attendeeCount && previewData.attendeeCount > 5) {
      factors.push('Multiple attendees');
      if (level === 'low') level = 'medium';
    }
    
    // Check for deletion action
    if (params.action === 'delete') {
      factors.push('Irreversible deletion');
      level = 'high';
      warnings.push('Event deletion cannot be undone');
    }
    
    // Check duration
    const duration = previewData.duration;
    if (duration.includes('hour') && parseInt(duration) > 4) {
      factors.push('Long duration meeting');
      if (level === 'low') level = 'medium';
    }
    
    // If no risk factors, ensure we have at least basic factors
    if (factors.length === 0) {
      factors.push('Standard calendar operation');
    }
    
    return {
      level,
      factors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Calculate duration between two times
   */
  private calculateDuration(startTime: string, endTime: string): string {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end.getTime() - start.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes} minutes`;
    }
    
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    
    if (minutes === 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    }
    
    return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minutes`;
  }

  /**
   * Format date for display
   */
  private formatDate(dateString?: string): string {
    if (!dateString) return 'unspecified time';
    
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  }

  /**
   * Estimate execution time for different operations
   */
  private estimateExecutionTime(action: string): string {
    switch (action) {
      case 'create':
        return '3-7 seconds';
      case 'update':
        return '2-5 seconds';
      case 'delete':
        return '1-3 seconds';
      default:
        return '1-5 seconds';
    }
  }

  /**
   * Create a new calendar event
   */
  private async createEvent(
    parameters: CalendarAgentRequest, 
    calendarService: CalendarService
  ): Promise<CalendarAgentResponse> {
    if (!parameters.summary || !parameters.start || !parameters.end) {
      throw this.createError('Summary, start time, and end time are required to create an event', 'MISSING_REQUIRED_FIELDS');
    }

    const calendarEvent: CalendarEvent = {
      summary: parameters.summary,
      description: parameters.description,
      start: {
        dateTime: parameters.start,
        timeZone: 'America/Los_Angeles' // TODO: Make timezone configurable
      },
      end: {
        dateTime: parameters.end,
        timeZone: 'America/Los_Angeles'
      },
      location: parameters.location
    };

    // Add attendees if provided
    if (parameters.attendees && parameters.attendees.length > 0) {
      calendarEvent.attendees = parameters.attendees.map(email => ({
        email,
        responseStatus: 'needsAction'
      }));
    }

    const event = await calendarService.createEvent(
      calendarEvent, 
      parameters.accessToken,
      parameters.calendarId
    );

    return {
      success: true,
      message: `Event "${parameters.summary}" created successfully`,
      data: { event }
    };
  }

  /**
   * List calendar events
   */
  private async listEvents(
    parameters: CalendarAgentRequest, 
    calendarService: CalendarService
  ): Promise<CalendarAgentResponse> {
    const options = {
      timeMin: parameters.timeMin,
      timeMax: parameters.timeMax,
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime' as const
    };

    const events = await calendarService.getEvents(
      parameters.accessToken,
      options,
      parameters.calendarId
    );

    return {
      success: true,
      message: `Found ${events.length} events`,
      data: { events }
    };
  }

  /**
   * Update an existing calendar event
   */
  private async updateEvent(
    parameters: CalendarAgentRequest, 
    calendarService: CalendarService
  ): Promise<CalendarAgentResponse> {
    if (!parameters.eventId) {
      throw this.createError('Event ID is required to update an event', 'MISSING_EVENT_ID');
    }

    const updateData: Partial<CalendarEvent> = {};
    
    if (parameters.summary) updateData.summary = parameters.summary;
    if (parameters.description) updateData.description = parameters.description;
    if (parameters.location) updateData.location = parameters.location;
    
    if (parameters.start) {
      updateData.start = {
        dateTime: parameters.start,
        timeZone: 'America/Los_Angeles'
      };
    }
    
    if (parameters.end) {
      updateData.end = {
        dateTime: parameters.end,
        timeZone: 'America/Los_Angeles'
      };
    }

    if (parameters.attendees) {
      updateData.attendees = parameters.attendees.map(email => ({
        email,
        responseStatus: 'needsAction'
      }));
    }

    const event = await calendarService.updateEvent(
      parameters.eventId,
      updateData,
      parameters.accessToken,
      parameters.calendarId
    );

    return {
      success: true,
      message: `Event updated successfully`,
      data: { event }
    };
  }

  /**
   * Delete a calendar event
   */
  private async deleteEvent(
    parameters: CalendarAgentRequest, 
    calendarService: CalendarService
  ): Promise<CalendarAgentResponse> {
    if (!parameters.eventId) {
      throw this.createError('Event ID is required to delete an event', 'MISSING_EVENT_ID');
    }

    await calendarService.deleteEvent(
      parameters.eventId,
      parameters.accessToken,
      parameters.calendarId
    );

    return {
      success: true,
      message: `Event deleted successfully`,
      data: {}
    };
  }

  /**
   * Check availability for a specific time slot
   */
  private async checkAvailability(
    parameters: CalendarAgentRequest, 
    calendarService: CalendarService
  ): Promise<CalendarAgentResponse> {
    if (!parameters.start || !parameters.end) {
      throw this.createError('Start and end times are required to check availability', 'MISSING_TIME_RANGE');
    }

    const availability = await calendarService.checkAvailability(
      parameters.accessToken,
      parameters.start,
      parameters.end,
      parameters.calendarId ? [parameters.calendarId] : ['primary']
    );

    const message = availability.busy 
      ? `Time slot is busy with ${availability.conflicts.length} conflict(s)`
      : 'Time slot is available';

    return {
      success: true,
      message,
      data: { availability }
    };
  }

  /**
   * Find available time slots
   */
  private async findAvailableSlots(
    parameters: CalendarAgentRequest, 
    calendarService: CalendarService
  ): Promise<CalendarAgentResponse> {
    if (!parameters.start || !parameters.end || !parameters.duration) {
      throw this.createError('Start time, end time, and duration are required to find available slots', 'MISSING_PARAMETERS');
    }

    const slots = await calendarService.findAvailableSlots(
      parameters.accessToken,
      parameters.start,
      parameters.end,
      parameters.duration,
      parameters.calendarId ? [parameters.calendarId] : ['primary']
    );

    return {
      success: true,
      message: `Found ${slots.length} available time slot(s)`,
      data: { slots }
    };
  }
}