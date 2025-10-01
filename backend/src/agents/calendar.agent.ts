/**
 * Calendar SubAgent - Calendar management using BaseSubAgent architecture
 * 
 * Implements the Generic SubAgent design pattern for calendar operations:
 * - 3-phase workflow (Intent Assessment, Tool Execution, Response Formatting)
 * - Direct integration with CalendarDomainService
 * - Natural language interface
 * - Tool-to-service mapping using unified ToolRegistry
 */

import { BaseSubAgent, AgentCapabilities } from '../framework/base-subagent';
import { ToolRegistry } from '../framework/tool-registry';
import { GenericAIService } from '../services/generic-ai.service';
import { CalendarDomainService } from '../services/domain/calendar-domain.service';
import { ErrorFactory } from '../errors/error-factory';

export class CalendarAgent extends BaseSubAgent {
  private calendarService: CalendarDomainService;

  constructor(calendarService: CalendarDomainService, aiService: GenericAIService) {
    super('calendar', aiService, {
      name: 'CalendarSubAgent',
      description: 'Calendar management sub-agent for creating, updating, and managing calendar events',
      enabled: true,
      timeout: 30000,
      retryCount: 3,
    });

    // Store injected domain service
    this.calendarService = calendarService;
  }

  /**
   * Get available tools from the unified registry
   */
  protected getAvailableTools(): string[] {
    return ToolRegistry.getToolNamesForDomain('calendar');
  }

  /**
   * Tool-to-service method mapping using registry
   */
  protected getToolToServiceMap(): Record<string, string> {
    const tools = ToolRegistry.getToolsForDomain('calendar');
    const mapping: Record<string, string> = {};
    
    for (const tool of tools) {
      mapping[tool.name] = tool.serviceMethod;
    }
    
    return mapping;
  }

  /**
   * Get the calendar domain service
   */
  protected getService(): CalendarDomainService {
    return this.calendarService;
  }

  /**
   * Execute tool call by mapping to calendar service method
   */
  protected async executeToolCall(toolName: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const serviceMethod = this.getToolToServiceMap()[toolName];
    if (!serviceMethod) {
      throw ErrorFactory.domain.serviceError('CalendarAgent', `Unknown calendar tool: ${toolName}`);
    }

    const { userId, ...serviceParams } = params;
    if (!userId) {
      throw ErrorFactory.api.badRequest('userId is required for calendar operations');
    }

    // TypeScript will enforce that service[serviceMethod] exists
    const service = this.getService();

    try {
      // Handle different method signatures
      switch (toolName) {
        case 'get_event':
          return await service.getEvent(serviceParams.eventId as string, serviceParams.calendarId as string) as unknown as Record<string, unknown>;
        case 'delete_event':
          return await service.deleteEvent(userId as string, serviceParams.eventId as string, serviceParams.calendarId as string) as unknown as Record<string, unknown>;
        case 'list_calendars':
          return await service.listCalendars(userId as string) as unknown as Record<string, unknown>;
        default: {
          // Most methods follow the pattern: method(userId, params)
          const method = (service as unknown as Record<string, (userId: string, params: Record<string, unknown>) => Promise<unknown>>)[serviceMethod];
          if (!method) {
            throw ErrorFactory.domain.serviceError('CalendarAgent', `Method ${serviceMethod} not found on CalendarDomainService`);
          }
          return await method(userId as string, serviceParams) as Record<string, unknown>;
        }
      }
    } catch (error) {
      throw ErrorFactory.domain.serviceError('CalendarAgent', `Calendar ${toolName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get agent capabilities for discovery using registry
   */
  getCapabilityDescription(): AgentCapabilities {
    const tools = ToolRegistry.getToolsForDomain('calendar');
    const examples = tools.flatMap(tool => tool.examples);
    
    return {
      name: 'CalendarSubAgent',
      description: 'Comprehensive calendar management including event creation, scheduling, and availability checking',
      operations: tools.map(tool => tool.name),
      requiresAuth: true,
      requiresConfirmation: tools.some(tool => tool.requiresConfirmation),
      isCritical: tools.some(tool => tool.isCritical),
      examples: examples.slice(0, 5), // Limit to 5 examples
    };
  }

}