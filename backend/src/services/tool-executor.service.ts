import logger from '../utils/logger';
import { emailAgent } from '../agents/email.agent';
import { contactAgent } from '../agents/contact.agent';
import { ContactAgent } from '../agents/contact.agent';
import { 
  ToolCall, 
  ToolResult, 
  ToolExecutionContext,
  ToolExecutionError,
  TOOL_NAMES 
} from '../types/tools';

export interface ToolExecutorConfig {
  timeout?: number;
  retryCount?: number;
}

export class ToolExecutorService {
  private config: ToolExecutorConfig;

  constructor(config: ToolExecutorConfig = {}) {
    this.config = {
      timeout: config.timeout || 30000, // 30 seconds
      retryCount: config.retryCount || 1
    };
    logger.info('ToolExecutorService initialized', { config: this.config });
  }

  /**
   * Execute a single tool call
   */
  async executeTool(
    toolCall: ToolCall, 
    context: ToolExecutionContext,
    accessToken?: string
  ): Promise<ToolResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Executing tool: ${toolCall.name}`, { 
        toolName: toolCall.name, 
        sessionId: context.sessionId 
      });

      let result: any;
      let success = true;
      let error: string | undefined;

      switch (toolCall.name) {
        case TOOL_NAMES.EMAIL_AGENT:
          result = await this.executeEmailAgent(toolCall, accessToken);
          break;

        case TOOL_NAMES.THINK:
          result = await this.executeThink(toolCall);
          break;

        case TOOL_NAMES.CONTACT_AGENT:
          result = await this.executeContactAgent(toolCall, accessToken);
          break;

        case TOOL_NAMES.CALENDAR_AGENT:
          result = await this.executeCalendarAgent(toolCall);
          break;

        case TOOL_NAMES.CONTENT_CREATOR:
          result = await this.executeContentCreator(toolCall);
          break;

        case TOOL_NAMES.TAVILY:
          result = await this.executeTavily(toolCall);
          break;

        default:
          throw new ToolExecutionError(
            toolCall.name,
            new Error(`Unknown tool: ${toolCall.name}`)
          );
      }

      // Check if the tool execution was successful
      if (result && typeof result === 'object' && 'success' in result) {
        success = result.success;
        if (!success && result.error) {
          error = result.error;
        }
      }

      const executionTime = Date.now() - startTime;

      const toolResult: ToolResult = {
        toolName: toolCall.name,
        result,
        success,
        error,
        executionTime
      };

      logger.info(`Tool execution completed: ${toolCall.name}`, { 
        success, 
        executionTime,
        hasError: !!error 
      });

      return toolResult;

    } catch (err) {
      const executionTime = Date.now() - startTime;
      const error = err instanceof Error ? err.message : 'Unknown error occurred';
      
      logger.error(`Tool execution failed: ${toolCall.name}`, { 
        error, 
        executionTime,
        sessionId: context.sessionId 
      });

      return {
        toolName: toolCall.name,
        result: null,
        success: false,
        error,
        executionTime
      };
    }
  }

  /**
   * Execute multiple tool calls sequentially
   */
  async executeTools(
    toolCalls: ToolCall[], 
    context: ToolExecutionContext,
    accessToken?: string
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    
    logger.info(`Executing ${toolCalls.length} tools`, { 
      sessionId: context.sessionId,
      tools: toolCalls.map(tc => tc.name) 
    });

    for (const toolCall of toolCalls) {
      try {
        const result = await this.executeTool(toolCall, context, accessToken);
        results.push(result);

        // If a critical tool fails, we might want to stop execution
        if (!result.success && this.isCriticalTool(toolCall.name)) {
          logger.warn(`Critical tool failed, stopping execution: ${toolCall.name}`);
          break;
        }

      } catch (error) {
        logger.error(`Failed to execute tool: ${toolCall.name}`, error);
        results.push({
          toolName: toolCall.name,
          result: null,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          executionTime: 0
        });
      }
    }

    return results;
  }

  /**
   * Execute email agent
   */
  private async executeEmailAgent(toolCall: ToolCall, accessToken?: string): Promise<any> {
    if (!accessToken) {
      return {
        success: false,
        message: 'Access token required for email operations',
        error: 'MISSING_ACCESS_TOKEN'
      };
    }

    // Format contacts from contact agent if provided
    let formattedContacts = toolCall.parameters.contacts;
    if (toolCall.parameters.contactResults) {
      // Convert contact agent results to the format email agent expects
      formattedContacts = ContactAgent.formatContactsForAgent(toolCall.parameters.contactResults);
    }

    return await emailAgent.processQuery({
      query: toolCall.parameters.query,
      accessToken,
      contacts: formattedContacts
    });
  }

  /**
   * Execute think tool (analysis/reasoning)
   */
  private async executeThink(toolCall: ToolCall): Promise<any> {
    // Think tool provides reasoning and analysis
    const query = toolCall.parameters.query;
    
    // For now, this is a simple implementation
    // In a real system, this might use an LLM for reasoning
    return {
      success: true,
      message: `Analyzed: ${query}`,
      analysis: `The request "${query}" has been analyzed and appropriate actions have been taken.`,
      reasoning: 'Based on the user input, the correct tools were identified and executed.',
      recommendations: [
        'Verify the results of the executed actions',
        'Check for any follow-up actions needed',
        'Confirm with user if the request was fulfilled'
      ]
    };
  }

  /**
   * Execute contact agent
   */
  private async executeContactAgent(toolCall: ToolCall, accessToken?: string): Promise<any> {
    if (!accessToken) {
      return {
        success: false,
        message: 'Access token required for contact operations',
        error: 'MISSING_ACCESS_TOKEN'
      };
    }

    return await contactAgent.processQuery({
      query: toolCall.parameters.query,
      operation: toolCall.parameters.operation
    }, accessToken);
  }

  /**
   * Execute calendar agent (placeholder)
   */
  private async executeCalendarAgent(toolCall: ToolCall): Promise<any> {
    // Placeholder for calendar agent
    logger.info('Calendar agent execution (placeholder)', { query: toolCall.parameters.query });
    
    return {
      success: false,
      message: 'Calendar agent not yet implemented',
      error: 'NOT_IMPLEMENTED'
    };
  }

  /**
   * Execute content creator (placeholder)
   */
  private async executeContentCreator(toolCall: ToolCall): Promise<any> {
    // Placeholder for content creator
    logger.info('Content creator execution (placeholder)', { query: toolCall.parameters.query });
    
    return {
      success: false,
      message: 'Content creator not yet implemented',
      error: 'NOT_IMPLEMENTED'
    };
  }

  /**
   * Execute Tavily search (placeholder)
   */
  private async executeTavily(toolCall: ToolCall): Promise<any> {
    // Placeholder for Tavily search
    logger.info('Tavily search execution (placeholder)', { query: toolCall.parameters.query });
    
    return {
      success: false,
      message: 'Tavily search not yet implemented',
      error: 'NOT_IMPLEMENTED'
    };
  }

  /**
   * Determine if a tool is critical for the workflow
   */
  private isCriticalTool(toolName: string): boolean {
    const criticalTools = [
      TOOL_NAMES.EMAIL_AGENT,
      TOOL_NAMES.CALENDAR_AGENT,
      TOOL_NAMES.CONTACT_AGENT
    ];
    
    return criticalTools.includes(toolName as any);
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(results: ToolResult[]): {
    total: number;
    successful: number;
    failed: number;
    averageExecutionTime: number;
    totalExecutionTime: number;
  } {
    const total = results.length;
    const successful = results.filter(r => r.success).length;
    const failed = total - successful;
    const totalExecutionTime = results.reduce((sum, r) => sum + (r.executionTime || 0), 0);
    const averageExecutionTime = total > 0 ? totalExecutionTime / total : 0;

    return {
      total,
      successful,
      failed,
      averageExecutionTime,
      totalExecutionTime
    };
  }
}

// Export singleton instance
export const toolExecutorService = new ToolExecutorService();