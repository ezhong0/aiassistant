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
import { ToolExecutionContext } from '../framework/tool-execution';
import { DomainServiceResolver } from '../services/domain/dependency-injection/domain-service-container';
import { IDomainService } from '../services/domain/interfaces/base-domain.interface';
import { ICalendarDomainService } from '../services/domain/interfaces/calendar-domain.interface';

export class CalendarAgent extends BaseSubAgent {
  private calendarService: ICalendarDomainService;

  constructor() {
    super('calendar', {
      name: 'CalendarSubAgent',
      description: 'Calendar management sub-agent for creating, updating, and managing calendar events',
      enabled: true,
      timeout: 30000,
      retryCount: 3
    });

    // Get existing domain service from container
    this.calendarService = DomainServiceResolver.getCalendarService();
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
  protected getService(): IDomainService {
    return this.calendarService;
  }

  /**
   * Execute tool call by mapping to calendar service method
   */
  protected async executeToolCall(toolName: string, params: any): Promise<any> {
    const serviceMethod = this.getToolToServiceMap()[toolName];
    if (!serviceMethod) {
      throw new Error(`Unknown calendar tool: ${toolName}`);
    }

    const { userId, ...serviceParams } = params;
    if (!userId) {
      throw new Error('userId is required for calendar operations');
    }

    // TypeScript will enforce that service[serviceMethod] exists
    const service = this.getService() as ICalendarDomainService;
    
    try {
      // Handle different method signatures
      switch (toolName) {
        case 'get_event':
          return await service.getEvent(serviceParams.eventId, serviceParams.calendarId);
        case 'delete_event':
          return await service.deleteEvent(userId, serviceParams.eventId, serviceParams.calendarId);
        case 'list_calendars':
          return await service.listCalendars(userId);
        default:
          // Most methods follow the pattern: method(userId, params)
          return await (service as any)[serviceMethod](userId, serviceParams);
      }
    } catch (error) {
      throw new Error(`Calendar ${toolName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      examples: examples.slice(0, 5) // Limit to 5 examples
    };
  }

}